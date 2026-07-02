const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const Officer = require('../models/Officer');
const Duty = require('../models/Duty');
const Rank = require('../models/Rank');
const Attendance = require('../models/Attendance');
const DutyType = require('../models/DutyType');
const SwapRequest = require('../models/SwapRequest');
const { successResponse, errorResponse, paginateQuery } = require('../utils/response');
const { createNotification, bulkNotify } = require('../utils/notificationService');
const { notifyDutyAssigned, notifyDutyCancelled, notifyDutyUpdated, notifyOfficerReplaced } = require('../utils/whatsapp');
const { cloudinary } = require('../config/cloudinary');

// An officer is "busy" while they hold a live assignment (assigned/accepted) on
// any duty that is still upcoming or ongoing — that means status 'draft' (not
// started yet) or 'active' (currently running). Rejected/replaced assignments
// don't count, and duties that are completed/cancelled don't count either.
// This list is what drives both the availability counters and what the
// auto/manual assignment flows are allowed to pick from — this is what was
// missing before, which is why availability counts never went down after
// officers got assigned.
const getBusyOfficerIds = async (excludeDutyId = null) => {
  const dutyFilter = { status: { $in: ['draft', 'active'] }, 'assignedOfficers.status': { $in: ['assigned', 'accepted'] } };
  if (excludeDutyId) dutyFilter._id = { $ne: excludeDutyId };

  const activeDuties = await Duty.find(dutyFilter).select('assignedOfficers');
  const busy = new Set();
  for (const duty of activeDuties) {
    for (const ao of duty.assignedOfficers) {
      if (['assigned', 'accepted'].includes(ao.status)) {
        busy.add(ao.officerRef.toString());
      }
    }
  }
  return busy;
};

// ─── OFFICER MANAGEMENT ───────────────────────────────────────────────────────

// @desc   Get officers under this operator's admin
// @route  GET /api/operator/officers
const getOfficers = asyncHandler(async (req, res) => {
  const { page, limit, search, rankId, status } = req.query;
  const query = { adminRef: req.user.adminRef };
  if (rankId) query.rankRef = rankId;
  if (status) query.status = status;
  if (search) query.$or = [
    { name: { $regex: search, $options: 'i' } },
    { badgeNumber: { $regex: search, $options: 'i' } }
  ];
  const result = await paginateQuery(Officer, query, page, limit,
    [{ path: 'rankRef', select: 'name code color priority' }, { path: 'userRef', select: 'email status lastLogin' }]
  );
  return successResponse(res, 200, 'Officers fetched', result);
});

// @desc   Add single officer
// @route  POST /api/operator/officers
const addOfficer = asyncHandler(async (req, res) => {
  const { name, email, phone, gender, dateOfBirth, rankId, badgeNumber, designation } = req.body;

  const rank = await Rank.findOne({ _id: rankId, isActive: true });
  if (!rank) return errorResponse(res, 404, 'Rank not found');

  const exists = await User.findOne({ email: email.toLowerCase() });
  if (exists) return errorResponse(res, 409, 'Email already registered');

  const admin = await User.findById(req.user.adminRef);
  const crypto = require('crypto');
  const tempPassword = crypto.randomBytes(6).toString('hex');

  const user = await User.create({
    name, email: email.toLowerCase(), phone, password: phone,
    gender, dateOfBirth, role: 'officer',
    adminRef: req.user.adminRef, superadminRef: admin.superadminRef,
    rankRef: rankId, badgeNumber, designation
  });

  await Officer.create({
    userRef: user._id, adminRef: req.user.adminRef,
    superadminRef: admin.superadminRef,
    name, phone, email: email.toLowerCase(), gender, dateOfBirth,
    rankRef: rankId, badgeNumber, designation
  });

  const { sendWelcomeMessage } = require('../utils/whatsapp');
  await sendWelcomeMessage(phone, name, `Officer (${rank.name})`, email, tempPassword);

  return successResponse(res, 201, 'Officer added', { user: { _id: user._id, name, email, phone } });
});

