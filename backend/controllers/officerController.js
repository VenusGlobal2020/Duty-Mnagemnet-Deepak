const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const Officer = require('../models/Officer');
const Duty = require('../models/Duty');
const { successResponse, errorResponse, paginateQuery } = require('../utils/response');
const { createNotification } = require('../utils/notificationService');
const { notifyDutyRejected } = require('../utils/whatsapp');

// @desc   Get officer's active duties
// @route  GET /api/officer/duties/active
const getActiveDuties = asyncHandler(async (req, res) => {
  const officer = await Officer.findOne({ userRef: req.user._id });
  if (!officer) return errorResponse(res, 404, 'Officer profile not found');

  // $elemMatch ensures officerRef AND status are checked on the SAME assignment
  // entry. Without it, Mongo matches if ANY entry has this officerRef and ANY
  // entry (possibly a different officer's) has a live status — so a duty stayed
  // in this officer's "active" list even after THEY had rejected it, as long as
  // some other officer on the same duty was still assigned/accepted.
  const duties = await Duty.find({
    status: 'active',
    assignedOfficers: {
      $elemMatch: { officerRef: officer._id, status: { $in: ['assigned', 'accepted'] } }
    }
  })
    .populate('assignedOfficers.rankRef', 'name code color')
    .populate('operatorRef', 'name phone')
    .sort({ startDate: 1 });

  return successResponse(res, 200, 'Active duties fetched', { duties });
});

// @desc   Get officer's duty history
// @route  GET /api/officer/duties/history
const getDutyHistory = asyncHandler(async (req, res) => {
  const officer = await Officer.findOne({ userRef: req.user._id });
  if (!officer) return errorResponse(res, 404, 'Officer profile not found');

  const { page, limit } = req.query;

  // Show ALL duties this officer was ever part of:
  // 1. Completed / cancelled duties (any assignment status)
  // 2. Active duties where the officer's own slot was rejected or replaced
  // Currently-active assignments (assigned/accepted) are shown in OfficerDuties, not here.
  const query = {
    $or: [
      {
        'assignedOfficers.officerRef': officer._id,
        status: { $in: ['completed', 'cancelled'] }
      },
      {
        assignedOfficers: {
          $elemMatch: {
            officerRef: officer._id,
            status: { $in: ['rejected', 'replaced'] }
          }
        }
      }
    ]
  };

  const result = await paginateQuery(Duty, query, page, limit,
    [{ path: 'operatorRef', select: 'name' }], { createdAt: -1 }
  );

  // Attach this officer's personal assignment status to each duty record
  const duties = result.data.map(duty => {
    const myAssignment = duty.assignedOfficers?.find(
      a => a.officerRef?.toString() === officer._id.toString()
    );
    const plain = duty.toObject ? duty.toObject() : { ...duty };
    return {
      ...plain,
      myAssignmentStatus: myAssignment?.status || 'unknown',
      myRejectionReason: myAssignment?.rejectionReason || null
    };
  });

  return successResponse(res, 200, 'Duty history fetched', { ...result, data: duties });
});

// @desc   Reject a duty assignment
// @route  PATCH /api/officer/duties/:dutyId/reject
const rejectDuty = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  if (!reason || reason.trim().length < 5) {
    return errorResponse(res, 400, 'Rejection reason required (min 5 characters)');
  }

  const officer = await Officer.findOne({ userRef: req.user._id });
  if (!officer) return errorResponse(res, 404, 'Officer profile not found');

  const duty = await Duty.findOne({
    _id: req.params.dutyId,
    status: 'active',
    'assignedOfficers.officerRef': officer._id
  });
  if (!duty) return errorResponse(res, 404, 'Duty not found or not assigned to you');

  const assignment = duty.assignedOfficers.find(
    a => a.officerRef.toString() === officer._id.toString() && a.status === 'accepted'
  );
  if (!assignment) return errorResponse(res, 400, 'Assignment not found or already rejected');

  assignment.status = 'rejected';
  assignment.rejectionReason = reason;
  assignment.rejectedAt = new Date();
  duty.timeline.push({
    action: 'OFFICER_REJECTED',
    performedBy: req.user._id,
    note: `Officer rejected: ${reason}`
  });

  await duty.save();

  // Update officer stats
  await Officer.findByIdAndUpdate(officer._id, { $inc: { totalDutiesRejected: 1 } });

  // Notify the operator — portal (in-app + push) AND WhatsApp, so the operator
  // can act on it immediately even if they aren't looking at the portal.
  const operator = await User.findById(duty.operatorRef);
  if (operator) {
    await createNotification({
      recipientId: operator._id,
      title: 'Duty Rejected by Officer',
      body: `${officer.name} rejected duty: ${duty.dutyName}. Reason: ${reason}`,
      type: 'duty_rejected', relatedDuty: duty._id, sendPush: true
    });
    if (operator.phone) {
      await notifyDutyRejected(operator.phone, operator.name, officer.name, duty.dutyName, reason);
    }
  }

  return successResponse(res, 200, 'Duty rejected. Operator has been notified.');
});

// @desc   Get officer's own profile
// @route  GET /api/officer/profile
const getOfficerProfile = asyncHandler(async (req, res) => {
  const officer = await Officer.findOne({ userRef: req.user._id })
    .populate('rankRef', 'name code color priority')
    .populate('adminRef', 'name email phone');
  if (!officer) return errorResponse(res, 404, 'Profile not found');
  return successResponse(res, 200, 'Profile fetched', { officer });
});

// @desc   Get duty details (officer view)
// @route  GET /api/officer/duties/:dutyId
const getDutyDetails = asyncHandler(async (req, res) => {
  const officer = await Officer.findOne({ userRef: req.user._id });
  if (!officer) return errorResponse(res, 404, 'Officer profile not found');

  const duty = await Duty.findOne({
    _id: req.params.dutyId,
    'assignedOfficers.officerRef': officer._id
  })
    .populate('assignedOfficers.rankRef', 'name code color')
    .populate('operatorRef', 'name phone');

  if (!duty) return errorResponse(res, 404, 'Duty not found');
  return successResponse(res, 200, 'Duty details fetched', { duty });
});

module.exports = { getActiveDuties, getDutyHistory, rejectDuty, getOfficerProfile, getDutyDetails };