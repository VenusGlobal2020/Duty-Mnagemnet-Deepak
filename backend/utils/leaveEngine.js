const User = require('../models/User');
const Officer = require('../models/Officer');
const Rank = require('../models/Rank');
const Duty = require('../models/Duty');
const LeaveRequest = require('../models/LeaveRequest');
const LeaveBalance = require('../models/LeaveBalance');
const LeaveDayLock = require('../models/LeaveDayLock');
const { createNotification, bulkNotify } = require('./notificationService');
const {config} = require('dotenv');
config(); // Load .env variables
const {
  todayISTStr, dateOnlyUTC, inclusiveDayCount, enumerateDateStrs,
  isDateWithinRange,
} = require('./dateIST');

// A plain Error subclass so controllers can tell "bad request" (400) apart
// from unexpected failures (500) without string-matching messages.
class LeaveValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'LeaveValidationError';
    this.statusCode = 400;
  }
}

const REGULAR_TYPES = ['casual', 'earned'];
const SPECIAL_TYPES = ['emergency', 'medical', 'maternity', 'childcare'];

const leaveCategoryOf = (leaveType) => (REGULAR_TYPES.includes(leaveType) ? 'regular' : 'special');

const getThresholdPercent = () => {
  const v = parseFloat(process.env.LEAVE_THRESHOLD_PERCENT);
  return Number.isFinite(v) && v > 0 ? v : 5;
};
const getAnnualCasualDays = () => {
  const v = parseInt(process.env.LEAVE_ANNUAL_CASUAL_DAYS, 10);
  return Number.isFinite(v) && v > 0 ? v : 14;
};
const getAnnualEarnedDays = () => {
  const v = parseInt(process.env.LEAVE_ANNUAL_EARNED_DAYS, 10);
  return Number.isFinite(v) && v > 0 ? v : 10;
};

// ─── Window validation ───────────────────────────────────────────────────────
const validateLeaveWindow = (fromDate, toDate, leaveCategory) => {
  const from = dateOnlyUTC(new Date(fromDate));
  const to = dateOnlyUTC(new Date(toDate));
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new LeaveValidationError('Invalid from/to date');
  }
  if (to.getTime() < from.getTime()) {
    throw new LeaveValidationError('To date cannot be before from date');
  }
  const today = dateOnlyUTC(todayISTStr());
  if (leaveCategory === 'regular' && from.getTime() < today.getTime()) {
    throw new LeaveValidationError('Casual/earned leave cannot be requested for past dates');
  }
  if (leaveCategory === 'special') {
    // Special leave (emergency/medical/maternity/childcare) may be filed
    // slightly after the fact — allow up to 3 days in the past.
    const earliestAllowed = new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000);
    if (from.getTime() < earliestAllowed.getTime()) {
      throw new LeaveValidationError('This leave cannot be backdated more than 3 days. Contact your admin directly for older cases.');
    }
  }
  const totalDays = inclusiveDayCount(from, to);
  if (totalDays > 90) {
    throw new LeaveValidationError('Leave duration looks too long for a single request. Please contact your admin directly.');
  }
  return totalDays;
};

// ─── Duplicate / overlap guard ───────────────────────────────────────────────
const assertNoOverlap = async (applicantRef, fromDate, toDate) => {
  const overlap = await LeaveRequest.findOne({
    applicantRef,
    status: { $in: ['pending', 'approved'] },
    fromDate: { $lte: toDate },
    toDate: { $gte: fromDate },
  });
  if (overlap) {
    throw new LeaveValidationError(
      overlap.status === 'approved'
        ? 'You already have an approved leave overlapping these dates'
        : 'You already have a pending leave request overlapping these dates'
    );
  }
};

// ─── Approver routing ────────────────────────────────────────────────────────
// Finds active officer-Users holding a rank tagged with `approvalRole`
// ('inspector' | 'dsp'), posted at the given thana/zone, under `adminRef`.
const findApprovingOfficerUserIds = async (adminRef, approvalRole, locationField, locationValue) => {
  if (!locationValue) return [];
  const ranks = await Rank.find({ isActive: true, leaveApprovalRole: approvalRole }).select('_id');
  if (ranks.length === 0) return [];
  const rankIds = ranks.map((r) => r._id);
  const query = {
    adminRef, role: 'officer', status: 'active', rankRef: { $in: rankIds },
    [locationField]: locationValue,
  };
  const users = await User.find(query).select('_id');
  return users.map((u) => u._id);
};

