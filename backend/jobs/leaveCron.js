const cron = require('node-cron');
const Officer = require('../models/Officer');
const LeaveRequest = require('../models/LeaveRequest');
const EmergencyPeriod = require('../models/EmergencyPeriod');
const { todayISTStr, dateOnlyUTC, enumerateDateStrs } = require('../utils/dateIST');
const { recomputeLocksForRange } = require('../utils/leaveEngine');
const { createNotification, bulkNotify } = require('../utils/notificationService');
const { getAllUserIdsUnderSuperadmin } = require('../utils/emergencyEngine');

// ─── LEAVE LIFECYCLE CRON ────────────────────────────────────────────────────
//   available -> on_leave        the moment an approved leave's fromDate is reached
//   on_leave  -> pending_return  the moment an approved leave's toDate has passed
// 'pending_return' -> 'available' is NEVER done here — only an operator's
// explicit "mark available" action does that (see operatorController.markOfficerAvailable),
// per the requirement that returning officers stay unassignable until cleared.

const flipOfficersStartingLeaveToday = async () => {
  const today = dateOnlyUTC(todayISTStr());
  const startingLeaves = await LeaveRequest.find({
    status: 'approved', fromDate: { $lte: today }, toDate: { $gte: today },
    officerRef: { $ne: null },
  }).select('_id officerRef');

  if (startingLeaves.length === 0) return 0;

  let flipped = 0;
  for (const leave of startingLeaves) {
    const result = await Officer.updateOne(
      { _id: leave.officerRef, dutyAvailability: 'available' },
      { $set: { dutyAvailability: 'on_leave', currentLeaveRef: leave._id } }
    );
    if (result.modifiedCount > 0) flipped++;
  }
  return flipped;
};

const flipOfficersWhoseLeaveEnded = async () => {
  const today = dateOnlyUTC(todayISTStr());
  const officers = await Officer.find({ dutyAvailability: 'on_leave' }).populate('currentLeaveRef');

  let flipped = 0;
  for (const officer of officers) {
    const leave = officer.currentLeaveRef;
    // Leave doc missing or already ended — move to pending_return either way
    // so the officer doesn't stay stuck in 'on_leave' with a dangling reference.
    const ended = !leave || dateOnlyUTC(leave.toDate).getTime() < today.getTime();
    if (ended) {
      officer.dutyAvailability = 'pending_return';
      await officer.save();
      flipped++;
      if (officer.userRef) {
        await createNotification({
          recipientId: officer.userRef,
          title: 'Leave Period Ended',
          body: 'Your leave period has ended. An operator will mark you available for duty shortly.',
          type: 'general',
        });
      }
    }
  }
  return flipped;
};

// Recomputes threshold locks for a rolling window (today .. +60 days) across
// every admin that has at least one leave request touching that window —
// catches drift from officer roster changes, not just new approvals.
const sweepThresholdLocks = async () => {
  const today = dateOnlyUTC(todayISTStr());
  const windowEnd = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000);

  const adminRefs = await LeaveRequest.distinct('adminRef', {
    status: 'approved', fromDate: { $lte: windowEnd }, toDate: { $gte: today },
  });

  for (const adminRef of adminRefs) {
    await recomputeLocksForRange(adminRef, today, windowEnd);
  }
  return adminRefs.length;
};

// Auto-ends any Emergency Lockdown whose endDate has passed, and broadcasts
// the "lockdown ended" notification to that superadmin's whole hierarchy —
// mirrors the manual "End Now" path in emergencyController.endEmergency.
const endExpiredEmergencyPeriods = async () => {
  const now = new Date();
  const expired = await EmergencyPeriod.find({ status: 'active', endDate: { $lt: now } });
  if (expired.length === 0) return 0;

  for (const ep of expired) {
    ep.status = 'ended';
    ep.endedBy = 'auto';
    ep.timeline.push({ action: 'ENDED', performedBy: null, note: 'Emergency period end time reached — automatically ended' });
    await ep.save();

    const recipientIds = await getAllUserIdsUnderSuperadmin(ep.superadminRef);
    await bulkNotify(
      recipientIds,
      '✅ Emergency Lockdown Ended',
      `The Emergency Lockdown ("${ep.reason}") has ended. Normal leave approval routing has resumed.`,
      'emergency_ended',
      null,
      true
    );
  }
  return expired.length;
};

let isRunning = false;

const runLeaveSweep = async () => {
  if (isRunning) return;
  isRunning = true;
  try {
    const started = await flipOfficersStartingLeaveToday();
    const ended = await flipOfficersWhoseLeaveEnded();
    const adminsSwept = await sweepThresholdLocks();
    const emergenciesEnded = await endExpiredEmergencyPeriods();
    if (started || ended || emergenciesEnded) {
      console.log(`[leave-cron] ${new Date().toISOString()} — started: ${started}, ended: ${ended}, locks swept for ${adminsSwept} admin(s), emergency periods auto-ended: ${emergenciesEnded}`);
    }
  } catch (err) {
    console.error('[leave-cron] sweep failed:', err);
  } finally {
    isRunning = false;
  }
};

// Runs every 15 minutes — leave-day transitions don't need minute-level
// precision the way live duty check-in/out does.
const startLeaveCron = () => {
  cron.schedule('*/15 * * * *', runLeaveSweep);
  console.log('🕐 Leave status cron started (runs every 15 minutes)');
  runLeaveSweep();
};

module.exports = { startLeaveCron, runLeaveSweep };
