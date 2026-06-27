const mongoose = require('mongoose');
const asyncHandler = require('express-async-handler');
const Duty = require('../models/Duty');
const Officer = require('../models/Officer');
const User = require('../models/User');
const SwapRequest = require('../models/SwapRequest');
const { successResponse, errorResponse } = require('../utils/response');
const { createNotification } = require('../utils/notificationService');
const {
  notifySwapRequested,
  notifySwapAccepted,
  notifySwapRejected,
  notifySwapExecuted,
  notifySwapRemoved,
  notifySwapCancelled,
} = require('../utils/whatsapp');

// ─────────────────────────────────────────────────────────────────────────────
// OFFICER SWAPS — full audited swap system.
//
// Two ways a swap can happen:
//   1. Officer-initiated: officer on a live duty requests to swap with another
//      officer (e.g. medical emergency). Goes to 'pending'. Operator must
//      accept or reject. Accepting EXECUTES the swap immediately.
//   2. Operator-forced: operator picks any two officers and swaps them right
//      away, no request/approval step needed. Still fully logged as a
//      SwapRequest with status 'executed' for audit purposes.
//
// A swap can be a:
//   - 'move': target officer is currently free → their slot didn't exist
//             anywhere else, so fromOfficer's duty slot is just handed to them.
//   - 'swap': target officer is currently active/assigned on ANOTHER live duty
//             (draft or active) → the two officers fully exchange duties. Both
//             duties' assignedOfficers arrays are updated in the same operation.
//
// Every execution path goes through `executeSwap()` below so the mutation
// logic, locking, and notifications only live in one place.
// ─────────────────────────────────────────────────────────────────────────────

const LIVE_DUTY_STATUSES = ['draft', 'active'];
const LIVE_ASSIGNMENT_STATUSES = ['assigned', 'accepted'];

// Officer is treated as "busy elsewhere" if they hold a live assignment on any
// live duty. Mirrors operatorController.getBusyOfficerIds but also returns
// WHICH duty/assignment, since a true two-way swap needs to mutate that duty too.
const findOfficerLiveAssignment = async (officerId, excludeDutyId = null) => {
  const filter = {
    status: { $in: LIVE_DUTY_STATUSES },
    assignedOfficers: {
      $elemMatch: { officerRef: officerId, status: { $in: LIVE_ASSIGNMENT_STATUSES } },
    },
  };
  if (excludeDutyId) filter._id = { $ne: excludeDutyId };

  const duty = await Duty.findOne(filter);
  if (!duty) return null;

  const assignment = duty.assignedOfficers.find(
    (a) => a.officerRef.toString() === officerId.toString() && LIVE_ASSIGNMENT_STATUSES.includes(a.status)
  );
  if (!assignment) return null;

  return { duty, assignment };
};

// Has this assignment already got an unresolved (pending) swap request against it?
// Prevents two competing swap requests from racing on the same seat.
const hasPendingSwapOnAssignment = async (dutyId, assignmentId) => {
  const existing = await SwapRequest.findOne({
    duty: dutyId,
    fromAssignmentId: assignmentId,
    status: 'pending',
  });
  return !!existing;
};