// @desc   Edit officer
// @route  PUT /api/operator/officers/:officerId
const updateOfficer = asyncHandler(async (req, res) => {
  const { name, phone, gender, dateOfBirth, rankId, badgeNumber, designation, status } = req.body;

  const officer = await Officer.findOne({ _id: req.params.officerId, adminRef: req.user.adminRef });
  if (!officer) return errorResponse(res, 404, 'Officer not found');

  if (rankId) {
    const rank = await Rank.findOne({ _id: rankId, isActive: true });
    if (!rank) return errorResponse(res, 404, 'Rank not found');
    officer.rankRef = rankId;
  }

  if (name) officer.name = name;
  if (phone) officer.phone = phone;
  if (gender) officer.gender = gender;
  if (dateOfBirth) officer.dateOfBirth = dateOfBirth;
  if (badgeNumber !== undefined) officer.badgeNumber = badgeNumber;
  if (designation !== undefined) officer.designation = designation;
  if (status) officer.status = status;

  await officer.save();

  // Sync user record
  const updateData = {};
  if (name) updateData.name = name;
  if (phone) updateData.phone = phone;
  if (rankId) updateData.rankRef = rankId;
  if (status) updateData.status = status;
  await User.findByIdAndUpdate(officer.userRef, updateData);

  return successResponse(res, 200, 'Officer updated', { officer });
});

// @desc   Delete officer
// @route  DELETE /api/operator/officers/:officerId
const deleteOfficer = asyncHandler(async (req, res) => {
  const officer = await Officer.findOne({ _id: req.params.officerId, adminRef: req.user.adminRef });
  if (!officer) return errorResponse(res, 404, 'Officer not found');

  // Check active duties (must match officerRef AND a live status on the SAME
  // assignment entry — without $elemMatch, Mongo would match if any element
  // has this officerRef and any element has a live status, even a different one)
  const activeDuty = await Duty.findOne({
    status: 'active',
    assignedOfficers: { $elemMatch: { officerRef: officer._id, status: { $in: ['assigned', 'accepted'] } } }
  });
  if (activeDuty) return errorResponse(res, 400, 'Officer has active duties. Reassign first.');

  await User.findByIdAndUpdate(officer.userRef, { status: 'inactive' });
  await Officer.findByIdAndDelete(officer._id);

  return successResponse(res, 200, 'Officer deleted');
});

// ─── DUTY MANAGEMENT ──────────────────────────────────────────────────────────

// Helper: assign officers by rank requirements
const assignOfficersByRank = async (rankRequirements, adminRef, excludeOfficerIds = []) => {
  const assigned = [];
  const rankNotAvailable = [];

  const busyIds = await getBusyOfficerIds();
  const excludeSet = new Set([...excludeOfficerIds.map(String), ...busyIds]);

  for (const req of rankRequirements) {
    const { rankRef, count, assignmentType } = req;

    if (assignmentType === 'manual') continue; // skip manual, handled separately

    // Available officers with this rank, not already assigned/busy
    const available = await Officer.find({
      adminRef,
      rankRef,
      status: 'active',
      _id: { $nin: Array.from(excludeSet) }
    }).select('_id userRef name phone');

    if (available.length < count) {
      const rank = await Rank.findById(rankRef).select('name code');
      rankNotAvailable.push({ rankRef, rankName: rank?.name, required: count, available: available.length });
      continue;
    }

    // Random selection
    const shuffled = available.sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, count);

    for (const officer of selected) {
      assigned.push({
        officerRef: officer._id,
        rankRef,
        status: 'accepted',
        assignedBy: null,
      });
      excludeSet.add(officer._id.toString()); // don't double-pick within this same request
    }
  }

  return { assigned, rankNotAvailable };
};