/**
 * Determines who must decide a leave request.
 * @returns {Promise<{approverLevel, eligibleApprovers: ObjectId[], routingFallback: boolean, routingNote: string|null}>}
 */
const determineApprover = async ({ applicantUser, officer, rank, leaveType, totalDays }) => {
  const leaveCategory = leaveCategoryOf(leaveType);

  // Admin applicant: everything goes to their own superadmin.
  if (applicantUser.role === 'admin') {
    return {
      approverLevel: 'superadmin',
      eligibleApprovers: [applicantUser.superadminRef],
      routingFallback: false,
      routingNote: null,
    };
  }

  // Officer applicant — special leave always goes straight to superadmin,
  // regardless of rank tier.
  if (leaveCategory === 'special') {
    return {
      approverLevel: 'superadmin',
      eligibleApprovers: [officer.superadminRef],
      routingFallback: false,
      routingNote: null,
    };
  }

  const tier = rank?.leaveTier || 'senior';

  // SI / Inspector / DSP (and any rank not explicitly tagged 'junior'):
  // regular leave always goes to admin.
  if (tier === 'senior') {
    return {
      approverLevel: 'admin',
      eligibleApprovers: [officer.adminRef],
      routingFallback: false,
      routingNote: null,
    };
  }

  // Junior tier (Constable / Head Constable) — duration-based routing.
  let desiredLevel;
  if (leaveType === 'casual') {
    if (totalDays <= 3) desiredLevel = 'inspector';
    else if (totalDays <= 10) desiredLevel = 'dsp';
    else if (totalDays <= 14) desiredLevel = 'admin';
    else throw new LeaveValidationError('Casual leave cannot exceed 14 days in a single request. Please contact your admin directly.');
  } else { // earned
    if (totalDays <= 7) desiredLevel = 'dsp';
    else if (totalDays <= 10) desiredLevel = 'admin';
    else throw new LeaveValidationError('Earned leave cannot exceed 10 days in a single request through this system. Please contact your admin directly.');
  }

  const chain = ['inspector', 'dsp', 'admin'];
  let startIdx = chain.indexOf(desiredLevel);
  let routingFallback = false;
  const notes = [];

  for (let i = startIdx; i < chain.length; i++) {
    const level = chain[i];
    if (level === 'admin') {
      if (i !== startIdx) routingFallback = true;
      return {
        approverLevel: 'admin',
        eligibleApprovers: [officer.adminRef],
        routingFallback,
        routingNote: notes.length ? notes.join('; ') : null,
      };
    }
    const locField = level === 'inspector' ? 'thana' : 'zone';
    const locVal = level === 'inspector' ? officer.thana : officer.zone;
    const found = await findApprovingOfficerUserIds(officer.adminRef, level, locField, locVal);
    if (found.length > 0) {
      return {
        approverLevel: level,
        eligibleApprovers: found,
        routingFallback,
        routingNote: notes.length ? notes.join('; ') : null,
      };
    }
    routingFallback = true;
    notes.push(
      locVal
        ? `No active ${level === 'inspector' ? 'Inspector' : 'DSP'} found for ${locField} "${locVal}" — escalated`
        : `Officer has no ${locField} set — escalated`
    );
  }

  // Should be unreachable (chain always ends in 'admin'), but keep a safe fallback.
  return { approverLevel: 'admin', eligibleApprovers: [officer.adminRef], routingFallback: true, routingNote: notes.join('; ') };
};

// ─── Leave balance ────────────────────────────────────────────────────────────
const getOrCreateBalance = async (officer, year) => {
  let bal = await LeaveBalance.findOne({ officerRef: officer._id, year });
  if (!bal) {
    bal = await LeaveBalance.create({
      officerRef: officer._id,
      adminRef: officer.adminRef,
      year,
      casual: { allocated: getAnnualCasualDays(), used: 0 },
      earned: { allocated: getAnnualEarnedDays(), used: 0 },
    });
  }
  return bal;
};

const remainingBalance = (bal, leaveType) => {
  const bucket = bal[leaveType];
  const adjustTotal = (bal.adjustments || [])
    .filter((a) => a.leaveType === leaveType)
    .reduce((sum, a) => sum + a.days, 0);
  return bucket.allocated + adjustTotal - bucket.used;
};

