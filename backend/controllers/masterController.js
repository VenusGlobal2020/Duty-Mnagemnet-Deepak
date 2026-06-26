const asyncHandler = require('express-async-handler');
const xlsx = require('xlsx');
const User = require('../models/User');
const Officer = require('../models/Officer');
const Rank = require('../models/Rank');
const Duty = require('../models/Duty');
const { successResponse, errorResponse, paginateQuery } = require('../utils/response');
const { sendWelcomeMessage, notifyAccountSuspended } = require('../utils/whatsapp');
const { createNotification } = require('../utils/notificationService');
const crypto = require('crypto');

const generateTempPassword = () => crypto.randomBytes(6).toString('hex');

// ─── SUPERADMIN MANAGEMENT ───────────────────────────────────────────────────

// @desc   Create superadmin (SP) - only 1 allowed
// @route  POST /api/master/superadmin
const createSuperadmin = asyncHandler(async (req, res) => {
  const existing = await User.findOne({ role: 'superadmin' });
  if (existing) return errorResponse(res, 409, 'Superadmin (SP) already exists. Only one is allowed.');

  const { name, email, phone, password, confirmPassword, gender, dateOfBirth } = req.body;

  if (password !== confirmPassword) return errorResponse(res, 400, 'Passwords do not match');

  const userExists = await User.findOne({ email: email.toLowerCase() });
  if (userExists) return errorResponse(res, 409, 'Email already registered');

  const superadmin = await User.create({
    name, email: email.toLowerCase(), phone, password, gender, dateOfBirth, role: 'superadmin'
  });

  await sendWelcomeMessage(phone, name, 'Superadmin (SP)', email, password);

  return successResponse(res, 201, 'Superadmin created successfully', {
    superadmin: { _id: superadmin._id, name, email, phone, role: superadmin.role }
  });
});

// @desc   Get superadmin
// @route  GET /api/master/superadmin
const getSuperadmin = asyncHandler(async (req, res) => {
  const superadmin = await User.findOne({ role: 'superadmin' }).select('-password');
  return successResponse(res, 200, 'Superadmin fetched', { superadmin });
});

// ─── ADMIN (ASP) MANAGEMENT ──────────────────────────────────────────────────

// @desc   Create admin (ASP)
// @route  POST /api/master/admins
const createAdmin = asyncHandler(async (req, res) => {
  const superadmin = await User.findOne({ role: 'superadmin' });
  if (!superadmin) return errorResponse(res, 400, 'Create superadmin first');

  const { name, email, phone, password, confirmPassword, gender, dateOfBirth } = req.body;
  if (password !== confirmPassword) return errorResponse(res, 400, 'Passwords do not match');

  const exists = await User.findOne({ email: email.toLowerCase() });
  if (exists) return errorResponse(res, 409, 'Email already registered');

  const admin = await User.create({
    name, email: email.toLowerCase(), phone, password, gender, dateOfBirth,
    role: 'admin', superadminRef: superadmin._id
  });

  await sendWelcomeMessage(phone, name, 'Admin (ACP)', email, password);

  return successResponse(res, 201, 'Admin created successfully', {
    admin: { _id: admin._id, name, email, phone, role: admin.role }
  });
});

// @desc   Get all admins
// @route  GET /api/master/admins
const getAdmins = asyncHandler(async (req, res) => {
  const { page, limit, search, status } = req.query;
  const query = { role: 'admin' };
  if (status) query.status = status;
  if (search) query.$or = [
    { name: { $regex: search, $options: 'i' } },
    { email: { $regex: search, $options: 'i' } }
  ];
  const result = await paginateQuery(User, query, page, limit, 'superadminRef', { createdAt: -1 });
  return successResponse(res, 200, 'Admins fetched', result);
});

// @desc   Get admin details with operators & officers
// @route  GET /api/master/admins/:adminId/details
const getAdminDetails = asyncHandler(async (req, res) => {
  const admin = await User.findOne({ _id: req.params.adminId, role: 'admin' }).select('-password');
  if (!admin) return errorResponse(res, 404, 'Admin not found');

  const operators = await User.find({
    adminRef: admin._id,
    role: { $in: ['operator_special', 'operator_regular'] }
  }).select('-password');

  const officers = await Officer.find({ adminRef: admin._id })
    .populate('rankRef', 'name code color priority')
    .populate('userRef', 'name email status');

  return successResponse(res, 200, 'Admin details fetched', { admin, operators, officers });
});