// @desc   Create duty
// @route  POST /api/operator/duties
const createDuty = asyncHandler(async (req, res) => {
  const isSpecial = req.user.role === 'operator_special';
  const {
    dutyName, locationName, lat, lng, startDate, endDate,
    priority, dutyType, description, phoneNumbers,
    rankRequirements, manualAssignments, vehicleNumber,
    dutyTypeRef, shifts,
  } = req.body;

  if (!dutyName || !locationName || !lat || !lng || !startDate || !endDate || !priority) {
    return errorResponse(res, 400, 'Missing required fields');
  }

  if (new Date(startDate) >= new Date(endDate)) {
    return errorResponse(res, 400, 'End date must be after start date');
  }

  if (isSpecial && dutyType && !['VVIP', 'CITY-POINT', 'CRIMINAL'].includes(dutyType)) {
    return errorResponse(res, 400, 'Invalid duty type');
  }

  const admin = await User.findById(req.user.adminRef);

  // Regular operator picked a saved DutyType template instead of manually
  // entering ranks — pull its rankRequirements in as a snapshot. If they
  // instead chose "Other", rankRequirements comes straight from the body
  // exactly like before, untouched.
  let parsedRequirements;
  let resolvedDutyTypeRef = null;
  if (!isSpecial && dutyTypeRef) {
    const template = await DutyType.findOne({ _id: dutyTypeRef, operatorRef: req.user._id, isActive: true });
    if (!template) return errorResponse(res, 404, 'Selected duty type not found');
    parsedRequirements = template.rankRequirements.map(r => ({
      rankRef: r.rankRef, count: r.count, assignmentType: 'auto',
    }));
    resolvedDutyTypeRef = template._id;
  } else {
    parsedRequirements = typeof rankRequirements === 'string'
      ? JSON.parse(rankRequirements) : rankRequirements || [];
  }

  // Shifts only make sense for multi-day duties, but we accept whatever the
  // operator sends — fully dynamic, no fixed set of allowed shift times.
  const parsedShifts = typeof shifts === 'string' ? JSON.parse(shifts) : shifts || [];
  for (const s of parsedShifts) {
    if (!s.label || !s.startTime || !s.endTime) {
      return errorResponse(res, 400, 'Each shift needs a label, start time, and end time');
    }
  }

  // Document uploads handled separately by multer
  const documents = [];
  if (req.files && req.files.length > 0) {
    for (const file of req.files) {
      documents.push({
        url: file.path, publicId: file.filename, originalName: file.originalname
      });
    }
  }

  const parsedPhones = typeof phoneNumbers === 'string'
    ? JSON.parse(phoneNumbers) : phoneNumbers || [];

  // Auto-assign officers
  const { assigned, rankNotAvailable } = await assignOfficersByRank(
    parsedRequirements.filter(r => r.assignmentType !== 'manual'), req.user.adminRef
  );

  // Manual assignments
  const manualAssigned = [];
  const manualUnavailable = [];
  if (manualAssignments) {
    const manuals = typeof manualAssignments === 'string'
      ? JSON.parse(manualAssignments) : manualAssignments;

    const busyIds = await getBusyOfficerIds();
    const pickedInThisRequest = new Set();

    for (const ma of manuals) {
      const officer = await Officer.findOne({ _id: ma.officerId, adminRef: req.user.adminRef, status: 'active' });
      if (!officer) {
        manualUnavailable.push({ officerId: ma.officerId, reason: 'Officer not found' });
        continue;
      }
      if (busyIds.has(officer._id.toString()) || pickedInThisRequest.has(officer._id.toString())) {
        manualUnavailable.push({ officerId: ma.officerId, name: officer.name, reason: 'Officer already on an active duty' });
        continue;
      }
      manualAssigned.push({
        officerRef: officer._id,
        rankRef: officer.rankRef,
        status: 'accepted',
        assignedBy: req.user._id
      });
      pickedInThisRequest.add(officer._id.toString());
    }
  }

  const duty = await Duty.create({
    dutyName, locationName,
    location: { lat: parseFloat(lat), lng: parseFloat(lng) },
    startDate: new Date(startDate), endDate: new Date(endDate),
    priority: parseInt(priority),
    ...(isSpecial && dutyType ? { dutyType } : {}),
    ...(resolvedDutyTypeRef ? { dutyTypeRef: resolvedDutyTypeRef } : {}),
    shifts: parsedShifts,
    description, phoneNumbers: parsedPhones,
    documents, rankRequirements: parsedRequirements,
    assignedOfficers: [...assigned, ...manualAssigned],
    operatorRef: req.user._id,
    adminRef: req.user.adminRef,
    superadminRef: admin.superadminRef,
    vehicleNumber: vehicleNumber || null,
    // Always created as draft — the cron job (jobs/dutyStatusCron.js) flips
    // this to 'active' automatically once startDate is reached.
    status: 'draft',
    timeline: [{ action: 'DUTY_CREATED', performedBy: req.user._id, note: 'Duty created (draft)' }]
  });

  // Populate and notify
  // Include userRef so we can target the correct User document for notifications
  const populated = await Duty.findById(duty._id)
    .populate('assignedOfficers.officerRef', 'name phone userRef')
    .populate('assignedOfficers.rankRef', 'name');

  for (const ao of populated.assignedOfficers) {
    if (ao.officerRef?.phone) {
      await notifyDutyAssigned(ao.officerRef.phone, ao.officerRef.name,
        dutyName, locationName, startDate, endDate);
    }
    // officerRef.userRef IS the User._id — use it directly as recipientId
    if (ao.officerRef?.userRef) {
      await createNotification({
        recipientId: ao.officerRef.userRef,
        title: 'New Duty Assigned',
        body: `You have been assigned to duty: ${dutyName} at ${locationName}`,
        type: 'duty_assigned', relatedDuty: duty._id, sendPush: false
      });
    }
  }

  return successResponse(res, 201, 'Duty created', {
    duty: populated,
    rankNotAvailable: rankNotAvailable.length > 0 ? rankNotAvailable : undefined,
    manualUnavailable: manualUnavailable.length > 0 ? manualUnavailable : undefined
  });
});