const assertSufficientBalance = async (officer, leaveType, totalDays, year) => {
  if (!REGULAR_TYPES.includes(leaveType)) return; // special types are not balance-limited
  const bal = await getOrCreateBalance(officer, year);
  const remaining = remainingBalance(bal, leaveType);
  if (totalDays > remaining) {
    throw new LeaveValidationError(
      `Insufficient ${leaveType} leave balance. Remaining: ${remaining} day(s), requested: ${totalDays} day(s).`
    );
  }
};

const deductBalance = async (officer, leaveType, totalDays, year) => {
  if (!REGULAR_TYPES.includes(leaveType)) return;
  await LeaveBalance.updateOne(
    { officerRef: officer._id, year },
    { $inc: { [`${leaveType}.used`]: totalDays } },
    { upsert: false }
  );
};

const restoreBalance = async (officer, leaveType, totalDays, year) => {
  if (!REGULAR_TYPES.includes(leaveType)) return;
  await LeaveBalance.updateOne(
    { officerRef: officer._id, year },
    { $inc: { [`${leaveType}.used`]: -totalDays } }
  );
};

// ─── Threshold lock ───────────────────────────────────────────────────────────
const recomputeLockForDate = async (adminRef, dateStr) => {
  const totalOfficers = await Officer.countDocuments({ adminRef, status: 'active' });
  if (totalOfficers === 0) return { lock: null, newlyLocked: false };

  const dayUTC = dateOnlyUTC(dateStr);
  const onLeaveCount = await LeaveRequest.countDocuments({
    adminRef, status: 'approved',
    fromDate: { $lte: dayUTC }, toDate: { $gte: dayUTC },
  });
  const percent = (onLeaveCount / totalOfficers) * 100;
  const threshold = getThresholdPercent();
  const existing = await LeaveDayLock.findOne({ adminRef, date: dateStr });

  if (percent > threshold) {
    if (existing) {
      existing.totalOfficers = totalOfficers;
      existing.onLeaveCount = onLeaveCount;
      existing.percent = percent;
      existing.thresholdPercent = threshold;
      await existing.save();
      return { lock: existing, newlyLocked: false };
    }
    const created = await LeaveDayLock.create({
      adminRef, date: dateStr, totalOfficers, onLeaveCount, percent, thresholdPercent: threshold, isUnlocked: false,
    });
    return { lock: created, newlyLocked: true };
  }

  // Back under threshold — clear an auto-generated (never-manually-unlocked) lock.
  if (existing && !existing.isUnlocked) {
    await LeaveDayLock.deleteOne({ _id: existing._id });
    return { lock: null, newlyLocked: false };
  }
  return { lock: existing || null, newlyLocked: false };
};

const recomputeLocksForRange = async (adminRef, fromDate, toDate) => {
  const dates = enumerateDateStrs(fromDate, toDate);
  const newlyLockedDates = [];
  for (const d of dates) {
    const { lock, newlyLocked } = await recomputeLockForDate(adminRef, d);
    if (newlyLocked && lock) newlyLockedDates.push(lock);
  }
  if (newlyLockedDates.length > 0) {
    await alertAdminsOfThresholdLock(adminRef, newlyLockedDates);
  }
  return newlyLockedDates;
};

const alertAdminsOfThresholdLock = async (adminRef, lockedDocs) => {
  const admin = await User.findById(adminRef).select('_id superadminRef name');
  if (!admin) return;
  const recipientIds = [admin._id];
  if (admin.superadminRef) recipientIds.push(admin.superadminRef);
  const dateList = lockedDocs.map((l) => `${l.date} (${l.percent.toFixed(1)}%)`).join(', ');
  await bulkNotify(
    recipientIds,
    'Leave Threshold Crossed',
    `Officers on leave exceeded ${lockedDocs[0]?.thresholdPercent}% of total strength on: ${dateList}. New leave requests for these dates are locked until an admin unlocks them.`,
    'leave_threshold_locked',
    null,
    true
  );
};

// Returns the still-locked LeaveDayLock docs (isUnlocked=false) overlapping
// [fromDate, toDate] for this admin — recomputes fresh first so this is
// always accurate at the moment of a new leave submission.
const getBlockingLocksForRange = async (adminRef, fromDate, toDate) => {
  await recomputeLocksForRange(adminRef, fromDate, toDate);
  const dates = enumerateDateStrs(fromDate, toDate);
  return LeaveDayLock.find({ adminRef, date: { $in: dates }, isUnlocked: false }).sort({ date: 1 });
};