// ─── MAP VIEW ─────────────────────────────────────────────────────────────────

// @desc   Get duties for map view (no pagination, lean fields only)
// @route  GET /api/master/duties/map
const getDutiesForMap = asyncHandler(async (req, res) => {
  const { adminId, operatorId, status } = req.query;
  const query = {};
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

// ─── SUSPEND / ACTIVATE ──────────────────────────────────────────────────────

// @desc   Suspend superadmin or admin
// @route  PATCH /api/master/suspend/:userId
const suspendUser = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  if (!reason) return errorResponse(res, 400, 'Suspension reason required');

  const user = await User.findOne({
    _id: req.params.userId,
    role: { $in: ['superadmin', 'admin'] }
  });
  if (!user) return errorResponse(res, 404, 'User not found');
  if (user.status === 'suspended') return errorResponse(res, 400, 'Already suspended');

  await User.findByIdAndUpdate(user._id, {
    status: 'suspended', suspendedBy: req.user._id,
    suspendedAt: new Date(), suspendReason: reason
  });

  await notifyAccountSuspended(user.phone, user.name, reason);
  await createNotification({
    recipientId: user._id, title: 'Account Suspended',
    body: `Your account has been suspended. Reason: ${reason}`,
    type: 'account_suspended', sendPush: false
  });

  return successResponse(res, 200, `${user.role === 'superadmin' ? 'Superadmin' : 'Admin'} suspended`);
});

// @desc   Activate suspended user
// @route  PATCH /api/master/activate/:userId
const activateUser = asyncHandler(async (req, res) => {
  const user = await User.findOne({
    _id: req.params.userId,
    role: { $in: ['superadmin', 'admin'] }
  });
  if (!user) return errorResponse(res, 404, 'User not found');
  if (user.status === 'active') return errorResponse(res, 400, 'Already active');

  await User.findByIdAndUpdate(user._id, {
    status: 'active',
    $unset: { suspendedBy: 1, suspendedAt: 1, suspendReason: 1 }
  });

  await createNotification({
    recipientId: user._id, title: 'Account Activated',
    body: 'Your account has been reactivated. You can now log in.',
    type: 'account_activated', sendPush: false
  });

  return successResponse(res, 200, 'Account activated');
});

// ─── RANK MANAGEMENT ─────────────────────────────────────────────────────────

// @desc   Create rank
// @route  POST /api/master/ranks
const createRank = asyncHandler(async (req, res) => {
  const { name, code, priority, color } = req.body;

  const exists = await Rank.findOne({ $or: [{ code: code.toUpperCase() }, { priority }] });
  if (exists) return errorResponse(res, 409, 'Rank with this code or priority already exists');

  const rank = await Rank.create({ name, code: code.toUpperCase(), priority, color, createdBy: req.user._id });
  return successResponse(res, 201, 'Rank created', { rank });
});

// @desc   Get all ranks
// @route  GET /api/master/ranks
const getRanks = asyncHandler(async (req, res) => {
  const ranks = await Rank.find({ isActive: true }).sort({ priority: 1 });
  return successResponse(res, 200, 'Ranks fetched', { ranks });
});

// @desc   Update rank
// @route  PUT /api/master/ranks/:rankId
const updateRank = asyncHandler(async (req, res) => {
  const rank = await Rank.findByIdAndUpdate(req.params.rankId, req.body, { new: true, runValidators: true });
  if (!rank) return errorResponse(res, 404, 'Rank not found');
  return successResponse(res, 200, 'Rank updated', { rank });
});

// @desc   Delete rank
// @route  DELETE /api/master/ranks/:rankId
const deleteRank = asyncHandler(async (req, res) => {
  // Check if rank is in use
  const inUse = await Officer.findOne({ rankRef: req.params.rankId });
  if (inUse) return errorResponse(res, 400, 'Cannot delete rank in use by officers');

  const rank = await Rank.findByIdAndUpdate(req.params.rankId, { isActive: false }, { new: true });
  if (!rank) return errorResponse(res, 404, 'Rank not found');
  return successResponse(res, 200, 'Rank deactivated');
});

// ─── EXCEL BULK OFFICER UPLOAD ────────────────────────────────────────────────

