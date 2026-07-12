const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const User = require('../models/User');
const Officer = require('../models/Officer');
const Rank = require('../models/Rank');
const LeaveRequest = require('../models/LeaveRequest');
const LeaveBalance = require('../models/LeaveBalance');
const LeaveDayLock = require('../models/LeaveDayLock');
const { successResponse, errorResponse, paginateQuery } = require('../utils/response');
const { createNotification } = require('../utils/notificationService');
const { notifyLeaveDecision } = require('../utils/whatsapp');
const { todayISTStr, dateOnlyUTC } = require('../utils/dateIST');
const engine = require('../utils/leaveEngine');

const LEAVE_TYPE_LABELS = {
  casual: 'Casual Leave', earned: 'Earned Leave', emergency: 'Emergency Leave',
  medical: 'Medical Leave', maternity: 'Maternity Leave', childcare: 'Child Care Leave',
};

const populateFields = [
  { path: 'officerRef', select: 'name phone badgeNumber thana zone rankRef', populate: { path: 'rankRef', select: 'name code color' } },
  { path: 'applicantRef', select: 'name email role' },
  { path: 'rankRef', select: 'name code color' },
  { path: 'decidedBy', select: 'name role' },
];

// ─── OFFICER: request leave ──────────────────────────────────────────────────
// @route POST /api/officer/leaves
const requestLeave = asyncHandler(async (req, res) => {
  const { leaveType, fromDate, toDate, remark } = req.body;
  if (!leaveType || !fromDate || !toDate) {
    return errorResponse(res, 400, 'leaveType, fromDate and toDate are required');
  }
  if (![...engine.REGULAR_TYPES, ...engine.SPECIAL_TYPES].includes(leaveType)) {
    return errorResponse(res, 400, 'Invalid leave type');
  }

  const leaveCategory = engine.leaveCategoryOf(leaveType);

  let totalDays;
  try {
    totalDays = engine.validateLeaveWindow(fromDate, toDate, leaveCategory);
  } catch (e) {
    return errorResponse(res, e.statusCode || 400, e.message);
  }
  const from = dateOnlyUTC(fromDate);
  const to = dateOnlyUTC(toDate);

  // ─── Admin applicant — always routes straight to their superadmin. No
  // balance tracking and no threshold-lock check apply to an admin's own leave. ──
  if (req.user.role === 'admin') {
    try {
      await engine.assertNoOverlap(req.user._id, from, to);
    } catch (e) {
      return errorResponse(res, e.statusCode || 400, e.message);
    }

    const routing = await engine.determineApprover({ applicantUser: req.user, officer: null, rank: null, leaveType, totalDays });

    const leave = await LeaveRequest.create({
      officerRef: null,
      applicantRef: req.user._id,
      applicantRole: 'admin',
      adminRef: req.user._id,
      superadminRef: req.user.superadminRef,
      leaveType, leaveCategory,
      fromDate: from, toDate: to, totalDays,
      remark: remark || '',
      document: req.file ? { url: req.file.path, publicId: req.file.filename, originalName: req.file.originalname } : undefined,
      approverLevel: routing.approverLevel,
      eligibleApprovers: routing.eligibleApprovers,
      timeline: [{ action: 'REQUESTED', performedBy: req.user._id }],
    });

    for (const approverId of routing.eligibleApprovers) {
      await createNotification({
        recipientId: approverId,
        title: 'New Leave Request',
        body: `${req.user.name} (Admin) requested ${LEAVE_TYPE_LABELS[leaveType]} (${totalDays} day${totalDays > 1 ? 's' : ''})`,
        type: 'leave_requested',
      });
    }

    return successResponse(res, 201, 'Leave request submitted', { leave });
  }

  // ─── Officer applicant ──────────────────────────────────────────────────────
  const officer = await Officer.findOne({ userRef: req.user._id }).populate('rankRef');
  if (!officer) return errorResponse(res, 404, 'Officer profile not found');
  if (officer.status !== 'active') return errorResponse(res, 400, 'Only active officers can request leave');

  try {
    await engine.assertNoOverlap(req.user._id, from, to);
    await engine.assertSufficientBalance(officer, leaveType, totalDays, from.getUTCFullYear());
  } catch (e) {
    return errorResponse(res, e.statusCode || 400, e.message);
  }

  // Threshold lock check — only applies to officer leave (staffing %).
  const blockingLocks = await engine.getBlockingLocksForRange(officer.adminRef, from, to);
  if (blockingLocks.length > 0) {
    return errorResponse(
      res, 423,
      `Leave requests are currently locked for ${blockingLocks.map(l => l.date).join(', ')} — too many officers are already on leave. Ask your admin to unlock before applying.`,
      { lockedDates: blockingLocks.map(l => l.date) }
    );
  }

  let routing;
  try {
    routing = await engine.determineApprover({
      applicantUser: req.user, officer, rank: officer.rankRef, leaveType, totalDays,
    });
  } catch (e) {
    return errorResponse(res, e.statusCode || 400, e.message);
  }

  const leave = await LeaveRequest.create({
    officerRef: officer._id,
    applicantRef: req.user._id,
    applicantRole: 'officer',
    rankRef: officer.rankRef?._id || null,
    rankTierAtRequest: officer.rankRef?.leaveTier || null,
    thanaAtRequest: officer.thana || null,
    zoneAtRequest: officer.zone || null,
    adminRef: officer.adminRef,
    superadminRef: officer.superadminRef,
    leaveType, leaveCategory,
    fromDate: from, toDate: to, totalDays,
    remark: remark || '',
    document: req.file ? { url: req.file.path, publicId: req.file.filename, originalName: req.file.originalname } : undefined,
    approverLevel: routing.approverLevel,
    eligibleApprovers: routing.eligibleApprovers,
    routingFallback: routing.routingFallback,
    routingNote: routing.routingNote,
    timeline: [{ action: 'REQUESTED', performedBy: req.user._id, note: routing.routingNote || undefined }],
  });

  for (const approverId of routing.eligibleApprovers) {
    await createNotification({
      recipientId: approverId,
      title: 'New Leave Request',
      body: `${officer.name} requested ${LEAVE_TYPE_LABELS[leaveType]} (${totalDays} day${totalDays > 1 ? 's' : ''})`,
      type: 'leave_requested',
    });
  }

  return successResponse(res, 201, 'Leave request submitted', { leave });
});

