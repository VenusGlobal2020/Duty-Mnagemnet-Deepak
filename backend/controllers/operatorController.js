const asyncHandler = require('express-async-handler');
const xlsx = require('xlsx');
const User = require('../models/User');
const Officer = require('../models/Officer');
const Duty = require('../models/Duty');
const Rank = require('../models/Rank');
const Attendance = require('../models/Attendance');
const DutyType = require('../models/DutyType');
const SwapRequest = require('../models/SwapRequest');
const { successResponse, errorResponse, paginateQuery } = require('../utils/response');
const { createNotification, bulkNotify } = require('../utils/notificationService');
const {
  notifyDutyAssigned, notifyDutyCancelled, notifyDutyUpdated, notifyOfficerReplaced,
  buildOfficersSummary, notifyDutyInfoToNumber, notifyDutyUpdateToNumber,
} = require('../utils/whatsapp');
const { cloudinary } = require('../config/cloudinary');
const { resolveRank, normalizeGender } = require('../utils/rankResolver');

const LeaveRequest = require('../models/LeaveRequest');

// An officer is "busy" while they hold a live assignment (assigned/accepted) on
// any duty that is still upcoming or ongoing — that means status 'draft' (not
// started yet) or 'active' (currently running). Rejected/replaced assignments
// don't count, and duties that are completed/cancelled don't count either.
// This list is what drives both the availability counters and what the
// auto/manual assignment flows are allowed to pick from — this is what was
// missing before, which is why availability counts never went down after
// officers got assigned.
//
// Also leave-aware: officers currently on approved leave or awaiting an
// operator's "mark available" after returning are always excluded, and — when
// dutyDates is supplied — so are officers with ANY approved leave overlapping
// those specific dates (covers duties created in advance, for a future window).
const getBusyOfficerIds = async (excludeDutyId = null, dutyDates = null) => {
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

  // Officers not currently 'available' (on leave, or returned but not yet
  // cleared by an operator) can never be assigned, regardless of duty dates.
  const unavailable = await Officer.find({ dutyAvailability: { $ne: 'available' } }).select('_id');
  for (const o of unavailable) busy.add(o._id.toString());

  // If we know the duty's own date window, also exclude officers who have an
  // APPROVED leave overlapping it (even if that leave hasn't started yet).
  if (dutyDates?.startDate && dutyDates?.endDate) {
    const conflicting = await LeaveRequest.find({
      status: 'approved',
      fromDate: { $lte: dutyDates.endDate },
      toDate: { $gte: dutyDates.startDate },
      officerRef: { $ne: null },
    }).select('officerRef');
    for (const l of conflicting) busy.add(l.officerRef.toString());
  }

  return busy;
};

// ─── OFFICER MANAGEMENT ───────────────────────────────────────────────────────

