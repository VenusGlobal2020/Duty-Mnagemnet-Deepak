const asyncHandler = require('express-async-handler');
const EmergencyPeriod = require('../models/EmergencyPeriod');
const LeaveRequest = require('../models/LeaveRequest');
const { successResponse, errorResponse, paginateQuery } = require('../utils/response');
const { createNotification, bulkNotify } = require('../utils/notificationService');
const { getAllUserIdsUnderSuperadmin, resolveSuperadminIdForUser } = require('../utils/emergencyEngine');
const engine = require('../utils/leaveEngine');
const { dateOnlyUTC } = require('../utils/dateIST');

const fmt = (d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

// @route  POST /api/superadmin/emergency
// @desc   Declare an Emergency Lockdown: broadcasts to the whole hierarchy,
//         cancels every currently-approved leave overlapping the window, and
//         (via leaveController.requestLeave + utils/emergencyEngine) forces
//         any new request for these dates straight to the superadmin.
const declareEmergency = asyncHandler(async (req, res) => {
  const { reason, startDate, endDate } = req.body;
  if (!reason?.trim() || !startDate || !endDate) {
    return errorResponse(res, 400, 'reason, startDate and endDate are required');
  }

  const start = dateOnlyUTC(startDate);
  const end = dateOnlyUTC(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return errorResponse(res, 400, 'Invalid startDate or endDate');
  }
  if (end.getTime() < start.getTime()) {
    return errorResponse(res, 400, 'endDate cannot be before startDate');
  }

  const existingActive = await EmergencyPeriod.findOne({ superadminRef: req.user._id, status: 'active' });
  if (existingActive) {
    return errorResponse(res, 400, 'An Emergency Lockdown is already active. End it before declaring a new one.');
  }

  const emergency = await EmergencyPeriod.create({
    superadminRef: req.user._id,
    reason: reason.trim(),
    startDate: start,
    endDate: end,
    status: 'active',
    createdBy: req.user._id,
    timeline: [{ action: 'DECLARED', performedBy: req.user._id, note: reason.trim() }],
  });

  // Cancel every approved leave in this hierarchy that overlaps the window —
  // reverseApprovalSideEffects restores balance + officer availability,
  // exactly like a normal self-cancel would.
  const affected = await LeaveRequest.find({
    superadminRef: req.user._id,
    status: 'approved',
    fromDate: { $lte: end },
    toDate: { $gte: start },
  });

  for (const leave of affected) {
    leave.status = 'cancelled';
    leave.emergencyPeriodRef = emergency._id;
    leave.timeline.push({
      action: 'CANCELLED',
      performedBy: req.user._id,
      note: `Auto-cancelled — Emergency Lockdown declared ("${reason.trim()}")`,
    });
    await engine.reverseApprovalSideEffects(leave);
    await leave.save();

    await createNotification({
      recipientId: leave.applicantRef,
      title: 'Leave Cancelled — Emergency Lockdown',
      body: `Your approved leave (${fmt(leave.fromDate)} – ${fmt(leave.toDate)}) has been cancelled due to an Emergency Lockdown: "${reason.trim()}".`,
      type: 'leave_cancelled',
    });
  }

  emergency.cancelledLeavesCount = affected.length;
  await emergency.save();

  // Broadcast to every admin, operator and officer under this superadmin.
  const recipientIds = await getAllUserIdsUnderSuperadmin(req.user._id);
  await bulkNotify(
    recipientIds,
    '🚨 Emergency Lockdown Declared',
    `${reason.trim()} — From ${fmt(start)} to ${fmt(end)}, no leave may be approved for these dates except directly by the Superadmin.${affected.length ? ` ${affected.length} previously-approved leave request(s) covering this window have been cancelled.` : ''}`,
    'emergency_declared',
    null,
    true
  );

  return successResponse(res, 201, 'Emergency Lockdown declared', {
    emergency,
    cancelledLeavesCount: affected.length,
    broadcastCount: recipientIds.length,
  });
});

// @route  PATCH /api/superadmin/emergency/:id/end
// @desc   End an active Emergency Lockdown early. Leave requests already
//         force-routed to the superadmin stay in the approvals queue as
//         normal — only new requests after this point route normally again.
const endEmergency = asyncHandler(async (req, res) => {
  const emergency = await EmergencyPeriod.findOne({ _id: req.params.id, superadminRef: req.user._id });
  if (!emergency) return errorResponse(res, 404, 'Emergency Lockdown not found');
  if (emergency.status !== 'active') return errorResponse(res, 400, `This lockdown is already ${emergency.status}`);

  emergency.status = 'ended';
  emergency.endedBy = 'manual';
  emergency.timeline.push({ action: 'ENDED', performedBy: req.user._id, note: 'Ended early by Superadmin' });
  await emergency.save();

  const recipientIds = await getAllUserIdsUnderSuperadmin(req.user._id);
  await bulkNotify(
    recipientIds,
    '✅ Emergency Lockdown Ended',
    `The Emergency Lockdown ("${emergency.reason}") has ended. Normal leave approval routing has resumed.`,
    'emergency_ended',
    null,
    true
  );

  return successResponse(res, 200, 'Emergency Lockdown ended', { emergency });
});

// @route  GET /api/superadmin/emergency
// @desc   History of this superadmin's emergency periods (active + past).
const getEmergencyHistory = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const result = await paginateQuery(
    EmergencyPeriod,
    { superadminRef: req.user._id },
    page, limit, '', { createdAt: -1 }
  );
  return successResponse(res, 200, 'Emergency Lockdown history fetched', result);
});

// @route  GET /api/emergency/active
// @desc   Shared, any-role check — "is there an emergency lockdown active
//         for my hierarchy right now?" Used to show a persistent banner and
//         to warn officers/admins applying for leave. Returns null, not an
//         error, when there isn't one (or for 'master', who isn't scoped to
//         any single superadmin).
const getActiveEmergency = asyncHandler(async (req, res) => {
  const superadminId = await resolveSuperadminIdForUser(req.user);
  if (!superadminId) return successResponse(res, 200, 'No active emergency', { emergency: null });

  const emergency = await EmergencyPeriod.findOne({ superadminRef: superadminId, status: 'active' });
  return successResponse(res, 200, 'Active emergency fetched', { emergency });
});

module.exports = { declareEmergency, endEmergency, getEmergencyHistory, getActiveEmergency };