// ─── Core execution ──────────────────────────────────────────────────────────
// Performs the actual officer swap/move across one or two duties, atomically
// per-duty via re-fetched documents, and writes the audit trail. This is the
// ONLY place that mutates assignedOfficers for a swap, so every swap — whether
// it came from an officer's accepted request or an operator's direct action —
// behaves identically and is logged identically.
//
// Returns the saved SwapRequest doc (status 'executed').
const executeSwap = async ({
  primaryDutyId,
  fromAssignmentId,
  toOfficerId,
  performedByUserId,
  initiatedBy, // 'officer' | 'operator'
  requestedByUserId, // who originally asked (officer for officer-initiated, same as performer for operator-forced)
  reason,
  operatorNote,
  existingSwapRequestDoc = null, // if resolving a pending request, pass it so we update instead of re-creating
}) => {
  // Re-fetch the primary duty fresh, right before mutating, so we're working
  // off the latest state even if time passed between request and decision.
  const primaryDuty = await Duty.findById(primaryDutyId);
  if (!primaryDuty) throw { status: 404, message: 'Duty not found' };
  if (!LIVE_DUTY_STATUSES.includes(primaryDuty.status)) {
    throw { status: 400, message: `Duty is ${primaryDuty.status} — officers can no longer be swapped` };
  }

  const fromAssignment = primaryDuty.assignedOfficers.id(fromAssignmentId);
  if (!fromAssignment) throw { status: 404, message: 'Original assignment not found' };
  if (!LIVE_ASSIGNMENT_STATUSES.includes(fromAssignment.status)) {
    throw { status: 400, message: 'This assignment is no longer active and cannot be swapped' };
  }

  const fromOfficerId = fromAssignment.officerRef.toString();
  if (fromOfficerId === toOfficerId.toString()) {
    throw { status: 400, message: 'Cannot swap an officer with themselves' };
  }

  const toOfficer = await Officer.findOne({ _id: toOfficerId, status: 'active' });
  if (!toOfficer) throw { status: 404, message: 'Target officer not found or inactive' };

  // Both officers must belong to the same admin pool as the duty — officers
  // are shared across operators within an admin, but never across admins.
  if (toOfficer.adminRef.toString() !== primaryDuty.adminRef.toString()) {
    throw { status: 400, message: 'Target officer does not belong to this duty\'s organisation' };
  }

  // Target officer can't already be on THIS duty (any live slot).
  const alreadyOnDuty = primaryDuty.assignedOfficers.some(
    (a) => a.officerRef.toString() === toOfficer._id.toString() && LIVE_ASSIGNMENT_STATUSES.includes(a.status)
  );
  if (alreadyOnDuty) {
    throw { status: 400, message: 'Target officer is already assigned to this duty' };
  }

  // Is the target officer currently busy on a different live duty?
  const targetLive = await findOfficerLiveAssignment(toOfficer._id, primaryDuty._id);

  let mode = 'move';
  let secondaryDuty = null;
  let secondaryAssignment = null;

  if (targetLive) {
    // Target officer is busy elsewhere → this becomes a true two-way swap.
    mode = 'swap';
    secondaryDuty = targetLive.duty;
    secondaryAssignment = targetLive.assignment;

    // Guard against the secondary duty having gone stale/non-live between
    // the lookup above and now (e.g. cron flipped it to completed a moment
    // ago, or it was cancelled).
    if (!LIVE_DUTY_STATUSES.includes(secondaryDuty.status)) {
      throw { status: 409, message: 'Target officer\'s other duty changed status — please retry the swap' };
    }
    if (!LIVE_ASSIGNMENT_STATUSES.includes(secondaryAssignment.status)) {
      throw { status: 409, message: 'Target officer\'s assignment changed — please retry the swap' };
    }
    // fromOfficer obviously can't already be on the secondary duty either.
    const fromAlreadyOnSecondary = secondaryDuty.assignedOfficers.some(
      (a) => a.officerRef.toString() === fromOfficerId && LIVE_ASSIGNMENT_STATUSES.includes(a.status)
    );
    if (fromAlreadyOnSecondary) {
      throw { status: 400, message: 'Officer being swapped in is already assigned to the target officer\'s other duty' };
    }
  }

  const now = new Date();

  // ── Mutate primary duty: fromOfficer's slot → replaced, toOfficer's new slot added
  // IMPORTANT: rankRef on an assignment represents the DUTY SLOT's rank
  // requirement, not the officer's personal rank (matches the existing
  // replaceOfficer/manualReplaceOfficer convention) — so toOfficer inherits
  // fromAssignment.rankRef here, never their own rank or the other duty's slot.
  fromAssignment.status = 'replaced';
  fromAssignment.replacedBy = toOfficer._id;
  fromAssignment.replacedAt = now;

  primaryDuty.assignedOfficers.push({
    officerRef: toOfficer._id,
    rankRef: fromAssignment.rankRef,
    status: 'accepted',
    assignedBy: performedByUserId,
  });

  primaryDuty.timeline.push({
    action: initiatedBy === 'officer' ? 'OFFICER_SWAP_EXECUTED' : 'OFFICER_SWAP_FORCED',
    performedBy: performedByUserId,
    performedAt: now,
    note: mode === 'swap'
      ? `Swapped with officer on another duty (${secondaryDuty.dutyName}). Reason: ${reason || 'N/A'}`
      : `Officer swapped. Reason: ${reason || 'N/A'}`,
  });

  await primaryDuty.save();

  // ── Mutate secondary duty (only if true two-way swap)
  if (secondaryDuty) {
    // Capture secondaryAssignment's rank slot BEFORE we flip its status —
    // it represents duty 2's own slot requirement, independent of duty 1's.
    const secondarySlotRank = secondaryAssignment.rankRef;

    secondaryAssignment.status = 'replaced';
    secondaryAssignment.replacedBy = new mongoose.Types.ObjectId(fromOfficerId);
    secondaryAssignment.replacedAt = now;

    secondaryDuty.assignedOfficers.push({
      officerRef: fromOfficerId,
      rankRef: secondarySlotRank,
      status: 'accepted',
      assignedBy: performedByUserId,
    });

    secondaryDuty.timeline.push({
      action: initiatedBy === 'officer' ? 'OFFICER_SWAP_EXECUTED' : 'OFFICER_SWAP_FORCED',
      performedBy: performedByUserId,
      performedAt: now,
      note: `Swapped with officer on another duty (${primaryDuty.dutyName}). Reason: ${reason || 'N/A'}`,
    });

    await secondaryDuty.save();
  }

  // ── Write / update the SwapRequest audit record
  let swapDoc;
  if (existingSwapRequestDoc) {
    swapDoc = existingSwapRequestDoc;
    swapDoc.status = 'executed';
    swapDoc.mode = mode;
    swapDoc.resolvedBy = performedByUserId;
    swapDoc.resolvedAt = now;
    if (operatorNote) swapDoc.operatorNote = operatorNote;
    if (secondaryDuty) {
      swapDoc.toOfficerCurrentDuty = secondaryDuty._id;
      swapDoc.toOfficerCurrentAssignmentId = targetLive ? targetLive.assignment._id : null;
    }
    await swapDoc.save();
  } else {
    swapDoc = await SwapRequest.create({
      duty: primaryDuty._id,
      fromOfficer: fromOfficerId,
      fromAssignmentId,
      toOfficer: toOfficer._id,
      toOfficerCurrentDuty: secondaryDuty ? secondaryDuty._id : null,
      toOfficerCurrentAssignmentId: secondaryDuty ? targetLive.assignment._id : null,
      mode,
      requestReason: reason,
      operatorNote,
      initiatedBy,
      requestedBy: requestedByUserId,
      status: 'executed',
      resolvedBy: performedByUserId,
      resolvedAt: now,
    });
  }

  // Auto-cancel any OTHER pending swap requests that referenced either seat
  // we just consumed — they're now stale and would corrupt state if acted on.
  const staleFilters = [
    { fromAssignmentId, status: 'pending' },
  ];
  if (secondaryAssignment) {
    staleFilters.push({ fromAssignmentId: secondaryAssignment._id, status: 'pending' });
  }
  const staleRequests = await SwapRequest.find({ $or: staleFilters, _id: { $ne: swapDoc._id } });
  if (staleRequests.length > 0) {
    await SwapRequest.updateMany(
      { _id: { $in: staleRequests.map((s) => s._id) } },
      {
        $set: {
          status: 'cancelled',
          cancelReason: 'Superseded by another swap that already moved this assignment',
          resolvedBy: performedByUserId,
          resolvedAt: now,
        },
      }
    );
  }

  return { swapDoc, primaryDuty, secondaryDuty, fromOfficerId, toOfficer, mode, staleRequests };
};

