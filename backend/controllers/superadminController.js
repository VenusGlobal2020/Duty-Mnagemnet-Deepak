const asyncHandler = require("express-async-handler");
const xlsx = require("xlsx");
const crypto = require("crypto");
const User = require("../models/User");
const Officer = require("../models/Officer");
const Rank = require("../models/Rank");
const Duty = require("../models/Duty");
const Attendance = require("../models/Attendance");
const {
  successResponse,
  errorResponse,
  paginateQuery,
} = require("../utils/response");
const {
  sendWelcomeMessage,
  notifyAccountSuspended,
} = require("../utils/whatsapp");
const { createNotification } = require("../utils/notificationService");
const { resolveRank, normalizeGender } = require("../utils/rankResolver");

const generateTempPassword = () => crypto.randomBytes(6).toString("hex");

// ─── ADMIN (ASP) MANAGEMENT ──────────────────────────────────────────────────
// Admin creation lives here (moved off the master) and is capped by
// `req.user.adminCreationLimit`, a quota only the master can set/change
// (see masterController.updateAdminCreationLimit).

// @desc   Create admin (ASP) — capped by the quota the master granted
// @route  POST /api/superadmin/admins
const createAdmin = asyncHandler(async (req, res) => {
  const limit = req.user.adminCreationLimit || 0;
  const existingCount = await User.countDocuments({
    superadminRef: req.user._id,
    role: "admin",
  });

  if (existingCount >= limit) {
    return errorResponse(
      res,
      403,
      limit === 0
        ? "You have no admin-creation quota yet. Contact the master to be granted one."
        : `Admin creation limit reached (${existingCount}/${limit}). Contact the master to raise your quota.`,
    );
  }

  const { name, email, phone, password, confirmPassword, gender, dateOfBirth } =
    req.body;
  if (!name || !email || !phone || !password || !gender || !dateOfBirth) {
    return errorResponse(res, 400, "All fields are required");
  }
  if (password !== confirmPassword)
    return errorResponse(res, 400, "Passwords do not match");
  if (password.length < 8)
    return errorResponse(res, 400, "Password must be at least 8 characters");
  if (!/^[6-9]\d{9}$/.test(phone))
    return errorResponse(
      res,
      400,
      "Enter a valid 10-digit Indian phone number",
    );

  const exists = await User.findOne({ email: email.toLowerCase() });
  if (exists) return errorResponse(res, 409, "Email already registered");

  const admin = await User.create({
    name,
    email: email.toLowerCase(),
    phone,
    password,
    gender,
    dateOfBirth,
    role: "admin",
    superadminRef: req.user._id,
  });

  await sendWelcomeMessage(phone, name, "Admin", email, password);

  return successResponse(res, 201, "Admin created successfully", {
    admin: { _id: admin._id, name, email, phone, role: admin.role },
    quota: { used: existingCount + 1, limit },
  });
});

// @desc   Get all admins under this superadmin
// @route  GET /api/superadmin/admins
const getAdmins = asyncHandler(async (req, res) => {
  const { page, limit, search, status } = req.query;
  const query = { superadminRef: req.user._id, role: "admin" };
  if (status) query.status = status;
  if (search)
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
  const result = await paginateQuery(User, query, page, limit, "", {
    createdAt: -1,
  });
  return successResponse(res, 200, "Admins fetched", result);
});

// @desc   Get admin's operators and officers
// @route  GET /api/superadmin/admins/:adminId/details
const getAdminDetails = asyncHandler(async (req, res) => {
  const admin = await User.findOne({
    _id: req.params.adminId,
    superadminRef: req.user._id,
    role: "admin",
  }).select("-password");
  if (!admin) return errorResponse(res, 404, "Admin not found");

  const operators = await User.find({
    adminRef: admin._id,
    role: { $in: ["operator_special", "operator_regular"] },
  }).select("-password");

  const officers = await Officer.find({ adminRef: admin._id }).populate(
    "rankRef",
    "name code color",
  );

  return successResponse(res, 200, "Admin details fetched", {
    admin,
    operators,
    officers,
  });
});