// ─── Mid-duty conflict detection ─────────────────────────────────────────────
const findConflictingDuties = async (officer, fromDate, toDate) => {
  const duties = await Duty.find({
    adminRef: officer.adminRef,
    status: { $in: ['draft', 'active'] },
    assignedOfficers: { $elemMatch: { officerRef: officer._id, status: { $in: ['assigned', 'accepted'] } } },
    startDate: { $lte: toDate },
    endDate: { $gte: fromDate },
  });

  const conflicts = [];
  for (const duty of duties) {
    const assignment = duty.assignedOfficers.find(
      (a) => a.officerRef.toString() === officer._id.toString() && ['assigned', 'accepted'].includes(a.status)
    );
    if (assignment) {
      conflicts.push({ dutyRef: duty._id, assignmentId: assignment._id, operatorRef: duty.operatorRef, dutyName: duty.dutyName });
    }
  }
  return conflicts;
};

// ─── Approval side-effects ────────────────────────────────────────────────────
// Called right after a LeaveRequest flips to 'approved'. Handles balance
// deduction, officer availability flip, and mid-duty conflict alerting.
const applyApprovalSideEffects = async (leaveRequest) => {
  if (!leaveRequest.officerRef) return { conflicts: [] }; // admin's own leave — no officer/duty side effects

  const officer = await Officer.findById(leaveRequest.officerRef);
  if (!officer) return { conflicts: [] };

  const year = new Date(leaveRequest.fromDate).getFullYear();
  if (leaveCategoryOf(leaveRequest.leaveType) === 'regular') {
    await deductBalance(officer, leaveRequest.leaveType, leaveRequest.totalDays, year);
    leaveRequest.balanceDeducted = true;
  }

  // Flip availability immediately if the leave has already started (covers today).
  if (isDateWithinRange(leaveRequest.fromDate, leaveRequest.toDate)) {
    officer.dutyAvailability = 'on_leave';
    officer.currentLeaveRef = leaveRequest._id;
    await officer.save();
  }

  const conflicts = await findConflictingDuties(officer, leaveRequest.fromDate, leaveRequest.toDate);
  if (conflicts.length > 0) {
    leaveRequest.conflictingDuties = conflicts.map((c) => ({
      dutyRef: c.dutyRef, assignmentId: c.assignmentId, operatorRef: c.operatorRef, resolved: false,
    }));
    for (const c of conflicts) {
      await createNotification({
        recipientId: c.operatorRef,
        title: 'Officer On Approved Leave — Reassignment Needed',
        body: `${officer.name} has approved leave covering duty "${c.dutyName}". Please reassign this duty slot.`,
        type: 'leave_conflict',
        relatedDuty: c.dutyRef,
      });
    }
  }

  await recomputeLocksForRange(officer.adminRef, leaveRequest.fromDate, leaveRequest.toDate);
  return { conflicts };
};

// Called when an approved leave is cancelled/reversed — restores balance and
// availability. (Rejections never reach here since balance was never deducted.)
const reverseApprovalSideEffects = async (leaveRequest) => {
  if (!leaveRequest.officerRef) return;
  const officer = await Officer.findById(leaveRequest.officerRef);
  if (!officer) return;

  if (leaveRequest.balanceDeducted) {
    const year = new Date(leaveRequest.fromDate).getFullYear();
    await restoreBalance(officer, leaveRequest.leaveType, leaveRequest.totalDays, year);
  }

  if (officer.currentLeaveRef?.toString() === leaveRequest._id.toString()) {
    officer.dutyAvailability = 'available';
    officer.currentLeaveRef = null;
    await officer.save();
  }

  await recomputeLocksForRange(officer.adminRef, leaveRequest.fromDate, leaveRequest.toDate);
};

module.exports = {
  LeaveValidationError,
  REGULAR_TYPES, SPECIAL_TYPES,
  leaveCategoryOf,
  getThresholdPercent, getAnnualCasualDays, getAnnualEarnedDays,
  validateLeaveWindow, assertNoOverlap,
  determineApprover,
  getOrCreateBalance, remainingBalance, assertSufficientBalance, deductBalance, restoreBalance,
  recomputeLockForDate, recomputeLocksForRange, getBlockingLocksForRange,
  findConflictingDuties,
  applyApprovalSideEffects, reverseApprovalSideEffects,
};