// @desc   Bulk upload officers via Excel
// @route  POST /api/master/officers/bulk-upload
const bulkUploadOfficers = asyncHandler(async (req, res) => {
  if (!req.file) return errorResponse(res, 400, 'Excel file required');
  const { adminId } = req.body;
  if (!adminId) return errorResponse(res, 400, 'Admin ID required');

  const admin = await User.findOne({ _id: adminId, role: 'admin' });
  if (!admin) return errorResponse(res, 404, 'Admin not found');
  if (admin.status !== 'active') return errorResponse(res, 400, 'Admin is not active');

  const superadmin = await User.findById(admin.superadminRef);

  // Parse Excel (memoryStorage gives us a Buffer, not a filesystem path)
  const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawRows = xlsx.utils.sheet_to_json(sheet);

  if (rawRows.length === 0) return errorResponse(res, 400, 'Excel file is empty');

  // Normalize header casing/spacing (e.g. "rankcode", "RankCode", "dateofBirth"
  // all map to the same field) so the upload doesn't silently fail on files
  // whose column headers don't exactly match our expected camelCase names.
  const FIELD_ALIASES = {
    name: 'name',
    email: 'email',
    phone: 'phone',
    gender: 'gender',
    dateofbirth: 'dateOfBirth',
    rankcode: 'rankCode',
    badgenumber: 'badgeNumber',
    designation: 'designation',
  };

  const normalizeRow = (row) => {
    const normalized = {};
    for (const key of Object.keys(row)) {
      const cleanKey = key.trim().toLowerCase().replace(/[\s_-]/g, '');
      const mappedKey = FIELD_ALIASES[cleanKey] || key;
      normalized[mappedKey] = row[key];
    }
    return normalized;
  };

  const rows = rawRows.map(normalizeRow);

  const results = { created: 0, failed: [], skipped: 0 };

  for (const row of rows) {
    try {
      const { name, email, phone, gender, dateOfBirth, rankCode, badgeNumber, designation } = row;

      if (!name || !email || !phone || !rankCode) {
        results.failed.push({ row: name || email, reason: 'Missing required fields' });
        continue;
      }

      // Phone validation
      if (!/^[6-9]\d{9}$/.test(String(phone))) {
        results.failed.push({ row: email, reason: 'Invalid phone number' });
        continue;
      }

      const rank = await Rank.findOne({ code: String(rankCode).toUpperCase(), isActive: true });
      if (!rank) {
        results.failed.push({ row: email, reason: `Rank code '${rankCode}' not found` });
        continue;
      }

      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        results.skipped++;
        continue;
      }

      const tempPassword = generateTempPassword();
      const userDoc = await User.create({
        name, email: email.toLowerCase(), phone: String(phone),
        password: String(phone), gender: gender || 'male',
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : new Date('1990-01-01'),
        role: 'officer', adminRef: adminId,
        superadminRef: admin.superadminRef, rankRef: rank._id,
        badgeNumber: badgeNumber ? String(badgeNumber) : undefined,
        designation
      });

      await Officer.create({
        userRef: userDoc._id, adminRef: adminId,
        superadminRef: admin.superadminRef,
        name, phone: String(phone), email: email.toLowerCase(),
        gender: gender || 'male',
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
        rankRef: rank._id, badgeNumber: badgeNumber ? String(badgeNumber) : undefined,
        designation
      });

      await sendWelcomeMessage(String(phone), name, `Officer (${rank.name})`, email, tempPassword);
      results.created++;
    } catch (err) {
      console.log(err)
      results.failed.push({ row: row.email || row.name, reason: err.message });
    }
  }

  return successResponse(res, 200, 'Bulk upload completed', results);
});

// @desc   View all officers (master-level)
// @route  GET /api/master/officers
const getAllOfficers = asyncHandler(async (req, res) => {
  const { adminId, page, limit, search } = req.query;
  const query = {};
  if (adminId) query.adminRef = adminId;
  if (search) query.name = { $regex: search, $options: 'i' };

  const result = await paginateQuery(
    Officer, query, page, limit,
    [{ path: 'rankRef', select: 'name code color priority' }, { path: 'adminRef', select: 'name email' }, { path: 'userRef', select: 'status lastLogin' }]
  );
  return successResponse(res, 200, 'Officers fetched', result);
});

module.exports = {
  createSuperadmin, getSuperadmin,
  createAdmin, getAdmins, getAdminDetails,
  suspendUser, activateUser,
  createRank, getRanks, updateRank, deleteRank,
  bulkUploadOfficers, getAllOfficers,
  getDutiesForMap,
};