// @desc   Get this superadmin's own admin-creation quota usage
// @route  GET /api/superadmin/quota
const getAdminQuota = asyncHandler(async (req, res) => {
  const used = await User.countDocuments({
    superadminRef: req.user._id,
    role: "admin",
  });
  return successResponse(res, 200, "Quota fetched", {
    used,
    limit: req.user.adminCreationLimit || 0,
  });
});

// ─── SUSPEND / ACTIVATE (admins AND operators) ───────────────────────────────
// The superadmin can suspend/activate any admin created under them, or any
// operator belonging to one of those admins. Suspending an admin cascades
// automatically to its operators/officers via the live hierarchy check in
// utils/hierarchyStatus.js — no descendant documents need to be touched.

// Ensures the target user (admin or operator) actually belongs to this
// superadmin's own hierarchy before allowing a suspend/activate action.
const assertOwnedByThisSuperadmin = async (superadminId, userId) => {
  const target = await User.findById(userId);
  if (!target) return null;

  if (target.role === "admin") {
    return target.superadminRef?.toString() === superadminId.toString()
      ? target
      : null;
  }
  if (
    target.role === "operator_special" ||
    target.role === "operator_regular"
  ) {
    if (!target.adminRef) return null;
    const parentAdmin = await User.findById(target.adminRef).select(
      "superadminRef",
    );
    return parentAdmin?.superadminRef?.toString() === superadminId.toString()
      ? target
      : null;
  }
  return null;
};

// @desc   Suspend an admin or operator under this superadmin
// @route  PATCH /api/superadmin/suspend/:userId
const suspendUser = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  if (!reason) return errorResponse(res, 400, "Suspension reason required");

  const user = await assertOwnedByThisSuperadmin(
    req.user._id,
    req.params.userId,
  );
  if (!user)
    return errorResponse(res, 404, "User not found under your hierarchy");
  if (user.status === "suspended")
    return errorResponse(res, 400, "Already suspended");

  await User.findByIdAndUpdate(user._id, {
    status: "suspended",
    suspendedBy: req.user._id,
    suspendedAt: new Date(),
    suspendReason: reason,
  });

  await notifyAccountSuspended(user.phone, user.name, reason);
  await createNotification({
    recipientId: user._id,
    title: "Account Suspended",
    body: `Your account has been suspended. Reason: ${reason}`,
    type: "account_suspended",
    sendPush: false,
  });

  const label = user.role === "admin" ? "Admin" : "Operator";
  return successResponse(
    res,
    200,
    `${label} suspended${user.role === "admin" ? ". All operators and officers under this admin are now locked out." : ""}`,
  );
});

// @desc   Activate a suspended admin or operator under this superadmin
// @route  PATCH /api/superadmin/activate/:userId
const activateUser = asyncHandler(async (req, res) => {
  const user = await assertOwnedByThisSuperadmin(
    req.user._id,
    req.params.userId,
  );
  if (!user)
    return errorResponse(res, 404, "User not found under your hierarchy");
  if (user.status === "active")
    return errorResponse(res, 400, "Already active");

  await User.findByIdAndUpdate(user._id, {
    status: "active",
    $unset: { suspendedBy: 1, suspendedAt: 1, suspendReason: 1 },
  });

  await createNotification({
    recipientId: user._id,
    title: "Account Activated",
    body: "Your account has been reactivated. You can now log in.",
    type: "account_activated",
    sendPush: false,
  });

  return successResponse(
    res,
    200,
    `${user.role === "admin" ? "Admin" : "Operator"} activated`,
  );
});

// ─── EXCEL BULK OFFICER UPLOAD (same feature the master has, scoped to own hierarchy) ─

