const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const Officer = require('../models/Officer');
const Duty = require('../models/Duty');
const Attendance = require('../models/Attendance');
const { successResponse, errorResponse, paginateQuery } = require('../utils/response');

// @desc   Get all admins under this superadmin
// @route  GET /api/superadmin/admins
const getAdmins = asyncHandler(async (req, res) => {
  const { page, limit, search, status } = req.query;
  const query = { superadminRef: req.user._id, role: 'admin' };
  if (status) query.status = status;
  if (search) query.$or = [
    { name: { $regex: search, $options: 'i' } },
    { email: { $regex: search, $options: 'i' } }
  ];
  const result = await paginateQuery(User, query, page, limit, '', { createdAt: -1 });
  return successResponse(res, 200, 'Admins fetched', result);
});

// @desc   Get admin's operators and officers
// @route  GET /api/superadmin/admins/:adminId/details
const getAdminDetails = asyncHandler(async (req, res) => {
  const admin = await User.findOne({ _id: req.params.adminId, superadminRef: req.user._id, role: 'admin' });
  if (!admin) return errorResponse(res, 404, 'Admin not found');

  const operators = await User.find({
    adminRef: admin._id,
    role: { $in: ['operator_special', 'operator_regular'] }
  }).select('-password');

  const officers = await Officer.find({ adminRef: admin._id })
    .populate('rankRef', 'name code color');

  return successResponse(res, 200, 'Admin details fetched', { admin, operators, officers });
});

// @desc   Get all duties (superadmin view, all admins)
// @route  GET /api/superadmin/duties
const getAllDuties = asyncHandler(async (req, res) => {
  const { page, limit, status, adminId, search, priority } = req.query;
  const query = { superadminRef: req.user._id };
  if (status) query.status = status;
  if (adminId) query.adminRef = adminId;
  if (priority) query.priority = parseInt(priority);
  if (search) query.$or = [
    { dutyName: { $regex: search, $options: 'i' } },
    { locationName: { $regex: search, $options: 'i' } }
  ];

  const result = await paginateQuery(Duty, query, page, limit,
    [{ path: 'operatorRef', select: 'name role' },
    { path: 'adminRef', select: 'name email' },
    { path: 'assignedOfficers.officerRef', select: 'name' },
    { path: 'assignedOfficers.rankRef', select: 'name code' }],
    { createdAt: -1 }
  );
  return successResponse(res, 200, 'Duties fetched', result);
});

// @desc   Get operators under a specific admin (lightweight, for dropdowns)
// @route  GET /api/superadmin/admins/:adminId/operators
const getOperatorsByAdmin = asyncHandler(async (req, res) => {
  const admin = await User.findOne({ _id: req.params.adminId, superadminRef: req.user._id, role: 'admin' });
  if (!admin) return errorResponse(res, 404, 'Admin not found');

  const operators = await User.find({
    adminRef: admin._id,
    role: { $in: ['operator_special', 'operator_regular'] }
  }).select('name role status');

  return successResponse(res, 200, 'Operators fetched', { operators });
});

// @desc   Get duties for map view (no pagination, lean fields only)
// @route  GET /api/superadmin/duties/map
const getDutiesForMap = asyncHandler(async (req, res) => {
  const { adminId, operatorId, status } = req.query;
  const query = { superadminRef: req.user._id };
  if (adminId) query.adminRef = adminId;
  if (operatorId) query.operatorRef = operatorId;
  if (status) query.status = status;

  const duties = await Duty.find(query)
    .select('dutyName locationName location status priority startDate endDate operatorRef adminRef assignedOfficers')
    .populate('operatorRef', 'name role')
    .populate('adminRef', 'name')
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
    operatorName: d.operatorRef?.name,
    adminName: d.adminRef?.name,
    officersCount: (d.assignedOfficers || []).filter(a => a.status !== 'replaced').length,
  }));

  return successResponse(res, 200, 'Duties fetched', { duties: slim });
});

// @desc   Get dashboard stats
// @route  GET /api/superadmin/dashboard
const getDashboardStats = asyncHandler(async (req, res) => {
  const superadminId = req.user._id;
  const [totalAdmins, activeAdmins, totalOfficers, totalDuties, activeDuties, completedDuties] = await Promise.all([
    User.countDocuments({ superadminRef: superadminId, role: 'admin' }),
    User.countDocuments({ superadminRef: superadminId, role: 'admin', status: 'active' }),
    Officer.countDocuments({ superadminRef: superadminId }),
    Duty.countDocuments({ superadminRef: superadminId }),
    Duty.countDocuments({ superadminRef: superadminId, status: 'active' }),
    Duty.countDocuments({ superadminRef: superadminId, status: 'completed' }),
  ]);

  return successResponse(res, 200, 'Dashboard stats', {
    totalAdmins, activeAdmins, totalOfficers, totalDuties, activeDuties, completedDuties
  });
});

// @desc   Get single duty detail with full info (superadmin view)
// @route  GET /api/superadmin/duties/:dutyId
const getDutyById = asyncHandler(async (req, res) => {
  const duty = await Duty.findOne({ _id: req.params.dutyId, superadminRef: req.user._id })
    .populate('assignedOfficers.officerRef', 'name phone badgeNumber')
    .populate('assignedOfficers.rankRef', 'name code color')
    .populate('assignedOfficers.replacedBy', 'name badgeNumber')
    .populate('assignedOfficers.assignedBy', 'name role')
    .populate('rankRequirements.rankRef', 'name code color')
    .populate('operatorRef', 'name phone email role')
    .populate('adminRef', 'name phone email')
    .populate('superadminRef', 'name email')
    .populate('timeline.performedBy', 'name role');

  if (!duty) return errorResponse(res, 404, 'Duty not found');

  const attendanceRecords = await Attendance.find({ dutyRef: duty._id })
    .populate('officerRef', 'name badgeNumber phone')
    .sort({ checkedInAt: 1 });

  const attendanceMap = {};
  for (const rec of attendanceRecords) {
    if (rec.officerRef) {
      attendanceMap[rec.officerRef._id.toString()] = {
        _id: rec._id,
        checkedInAt: rec.checkedInAt,
        checkedOutAt: rec.checkedOutAt,
        durationMinutes: rec.durationMinutes,
        checkInDistanceMeters: rec.checkInDistanceMeters,
        checkOutDistanceMeters: rec.checkOutDistanceMeters,
        checkInLocation: rec.checkInLocation,
        checkOutLocation: rec.checkOutLocation,
        status: rec.status,
        isWithinRadius: rec.isWithinRadius,
      };
    }
  }

  const mapsLink = duty.location?.lat && duty.location?.lng
    ? `https://www.google.com/maps/dir/?api=1&destination=${duty.location.lat},${duty.location.lng}`
    : null;

  return successResponse(res, 200, 'Duty fetched', { duty, attendanceMap, mapsLink });
});

module.exports = { getAdmins, getAdminDetails, getAllDuties, getDashboardStats, getOperatorsByAdmin, getDutiesForMap, getDutyById };