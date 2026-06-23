const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const Officer = require('../models/Officer');
const Duty = require('../models/Duty');
const Attendance = require('../models/Attendance');
const { successResponse, errorResponse, paginateQuery } = require('../utils/response');
const { sendWelcomeMessage } = require('../utils/whatsapp');
const crypto = require('crypto');

// @desc   Create operator (admin can create 1 special + 1 regular)
// @route  POST /api/admin/operators
const createOperator = asyncHandler(async (req, res) => {
  const { name, email, phone, password, confirmPassword, gender, dateOfBirth, operatorType } = req.body;

  if (!['operator_special', 'operator_regular'].includes(operatorType)) {
    return errorResponse(res, 400, 'operatorType must be operator_special or operator_regular');
  }

  // Check limit: 1 special + 1 regular per admin
  const existingCount = await User.countDocuments({ adminRef: req.user._id, role: operatorType });
  if (existingCount >= 1) {
    return errorResponse(res, 409, `You can only have one ${operatorType === 'operator_special' ? 'special' : 'regular'} operator`);
  }

  if (password !== confirmPassword) return errorResponse(res, 400, 'Passwords do not match');

  const exists = await User.findOne({ email: email.toLowerCase() });
  if (exists) return errorResponse(res, 409, 'Email already registered');

  const operator = await User.create({
    name, email: email.toLowerCase(), phone, password,
    gender, dateOfBirth, role: operatorType,
    adminRef: req.user._id, superadminRef: req.user.superadminRef
  });

  await sendWelcomeMessage(phone, name, operatorType === 'operator_special' ? 'Special Operator' : 'Regular Operator', email, password);

  return successResponse(res, 201, 'Operator created', {
    operator: { _id: operator._id, name, email, phone, role: operator.role }
  });
});

// @desc   Get operators
// @route  GET /api/admin/operators
const getOperators = asyncHandler(async (req, res) => {
  const operators = await User.find({
    adminRef: req.user._id,
    role: { $in: ['operator_special', 'operator_regular'] }
  }).select('-password');
  return successResponse(res, 200, 'Operators fetched', { operators });
});

// @desc   Update operator (password, name, etc.)
// @route  PUT /api/admin/operators/:operatorId
const updateOperator = asyncHandler(async (req, res) => {
  const operator = await User.findOne({
    _id: req.params.operatorId,
    adminRef: req.user._id,
    role: { $in: ['operator_special', 'operator_regular'] }
  });
  if (!operator) return errorResponse(res, 404, 'Operator not found');

  const { name, phone, gender, dateOfBirth, newPassword } = req.body;
  if (name) operator.name = name;
  if (phone) operator.phone = phone;
  if (gender) operator.gender = gender;
  if (dateOfBirth) operator.dateOfBirth = dateOfBirth;
  if (newPassword) {
    if (newPassword.length < 8) return errorResponse(res, 400, 'Password must be at least 8 characters');
    operator.password = newPassword;
  }

  await operator.save();
  return successResponse(res, 200, 'Operator updated');
});

// @desc   Get all duties of this admin
// @route  GET /api/admin/duties
const getDuties = asyncHandler(async (req, res) => {
  const { page, limit, status, operatorId, search, priority } = req.query;
  const query = { adminRef: req.user._id };
  if (status) query.status = status;
  if (operatorId) query.operatorRef = operatorId;
  if (priority) query.priority = parseInt(priority);
  if (search) query.$or = [
    { dutyName: { $regex: search, $options: 'i' } },
    { locationName: { $regex: search, $options: 'i' } }
  ];

  const result = await paginateQuery(Duty, query, page, limit,
    [{ path: 'operatorRef', select: 'name role' },
    { path: 'assignedOfficers.rankRef', select: 'name code' }],
    { createdAt: -1 }
  );
  return successResponse(res, 200, 'Duties fetched', result);
});

// @desc   Dashboard stats
// @route  GET /api/admin/dashboard
const getDashboardStats = asyncHandler(async (req, res) => {
  const adminId = req.user._id;
  const [operators, officers, totalDuties, activeDuties, completedDuties, cancelledDuties] = await Promise.all([
    User.countDocuments({ adminRef: adminId, role: { $in: ['operator_special', 'operator_regular'] } }),
    Officer.countDocuments({ adminRef: adminId }),
    Duty.countDocuments({ adminRef: adminId }),
    Duty.countDocuments({ adminRef: adminId, status: 'active' }),
    Duty.countDocuments({ adminRef: adminId, status: 'completed' }),
    Duty.countDocuments({ adminRef: adminId, status: 'cancelled' }),
  ]);

  return successResponse(res, 200, 'Stats', { operators, officers, totalDuties, activeDuties, completedDuties, cancelledDuties });
});

// @desc   Get single duty detail with attendance (admin view)
// @route  GET /api/admin/duties/:dutyId
const getDutyById = asyncHandler(async (req, res) => {
  const duty = await Duty.findOne({ _id: req.params.dutyId, adminRef: req.user._id })
    .populate('assignedOfficers.officerRef', 'name phone badgeNumber')
    .populate('assignedOfficers.rankRef', 'name code color')
    .populate('rankRequirements.rankRef', 'name code color')
    .populate('operatorRef', 'name phone role')
    .populate('timeline.performedBy', 'name role');

  if (!duty) return errorResponse(res, 404, 'Duty not found');

  // Attendance records for this duty
  const attendanceRecords = await Attendance.find({ dutyRef: duty._id })
    .populate('officerRef', 'name badgeNumber')
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

module.exports = { createOperator, getOperators, updateOperator, getDuties, getDashboardStats, getDutyById };