// @desc   Bulk upload officers via Excel — admin must belong to this superadmin
// @route  POST /api/superadmin/officers/bulk-upload
const bulkUploadOfficers = asyncHandler(async (req, res) => {
  if (!req.file) return errorResponse(res, 400, "Excel file required");
  const { adminId } = req.body;
  if (!adminId) return errorResponse(res, 400, "Admin ID required");

  const admin = await User.findOne({
    _id: adminId,
    role: "admin",
    superadminRef: req.user._id,
  });
  if (!admin)
    return errorResponse(res, 404, "Admin not found under your hierarchy");
  if (admin.status !== "active")
    return errorResponse(res, 400, "Admin is not active");

  const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawRows = xlsx.utils.sheet_to_json(sheet);

  if (rawRows.length === 0)
    return errorResponse(res, 400, "Excel file is empty");

  const FIELD_ALIASES = {
    name: "name",
    email: "email",
    phone: "phone",
    gender: "gender",
    dateofbirth: "dateOfBirth",
    rankcode: "rank",
    rank: "rank",
    rankname: "rank",
    badgenumber: "badgeNumber",
    designation: "designation",
    thana: "thana",
    policestation: "thana",
    zone: "zone",
  };

  const normalizeRow = (row) => {
    const normalized = {};
    for (const key of Object.keys(row)) {
      const cleanKey = key
        .trim()
        .toLowerCase()
        .replace(/[\s_-]/g, "");
      const mappedKey = FIELD_ALIASES[cleanKey] || key;
      normalized[mappedKey] = row[key];
    }
    return normalized;
  };

  const rows = rawRows.map(normalizeRow);
  const total = rows.length;

  // Same NDJSON streaming progress pattern used by the master's bulk upload
  // (see masterController.bulkUploadOfficers) — kept consistent so the same
  // frontend upload experience works for both roles.
  res.setHeader("Content-Type", "application/x-ndjson");
  res.setHeader("Cache-Control", "no-cache");
  if (typeof res.flushHeaders === "function") res.flushHeaders();

  const sendEvent = (event) => res.write(JSON.stringify(event) + "\n");

  const results = { created: 0, failed: [], skipped: 0 };
  sendEvent({ type: "start", total });

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const {
        name,
        email,
        phone,
        gender,
        dateOfBirth,
        rank: rankInput,
        badgeNumber,
        designation,
        thana,
        zone,
      } = row;

      if (!name || !email || !phone || !rankInput) {
        results.failed.push({
          row: name || email,
          reason: "Missing required fields",
        });
      } else if (!/^[6-9]\d{9}$/.test(String(phone))) {
        results.failed.push({ row: email, reason: "Invalid phone number" });
      } else {
        const rank = await resolveRank(rankInput);
        if (!rank) {
          results.failed.push({
            row: email,
            reason: `Rank '${rankInput}' not recognized`,
          });
        } else {
          const existingUser = await User.findOne({
            email: email.toLowerCase(),
          });
          if (existingUser) {
            results.skipped++;
          } else {
            const tempPassword = generateTempPassword();
            const userDoc = await User.create({
              name,
              email: email.toLowerCase(),
              phone: String(phone),
              password: String(phone),
              gender: normalizeGender(gender),
              dateOfBirth: dateOfBirth
                ? new Date(dateOfBirth)
                : new Date("1990-01-01"),
              role: "officer",
              adminRef: adminId,
              superadminRef: req.user._id,
              rankRef: rank._id,
              badgeNumber: badgeNumber ? String(badgeNumber) : undefined,
              designation,
              thana: thana ? String(thana).trim() : null,
              zone: zone ? String(zone).trim() : null,
            });

            await Officer.create({
              userRef: userDoc._id,
              adminRef: adminId,
              superadminRef: req.user._id,
              name,
              phone: String(phone),
              email: email.toLowerCase(),
              gender: normalizeGender(gender),
              dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
              rankRef: rank._id,
              badgeNumber: badgeNumber ? String(badgeNumber) : undefined,
              designation,
              thana: thana ? String(thana).trim() : null,
              zone: zone ? String(zone).trim() : null,
            });

            await sendWelcomeMessage(
              String(phone),
              name,
              `Officer (${rank.name})`,
              email,
              tempPassword,
            );
            results.created++;
          }
        }
      }
    } catch (err) {
      results.failed.push({ row: row.email || row.name, reason: err.message });
    }

    sendEvent({
      type: "progress",
      processed: i + 1,
      total,
      percent: Math.round(((i + 1) / total) * 100),
      created: results.created,
      skipped: results.skipped,
      failed: results.failed.length,
      lastRow: row.name || row.email || null,
    });
  }

  sendEvent({ type: "done", result: results });
  res.end();
});