// @desc   Get duties (operator sees only their own)
// @route  GET /api/operator/duties
const getDuties = asyncHandler(async (req, res) => {
  const { page, limit, status, search, priority, startDate, endDate } = req.query;
  const query = { operatorRef: req.user._id };
  if (status) query.status = status;
  if (priority) query.priority = parseInt(priority);
  if (search) query.$or = [
    { dutyName: { $regex: search, $options: 'i' } },
    { locationName: { $regex: search, $options: 'i' } }
  ];
  if (startDate || endDate) {
    query.startDate = {};
    if (startDate) query.startDate.$gte = new Date(startDate);
    if (endDate) query.startDate.$lte = new Date(endDate);
  }

  const result = await paginateQuery(Duty, query, page, limit,
    [{ path: 'assignedOfficers.officerRef', select: 'name phone' },
    { path: 'assignedOfficers.rankRef', select: 'name code color' }],
    { createdAt: -1 }
  );
  return successResponse(res, 200, 'Duties fetched', result);
});

// @desc   Get duties for map view (operator's own duties, lean fields only)
// @route  GET /api/operator/duties/map
const getDutiesForMap = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const query = { operatorRef: req.user._id };
  if (status) query.status = status;

  const duties = await Duty.find(query)
    .select('dutyName locationName location status priority startDate endDate assignedOfficers')
    .sort({ createdAt: -1 })
    .limit(500)
    .lean();

  const slim = duties.map(d => ({
    _id: d._id,
    dutyName: d.dutyName,
    locationName: d.locationName,
    location: d.location,
    status: d.status,
    priority: d.priority,
    startDate: d.startDate,
    endDate: d.endDate,
    officersCount: (d.assignedOfficers || []).filter(a => a.status !== 'replaced').length,
  }));

  return successResponse(res, 200, 'Duties fetched', { duties: slim });
});

// @desc   Get single duty
// @route  GET /api/operator/duties/:dutyId
const getDutyById = asyncHandler(async (req, res) => {
  const duty = await Duty.findOne({ _id: req.params.dutyId, operatorRef: req.user._id })
    .populate('assignedOfficers.officerRef', 'name phone badgeNumber')
    .populate('assignedOfficers.rankRef', 'name code color')
    .populate('assignedOfficers.replacedBy', 'name phone badgeNumber')
    .populate('rankRequirements.rankRef', 'name code color')
    .populate('dutyTypeRef', 'name')
    .populate('operatorRef', 'name')
    .populate('timeline.performedBy', 'name role');

  if (!duty) return errorResponse(res, 404, 'Duty not found');

  // Attach attendance records so frontend can show attendance per officer,
  // grouped by calendar date since multi-day duties now track daily records.
  const attendanceRecords = await Attendance.find({ dutyRef: duty._id })
    .populate('officerRef', 'name badgeNumber')
    .sort({ date: 1, checkedInAt: 1 });

  // attendanceMap: officerId -> today's/most-recent record (kept for
  // backward compatibility with older frontend code paths)
  const attendanceMap = {};
  // attendanceByDate: date -> officerId -> record (new, full daily picture)
  const attendanceByDate = {};
  for (const rec of attendanceRecords) {
    if (!rec.officerRef) continue;
    const officerId = rec.officerRef._id.toString();
    const slim = {
      _id: rec._id,
      date: rec.date,
      shiftLabel: rec.shiftLabel,
      checkedInAt: rec.checkedInAt,
      checkedOutAt: rec.checkedOutAt,
      durationMinutes: rec.durationMinutes,
      checkInDistanceMeters: rec.checkInDistanceMeters,
      status: rec.status,
      isWithinRadius: rec.isWithinRadius,
    };
    attendanceMap[officerId] = slim; // last one wins (records sorted by date asc)
    if (!attendanceByDate[rec.date]) attendanceByDate[rec.date] = {};
    attendanceByDate[rec.date][officerId] = slim;
  }

  // Google Maps link to duty location (useful for officers navigating to location)
  const mapsLink = duty.location?.lat && duty.location?.lng
    ? `https://www.google.com/maps/dir/?api=1&destination=${duty.location.lat},${duty.location.lng}`
    : null;

  return successResponse(res, 200, 'Duty fetched', { duty, attendanceMap, attendanceByDate, mapsLink });
});