// Fire-and-forget style notifications after a successful execution. Failures
// here must never roll back the swap itself — the swap already happened and
// is the source of truth; notification delivery is best-effort.
const sendExecutionNotifications = async ({ primaryDuty, secondaryDuty, fromOfficerId, toOfficer, mode, reason, operatorNote, staleRequests = [] }) => {
  try {
    const fromOfficer = await Officer.findById(fromOfficerId);

    // Notify incoming officer about their new duty (primary)
    if (toOfficer.phone) {
      await notifySwapExecuted(
        toOfficer.phone, toOfficer.name, primaryDuty.dutyName,
        primaryDuty.locationName, primaryDuty.startDate, primaryDuty.endDate,
        operatorNote || reason || 'Assigned via swap'
      );
    }
    const toOfficerUser = await User.findOne({ _id: toOfficer.userRef }).select('_id');
    if (toOfficerUser) {
      await createNotification({
        recipientId: toOfficerUser._id,
        title: 'New Duty Assigned (Swap)',
        body: `You have been assigned to duty: ${primaryDuty.dutyName} via officer swap`,
        type: 'swap_executed', relatedDuty: primaryDuty._id,
      });
    }

    if (mode === 'swap' && secondaryDuty && fromOfficer) {
      // The fromOfficer is now assigned to secondaryDuty — notify them.
      if (fromOfficer.phone) {
        await notifySwapExecuted(
          fromOfficer.phone, fromOfficer.name, secondaryDuty.dutyName,
          secondaryDuty.locationName, secondaryDuty.startDate, secondaryDuty.endDate,
          operatorNote || reason || 'Assigned via swap'
        );
      }
      const fromOfficerUser = await User.findOne({ _id: fromOfficer.userRef }).select('_id');
      if (fromOfficerUser) {
        await createNotification({
          recipientId: fromOfficerUser._id,
          title: 'New Duty Assigned (Swap)',
          body: `You have been assigned to duty: ${secondaryDuty.dutyName} via officer swap`,
          type: 'swap_executed', relatedDuty: secondaryDuty._id,
        });
      }
    } else if (fromOfficer) {
      // 'move' mode — fromOfficer is now free, just let them know they were taken off this duty.
      if (fromOfficer.phone) {
        await notifySwapRemoved(
          fromOfficer.phone, fromOfficer.name, primaryDuty.dutyName,
          operatorNote || reason || 'You have been swapped out by the operator'
        );
      }
      const fromOfficerUser = await User.findOne({ _id: fromOfficer.userRef }).select('_id');
      if (fromOfficerUser) {
        await createNotification({
          recipientId: fromOfficerUser._id,
          title: 'Removed From Duty (Swap)',
          body: `You have been swapped out of duty: ${primaryDuty.dutyName}`,
          type: 'swap_executed', relatedDuty: primaryDuty._id,
        });
      }
    }

    // Rare race-condition cleanup: any other officer who had a pending swap
    // request riding on a seat that just got consumed by this execution
    // needs to know their request can no longer go through, so they don't
    // sit waiting on something that will never be approved.
    for (const stale of staleRequests) {
      const staleOfficer = await Officer.findById(stale.fromOfficer);
      if (!staleOfficer) continue;
      if (staleOfficer.phone) {
        await notifySwapRejected(
          staleOfficer.phone, staleOfficer.name,
          (await Duty.findById(stale.duty).select('dutyName'))?.dutyName || 'the duty',
          'Your seat was already moved by another swap before this request could be reviewed'
        );
      }
      const staleOfficerUser = await User.findOne({ _id: staleOfficer.userRef }).select('_id');
      if (staleOfficerUser) {
        await createNotification({
          recipientId: staleOfficerUser._id,
          title: 'Swap Request No Longer Valid',
          body: 'Your swap request was superseded by another swap and can no longer be processed.',
          type: 'swap_cancelled', relatedDuty: stale.duty,
        });
      }
    }
  } catch (err) {
    console.error('[swap] notification dispatch failed (swap itself succeeded):', err.message);
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// OFFICER ENDPOINTS
// ═════════════════════════════════════════════════════════════════════════════

// @desc   Officer requests a swap on one of their own live assignments
// @route  POST /api/officer/swaps/request
// body: { dutyId, toOfficerId, reason }
const requestSwap = asyncHandler(async (req, res) => {
  const { dutyId, toOfficerId, reason } = req.body;
  if (!dutyId || !toOfficerId) return errorResponse(res, 400, 'dutyId and toOfficerId are required');
  if (!reason || reason.trim().length < 5) {
    return errorResponse(res, 400, 'A reason is required (min 5 characters) — e.g. medical emergency');
  }

  const officer = await Officer.findOne({ userRef: req.user._id });
  if (!officer) return errorResponse(res, 404, 'Officer profile not found');

  const duty = await Duty.findOne({ _id: dutyId, status: { $in: LIVE_DUTY_STATUSES } });
  if (!duty) return errorResponse(res, 404, 'Duty not found or not currently active/draft');

  const myAssignment = duty.assignedOfficers.find(
    (a) => a.officerRef.toString() === officer._id.toString() && LIVE_ASSIGNMENT_STATUSES.includes(a.status)
  );
  if (!myAssignment) return errorResponse(res, 404, 'You do not have a live assignment on this duty');

  if (toOfficerId === officer._id.toString()) {
    return errorResponse(res, 400, 'You cannot request a swap with yourself');
  }

  const targetOfficer = await Officer.findOne({ _id: toOfficerId, status: 'active' });
  if (!targetOfficer) return errorResponse(res, 404, 'Target officer not found or inactive');
  if (targetOfficer.adminRef.toString() !== officer.adminRef.toString()) {
    return errorResponse(res, 400, 'Target officer is outside your organisation');
  }

  const alreadyOnDuty = duty.assignedOfficers.some(
    (a) => a.officerRef.toString() === targetOfficer._id.toString() && LIVE_ASSIGNMENT_STATUSES.includes(a.status)
  );
  if (alreadyOnDuty) return errorResponse(res, 400, 'Target officer is already on this duty');

  // One pending request per seat at a time — keeps things unambiguous for the operator.
  if (await hasPendingSwapOnAssignment(duty._id, myAssignment._id)) {
    return errorResponse(res, 409, 'You already have a pending swap request for this duty');
  }

  // Figure out (informationally) whether target is currently busy elsewhere,
  // so the operator sees up front whether accepting will trigger a two-way swap.
  const targetLive = await findOfficerLiveAssignment(targetOfficer._id, duty._id);
  const mode = targetLive ? 'swap' : 'move';

  const swapRequest = await SwapRequest.create({
    duty: duty._id,
    fromOfficer: officer._id,
    fromAssignmentId: myAssignment._id,
    toOfficer: targetOfficer._id,
    toOfficerCurrentDuty: targetLive ? targetLive.duty._id : null,
    toOfficerCurrentAssignmentId: targetLive ? targetLive.assignment._id : null,
    mode,
    requestReason: reason.trim(),
    initiatedBy: 'officer',
    requestedBy: req.user._id,
    status: 'pending',
  });

  duty.timeline.push({
    action: 'OFFICER_SWAP_REQUESTED',
    performedBy: req.user._id,
    note: `${officer.name} requested swap with ${targetOfficer.name}. Reason: ${reason.trim()}`,
  });
  await duty.save();

  // Notify operator — portal + WhatsApp
  const operator = await User.findById(duty.operatorRef);
  if (operator) {
    await createNotification({
      recipientId: operator._id,
      title: 'Swap Request Pending Approval',
      body: `${officer.name} requested to swap out of "${duty.dutyName}" with ${targetOfficer.name}. Reason: ${reason.trim()}`,
      type: 'swap_requested', relatedDuty: duty._id,
    });
    if (operator.phone) {
      await notifySwapRequested(operator.phone, operator.name, officer.name, targetOfficer.name, duty.dutyName, reason.trim());
    }
  }

  return successResponse(res, 201, 'Swap request submitted. Awaiting operator approval.', { swapRequest });
});

// @desc   Officer withdraws their own pending swap request
// @route  PATCH /api/officer/swaps/:swapId/cancel
const cancelMySwapRequest = asyncHandler(async (req, res) => {
  const officer = await Officer.findOne({ userRef: req.user._id });
  if (!officer) return errorResponse(res, 404, 'Officer profile not found');

  const swapRequest = await SwapRequest.findOne({
    _id: req.params.swapId,
    fromOfficer: officer._id,
    initiatedBy: 'officer',
  });
  if (!swapRequest) return errorResponse(res, 404, 'Swap request not found');
  if (swapRequest.status !== 'pending') {
    return errorResponse(res, 400, `Cannot cancel a request that is already ${swapRequest.status}`);
  }

  swapRequest.status = 'cancelled';
  swapRequest.cancelReason = 'Withdrawn by requesting officer';
  swapRequest.resolvedBy = req.user._id;
  swapRequest.resolvedAt = new Date();
  await swapRequest.save();

  const duty = await Duty.findById(swapRequest.duty);
  if (duty) {
    duty.timeline.push({
      action: 'OFFICER_SWAP_CANCELLED',
      performedBy: req.user._id,
      note: `${officer.name} withdrew their swap request`,
    });
    await duty.save();

    // Let the operator know — they may already be reviewing this request.
    const operator = await User.findById(duty.operatorRef);
    if (operator) {
      await createNotification({
        recipientId: operator._id,
        title: 'Swap Request Withdrawn',
        body: `${officer.name} withdrew their swap request for "${duty.dutyName}"`,
        type: 'swap_cancelled', relatedDuty: duty._id,
      });
      if (operator.phone) {
        await notifySwapCancelled(operator.phone, operator.name, officer.name, duty.dutyName);
      }
    }
  }

  return successResponse(res, 200, 'Swap request withdrawn');
});

// @desc   Officer views their own swap requests (any status)
// @route  GET /api/officer/swaps
const getMySwapRequests = asyncHandler(async (req, res) => {
  const officer = await Officer.findOne({ userRef: req.user._id });
  if (!officer) return errorResponse(res, 404, 'Officer profile not found');

  const swaps = await SwapRequest.find({ fromOfficer: officer._id })
    .populate('duty', 'dutyName locationName status startDate endDate')
    .populate('toOfficer', 'name badgeNumber')
    .sort({ createdAt: -1 });

  return successResponse(res, 200, 'Your swap requests fetched', { swaps });
});

// @desc   Officer browses fellow officers (under the same admin) to pick a
//         swap target — flags which ones are currently busy on another
//         duty so the officer knows up front whether picking them will
//         trigger a two-way swap instead of a simple move.
// @route  GET /api/officer/colleagues?search=...
const getSwapColleagues = asyncHandler(async (req, res) => {
  const officer = await Officer.findOne({ userRef: req.user._id });
  if (!officer) return errorResponse(res, 404, 'Officer profile not found');

  const { search } = req.query;
  const filter = {
    adminRef: officer.adminRef,
    status: 'active',
    _id: { $ne: officer._id },
  };
  if (search && search.trim()) {
    filter.$or = [
      { name: { $regex: search.trim(), $options: 'i' } },
      { badgeNumber: { $regex: search.trim(), $options: 'i' } },
    ];
  }

  const colleagues = await Officer.find(filter)
    .select('_id name badgeNumber designation rankRef')
    .populate('rankRef', 'name code color')
    .sort({ name: 1 })
    .limit(200);

  // Mark which colleagues are currently busy on a live duty elsewhere —
  // informational only, doesn't block selection (a busy colleague just
  // means the resulting swap will be a two-way exchange).
  const busyDuties = await Duty.find({
    status: { $in: LIVE_DUTY_STATUSES },
    'assignedOfficers.status': { $in: LIVE_ASSIGNMENT_STATUSES },
  }).select('assignedOfficers');

  const busyIds = new Set();
  for (const d of busyDuties) {
    for (const a of d.assignedOfficers) {
      if (LIVE_ASSIGNMENT_STATUSES.includes(a.status)) busyIds.add(a.officerRef.toString());
    }
  }

  const result = colleagues.map((c) => ({
    _id: c._id,
    name: c.name,
    badgeNumber: c.badgeNumber,
    designation: c.designation,
    rank: c.rankRef,
    currentlyBusy: busyIds.has(c._id.toString()),
  }));

  return successResponse(res, 200, 'Colleagues fetched', { officers: result });
});

// ═════════════════════════════════════════════════════════════════════════════
// OPERATOR ENDPOINTS
// ═════════════════════════════════════════════════════════════════════════════

// @desc   Get all swap requests for duties under this operator (default: pending only)
// @route  GET /api/operator/swaps?status=pending
const getSwapRequests = asyncHandler(async (req, res) => {
  const { status, dutyId } = req.query;

  // Restrict to duties this operator owns.
  const operatorDutyIds = await Duty.find({ operatorRef: req.user._id }).select('_id').lean();
  const dutyIdSet = operatorDutyIds.map((d) => d._id);

  const query = { duty: { $in: dutyIdSet } };
  if (status && status !== 'all') query.status = status;
  else if (!status) query.status = 'pending'; // default view is the actionable queue
  // status=all → no status filter, returns everything
  if (dutyId) query.duty = dutyId;

  const swaps = await SwapRequest.find(query)
    .populate('duty', 'dutyName locationName status startDate endDate')
    .populate('fromOfficer', 'name phone badgeNumber rankRef')
    .populate('toOfficer', 'name phone badgeNumber rankRef')
    .populate('toOfficerCurrentDuty', 'dutyName locationName')
    .populate('requestedBy', 'name role')
    .sort({ createdAt: -1 });

  return successResponse(res, 200, 'Swap requests fetched', { swaps });
});

// @desc   Full swap audit trail for one duty (all statuses)
// @route  GET /api/operator/duties/:dutyId/swaps
const getSwapHistoryForDuty = asyncHandler(async (req, res) => {
  const duty = await Duty.findOne({ _id: req.params.dutyId, operatorRef: req.user._id });
  if (!duty) return errorResponse(res, 404, 'Duty not found');

  const swaps = await SwapRequest.find({ duty: duty._id })
    .populate('fromOfficer', 'name badgeNumber')
    .populate('toOfficer', 'name badgeNumber')
    .populate('toOfficerCurrentDuty', 'dutyName')
    .populate('requestedBy', 'name role')
    .populate('resolvedBy', 'name role')
    .sort({ createdAt: -1 });

  return successResponse(res, 200, 'Swap history fetched', { swaps });
});

// @desc   Operator browses officers to pick as a swap target for a given
//         assignment — unlike getAvailableOfficersByRank, this DOES include
//         officers who are currently busy on another live duty, since
//         picking one of them is valid (it just becomes a two-way swap).
//         Each result is flagged with their current duty, if any.
// @route  GET /api/operator/duties/:dutyId/assignments/:assignmentId/swap-candidates?search=...
const getSwapCandidates = asyncHandler(async (req, res) => {
  const duty = await Duty.findOne({ _id: req.params.dutyId, operatorRef: req.user._id });
  if (!duty) return errorResponse(res, 404, 'Duty not found');

  const assignment = duty.assignedOfficers.id(req.params.assignmentId);
  if (!assignment) return errorResponse(res, 404, 'Assignment not found');

  const { search } = req.query;
  const filter = {
    adminRef: duty.adminRef,
    status: 'active',
    _id: { $ne: assignment.officerRef },
  };
  if (search && search.trim()) {
    filter.$or = [
      { name: { $regex: search.trim(), $options: 'i' } },
      { badgeNumber: { $regex: search.trim(), $options: 'i' } },
    ];
  }

  const officers = await Officer.find(filter)
    .select('_id name phone badgeNumber designation rankRef')
    .populate('rankRef', 'name code color')
    .sort({ name: 1 })
    .limit(200);

  // Already-live officers on THIS duty are not valid candidates at all (no
  // point swapping someone into a duty they're already on).
  const onThisDuty = new Set(
    duty.assignedOfficers
      .filter((a) => LIVE_ASSIGNMENT_STATUSES.includes(a.status))
      .map((a) => a.officerRef.toString())
  );

  const liveDuties = await Duty.find({
    _id: { $ne: duty._id },
    status: { $in: LIVE_DUTY_STATUSES },
    'assignedOfficers.status': { $in: LIVE_ASSIGNMENT_STATUSES },
  }).select('dutyName status assignedOfficers');

  const busyMap = new Map(); // officerId -> { dutyId, dutyName }
  for (const d of liveDuties) {
    for (const a of d.assignedOfficers) {
      if (LIVE_ASSIGNMENT_STATUSES.includes(a.status)) {
        busyMap.set(a.officerRef.toString(), { dutyId: d._id, dutyName: d.dutyName });
      }
    }
  }

  const result = officers
    .filter((o) => !onThisDuty.has(o._id.toString()))
    .map((o) => {
      const busy = busyMap.get(o._id.toString()) || null;
      return {
        _id: o._id,
        name: o.name,
        phone: o.phone,
        badgeNumber: o.badgeNumber,
        designation: o.designation,
        rank: o.rankRef,
        currentlyBusy: !!busy,
        currentDuty: busy, // { dutyId, dutyName } or null — swap UI shows "will swap with X on duty Y"
      };
    });

  return successResponse(res, 200, 'Swap candidates fetched', { officers: result });
});

// @desc   Operator accepts a pending officer-initiated swap request — executes it
// @route  PATCH /api/operator/swaps/:swapId/accept
// body: { operatorNote }
const acceptSwapRequest = asyncHandler(async (req, res) => {
  const { operatorNote } = req.body;

  const swapRequest = await SwapRequest.findById(req.params.swapId);
  if (!swapRequest) return errorResponse(res, 404, 'Swap request not found');
  if (swapRequest.status !== 'pending') {
    return errorResponse(res, 400, `This request is already ${swapRequest.status}`);
  }

  // Ownership check: the duty must belong to this operator.
  const duty = await Duty.findOne({ _id: swapRequest.duty, operatorRef: req.user._id });
  if (!duty) return errorResponse(res, 404, 'Swap request not found for your duties');

  let result;
  try {
    result = await executeSwap({
      primaryDutyId: swapRequest.duty,
      fromAssignmentId: swapRequest.fromAssignmentId,
      toOfficerId: swapRequest.toOfficer,
      performedByUserId: req.user._id,
      initiatedBy: 'officer',
      requestedByUserId: swapRequest.requestedBy,
      reason: swapRequest.requestReason,
      operatorNote,
      existingSwapRequestDoc: swapRequest,
    });
  } catch (err) {
    return errorResponse(res, err.status || 500, err.message || 'Swap could not be executed');
  }

  // Notify requesting officer that their swap was accepted
  const fromOfficer = await Officer.findById(swapRequest.fromOfficer);
  if (fromOfficer) {
    const fromOfficerUser = await User.findOne({ _id: fromOfficer.userRef }).select('_id');
    if (fromOfficerUser) {
      await createNotification({
        recipientId: fromOfficerUser._id,
        title: 'Swap Request Accepted',
        body: `Your swap request for "${result.primaryDuty.dutyName}" was accepted.`,
        type: 'swap_accepted', relatedDuty: result.primaryDuty._id,
      });
    }
    if (fromOfficer.phone) {
      await notifySwapAccepted(fromOfficer.phone, fromOfficer.name, result.primaryDuty.dutyName, 'accepted', operatorNote);
    }
  }

  await sendExecutionNotifications({ ...result, reason: swapRequest.requestReason, operatorNote });

  return successResponse(res, 200, 'Swap request accepted and executed', { swap: result.swapDoc });
});

// @desc   Operator rejects a pending officer-initiated swap request — no mutation
// @route  PATCH /api/operator/swaps/:swapId/reject
// body: { operatorNote }
const rejectSwapRequest = asyncHandler(async (req, res) => {
  const { operatorNote } = req.body;
  if (!operatorNote || operatorNote.trim().length < 3) {
    return errorResponse(res, 400, 'A note/reason is required to reject a swap request');
  }

  const swapRequest = await SwapRequest.findById(req.params.swapId);
  if (!swapRequest) return errorResponse(res, 404, 'Swap request not found');
  if (swapRequest.status !== 'pending') {
    return errorResponse(res, 400, `This request is already ${swapRequest.status}`);
  }

  const duty = await Duty.findOne({ _id: swapRequest.duty, operatorRef: req.user._id });
  if (!duty) return errorResponse(res, 404, 'Swap request not found for your duties');

  swapRequest.status = 'rejected';
  swapRequest.operatorNote = operatorNote.trim();
  swapRequest.resolvedBy = req.user._id;
  swapRequest.resolvedAt = new Date();
  await swapRequest.save();

  duty.timeline.push({
    action: 'OFFICER_SWAP_REJECTED',
    performedBy: req.user._id,
    note: `Swap request rejected. Note: ${operatorNote.trim()}`,
  });
  await duty.save();

  const fromOfficer = await Officer.findById(swapRequest.fromOfficer);
  if (fromOfficer) {
    const fromOfficerUser = await User.findOne({ _id: fromOfficer.userRef }).select('_id');
    if (fromOfficerUser) {
      await createNotification({
        recipientId: fromOfficerUser._id,
        title: 'Swap Request Rejected',
        body: `Your swap request for "${duty.dutyName}" was rejected. Note: ${operatorNote.trim()}`,
        type: 'swap_rejected', relatedDuty: duty._id,
      });
    }
    if (fromOfficer.phone) {
      await notifySwapRejected(fromOfficer.phone, fromOfficer.name, duty.dutyName, operatorNote.trim());
    }
  }

  return successResponse(res, 200, 'Swap request rejected');
});

// @desc   Operator forces a swap directly — no prior officer request needed.
//         Works on any live (draft/active) assignment, including duties that
//         have already started. Handles both 'move' (target free) and
//         'swap' (target busy on another duty) automatically.
// @route  POST /api/operator/duties/:dutyId/assignments/:assignmentId/force-swap
// body: { toOfficerId, reason }
const forceSwap = asyncHandler(async (req, res) => {
  const { toOfficerId, reason } = req.body;
  if (!toOfficerId) return errorResponse(res, 400, 'toOfficerId is required');
  if (!reason || reason.trim().length < 3) {
    return errorResponse(res, 400, 'A reason is required (min 3 characters)');
  }

  const duty = await Duty.findOne({ _id: req.params.dutyId, operatorRef: req.user._id });
  if (!duty) return errorResponse(res, 404, 'Duty not found');

  const assignment = duty.assignedOfficers.id(req.params.assignmentId);
  if (!assignment) return errorResponse(res, 404, 'Assignment not found');

  let result;
  try {
    result = await executeSwap({
      primaryDutyId: duty._id,
      fromAssignmentId: assignment._id,
      toOfficerId,
      performedByUserId: req.user._id,
      initiatedBy: 'operator',
      requestedByUserId: req.user._id,
      reason: reason.trim(),
      operatorNote: reason.trim(),
    });
  } catch (err) {
    return errorResponse(res, err.status || 500, err.message || 'Swap could not be executed');
  }

  await sendExecutionNotifications({ ...result, reason: reason.trim() });

  return successResponse(res, 200, `Officer ${result.mode === 'swap' ? 'swapped' : 'moved'} successfully`, {
    swap: result.swapDoc,
    mode: result.mode,
  });
});

module.exports = {
  // officer
  requestSwap,
  cancelMySwapRequest,
  getMySwapRequests,
  getSwapColleagues,
  // operator
  getSwapRequests,
  getSwapHistoryForDuty,
  getSwapCandidates,
  acceptSwapRequest,
  rejectSwapRequest,
  forceSwap,
};