// @desc   View all officers under this superadmin
// @route  GET /api/superadmin/officers
const getAllOfficers = asyncHandler(async (req, res) => {
  const { adminId, page, limit, search, rankId, availability, status } = req.query;
  const query = { superadminRef: req.user._id };
  if (adminId) query.adminRef = adminId;
  if (rankId) query.rankRef = rankId;
  if (availability) query.dutyAvailability = availability; // available | on_leave | pending_return
  if (status) query.status = status; // active | suspended | inactive
  if (search) query.$or = [
    { name: { $regex: search, $options: "i" } },
    { badgeNumber: { $regex: search, $options: "i" } },
  ];

  const result = await paginateQuery(Officer, query, page, limit, [
    { path: "rankRef", select: "name code color priority leaveTier leaveApprovalRole" },
    { path: "adminRef", select: "name email" },
    { path: "userRef", select: "status lastLogin" },
    { path: "currentLeaveRef", select: "leaveType fromDate toDate status remark" },
  ]);
  return successResponse(res, 200, "Officers fetched", result);
});

// @desc   Distinct thana/zone values in use under this superadmin — powers
//         the filter dropdowns on the officer list.
// @route  GET /api/superadmin/officers/locations
const getOfficerLocations = asyncHandler(async (req, res) => {
  const { adminId } = req.query;
  const match = {
    superadminRef: req.user._id,
    ...(adminId ? { adminRef: adminId } : {}),
  };
  const [thanas, zones, ranks] = await Promise.all([
    Officer.distinct("thana", { ...match, thana: { $nin: [null, ""] } }),
    Officer.distinct("zone", { ...match, zone: { $nin: [null, ""] } }),
    Rank.find({ isActive: true }).sort({ priority: 1 }).select("name code color"),
  ]);
  return successResponse(res, 200, "Locations fetched", {
    thanas: thanas.sort(),
    zones: zones.sort(),
    ranks,
  });
});

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ─── DUTIES / DASHBOARD (unchanged) ──────────────────────────────────────────

// @desc   Get all duties (superadmin view, all admins)
// @route  GET /api/superadmin/duties
const getAllDuties = asyncHandler(async (req, res) => {
  const { page, limit, status, adminId, search, priority } = req.query;
  const query = { superadminRef: req.user._id };
  if (status) query.status = status;
  if (adminId) query.adminRef = adminId;
  if (priority) query.priority = parseInt(priority);
  if (search)
    query.$or = [
      { dutyName: { $regex: search, $options: "i" } },
      { locationName: { $regex: search, $options: "i" } },
    ];

  const result = await paginateQuery(
    Duty,
    query,
    page,
    limit,
    [
      { path: "operatorRef", select: "name role" },
      { path: "adminRef", select: "name email" },
      { path: "assignedOfficers.officerRef", select: "name" },
      { path: "assignedOfficers.rankRef", select: "name code" },
    ],
    { createdAt: -1 },
  );
  return successResponse(res, 200, "Duties fetched", result);
});