// ─── OFFICER: my leaves ──────────────────────────────────────────────────────
// @route GET /api/officer/leaves
const getMyLeaves = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status } = req.query;
  const query = { applicantRef: req.user._id };
  if (status) query.status = status;
  const result = await paginateQuery(LeaveRequest, query, page, limit, populateFields, { createdAt: -1 });
  return successResponse(res, 200, 'Leaves fetched', result);
});

// ─── OFFICER: my leave balance ───────────────────────────────────────────────
// @route GET /api/officer/leaves/balance
const getMyLeaveBalance = asyncHandler(async (req, res) => {
  const officer = await Officer.findOne({ userRef: req.user._id });
  if (!officer) return errorResponse(res, 404, 'Officer profile not found');
  const year = parseInt(req.query.year, 10) || new Date().getFullYear();
  const bal = await engine.getOrCreateBalance(officer, year);
  return successResponse(res, 200, 'Balance fetched', {
    year,
    casual: { allocated: bal.casual.allocated, used: bal.casual.used, remaining: engine.remainingBalance(bal, 'casual') },
    earned: { allocated: bal.earned.allocated, used: bal.earned.used, remaining: engine.remainingBalance(bal, 'earned') },
  });
});

// ─── OFFICER/ADMIN: cancel own pending or future-dated approved leave ────────
// @route PATCH /api/officer/leaves/:id/cancel  (also mounted for admin)
const cancelMyLeave = asyncHandler(async (req, res) => {
  const leave = await LeaveRequest.findOne({ _id: req.params.id, applicantRef: req.user._id });
  if (!leave) return errorResponse(res, 404, 'Leave request not found');
  if (!['pending', 'approved'].includes(leave.status)) {
    return errorResponse(res, 400, `Cannot cancel a ${leave.status} leave request`);
  }
  if (leave.status === 'approved' && dateOnlyUTC(todayISTStr()).getTime() >= dateOnlyUTC(leave.fromDate).getTime()) {
    return errorResponse(res, 400, 'This leave has already started. Contact your admin to cancel it.');
  }

  const wasApproved = leave.status === 'approved';
  leave.status = 'cancelled';
  leave.timeline.push({ action: 'CANCELLED', performedBy: req.user._id });
  if (wasApproved) await engine.reverseApprovalSideEffects(leave);
  await leave.save();

  return successResponse(res, 200, 'Leave request cancelled', { leave });
});