// @desc   Update duty
// @route  PUT /api/operator/duties/:dutyId
const updateDuty = asyncHandler(async (req, res) => {
  const duty = await Duty.findOne({ _id: req.params.dutyId, operatorRef: req.user._id });
  if (!duty) return errorResponse(res, 404, 'Duty not found');
  // Full editing freedom while the duty is live (draft or active) — only a
  // duty that's already cancelled or fully completed can no longer be touched.
  if (['cancelled', 'completed'].includes(duty.status)) {
    return errorResponse(res, 400, `Cannot update a ${duty.status} duty`);
  }

  const isSpecial = req.user.role === 'operator_special';
  const allowed = ['dutyName', 'locationName', 'lat', 'lng', 'startDate', 'endDate',
    'priority', 'description', 'phoneNumbers', 'status', 'vehicleNumber'];
  if (isSpecial) allowed.push('dutyType');

  const updateData = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updateData[key] = req.body[key];
  }

  const nextStart = updateData.startDate ? new Date(updateData.startDate) : duty.startDate;
  const nextEnd = updateData.endDate ? new Date(updateData.endDate) : duty.endDate;
  if (nextStart >= nextEnd) {
    return errorResponse(res, 400, 'End date must be after start date');
  }

  if (req.body.lat || req.body.lng) {
    updateData.location = {
      lat: parseFloat(req.body.lat || duty.location.lat),
      lng: parseFloat(req.body.lng || duty.location.lng)
    };
    delete updateData.lat; delete updateData.lng;
  }

  // Shifts — fully replaceable at any time.
  if (req.body.shifts !== undefined) {
    const parsedShifts = typeof req.body.shifts === 'string' ? JSON.parse(req.body.shifts) : req.body.shifts;
    for (const s of parsedShifts) {
      if (!s.label || !s.startTime || !s.endTime) {
        return errorResponse(res, 400, 'Each shift needs a label, start time, and end time');
      }
    }
    updateData.shifts = parsedShifts;
  }

  const timelineEntries = [{ action: 'DUTY_UPDATED', performedBy: req.user._id, note: 'Duty details updated' }];
  const newlyAssignedForNotify = [];
  const removedForNotify = [];

  // Rank requirements — full freedom to raise or lower counts even after the
  // duty has started. Raising a rank's count tries to auto-assign more
  // officers immediately; lowering it frees up the most recently assigned
  // officers on that rank (marked 'removed', not deleted, so history stays intact).
  if (req.body.rankRequirements !== undefined) {
    const parsedReqs = typeof req.body.rankRequirements === 'string'
      ? JSON.parse(req.body.rankRequirements) : req.body.rankRequirements;

    for (const r of parsedReqs) {
      if (!r.rankRef || !r.count || r.count < 1) {
        return errorResponse(res, 400, 'Each rank requirement needs a rank and a count of at least 1');
      }
    }

    const busyIds = await getBusyOfficerIds(duty._id);

    for (const req_ of parsedReqs) {
      const targetCount = parseInt(req_.count);
      const rankRef = req_.rankRef.toString();

      const currentForRank = duty.assignedOfficers.filter(
        a => a.rankRef.toString() === rankRef && ['assigned', 'accepted'].includes(a.status)
      );
      const currentCount = currentForRank.length;

      if (targetCount > currentCount) {
        const need = targetCount - currentCount;
        const excludeIds = new Set([
          ...duty.assignedOfficers
            .filter(a => ['assigned', 'accepted'].includes(a.status))
            .map(a => a.officerRef.toString()),
          ...busyIds,
        ]);
        const available = await Officer.find({
          adminRef: req.user.adminRef,
          rankRef,
          status: 'active',
          _id: { $nin: Array.from(excludeIds) },
        }).select('_id name phone userRef').limit(need);

        for (const officer of available) {
          duty.assignedOfficers.push({
            officerRef: officer._id,
            rankRef,
            status: 'accepted',
            assignedBy: req.user._id,
          });
          newlyAssignedForNotify.push(officer);
        }
        if (available.length < need) {
          const rank = await Rank.findById(rankRef).select('name');
          timelineEntries.push({
            action: 'RANK_REQUIREMENT_INCREASED',
            performedBy: req.user._id,
            note: `${rank?.name || 'Rank'} increased to ${targetCount}, but only ${available.length}/${need} additional officer(s) were available`,
          });
        }
      } else if (targetCount < currentCount) {
        const excess = currentCount - targetCount;
        // Remove the most recently assigned first
        const toRemove = [...currentForRank]
          .sort((a, b) => new Date(b.assignedAt) - new Date(a.assignedAt))
          .slice(0, excess);
        for (const assignment of toRemove) {
          const officer = await Officer.findById(assignment.officerRef).select('name phone userRef');
          assignment.status = 'removed';
          if (officer) removedForNotify.push(officer);
        }
      }

      // Sync the requirement's target count on the duty record itself
      const existingReqEntry = duty.rankRequirements.find(rr => rr.rankRef.toString() === rankRef);
      if (existingReqEntry) existingReqEntry.count = targetCount;
      else duty.rankRequirements.push({ rankRef, count: targetCount, assignmentType: 'auto' });
    }

    timelineEntries.push({ action: 'RANK_REQUIREMENTS_UPDATED', performedBy: req.user._id, note: 'Rank requirements adjusted' });
  }

  updateData.timeline = [...duty.timeline, ...timelineEntries];

  // Apply the simple field updates first, then persist the rankRequirements/
  // assignedOfficers array mutations made above via duty.save().
  Object.assign(duty, updateData);
  await duty.save();

  const updated = await Duty.findById(duty._id)
    .populate('assignedOfficers.officerRef', 'name phone')
    .populate('assignedOfficers.rankRef', 'name')
    .populate('rankRequirements.rankRef', 'name code color');

  // Notify assigned officers about general duty changes
  const changes = Object.keys(updateData).filter(k => k !== 'timeline').join(', ');
  if (changes) {
    for (const ao of updated.assignedOfficers) {
      if (ao.officerRef?.phone && ao.status !== 'rejected' && ao.status !== 'removed') {
        await notifyDutyUpdated(ao.officerRef.phone, ao.officerRef.name, duty.dutyName, changes);
      }
    }
  }

  // Notify newly-assigned officers (rank count increase)
  for (const officer of newlyAssignedForNotify) {
    if (officer.phone) {
      await notifyOfficerReplaced(officer.phone, officer.name, duty.dutyName, 'Assigned — additional officers requested by operator');
    }
    if (officer.userRef) {
      await createNotification({
        recipientId: officer.userRef,
        title: 'New Duty Assigned',
        body: `You have been assigned to duty: ${duty.dutyName} at ${duty.locationName}`,
        type: 'duty_assigned', relatedDuty: duty._id, sendPush: false,
      });
    }
  }

  // Notify removed officers (rank count decrease)
  for (const officer of removedForNotify) {
    if (officer.userRef) {
      await createNotification({
        recipientId: officer.userRef,
        title: 'Removed from Duty',
        body: `You have been removed from duty: ${duty.dutyName} — the operator reduced the required officer count.`,
        type: 'duty_updated', relatedDuty: duty._id, sendPush: false,
      });
    }
  }

  return successResponse(res, 200, 'Duty updated', { duty: updated });
});