// @desc   Get officers under this operator's admin
// @route  GET /api/operator/officers
const getOfficers = asyncHandler(async (req, res) => {
  const { page, limit, search, rankId, status, thana, zone } = req.query;
  const query = { adminRef: req.user.adminRef };
  if (rankId) query.rankRef = rankId;
  if (status) query.status = status;
  if (thana) query.thana = { $regex: `^${thana.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' };
  if (zone) query.zone = { $regex: `^${zone.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' };
  if (search) query.$or = [
    { name: { $regex: search, $options: 'i' } },
    { badgeNumber: { $regex: search, $options: 'i' } }
  ];
  const result = await paginateQuery(Officer, query, page, limit,
    [{ path: 'rankRef', select: 'name code color priority' }, { path: 'userRef', select: 'email status lastLogin' }]
  );
  return successResponse(res, 200, 'Officers fetched', result);
});

// @desc   Distinct thana/zone values in use for this admin — powers the
//         filter dropdowns on the officer list.
// @route  GET /api/operator/officers/locations
const getOfficerLocations = asyncHandler(async (req, res) => {
  const match = { adminRef: req.user.adminRef };
  const [thanas, zones] = await Promise.all([
    Officer.distinct('thana', { ...match, thana: { $nin: [null, ''] } }),
    Officer.distinct('zone', { ...match, zone: { $nin: [null, ''] } }),
  ]);
  return successResponse(res, 200, 'Locations fetched', { thanas: thanas.sort(), zones: zones.sort() });
});

// @desc   Add single officer
// @route  POST /api/operator/officers
const addOfficer = asyncHandler(async (req, res) => {
  const { name, email, phone, gender, dateOfBirth, rankId, rankText, badgeNumber, designation, thana, zone } = req.body;

  // Prefer an exact rankId (dropdown) but tolerate a free-text rank value too
  // (shortform / Hindi / spacing variants) — same resolver used by bulk upload.
  let rank = null;
  if (rankId) rank = await Rank.findOne({ _id: rankId, isActive: true });
  else if (rankText) rank = await resolveRank(rankText);
  if (!rank) return errorResponse(res, 404, rankText && !rankId ? `Could not recognize rank "${rankText}"` : 'Rank not found');

  const exists = await User.findOne({ email: email.toLowerCase() });
  if (exists) return errorResponse(res, 409, 'Email already registered');

  const admin = await User.findById(req.user.adminRef);
  const crypto = require('crypto');
  const tempPassword = crypto.randomBytes(6).toString('hex');

  const user = await User.create({
    name, email: email.toLowerCase(), phone, password: phone,
    gender: normalizeGender(gender), dateOfBirth, role: 'officer',
    adminRef: req.user.adminRef, superadminRef: admin.superadminRef,
    rankRef: rank._id, badgeNumber, designation,
    thana: thana || null, zone: zone || null,
  });

  await Officer.create({
    userRef: user._id, adminRef: req.user.adminRef,
    superadminRef: admin.superadminRef,
    name, phone, email: email.toLowerCase(), gender: normalizeGender(gender), dateOfBirth,
    rankRef: rank._id, badgeNumber, designation,
    thana: thana || null, zone: zone || null,
  });

  const { sendWelcomeMessage } = require('../utils/whatsapp');
  await sendWelcomeMessage(phone, name, `Officer (${rank.name})`, email, tempPassword);

  return successResponse(res, 201, 'Officer added', { user: { _id: user._id, name, email, phone } });
});

// @desc   Edit officer
// @route  PUT /api/operator/officers/:officerId
const updateOfficer = asyncHandler(async (req, res) => {
  const { name, phone, gender, dateOfBirth, rankId, rankText, badgeNumber, designation, status, thana, zone } = req.body;

  const officer = await Officer.findOne({ _id: req.params.officerId, adminRef: req.user.adminRef });
  if (!officer) return errorResponse(res, 404, 'Officer not found');

  let resolvedRankId;
  if (rankId) {
    const rank = await Rank.findOne({ _id: rankId, isActive: true });
    if (!rank) return errorResponse(res, 404, 'Rank not found');
    resolvedRankId = rank._id;
  } else if (rankText) {
    const rank = await resolveRank(rankText);
    if (!rank) return errorResponse(res, 404, `Could not recognize rank "${rankText}"`);
    resolvedRankId = rank._id;
  }
  if (resolvedRankId) officer.rankRef = resolvedRankId;

  if (name) officer.name = name;
  if (phone) officer.phone = phone;
  if (gender) officer.gender = normalizeGender(gender);
  if (dateOfBirth) officer.dateOfBirth = dateOfBirth;
  if (badgeNumber !== undefined) officer.badgeNumber = badgeNumber;
  if (designation !== undefined) officer.designation = designation;
  if (status) officer.status = status;
  if (thana !== undefined) officer.thana = thana || null;
  if (zone !== undefined) officer.zone = zone || null;

  await officer.save();

  // Sync user record
  const updateData = {};
  if (name) updateData.name = name;
  if (phone) updateData.phone = phone;
  if (resolvedRankId) updateData.rankRef = resolvedRankId;
  if (status) updateData.status = status;
  if (thana !== undefined) updateData.thana = thana || null;
  if (zone !== undefined) updateData.zone = zone || null;
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
const assignOfficersByRank = async (rankRequirements, adminRef, excludeOfficerIds = [], dutyDates = null) => {
  const assigned = [];
  const rankNotAvailable = [];

  const busyIds = await getBusyOfficerIds(null, dutyDates);
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
    sourceLat, sourceLng, destLat, destLng,
  } = req.body;

  // MOBILITY duties don't use the standalone lat/lng fields at all — officers
  // check IN near the source point and check OUT near the destination point,
  // so only source/destination coordinates apply to them.
  const isMobility = isSpecial && dutyType === 'MOBILITY';

  if (!dutyName || !locationName || !startDate || !endDate || !priority) {
    return errorResponse(res, 400, 'Missing required fields');
  }

  // Non-MOBILITY duties (regular duties, VVIP, CITY-POINT, CRIMINAL) still
  // need a direct lat/lng — only MOBILITY skips this in favor of source/dest.
  if (!isMobility && (!lat || !lng)) {
    return errorResponse(res, 400, 'Latitude and longitude are required');
  }

  if (new Date(startDate) >= new Date(endDate)) {
    return errorResponse(res, 400, 'End date must be after start date');
  }

  if (isSpecial && dutyType && !['VVIP', 'CITY-POINT', 'CRIMINAL', 'MOBILITY'].includes(dutyType)) {
    return errorResponse(res, 400, 'Invalid duty type');
  }

  // MOBILITY duties need both a source and a destination point.
  let sourceLocation = null;
  let destinationLocation = null;
  if (isMobility) {
    if (!sourceLat || !sourceLng || !destLat || !destLng) {
      return errorResponse(res, 400, 'Source and destination coordinates are required for a MOBILITY duty');
    }
    sourceLocation = { lat: parseFloat(sourceLat), lng: parseFloat(sourceLng) };
    destinationLocation = { lat: parseFloat(destLat), lng: parseFloat(destLng) };
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

  // Auto-assign officers — leave-conflict-aware for this duty's actual window
  const { assigned, rankNotAvailable } = await assignOfficersByRank(
    parsedRequirements.filter(r => r.assignmentType !== 'manual'), req.user.adminRef,
    [], { startDate: new Date(startDate), endDate: new Date(endDate) }
  );

  // Manual assignments
  const manualAssigned = [];
  const manualUnavailable = [];
  if (manualAssignments) {
    const manuals = typeof manualAssignments === 'string'
      ? JSON.parse(manualAssignments) : manualAssignments;

    const busyIds = await getBusyOfficerIds(null, { startDate: new Date(startDate), endDate: new Date(endDate) });
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

  // For MOBILITY duties there's no standalone lat/lng from the form — use the
  // source point as the duty's primary "location" so anything elsewhere that
  // reads duty.location (map view, maps link, geo-fenced attendance fallback,
  // etc.) keeps working without any further changes.
  const dutyLocation = isMobility
    ? sourceLocation
    : { lat: parseFloat(lat), lng: parseFloat(lng) };

  const duty = await Duty.create({
    dutyName, locationName,
    location: dutyLocation,
    startDate: new Date(startDate), endDate: new Date(endDate),
    priority: parseInt(priority),
    ...(isSpecial && dutyType ? { dutyType } : {}),
    ...(sourceLocation ? { sourceLocation } : {}),
    ...(destinationLocation ? { destinationLocation } : {}),
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
        type: 'duty_assigned', relatedDuty: duty._id
      });
    }
  }

  // Notify the duty's own contact number(s) — full duty + officer snapshot
  if (populated.phoneNumbers && populated.phoneNumbers.length > 0) {
    const officersSummary = buildOfficersSummary(populated.assignedOfficers);
    for (const num of populated.phoneNumbers) {
      await notifyDutyInfoToNumber(
        num, dutyName, locationName, startDate, endDate,
        isSpecial && dutyType ? dutyType : `Priority ${priority}`,
        vehicleNumber, officersSummary
      );
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

  // lat/lng on update remain fully optional (as before) — this naturally
  // covers MOBILITY duties too, since they simply won't send these fields.
  if (req.body.lat || req.body.lng) {
    updateData.location = {
      lat: parseFloat(req.body.lat || duty.location.lat),
      lng: parseFloat(req.body.lng || duty.location.lng)
    };
    delete updateData.lat; delete updateData.lng;
  }

  // Source/destination coordinates — only meaningful for MOBILITY duties,
  // but accepted whenever sent so an operator can correct them later.
  if (req.body.sourceLat || req.body.sourceLng) {
    updateData.sourceLocation = {
      lat: parseFloat(req.body.sourceLat || duty.sourceLocation?.lat),
      lng: parseFloat(req.body.sourceLng || duty.sourceLocation?.lng),
    };
  }
  if (req.body.destLat || req.body.destLng) {
    updateData.destinationLocation = {
      lat: parseFloat(req.body.destLat || duty.destinationLocation?.lat),
      lng: parseFloat(req.body.destLng || duty.destinationLocation?.lng),
    };
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

    const busyIds = await getBusyOfficerIds(duty._id, { startDate: duty.startDate, endDate: duty.endDate });

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

        // Manual mode: operator hand-picked the specific officers to fill the
        // new slots (via the officer picker on the frontend) instead of letting
        // the system auto-select at random. Falls back to 'auto' behavior
        // whenever assignmentType isn't explicitly 'manual'.
        const isManual = req_.assignmentType === 'manual';
        let selected = [];

        if (isManual) {
          const requestedIds = Array.isArray(req_.manualOfficerIds) ? req_.manualOfficerIds.slice(0, need) : [];
          if (requestedIds.length > 0) {
            const candidates = await Officer.find({
              _id: { $in: requestedIds },
              adminRef: req.user.adminRef,
              rankRef,
              status: 'active',
              _id: { $nin: Array.from(excludeIds) },
            }).select('_id name phone userRef');
            // Preserve the operator's chosen order rather than Mongo's default
            const byId = new Map(candidates.map(o => [o._id.toString(), o]));
            selected = requestedIds.map(id => byId.get(id.toString())).filter(Boolean);
          }
        } else {
          const available = await Officer.find({
            adminRef: req.user.adminRef,
            rankRef,
            status: 'active',
            _id: { $nin: Array.from(excludeIds) },
          }).select('_id name phone userRef').limit(need);
          selected = available;
        }

        for (const officer of selected) {
          duty.assignedOfficers.push({
            officerRef: officer._id,
            rankRef,
            status: 'accepted',
            assignedBy: req.user._id,
          });
          newlyAssignedForNotify.push(officer);
          excludeIds.add(officer._id.toString()); // don't double-pick within this same request
        }
        if (selected.length < need) {
          const rank = await Rank.findById(rankRef).select('name');
          timelineEntries.push({
            action: 'RANK_REQUIREMENT_INCREASED',
            performedBy: req.user._id,
            note: isManual
              ? `${rank?.name || 'Rank'} increased to ${targetCount}, but only ${selected.length}/${need} of the manually selected officer(s) were valid/available`
              : `${rank?.name || 'Rank'} increased to ${targetCount}, but only ${selected.length}/${need} additional officer(s) were available`,
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
      if (existingReqEntry) {
        existingReqEntry.count = targetCount;
        existingReqEntry.assignmentType = req_.assignmentType === 'manual' ? 'manual' : 'auto';
      } else {
        duty.rankRequirements.push({ rankRef, count: targetCount, assignmentType: req_.assignmentType === 'manual' ? 'manual' : 'auto' });
      }
    }

    timelineEntries.push({ action: 'RANK_REQUIREMENTS_UPDATED', performedBy: req.user._id, note: 'Rank requirements adjusted' });
  }

  updateData.timeline = [...duty.timeline, ...timelineEntries];

  // Apply the simple field updates first, then persist the rankRequirements/
  // assignedOfficers array mutations made above via duty.save().
  Object.assign(duty, updateData);
  await duty.save();

  const updated = await Duty.findById(duty._id)
    .populate('assignedOfficers.officerRef', 'name phone userRef')
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

  // Notify the duty's own contact number(s) — full duty + officer snapshot
  if (changes && updated.phoneNumbers && updated.phoneNumbers.length > 0) {
    const officersSummary = buildOfficersSummary(updated.assignedOfficers);
    for (const num of updated.phoneNumbers) {
      await notifyDutyUpdateToNumber(
        num, updated.dutyName, 'Duty Updated', `Changed: ${changes}`,
        updated.locationName, updated.startDate, updated.endDate, officersSummary
      );
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
        type: 'duty_assigned', relatedDuty: duty._id,
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
        type: 'duty_updated', relatedDuty: duty._id,
      });
    }
  }

  // Notify currently-assigned officers (still on the duty, not rejected/
  // removed/replaced) about general duty field changes — e.g. timing,
  // location, priority, description. Rank-count-driven add/remove above are
  // reported separately with their own more specific messages.
  if (changes) {
    const stillOnDuty = updated.assignedOfficers.filter(
      (ao) => ['assigned', 'accepted'].includes(ao.status) && ao.officerRef?.userRef
    );
    for (const ao of stillOnDuty) {
      await createNotification({
        recipientId: ao.officerRef.userRef,
        title: 'Duty Updated',
        body: `Duty "${duty.dutyName}" was updated by the operator. Changed: ${changes}`,
        type: 'duty_updated', relatedDuty: duty._id,
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

  const duty = await Duty.findOne({ _id: req.params.dutyId, operatorRef: req.user._id })
    .populate('assignedOfficers.officerRef', 'name')
    .populate('assignedOfficers.rankRef', 'name');
  if (!duty) return errorResponse(res, 404, 'Duty not found');

  const userWithPassword = await User.findById(req.user._id).select('+password');
  const isMatch = await userWithPassword.matchPassword(password);
  if (!isMatch) return errorResponse(res, 401, 'Incorrect password — duty was not deleted');

  // Notify the duty's own contact number(s) before it's gone — full snapshot
  if (duty.phoneNumbers && duty.phoneNumbers.length > 0) {
    const officersSummary = buildOfficersSummary(duty.assignedOfficers);
    for (const num of duty.phoneNumbers) {
      await notifyDutyUpdateToNumber(
        num, duty.dutyName, 'Duty Deleted', 'This duty has been permanently deleted by the operator',
        duty.locationName, duty.startDate, duty.endDate, officersSummary
      );
    }
  }

  await Attendance.deleteMany({ dutyRef: duty._id });
  await SwapRequest.deleteMany({ duty: duty._id });
  await Duty.findByIdAndDelete(duty._id);

  return successResponse(res, 200, 'Duty permanently deleted');
});

// @desc   Cancel duty
// @route  PATCH /api/operator/duties/:dutyId/cancel
const cancelDuty = asyncHandler(async (req, res) => {
  const duty = await Duty.findOne({ _id: req.params.dutyId, operatorRef: req.user._id })
    .populate('assignedOfficers.officerRef', 'name phone userRef')
    .populate('assignedOfficers.rankRef', 'name');
  if (!duty) return errorResponse(res, 404, 'Duty not found');
  if (duty.status === 'cancelled') return errorResponse(res, 400, 'Already cancelled');

  const { reason } = req.body;

  await Duty.findByIdAndUpdate(duty._id, {
    status: 'cancelled',
    $push: { timeline: { action: 'DUTY_CANCELLED', performedBy: req.user._id, note: reason || 'Cancelled by operator' } }
  });

  // Notify only officers CURRENTLY assigned to this duty (status 'assigned'
  // or 'accepted') — not officers who rejected it, nor officers who were
  // swapped/replaced out and are no longer actually on the duty.
  const currentlyAssigned = duty.assignedOfficers.filter((ao) => ['assigned', 'accepted'].includes(ao.status));
  for (const ao of currentlyAssigned) {
    if (ao.officerRef?.phone) {
      await notifyDutyCancelled(ao.officerRef.phone, ao.officerRef.name, duty.dutyName, reason);
    }
    if (ao.officerRef?.userRef) {
      await createNotification({
        recipientId: ao.officerRef.userRef,
        title: 'Duty Cancelled',
        body: `Duty "${duty.dutyName}" has been cancelled by the operator.${reason ? ` Reason: ${reason}` : ''}`,
        type: 'duty_cancelled', relatedDuty: duty._id,
      });
    }
  }

  // Notify the duty's own contact number(s) — full duty + officer snapshot
  if (duty.phoneNumbers && duty.phoneNumbers.length > 0) {
    const officersSummary = buildOfficersSummary(duty.assignedOfficers);
    for (const num of duty.phoneNumbers) {
      await notifyDutyUpdateToNumber(
        num, duty.dutyName, 'Duty Cancelled', reason || 'Cancelled by operator',
        duty.locationName, duty.startDate, duty.endDate, officersSummary
      );
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
  const busyIds = await getBusyOfficerIds(duty._id, { startDate: duty.startDate, endDate: duty.endDate });
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
      type: 'duty_assigned', relatedDuty: duty._id
    });
  }

  // Notify the duty's own contact number(s) — full duty + officer snapshot
  if (duty.phoneNumbers && duty.phoneNumbers.length > 0) {
    const forNotify = await Duty.findById(duty._id)
      .populate('assignedOfficers.officerRef', 'name')
      .populate('assignedOfficers.rankRef', 'name');
    const officersSummary = buildOfficersSummary(forNotify.assignedOfficers);
    for (const num of duty.phoneNumbers) {
      await notifyDutyUpdateToNumber(
        num, duty.dutyName, 'Officer Swapped', `${replacement.name} auto-replaced a rejected officer`,
        duty.locationName, duty.startDate, duty.endDate, officersSummary
      );
    }
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

  const busyIds = await getBusyOfficerIds(duty._id, { startDate: duty.startDate, endDate: duty.endDate });
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
      type: 'duty_assigned', relatedDuty: duty._id
    });
  }

  // Notify the duty's own contact number(s) — full duty + officer snapshot
  if (duty.phoneNumbers && duty.phoneNumbers.length > 0) {
    const forNotify = await Duty.findById(duty._id)
      .populate('assignedOfficers.officerRef', 'name')
      .populate('assignedOfficers.rankRef', 'name');
    const officersSummary = buildOfficersSummary(forNotify.assignedOfficers);
    for (const num of duty.phoneNumbers) {
      await notifyDutyUpdateToNumber(
        num, duty.dutyName, 'Officer Swapped', `${newOfficer.name} manually assigned by operator`,
        duty.locationName, duty.startDate, duty.endDate, officersSummary
      );
    }
  }

  return successResponse(res, 200, 'Officer changed', { replacement: { name: newOfficer.name, _id: newOfficer._id } });
});

// @desc   Get available officers for a given rank (for manual assignment picker)
// @route  GET /api/operator/officers/available?rankId=...&excludeDutyId=...
const getAvailableOfficersByRank = asyncHandler(async (req, res) => {
  const { rankId, excludeDutyId, search, startDate, endDate } = req.query;
  if (!rankId) return errorResponse(res, 400, 'rankId is required');

  const dutyDates = startDate && endDate ? { startDate: new Date(startDate), endDate: new Date(endDate) } : null;
  const busyIds = await getBusyOfficerIds(excludeDutyId || null, dutyDates);

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

// ─── LEAVE-RELATED OFFICER AVAILABILITY ──────────────────────────────────────

// @desc   Mark a returning officer (post-leave) as available for duty again.
//         Officers stay in 'pending_return' after their leave's end date
//         passes until an operator explicitly does this — they are never
//         auto-assigned to a duty in between.
// @route  PATCH /api/operator/officers/:officerId/mark-available
const markOfficerAvailable = asyncHandler(async (req, res) => {
  const officer = await Officer.findOne({ _id: req.params.officerId, adminRef: req.user.adminRef });
  if (!officer) return errorResponse(res, 404, 'Officer not found');
  if (officer.dutyAvailability === 'on_leave') {
    return errorResponse(res, 400, 'Officer is still within their approved leave dates');
  }
  if (officer.dutyAvailability === 'available') {
    return errorResponse(res, 400, 'Officer is already marked available');
  }

  officer.dutyAvailability = 'available';
  officer.currentLeaveRef = null;
  await officer.save();

  if (officer.userRef) {
    await createNotification({
      recipientId: officer.userRef,
      title: 'Marked Available for Duty',
      body: `You have been marked available for duty assignment again.`,
      type: 'general',
    });
  }

  return successResponse(res, 200, 'Officer marked available for duty', { officer });
});

// @desc   List operator's officers currently returned-from-leave but not yet
//         cleared for duty (dutyAvailability = 'pending_return')
// @route  GET /api/operator/officers/pending-return
const getPendingReturnOfficers = asyncHandler(async (req, res) => {
  const officers = await Officer.find({ adminRef: req.user.adminRef, dutyAvailability: 'pending_return' })
    .populate('rankRef', 'name code color')
    .populate('currentLeaveRef', 'leaveType fromDate toDate')
    .sort({ name: 1 });
  return successResponse(res, 200, 'Pending-return officers fetched', { officers });
});

// @desc   Suggested replacement officers for a duty slot left vacant by an
//         officer whose leave was just approved (same rank, available for
//         the duty's window).
// @route  GET /api/operator/duties/:dutyId/assignments/:assignmentId/leave-conflict-suggestions
const getLeaveConflictSuggestions = asyncHandler(async (req, res) => {
  const duty = await Duty.findOne({ _id: req.params.dutyId, operatorRef: req.user._id });
  if (!duty) return errorResponse(res, 404, 'Duty not found');
  const assignment = duty.assignedOfficers.id(req.params.assignmentId);
  if (!assignment) return errorResponse(res, 404, 'Assignment not found');

  const currentlyAssigned = duty.assignedOfficers
    .filter(a => ['assigned', 'accepted'].includes(a.status))
    .map(a => a.officerRef.toString());
  const busyIds = await getBusyOfficerIds(duty._id, { startDate: duty.startDate, endDate: duty.endDate });
  const excludeIds = Array.from(new Set([...currentlyAssigned, ...busyIds]));

  const suggestions = await Officer.find({
    adminRef: req.user.adminRef, rankRef: assignment.rankRef, status: 'active',
    _id: { $nin: excludeIds },
  }).select('_id name phone badgeNumber designation').sort({ name: 1 });

  return successResponse(res, 200, 'Suggestions fetched', { suggestions });
});

// @desc   Resolve a leave-driven duty conflict — replace the on-leave
//         officer's assignment either with a chosen officer (manual) or the
//         first available matching-rank officer (auto).
// @route  PATCH /api/operator/duties/:dutyId/assignments/:assignmentId/resolve-leave-conflict
//         body: { officerId } (manual) OR { auto: true }
const resolveLeaveConflict = asyncHandler(async (req, res) => {
  const { officerId, auto } = req.body;
  const duty = await Duty.findOne({ _id: req.params.dutyId, operatorRef: req.user._id });
  if (!duty) return errorResponse(res, 404, 'Duty not found');
  if (!['draft', 'active'].includes(duty.status)) return errorResponse(res, 400, 'Only draft or active duties can be edited');

  const assignment = duty.assignedOfficers.id(req.params.assignmentId);
  if (!assignment) return errorResponse(res, 404, 'Assignment not found');
  if (!['assigned', 'accepted'].includes(assignment.status)) {
    return errorResponse(res, 400, 'This assignment is not currently active');
  }

  const currentlyAssigned = duty.assignedOfficers
    .filter(a => ['assigned', 'accepted'].includes(a.status))
    .map(a => a.officerRef.toString());
  const busyIds = await getBusyOfficerIds(duty._id, { startDate: duty.startDate, endDate: duty.endDate });
  const excludeIds = Array.from(new Set([...currentlyAssigned, ...busyIds]));

  let replacement;
  if (auto) {
    replacement = await Officer.findOne({
      adminRef: req.user.adminRef, rankRef: assignment.rankRef, status: 'active',
      _id: { $nin: excludeIds },
    });
    if (!replacement) return errorResponse(res, 404, 'No available officer with the required rank to auto-assign');
  } else {
    if (!officerId) return errorResponse(res, 400, 'officerId is required for manual resolution');
    replacement = await Officer.findOne({ _id: officerId, adminRef: req.user.adminRef, status: 'active' });
    if (!replacement) return errorResponse(res, 404, 'Selected officer not found');
    if (excludeIds.includes(replacement._id.toString())) {
      return errorResponse(res, 400, 'Selected officer is unavailable for this duty\'s dates');
    }
  }

  assignment.status = 'replaced';
  assignment.replacedBy = replacement._id;
  assignment.replacedAt = new Date();
  duty.assignedOfficers.push({
    officerRef: replacement._id, rankRef: assignment.rankRef, status: 'accepted', assignedBy: req.user._id,
  });
  duty.timeline.push({ action: 'OFFICER_REPLACED', performedBy: req.user._id, note: 'Reassigned after original officer\'s leave was approved' });
  await duty.save();

  // Mark the leave's conflict entry resolved
  await LeaveRequest.updateOne(
    { 'conflictingDuties.dutyRef': duty._id, 'conflictingDuties.assignmentId': assignment._id },
    { $set: { 'conflictingDuties.$.resolved': true, 'conflictingDuties.$.resolvedAt': new Date() } }
  );

  const officerUser = await User.findOne({ _id: replacement.userRef }).select('_id');
  if (replacement.phone) {
    await notifyOfficerReplaced(replacement.phone, replacement.name, duty.dutyName, 'Reassigned after previous officer went on leave');
  }
  if (officerUser) {
    await createNotification({
      recipientId: officerUser._id, title: 'New Duty Assigned',
      body: `You have been assigned to duty: ${duty.dutyName}`, type: 'duty_assigned', relatedDuty: duty._id,
    });
  }

  return successResponse(res, 200, 'Leave conflict resolved', { replacement: { name: replacement.name, _id: replacement._id } });
});

// ─── BULK DUTY CREATION VIA EXCEL ────────────────────────────────────────────
// One row = one officer assigned to a duty. Rows that share the same
// `dutyGroupId` value belong to the same duty (so a duty needing 5 officers
// is 5 rows). Duty-level columns (name, location, dates, priority, etc.)
// only need to be filled on one row per group — the first non-empty value
// seen for each field across the group is used — but repeating them on
// every row is fine too and is what the downloadable template does, since
// that's the easiest way for someone to build the sheet in Excel.
//
// @desc   Bulk create duties (with officer assignments) via Excel
// @route  POST /api/operator/duties/bulk-upload
const bulkCreateDuties = asyncHandler(async (req, res) => {
  if (!req.file) return errorResponse(res, 400, 'Excel file required');

  const isSpecial = req.user.role === 'operator_special';
  const admin = await User.findById(req.user.adminRef);

  const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawRows = xlsx.utils.sheet_to_json(sheet, { defval: '' });

  if (rawRows.length === 0) return errorResponse(res, 400, 'Excel file is empty');

  // Normalize header casing/spacing exactly like the officer bulk upload,
  // so "Duty Group Id", "dutygroupid", "DutyGroupID" etc. all map correctly.
  const FIELD_ALIASES = {
    dutygroupid: 'dutyGroupId',
    dutyname: 'dutyName',
    locationname: 'locationName',
    lat: 'lat', lng: 'lng',
    startdate: 'startDate', enddate: 'endDate',
    priority: 'priority',
    dutytype: 'dutyType',
    description: 'description',
    vehiclenumber: 'vehicleNumber',
    phonenumbers: 'phoneNumbers',
    sourcelat: 'sourceLat', sourcelng: 'sourceLng',
    destlat: 'destLat', destlng: 'destLng',
    officerbadgenumber: 'officerBadgeNumber',
    officeremail: 'officerEmail',
  };

  const normalizeRow = (row) => {
    const normalized = {};
    for (const key of Object.keys(row)) {
      const cleanKey = key.trim().toLowerCase().replace(/[\s_-]/g, '');
      const mappedKey = FIELD_ALIASES[cleanKey] || key;
      normalized[mappedKey] = typeof row[key] === 'string' ? row[key].trim() : row[key];
    }
    return normalized;
  };

  const rows = rawRows.map(normalizeRow).filter(r => Object.values(r).some(v => v !== '' && v !== undefined));
  if (rows.length === 0) return errorResponse(res, 400, 'Excel file has no usable rows');

  // Group rows by dutyGroupId, preserving first-seen order so duties are
  // created in the same order they appear in the sheet.
  const groupOrder = [];
  const groups = new Map();
  for (const row of rows) {
    const gid = String(row.dutyGroupId || '').trim();
    if (!gid) continue; // rows without a group id are skipped, reported below
    if (!groups.has(gid)) { groups.set(gid, []); groupOrder.push(gid); }
    groups.get(gid).push(row);
  }

  const total = groupOrder.length;
  const ungroupedCount = rows.length - Array.from(groups.values()).reduce((n, g) => n + g.length, 0);

  res.setHeader('Content-Type', 'application/x-ndjson');
  res.setHeader('Cache-Control', 'no-cache');
  if (typeof res.flushHeaders === 'function') res.flushHeaders();
  const sendEvent = (event) => res.write(JSON.stringify(event) + '\n');

  const results = { created: 0, failed: [], officersAssigned: 0, officersSkipped: [] };
  sendEvent({ type: 'start', total, ungroupedRows: ungroupedCount });

  // Track officers consumed across THIS whole upload so the same officer
  // can't be double-booked onto two duties within the same file.
  const consumedThisBatch = new Set();
  const busyIds = await getBusyOfficerIds();

  for (let i = 0; i < groupOrder.length; i++) {
    const gid = groupOrder[i];
    const groupRows = groups.get(gid);

    try {
      // Merge duty-level fields — first non-empty value across the group wins.
      const merged = {};
      for (const r of groupRows) {
        for (const key of ['dutyName', 'locationName', 'lat', 'lng', 'startDate', 'endDate',
          'priority', 'dutyType', 'description', 'vehicleNumber', 'phoneNumbers',
          'sourceLat', 'sourceLng', 'destLat', 'destLng']) {
          if ((merged[key] === undefined || merged[key] === '') && r[key] !== undefined && r[key] !== '') {
            merged[key] = r[key];
          }
        }
      }

      const { dutyName, locationName, startDate, endDate, priority } = merged;
      if (!dutyName || !locationName || !startDate || !endDate || !priority) {
        results.failed.push({ dutyGroupId: gid, reason: 'Missing one of: dutyName, locationName, startDate, endDate, priority' });
        sendEvent({ type: 'progress', processed: i + 1, total, created: results.created, failed: results.failed.length, lastGroup: gid });
        continue;
      }

      const start = new Date(startDate);
      const end = new Date(endDate);
      if (isNaN(start) || isNaN(end) || start >= end) {
        results.failed.push({ dutyGroupId: gid, reason: 'Invalid or out-of-order startDate/endDate' });
        sendEvent({ type: 'progress', processed: i + 1, total, created: results.created, failed: results.failed.length, lastGroup: gid });
        continue;
      }

      const dutyTypeValue = isSpecial && merged.dutyType ? String(merged.dutyType).toUpperCase() : undefined;
      if (dutyTypeValue && !['VVIP', 'CITY-POINT', 'CRIMINAL', 'MOBILITY'].includes(dutyTypeValue)) {
        results.failed.push({ dutyGroupId: gid, reason: `Invalid dutyType '${merged.dutyType}'` });
        sendEvent({ type: 'progress', processed: i + 1, total, created: results.created, failed: results.failed.length, lastGroup: gid });
        continue;
      }
      const isMobility = isSpecial && dutyTypeValue === 'MOBILITY';

      let dutyLocation;
      let sourceLocation = null;
      let destinationLocation = null;
      if (isMobility) {
        if (!merged.sourceLat || !merged.sourceLng || !merged.destLat || !merged.destLng) {
          results.failed.push({ dutyGroupId: gid, reason: 'MOBILITY duty requires sourceLat/sourceLng/destLat/destLng' });
          sendEvent({ type: 'progress', processed: i + 1, total, created: results.created, failed: results.failed.length, lastGroup: gid });
          continue;
        }
        sourceLocation = { lat: parseFloat(merged.sourceLat), lng: parseFloat(merged.sourceLng) };
        destinationLocation = { lat: parseFloat(merged.destLat), lng: parseFloat(merged.destLng) };
        dutyLocation = sourceLocation;
      } else {
        if (!merged.lat || !merged.lng) {
          results.failed.push({ dutyGroupId: gid, reason: 'lat/lng are required (unless dutyType is MOBILITY)' });
          sendEvent({ type: 'progress', processed: i + 1, total, created: results.created, failed: results.failed.length, lastGroup: gid });
          continue;
        }
        dutyLocation = { lat: parseFloat(merged.lat), lng: parseFloat(merged.lng) };
      }

      const parsedPhones = merged.phoneNumbers
        ? String(merged.phoneNumbers).split(',').map(p => p.trim()).filter(Boolean)
        : [];

      // Resolve every officer row in this group
      const assignedOfficers = [];
      const rankCounts = new Map();
      for (const r of groupRows) {
        const identifier = r.officerBadgeNumber || r.officerEmail;
        if (!identifier) continue; // duty-level-only row with no officer — allowed, just no assignment

        const officerQuery = { adminRef: req.user.adminRef, status: 'active' };
        if (r.officerBadgeNumber) officerQuery.badgeNumber = String(r.officerBadgeNumber);
        else officerQuery.email = String(r.officerEmail).toLowerCase();

        const officer = await Officer.findOne(officerQuery);
        if (!officer) {
          results.officersSkipped.push({ dutyGroupId: gid, identifier, reason: 'Officer not found or inactive' });
          continue;
        }
        const officerId = officer._id.toString();
        if (consumedThisBatch.has(officerId) || busyIds.has(officerId)) {
          results.officersSkipped.push({ dutyGroupId: gid, identifier, name: officer.name, reason: 'Officer already assigned elsewhere' });
          continue;
        }

        assignedOfficers.push({ officerRef: officer._id, rankRef: officer.rankRef, status: 'accepted', assignedBy: req.user._id });
        consumedThisBatch.add(officerId);
        rankCounts.set(officer.rankRef.toString(), (rankCounts.get(officer.rankRef.toString()) || 0) + 1);
        results.officersAssigned++;
      }

      const rankRequirements = Array.from(rankCounts.entries()).map(([rankRef, count]) => ({
        rankRef, count, assignmentType: 'manual',
      }));

      const duty = await Duty.create({
        dutyName, locationName,
        location: dutyLocation,
        startDate: start, endDate: end,
        priority: parseInt(priority),
        ...(dutyTypeValue ? { dutyType: dutyTypeValue } : {}),
        ...(sourceLocation ? { sourceLocation } : {}),
        ...(destinationLocation ? { destinationLocation } : {}),
        description: merged.description || undefined,
        phoneNumbers: parsedPhones,
        vehicleNumber: merged.vehicleNumber || null,
        rankRequirements,
        assignedOfficers,
        operatorRef: req.user._id,
        adminRef: req.user.adminRef,
        superadminRef: admin.superadminRef,
        status: 'draft',
        timeline: [{ action: 'DUTY_CREATED', performedBy: req.user._id, note: 'Duty created via bulk Excel upload (draft)' }],
      });

      // Notify assigned officers — same channels as single duty creation.
      const populated = await Duty.findById(duty._id)
        .populate('assignedOfficers.officerRef', 'name phone userRef')
        .populate('assignedOfficers.rankRef', 'name');
      for (const ao of populated.assignedOfficers) {
        if (ao.officerRef?.phone) {
          await notifyDutyAssigned(ao.officerRef.phone, ao.officerRef.name, dutyName, locationName, start, end);
        }
        if (ao.officerRef?.userRef) {
          await createNotification({
            recipientId: ao.officerRef.userRef,
            title: 'New Duty Assigned',
            body: `You have been assigned to duty: ${dutyName} at ${locationName}`,
            type: 'duty_assigned', relatedDuty: duty._id,
          });
        }
      }
      if (parsedPhones.length > 0) {
        const officersSummary = buildOfficersSummary(populated.assignedOfficers);
        for (const num of parsedPhones) {
          await notifyDutyInfoToNumber(num, dutyName, locationName, start, end,
            dutyTypeValue || `Priority ${priority}`, merged.vehicleNumber, officersSummary);
        }
      }

      results.created++;
    } catch (err) {
      results.failed.push({ dutyGroupId: gid, reason: err.message });
    }

    sendEvent({
      type: 'progress',
      processed: i + 1,
      total,
      percent: Math.round(((i + 1) / total) * 100),
      created: results.created,
      failed: results.failed.length,
      officersAssigned: results.officersAssigned,
      lastGroup: gid,
    });
  }

  sendEvent({ type: 'done', result: results });
  res.end();
});

module.exports = {
  getOfficers, addOfficer, updateOfficer, deleteOfficer, getOfficerLocations,
  createDuty, getDuties, getDutyById, updateDuty, cancelDuty, deleteDuty,
  replaceOfficer, manualReplaceOfficer, getRankAvailability, getAvailableOfficersByRank,
  getDutiesForMap, bulkCreateDuties,
  markOfficerAvailable, getPendingReturnOfficers, getLeaveConflictSuggestions, resolveLeaveConflict,
};