// @desc   Get operators under a specific admin (lightweight, for dropdowns)
// @route  GET /api/superadmin/admins/:adminId/operators
const getOperatorsByAdmin = asyncHandler(async (req, res) => {
  const admin = await User.findOne({
    _id: req.params.adminId,
    superadminRef: req.user._id,
    role: "admin",
  });
  if (!admin) return errorResponse(res, 404, "Admin not found");

  const operators = await User.find({
    adminRef: admin._id,
    role: { $in: ["operator_special", "operator_regular"] },
  }).select("name role status");

  return successResponse(res, 200, "Operators fetched", { operators });
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
    .select(
      "dutyName locationName location status priority startDate endDate operatorRef adminRef assignedOfficers",
    )
    .populate("operatorRef", "name role")
    .populate("adminRef", "name")
    .sort({ createdAt: -1 })
    .limit(500)
    .lean();

  const slim = duties.map((d) => ({
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
    officersCount: (d.assignedOfficers || []).filter(
      (a) => a.status !== "replaced",
    ).length,
  }));

  return successResponse(res, 200, "Duties fetched", { duties: slim });
});

// @desc   Get dashboard stats
// @route  GET /api/superadmin/dashboard
const getDashboardStats = asyncHandler(async (req, res) => {
  const superadminId = req.user._id;
  const [
    totalAdmins,
    activeAdmins,
    totalOfficers,
    officersOnLeave,
    totalDuties,
    activeDuties,
    completedDuties,
  ] = await Promise.all([
    User.countDocuments({ superadminRef: superadminId, role: "admin" }),
    User.countDocuments({
      superadminRef: superadminId,
      role: "admin",
      status: "active",
    }),
    Officer.countDocuments({ superadminRef: superadminId }),
    Officer.countDocuments({ superadminRef: superadminId, dutyAvailability: "on_leave" }),
    Duty.countDocuments({ superadminRef: superadminId }),
    Duty.countDocuments({ superadminRef: superadminId, status: "active" }),
    Duty.countDocuments({ superadminRef: superadminId, status: "completed" }),
  ]);

  return successResponse(res, 200, "Dashboard stats", {
    totalAdmins,
    activeAdmins,
    totalOfficers,
    officersOnLeave,
    totalDuties,
    activeDuties,
    completedDuties,
    adminQuota: { used: totalAdmins, limit: req.user.adminCreationLimit || 0 },
  });
});

// @desc   Get single duty detail with full info (superadmin view)
// @route  GET /api/superadmin/duties/:dutyId
const getDutyById = asyncHandler(async (req, res) => {
  const duty = await Duty.findOne({
    _id: req.params.dutyId,
    superadminRef: req.user._id,
  })
    .populate("assignedOfficers.officerRef", "name phone badgeNumber")
    .populate("assignedOfficers.rankRef", "name code color")
    .populate("assignedOfficers.replacedBy", "name badgeNumber")
    .populate("assignedOfficers.assignedBy", "name role")
    .populate("rankRequirements.rankRef", "name code color")
    .populate("operatorRef", "name phone email role")
    .populate("adminRef", "name phone email")
    .populate("superadminRef", "name email")
    .populate("timeline.performedBy", "name role");

  if (!duty) return errorResponse(res, 404, "Duty not found");

  const attendanceRecords = await Attendance.find({ dutyRef: duty._id })
    .populate("officerRef", "name badgeNumber phone")
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

  const mapsLink =
    duty.location?.lat && duty.location?.lng
      ? `https://www.google.com/maps/dir/?api=1&destination=${duty.location.lat},${duty.location.lng}`
      : null;

  return successResponse(res, 200, "Duty fetched", {
    duty,
    attendanceMap,
    mapsLink,
  });
});

module.exports = {
  createAdmin,
  getAdmins,
  getAdminDetails,
  getAdminQuota,
  suspendUser,
  activateUser,
  bulkUploadOfficers,
  getAllOfficers,
  getAllDuties,
  getDashboardStats,
  getOperatorsByAdmin,
  getDutiesForMap,
  getDutyById,
  getOfficerLocations
};