// @desc   Permanently delete a duty — requires the operator's account password
//         as confirmation. If the password is wrong, nothing is deleted.
// @route  DELETE /api/operator/duties/:dutyId
const deleteDuty = asyncHandler(async (req, res) => {
  const { password } = req.body;
  if (!password) return errorResponse(res, 400, 'Password is required to delete a duty');

  const duty = await Duty.findOne({ _id: req.params.dutyId, operatorRef: req.user._id });
  if (!duty) return errorResponse(res, 404, 'Duty not found');

  const userWithPassword = await User.findById(req.user._id).select('+password');
  const isMatch = await userWithPassword.matchPassword(password);
  if (!isMatch) return errorResponse(res, 401, 'Incorrect password — duty was not deleted');

  await Attendance.deleteMany({ dutyRef: duty._id });
  await SwapRequest.deleteMany({ duty: duty._id });
  await Duty.findByIdAndDelete(duty._id);

  return successResponse(res, 200, 'Duty permanently deleted');
});

// @desc   Cancel duty
// @route  PATCH /api/operator/duties/:dutyId/cancel
const cancelDuty = asyncHandler(async (req, res) => {
  const duty = await Duty.findOne({ _id: req.params.dutyId, operatorRef: req.user._id })
    .populate('assignedOfficers.officerRef', 'name phone');
  if (!duty) return errorResponse(res, 404, 'Duty not found');
  if (duty.status === 'cancelled') return errorResponse(res, 400, 'Already cancelled');

  const { reason } = req.body;

  await Duty.findByIdAndUpdate(duty._id, {
    status: 'cancelled',
    $push: { timeline: { action: 'DUTY_CANCELLED', performedBy: req.user._id, note: reason || 'Cancelled by operator' } }
  });

  // Notify all assigned officers
  for (const ao of duty.assignedOfficers) {
    if (ao.officerRef?.phone && ao.status !== 'rejected') {
      await notifyDutyCancelled(ao.officerRef.phone, ao.officerRef.name, duty.dutyName, reason);
    }
  }

  return successResponse(res, 200, 'Duty cancelled');
});