// ─── SHARED: pending approvals for the current decider ──────────────────────
// Works identically whether the decider is an officer acting as Inspector/DSP,
// an admin, or a superadmin — eligibleApprovers is always scoped correctly
// at request time by utils/leaveEngine.determineApprover.
// @route GET /api/{officer|admin|superadmin}/leaves/approvals
const getPendingApprovals = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const query = { eligibleApprovers: req.user._id, status: 'pending' };
  const result = await paginateQuery(LeaveRequest, query, page, limit, populateFields, { createdAt: 1 });
  return successResponse(res, 200, 'Pending approvals fetched', result);
});

// ─── SHARED: approve / reject ────────────────────────────────────────────────
// @route PATCH /api/{officer|admin|superadmin}/leaves/:id/decide  body: { decision: 'approve'|'reject', note }
const decideLeave = asyncHandler(async (req, res) => {
  const { decision, note } = req.body;
  if (!['approve', 'reject'].includes(decision)) {
    return errorResponse(res, 400, "decision must be 'approve' or 'reject'");
  }

  const leave = await LeaveRequest.findById(req.params.id).populate('officerRef');
  if (!leave) return errorResponse(res, 404, 'Leave request not found');
  if (leave.status !== 'pending') return errorResponse(res, 400, `This request was already ${leave.status}`);

  const isEligible = leave.eligibleApprovers.some((id) => id.toString() === req.user._id.toString());
  if (!isEligible) return errorResponse(res, 403, 'You are not authorized to decide this leave request');

  if (decision === 'approve') {
    // Re-check threshold lock — dates may have become locked since submission.
    if (leave.officerRef) {
      const locks = await engine.getBlockingLocksForRange(leave.adminRef, leave.fromDate, leave.toDate);
      if (locks.length > 0) {
        return errorResponse(
          res, 423,
          `Cannot approve — ${locks.map(l => l.date).join(', ')} are locked due to high leave volume. An admin must unlock first.`,
          { lockedDates: locks.map(l => l.date) }
        );
      }
      // Re-verify balance is still sufficient at decision time.
      if (engine.REGULAR_TYPES.includes(leave.leaveType)) {
        try {
          await engine.assertSufficientBalance(leave.officerRef, leave.leaveType, leave.totalDays, new Date(leave.fromDate).getFullYear());
        } catch (e) {
          return errorResponse(res, e.statusCode || 400, e.message);
        }
      }
    }

    leave.status = 'approved';
    leave.decidedBy = req.user._id;
    leave.decidedAt = new Date();
    leave.decisionNote = note || '';
    leave.timeline.push({ action: 'APPROVED', performedBy: req.user._id, note });
    const { conflicts } = await engine.applyApprovalSideEffects(leave);
    await leave.save();

    await notifyApplicantOfDecision(leave, 'Approved', req.user, note);
    return successResponse(res, 200, 'Leave approved', { leave, conflicts });
  }

  // reject
  leave.status = 'rejected';
  leave.decidedBy = req.user._id;
  leave.decidedAt = new Date();
  leave.decisionNote = note || '';
  leave.timeline.push({ action: 'REJECTED', performedBy: req.user._id, note });
  await leave.save();

  await notifyApplicantOfDecision(leave, 'Rejected', req.user, note);
  return successResponse(res, 200, 'Leave rejected', { leave });
});