// @desc   Replace rejected officer randomly
// @route  PATCH /api/operator/duties/:dutyId/replace/:assignmentId
const replaceOfficer = asyncHandler(async (req, res) => {
  const duty = await Duty.findOne({ _id: req.params.dutyId, operatorRef: req.user._id });
  if (!duty) return errorResponse(res, 404, 'Duty not found');
  if (['cancelled', 'completed'].includes(duty.status)) {
    return errorResponse(res, 400, `Cannot change officers on a ${duty.status} duty`);
  }

  const assignment = duty.assignedOfficers.id(req.params.assignmentId);
  if (!assignment) return errorResponse(res, 404, 'Assignment not found');
  if (assignment.status !== 'rejected') return errorResponse(res, 400, 'Can only replace rejected assignments');

  // Find a replacement with same rank — exclude officers on this duty AND
  // officers already busy on any other active duty.
  const currentlyAssigned = duty.assignedOfficers.map(a => a.officerRef.toString());
  const busyIds = await getBusyOfficerIds(duty._id);
  const excludeIds = Array.from(new Set([...currentlyAssigned, ...busyIds]));

  const replacement = await Officer.findOne({
    adminRef: req.user.adminRef,
    rankRef: assignment.rankRef,
    status: 'active',
    _id: { $nin: excludeIds }
  });

  if (!replacement) return errorResponse(res, 404, 'No available officer with required rank');

  // Mark old as replaced
  assignment.status = 'replaced';
  assignment.replacedBy = replacement._id;
  assignment.replacedAt = new Date();

  // Add new assignment
  duty.assignedOfficers.push({
    officerRef: replacement._id,
    rankRef: assignment.rankRef,
    status: 'accepted',
    assignedBy: req.user._id
  });

  duty.timeline.push({ action: 'OFFICER_REPLACED', performedBy: req.user._id });
  await duty.save();

  // Notify new officer
  const officerUser = await User.findOne({ _id: replacement.userRef }).select('_id');
  if (replacement.phone) {
    await notifyOfficerReplaced(replacement.phone, replacement.name, duty.dutyName, 'Previous officer was unavailable');
  }
  if (officerUser) {
    await createNotification({
      recipientId: officerUser._id,
      title: 'New Duty Assigned',
      body: `You have been assigned to duty: ${duty.dutyName}`,
      type: 'duty_assigned', relatedDuty: duty._id, sendPush: false
    });
  }

  return successResponse(res, 200, 'Officer replaced', { replacement: { name: replacement.name, _id: replacement._id } });
});

// @desc   Manually swap any active (non-rejected) assignment with a chosen officer
// @route  PATCH /api/operator/duties/:dutyId/assignments/:assignmentId/manual-replace
const manualReplaceOfficer = asyncHandler(async (req, res) => {
  const { officerId } = req.body;
  if (!officerId) return errorResponse(res, 400, 'officerId is required');

  const duty = await Duty.findOne({ _id: req.params.dutyId, operatorRef: req.user._id });
  if (!duty) return errorResponse(res, 404, 'Duty not found');
  if (!['draft', 'active'].includes(duty.status)) return errorResponse(res, 400, 'Only draft or active duties can be edited');

  const assignment = duty.assignedOfficers.id(req.params.assignmentId);
  if (!assignment) return errorResponse(res, 404, 'Assignment not found');
  if (!['assigned', 'accepted', 'rejected'].includes(assignment.status)) {
    return errorResponse(res, 400, 'This assignment can no longer be changed');
  }

  const newOfficer = await Officer.findOne({ _id: officerId, adminRef: req.user.adminRef, status: 'active' });
  if (!newOfficer) return errorResponse(res, 404, 'Selected officer not found');

  const currentlyAssigned = duty.assignedOfficers
    .filter(a => ['assigned', 'accepted'].includes(a.status))
    .map(a => a.officerRef.toString());
  if (currentlyAssigned.includes(newOfficer._id.toString())) {
    return errorResponse(res, 400, 'Officer is already assigned to this duty');
  }

  const busyIds = await getBusyOfficerIds(duty._id);
  if (busyIds.has(newOfficer._id.toString())) {
    return errorResponse(res, 400, 'Selected officer is already on another active duty');
  }

  const previousStatus = assignment.status;
  assignment.status = 'replaced';
  assignment.replacedBy = newOfficer._id;
  assignment.replacedAt = new Date();

  duty.assignedOfficers.push({
    officerRef: newOfficer._id,
    rankRef: assignment.rankRef,
    status: 'accepted',
    assignedBy: req.user._id
  });

  duty.timeline.push({
    action: 'OFFICER_REPLACED',
    performedBy: req.user._id,
    note: `Manually changed by operator${previousStatus === 'rejected' ? ' (after rejection)' : ''}`
  });
  await duty.save();

  // Notify the newly assigned officer — portal + WhatsApp
  const officerUser = await User.findOne({ _id: newOfficer.userRef }).select('_id');
  if (newOfficer.phone) {
    await notifyOfficerReplaced(newOfficer.phone, newOfficer.name, duty.dutyName, 'Assigned by operator');
  }
  if (officerUser) {
    await createNotification({
      recipientId: officerUser._id,
      title: 'New Duty Assigned',
      body: `You have been assigned to duty: ${duty.dutyName}`,
      type: 'duty_assigned', relatedDuty: duty._id, sendPush: false
    });
  }

  return successResponse(res, 200, 'Officer changed', { replacement: { name: newOfficer.name, _id: newOfficer._id } });
});

// @desc   Get available officers for a given rank (for manual assignment picker)
// @route  GET /api/operator/officers/available?rankId=...&excludeDutyId=...
const getAvailableOfficersByRank = asyncHandler(async (req, res) => {
  const { rankId, excludeDutyId, search } = req.query;
  if (!rankId) return errorResponse(res, 400, 'rankId is required');

  const busyIds = await getBusyOfficerIds(excludeDutyId || null);

  const filter = {
    adminRef: req.user.adminRef,
    rankRef: rankId,
    status: 'active'
  };

  // Server-side search so large officer pools (100k+) do not choke the client
  if (search && search.trim()) {
    filter.$or = [
      { name: { $regex: search.trim(), $options: 'i' } },
      { badgeNumber: { $regex: search.trim(), $options: 'i' } }
    ];
  }

  const officers = await Officer.find(filter)
    .select('_id name phone badgeNumber designation')
    .sort({ name: 1 });

  const available = officers.filter(o => !busyIds.has(o._id.toString()));

  return successResponse(res, 200, 'Available officers fetched', { officers: available });
});

// @desc   Get available ranks with availability count
// @route  GET /api/operator/ranks/availability
const getRankAvailability = asyncHandler(async (req, res) => {
  const ranks = await Rank.find({ isActive: true }).sort({ priority: 1 });
  const result = [];

  const busyIds = await getBusyOfficerIds();

  for (const rank of ranks) {
    const officers = await Officer.find({
      adminRef: req.user.adminRef,
      rankRef: rank._id,
      status: 'active'
    }).select('_id');

    const availableCount = officers.filter(o => !busyIds.has(o._id.toString())).length;
    result.push({ ...rank.toObject(), totalCount: officers.length, availableCount });
  }

  return successResponse(res, 200, 'Rank availability fetched', { ranks: result });
});

module.exports = {
  getOfficers, addOfficer, updateOfficer, deleteOfficer,
  createDuty, getDuties, getDutyById, updateDuty, cancelDuty, deleteDuty,
  replaceOfficer, manualReplaceOfficer, getRankAvailability, getAvailableOfficersByRank,
  getDutiesForMap,
};