const notifyApplicantOfDecision = async (leave, decisionLabel, decider, note) => {
  const applicant = await User.findById(leave.applicantRef).select('name phone');
  const dateLabel = `${dateOnlyUTC(leave.fromDate).toISOString().slice(0, 10)} to ${dateOnlyUTC(leave.toDate).toISOString().slice(0, 10)}`;
  await createNotification({
    recipientId: leave.applicantRef,
    title: `Leave ${decisionLabel}`,
    body: `Your ${LEAVE_TYPE_LABELS[leave.leaveType]} request (${dateLabel}) was ${decisionLabel.toLowerCase()} by ${decider.name}.`,
    type: decisionLabel === 'Approved' ? 'leave_approved' : 'leave_rejected',
  });
  // WhatsApp — final decision only, to keep cost down.
  if (applicant?.phone) {
    try {
      await notifyLeaveDecision(applicant.phone, applicant.name, LEAVE_TYPE_LABELS[leave.leaveType], dateLabel, decisionLabel, decider.name, note);
    } catch (e) {
      console.error('Leave decision WhatsApp failed:', e.message);
    }
  }
};

// ─── ADMIN/SUPERADMIN: full visibility of leaves in own hierarchy ───────────
// @route GET /api/admin/leaves  |  GET /api/superadmin/leaves
const getHierarchyLeaves = asyncHandler(async (req, res) => {
  const { page = 1, limit = 15, status, leaveType, search } = req.query;
  const scopeField = req.user.role === 'admin' ? 'adminRef' : 'superadminRef';
  const query = { [scopeField]: req.user._id };
  if (status) query.status = status;
  if (leaveType) query.leaveType = leaveType;

  if (search && search.trim()) {
    const officerIds = await Officer.find({
      [scopeField]: req.user._id,
      name: { $regex: search.trim(), $options: 'i' },
    }).select('_id');
    query.officerRef = { $in: officerIds.map((o) => o._id) };
  }

  const result = await paginateQuery(LeaveRequest, query, page, limit, populateFields, { createdAt: -1 });
  return successResponse(res, 200, 'Leaves fetched', result);
});

// ─── ADMIN: threshold lock management ────────────────────────────────────────
// @route GET /api/admin/leaves/locks
const getLeaveLocks = asyncHandler(async (req, res) => {
  const locks = await LeaveDayLock.find({ adminRef: req.user._id, isUnlocked: false }).sort({ date: 1 });
  return successResponse(res, 200, 'Locks fetched', { locks, thresholdPercent: engine.getThresholdPercent() });
});

// @route GET /api/superadmin/leaves/locks (read-only visibility for superadmin)
const getLeaveLocksForSuperadmin = asyncHandler(async (req, res) => {
  const admins = await User.find({ superadminRef: req.user._id, role: 'admin' }).select('_id name');
  const locks = await LeaveDayLock.find({ adminRef: { $in: admins.map((a) => a._id) }, isUnlocked: false }).sort({ date: 1 });
  const adminNameMap = Object.fromEntries(admins.map((a) => [a._id.toString(), a.name]));
  return successResponse(res, 200, 'Locks fetched', {
    locks: locks.map((l) => ({ ...l.toObject(), adminName: adminNameMap[l.adminRef.toString()] })),
    thresholdPercent: engine.getThresholdPercent(),
  });
});

// @route PATCH /api/admin/leaves/locks/:id/unlock
const unlockLeaveDay = asyncHandler(async (req, res) => {
  const lock = await LeaveDayLock.findOne({ _id: req.params.id, adminRef: req.user._id });
  if (!lock) return errorResponse(res, 404, 'Lock not found');
  lock.isUnlocked = true;
  lock.unlockedBy = req.user._id;
  lock.unlockedAt = new Date();
  lock.unlockNote = req.body?.note || '';
  await lock.save();
  return successResponse(res, 200, 'Date unlocked — leave requests can be submitted for this date again', { lock });
});

// ─── OFFICER (Inspector rank): thana leave overview ─────────────────────────
// "show all leave info to inspector of their staff of that thana"
// @route GET /api/officer/leaves/thana-overview
const getThanaOverview = asyncHandler(async (req, res) => {
  const officer = await Officer.findOne({ userRef: req.user._id }).populate('rankRef');
  if (!officer) return errorResponse(res, 404, 'Officer profile not found');
  if (officer.rankRef?.leaveApprovalRole !== 'inspector') {
    return errorResponse(res, 403, 'Only an Inspector can view the thana leave overview');
  }
  if (!officer.thana) return errorResponse(res, 400, 'Your posting (thana) is not set');

  const staffIds = await Officer.find({ adminRef: officer.adminRef, thana: officer.thana }).select('_id');
  const { page = 1, limit = 20, status } = req.query;
  const query = { officerRef: { $in: staffIds.map((o) => o._id) } };
  if (status) query.status = status;
  const result = await paginateQuery(LeaveRequest, query, page, limit, populateFields, { createdAt: -1 });
  return successResponse(res, 200, 'Thana leave overview fetched', { ...result, thana: officer.thana });
});

// ─── OFFICER (DSP rank): zone leave overview + balance maintenance ──────────
// "dsp of their zone maintain the leave count and balance"
// @route GET /api/officer/leaves/zone-overview
const getZoneOverview = asyncHandler(async (req, res) => {
  const officer = await Officer.findOne({ userRef: req.user._id }).populate('rankRef');
  if (!officer) return errorResponse(res, 404, 'Officer profile not found');
  if (officer.rankRef?.leaveApprovalRole !== 'dsp') {
    return errorResponse(res, 403, 'Only a DSP can view the zone leave overview');
  }
  if (!officer.zone) return errorResponse(res, 400, 'Your posting (zone) is not set');

  const zoneOfficers = await Officer.find({ adminRef: officer.adminRef, zone: officer.zone }).select('_id name badgeNumber rankRef').populate('rankRef', 'name code color');
  const officerIds = zoneOfficers.map((o) => o._id);

  const { page = 1, limit = 20, status } = req.query;
  const query = { officerRef: { $in: officerIds } };
  if (status) query.status = status;
  const result = await paginateQuery(LeaveRequest, query, page, limit, populateFields, { createdAt: -1 });

  const year = new Date().getFullYear();
  const balances = await LeaveBalance.find({ officerRef: { $in: officerIds }, year });
  const balMap = Object.fromEntries(balances.map((b) => [b.officerRef.toString(), b]));
  const balanceSummary = zoneOfficers.map((o) => {
    const bal = balMap[o._id.toString()];
    return {
      officerId: o._id, name: o.name, badgeNumber: o.badgeNumber, rank: o.rankRef,
      casualRemaining: bal ? engine.remainingBalance(bal, 'casual') : engine.getAnnualCasualDays(),
      earnedRemaining: bal ? engine.remainingBalance(bal, 'earned') : engine.getAnnualEarnedDays(),
    };
  });

  return successResponse(res, 200, 'Zone leave overview fetched', { ...result, zone: officer.zone, balanceSummary });
});

// ─── OFFICER (DSP rank): adjust a zone officer's leave balance ──────────────
// @route PATCH /api/officer/leaves/balance/:officerId/adjust  body: { leaveType, days, reason }
const adjustLeaveBalance = asyncHandler(async (req, res) => {
  const officer = await Officer.findOne({ userRef: req.user._id }).populate('rankRef');
  if (!officer || officer.rankRef?.leaveApprovalRole !== 'dsp') {
    return errorResponse(res, 403, 'Only a DSP can adjust leave balances');
  }
  const target = await Officer.findOne({ _id: req.params.officerId, adminRef: officer.adminRef, zone: officer.zone });
  if (!target) return errorResponse(res, 404, 'Officer not found in your zone');

  const { leaveType, days, reason } = req.body;
  if (!['casual', 'earned'].includes(leaveType) || !Number.isFinite(Number(days)) || !reason) {
    return errorResponse(res, 400, 'leaveType, days (number) and reason are required');
  }

  const year = new Date().getFullYear();
  const bal = await engine.getOrCreateBalance(target, year);
  bal.adjustments.push({ leaveType, days: Number(days), reason, adjustedBy: req.user._id });
  await bal.save();

  return successResponse(res, 200, 'Balance adjusted', { balance: bal });
});

module.exports = {
  requestLeave, getMyLeaves, getMyLeaveBalance, cancelMyLeave,
  getPendingApprovals, decideLeave,
  getHierarchyLeaves, getLeaveLocks, getLeaveLocksForSuperadmin, unlockLeaveDay,
  getThanaOverview, getZoneOverview, adjustLeaveBalance,
  LEAVE_TYPE_LABELS,
};