const asyncHandler = require('express-async-handler');
const Attendance = require('../models/Attendance');
const Duty = require('../models/Duty');
const Officer = require('../models/Officer');
const Rank = require('../models/Rank');
const { successResponse, errorResponse } = require('../utils/response');

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const CHECKIN_RADIUS_METERS = 1000; // 1 km

// ─── UTILITY ─────────────────────────────────────────────────────────────────

/**
 * Haversine formula — returns distance in meters between two lat/lng points.
 */
const getDistanceMeters = (lat1, lng1, lat2, lng2) => {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// ─── OFFICER: CHECK-IN ────────────────────────────────────────────────────────

// @desc   Officer checks in to a duty (must be within 1km of duty location)
// @route  POST /api/attendance/checkin
// @access Officer
const checkIn = asyncHandler(async (req, res) => {
  const { dutyId, lat, lng } = req.body;

  if (!dutyId || lat === undefined || lng === undefined) {
    return errorResponse(res, 400, 'dutyId, lat, and lng are required');
  }

  const officerLat = parseFloat(lat);
  const officerLng = parseFloat(lng);

  if (isNaN(officerLat) || isNaN(officerLng)) {
    return errorResponse(res, 400, 'Invalid coordinates');
  }

  // Find the officer profile
  const officer = await Officer.findOne({ userRef: req.user._id });
  if (!officer) return errorResponse(res, 404, 'Officer profile not found');

  // Verify the duty exists and this officer is assigned
  const duty = await Duty.findOne({
    _id: dutyId,
    status: 'active',
    assignedOfficers: {
      $elemMatch: {
        officerRef: officer._id,
        status: { $in: ['assigned', 'accepted'] },
      },
    },
  });

  if (!duty) {
    return errorResponse(res, 404, 'Active duty assignment not found');
  }

  // Check if already checked in
  const existing = await Attendance.findOne({ dutyRef: dutyId, officerRef: officer._id });
  if (existing && existing.checkedInAt) {
    return errorResponse(res, 409, 'You have already checked in to this duty');
  }

  // Calculate distance from duty location
  const distanceMeters = getDistanceMeters(
    officerLat, officerLng,
    duty.location.lat, duty.location.lng
  );

  const isWithinRadius = distanceMeters <= CHECKIN_RADIUS_METERS;

  if (!isWithinRadius) {
    return errorResponse(
      res,
      400,
      `You are ${Math.round(distanceMeters)}m from the duty location. Check-in requires you to be within ${CHECKIN_RADIUS_METERS / 1000}km.`
    );
  }

  // Create or update attendance record
  const now = new Date();
  const attendanceData = {
    dutyRef: duty._id,
    officerRef: officer._id,
    officerUserRef: req.user._id,
    operatorRef: duty.operatorRef,
    adminRef: duty.adminRef,
    superadminRef: duty.superadminRef,
    checkedInAt: now,
    checkInLocation: { lat: officerLat, lng: officerLng },
    checkInDistanceMeters: Math.round(distanceMeters),
    isWithinRadius: true,
    status: 'partial',
    dutySnapshot: {
      dutyName: duty.dutyName,
      locationName: duty.locationName,
      dutyLat: duty.location.lat,
      dutyLng: duty.location.lng,
      startDate: duty.startDate,
      endDate: duty.endDate,
    },
  };

  const attendance = await Attendance.findOneAndUpdate(
    { dutyRef: duty._id, officerRef: officer._id },
    attendanceData,
    { upsert: true, new: true }
  );

  return successResponse(res, 200, 'Check-in successful', {
    attendance: {
      _id: attendance._id,
      checkedInAt: attendance.checkedInAt,
      checkInDistanceMeters: attendance.checkInDistanceMeters,
      dutyName: duty.dutyName,
      locationName: duty.locationName,
    },
  });
});

// ─── OFFICER: CHECK-OUT ───────────────────────────────────────────────────────

// @desc   Officer checks out of a duty
// @route  POST /api/attendance/checkout
// @access Officer
const checkOut = asyncHandler(async (req, res) => {
  const { dutyId, lat, lng } = req.body;

  if (!dutyId) return errorResponse(res, 400, 'dutyId is required');

  const officer = await Officer.findOne({ userRef: req.user._id });
  if (!officer) return errorResponse(res, 404, 'Officer profile not found');

  const attendance = await Attendance.findOne({
    dutyRef: dutyId,
    officerRef: officer._id,
  });

  if (!attendance || !attendance.checkedInAt) {
    return errorResponse(res, 400, 'You have not checked in to this duty yet');
  }

  if (attendance.checkedOutAt) {
    return errorResponse(res, 409, 'You have already checked out of this duty');
  }

  const now = new Date();
  const durationMinutes = Math.round(
    (now - attendance.checkedInAt) / (1000 * 60)
  );

  let checkOutDistanceMeters = null;
  if (lat !== undefined && lng !== undefined) {
    const duty = await Duty.findById(dutyId).select('location');
    if (duty) {
      checkOutDistanceMeters = Math.round(
        getDistanceMeters(parseFloat(lat), parseFloat(lng), duty.location.lat, duty.location.lng)
      );
    }
  }

  attendance.checkedOutAt = now;
  if (lat !== undefined && lng !== undefined) {
    attendance.checkOutLocation = { lat: parseFloat(lat), lng: parseFloat(lng) };
  }
  attendance.checkOutDistanceMeters = checkOutDistanceMeters;
  attendance.durationMinutes = durationMinutes;
  attendance.status = 'present';
  await attendance.save();

  return successResponse(res, 200, 'Check-out successful', {
    attendance: {
      _id: attendance._id,
      checkedInAt: attendance.checkedInAt,
      checkedOutAt: attendance.checkedOutAt,
      durationMinutes,
    },
  });
});

// ─── OFFICER: GET MY ATTENDANCE STATUS FOR A DUTY ────────────────────────────

// @desc   Officer checks their own attendance for a duty
// @route  GET /api/attendance/my/:dutyId
// @access Officer
const getMyAttendance = asyncHandler(async (req, res) => {
  const officer = await Officer.findOne({ userRef: req.user._id });
  if (!officer) return errorResponse(res, 404, 'Officer profile not found');

  const attendance = await Attendance.findOne({
    dutyRef: req.params.dutyId,
    officerRef: officer._id,
  });

  return successResponse(res, 200, 'Attendance fetched', {
    attendance: attendance || null,
    hasCheckedIn: !!(attendance?.checkedInAt),
    hasCheckedOut: !!(attendance?.checkedOutAt),
  });
});

// ─── OPERATOR / ADMIN / SUPERADMIN: VIEW ATTENDANCE FOR A DUTY ───────────────

// @desc   Get attendance list for a specific duty (with role-based access control)
// @route  GET /api/attendance/duty/:dutyId
// @access Operator (own duties), Admin (their admin's duties), Superadmin/Master
const getDutyAttendance = asyncHandler(async (req, res) => {
  const { dutyId } = req.params;
  const role = req.user.role;

  // Build duty filter based on role
  let dutyFilter = { _id: dutyId };
  if (role === 'officer') {
    return errorResponse(res, 403, 'Access denied');
  } else if (role === 'operator_special' || role === 'operator_regular') {
    dutyFilter.operatorRef = req.user._id;
  } else if (role === 'admin') {
    dutyFilter.adminRef = req.user._id;
  } else if (role === 'superadmin') {
    dutyFilter.superadminRef = req.user._id;
  }
  // master role: no extra filter

  const duty = await Duty.findOne(dutyFilter)
    .populate('assignedOfficers.officerRef', 'name phone badgeNumber')
    .populate('assignedOfficers.rankRef', 'name code color');

  if (!duty) return errorResponse(res, 404, 'Duty not found or access denied');

  // Fetch attendance records for this duty
  const attendanceRecords = await Attendance.find({ dutyRef: dutyId })
    .populate('officerRef', 'name phone badgeNumber')
    .sort({ checkedInAt: 1 });

  // Build a map of officerRef -> attendance
  const attendanceMap = {};
  for (const record of attendanceRecords) {
    attendanceMap[record.officerRef._id.toString()] = record;
  }

  // Merge assignment data with attendance data
  const summary = duty.assignedOfficers
    .filter(ao => ['assigned', 'accepted'].includes(ao.status))
    .map((ao) => {
      const officerId = ao.officerRef?._id?.toString();
      const att = attendanceMap[officerId];
      return {
        officer: {
          _id: ao.officerRef?._id,
          name: ao.officerRef?.name,
          phone: ao.officerRef?.phone,
          badgeNumber: ao.officerRef?.badgeNumber,
        },
        rank: ao.rankRef,
        assignmentStatus: ao.status,
        attendance: att
          ? {
              _id: att._id,
              checkedInAt: att.checkedInAt,
              checkedOutAt: att.checkedOutAt,
              durationMinutes: att.durationMinutes,
              checkInDistanceMeters: att.checkInDistanceMeters,
              status: att.status,
              isWithinRadius: att.isWithinRadius,
            }
          : null,
        attendanceStatus: att ? att.status : 'absent',
      };
    });

  const stats = {
    totalAssigned: summary.length,
    present: summary.filter((s) => s.attendanceStatus === 'present').length,
    partial: summary.filter((s) => s.attendanceStatus === 'partial').length,
    absent: summary.filter((s) => s.attendanceStatus === 'absent').length,
  };

  return successResponse(res, 200, 'Duty attendance fetched', {
    duty: {
      _id: duty._id,
      dutyName: duty.dutyName,
      locationName: duty.locationName,
      location: duty.location,
      startDate: duty.startDate,
      endDate: duty.endDate,
      status: duty.status,
    },
    summary,
    stats,
  });
});

// ─── EXPORT ATTENDANCE PDF (HTML stream for browser print/PDF) ────────────────

// @desc   Export duty attendance as a professional PDF (HTML-based, browser printable)
// @route  GET /api/attendance/duty/:dutyId/export-pdf
// @access Operator (own duty), Admin (their duties)
const exportAttendancePDF = asyncHandler(async (req, res) => {
  const { dutyId } = req.params;
  const role = req.user.role;

  if (role === 'officer' || role === 'superadmin' || role === 'master') {
    return errorResponse(res, 403, 'Only operators and admins can export attendance PDF');
  }

  let dutyFilter = { _id: dutyId };
  if (role === 'operator_special' || role === 'operator_regular') {
    dutyFilter.operatorRef = req.user._id;
  } else if (role === 'admin') {
    dutyFilter.adminRef = req.user._id;
  }

  const duty = await Duty.findOne(dutyFilter)
    .populate('assignedOfficers.officerRef', 'name phone badgeNumber')
    .populate('assignedOfficers.rankRef', 'name code color')
    .populate('operatorRef', 'name phone')
    .populate('adminRef', 'name');

  if (!duty) return errorResponse(res, 404, 'Duty not found or access denied');

  const attendanceRecords = await Attendance.find({ dutyRef: dutyId })
    .populate('officerRef', 'name phone badgeNumber')
    .sort({ checkedInAt: 1 });

  const attendanceMap = {};
  for (const record of attendanceRecords) {
    attendanceMap[record.officerRef._id.toString()] = record;
  }

  const activeOfficers = duty.assignedOfficers.filter(
    (ao) => ['assigned', 'accepted'].includes(ao.status)
  );

  const summary = activeOfficers.map((ao) => {
    const officerId = ao.officerRef?._id?.toString();
    const att = attendanceMap[officerId];
    return {
      officer: ao.officerRef,
      rank: ao.rankRef,
      att: att || null,
      attendanceStatus: att ? att.status : 'absent',
    };
  });

  const stats = {
    total: summary.length,
    present: summary.filter((s) => s.attendanceStatus === 'present').length,
    partial: summary.filter((s) => s.attendanceStatus === 'partial').length,
    absent: summary.filter((s) => s.attendanceStatus === 'absent').length,
  };

  const formatDate = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
  };

  const formatDuration = (mins) => {
    if (!mins) return '—';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const statusBadge = (status) => {
    const map = {
      present: { label: 'Present', color: '#16a34a', bg: '#dcfce7' },
      partial: { label: 'Checked In', color: '#d97706', bg: '#fef3c7' },
      absent: { label: 'Absent', color: '#dc2626', bg: '#fee2e2' },
    };
    const s = map[status] || map.absent;
    return `<span style="background:${s.bg};color:${s.color};padding:2px 10px;border-radius:20px;font-size:11px;font-weight:600;letter-spacing:0.5px;">${s.label}</span>`;
  };

  const tableRows = summary
    .map((s, idx) => {
      const att = s.att;
      return `
      <tr style="background:${idx % 2 === 0 ? '#fff' : '#f8fafc'};">
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:center;color:#64748b;font-size:13px;">${idx + 1}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;">
          <div style="font-weight:600;color:#0f172a;font-size:13px;">${s.officer?.name || '—'}</div>
          <div style="color:#64748b;font-size:11px;">${s.officer?.badgeNumber ? `Badge: ${s.officer.badgeNumber}` : ''}</div>
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#475569;">${s.rank?.name || '—'}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#475569;">${s.officer?.phone || '—'}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#475569;">${formatDate(att?.checkedInAt)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#475569;">${formatDate(att?.checkedOutAt)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#475569;">${formatDuration(att?.durationMinutes)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:center;">${statusBadge(s.attendanceStatus)}</td>
      </tr>
    `;
    })
    .join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Attendance Report - ${duty.dutyName}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', 'Segoe UI', Arial, sans-serif; background: #fff; color: #0f172a; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
      @page { margin: 15mm 12mm; size: A4 landscape; }
    }
  </style>
</head>
<body style="padding:32px 40px;max-width:1100px;margin:0 auto;">

  <!-- Header Banner -->
  <div style="background:linear-gradient(135deg,#1e3a5f 0%,#0f172a 100%);border-radius:12px;padding:28px 32px;margin-bottom:28px;display:flex;justify-content:space-between;align-items:center;">
    <div>
      <div style="color:#93c5fd;font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;">Duty Management System</div>
      <h1 style="color:#fff;font-size:22px;font-weight:800;line-height:1.2;margin-bottom:4px;">Attendance Report</h1>
      <div style="color:#94a3b8;font-size:13px;">Generated on ${formatDate(new Date())}</div>
    </div>
    <div style="text-align:right;">
      <div style="color:#93c5fd;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">Exported by</div>
      <div style="color:#fff;font-size:14px;font-weight:600;">${req.user.name}</div>
      <div style="color:#94a3b8;font-size:12px;text-transform:capitalize;">${role.replace('_', ' ')}</div>
    </div>
  </div>

  <!-- Duty Info Card -->
  <div style="border:1px solid #e2e8f0;border-radius:10px;padding:20px 24px;margin-bottom:24px;background:#f8fafc;">
    <div style="font-size:11px;font-weight:700;color:#64748b;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:14px;">Duty Details</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;">
      <div>
        <div style="font-size:11px;color:#94a3b8;margin-bottom:3px;">Duty Name</div>
        <div style="font-size:14px;font-weight:600;color:#0f172a;">${duty.dutyName}</div>
      </div>
      <div>
        <div style="font-size:11px;color:#94a3b8;margin-bottom:3px;">Location</div>
        <div style="font-size:14px;font-weight:600;color:#0f172a;">${duty.locationName}</div>
      </div>
      <div>
        <div style="font-size:11px;color:#94a3b8;margin-bottom:3px;">Status</div>
        <div style="font-size:14px;font-weight:600;color:#0f172a;text-transform:capitalize;">${duty.status}</div>
      </div>
      <div>
        <div style="font-size:11px;color:#94a3b8;margin-bottom:3px;">Start Date</div>
        <div style="font-size:13px;font-weight:500;color:#334155;">${formatDate(duty.startDate)}</div>
      </div>
      <div>
        <div style="font-size:11px;color:#94a3b8;margin-bottom:3px;">End Date</div>
        <div style="font-size:13px;font-weight:500;color:#334155;">${formatDate(duty.endDate)}</div>
      </div>
      <div>
        <div style="font-size:11px;color:#94a3b8;margin-bottom:3px;">Operator</div>
        <div style="font-size:13px;font-weight:500;color:#334155;">${duty.operatorRef?.name || '—'}</div>
      </div>
    </div>
  </div>

  <!-- Stats Row -->
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:24px;">
    ${[
      { label: 'Total Assigned', value: stats.total, color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe' },
      { label: 'Present', value: stats.present, color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
      { label: 'Checked In', value: stats.partial, color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
      { label: 'Absent', value: stats.absent, color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
    ]
      .map(
        (s) => `
      <div style="border:1px solid ${s.border};border-radius:10px;padding:16px 18px;background:${s.bg};text-align:center;">
        <div style="font-size:28px;font-weight:800;color:${s.color};line-height:1;">${s.value}</div>
        <div style="font-size:11px;font-weight:600;color:${s.color};margin-top:4px;text-transform:uppercase;letter-spacing:0.5px;">${s.label}</div>
      </div>`
      )
      .join('')}
  </div>

  <!-- Attendance Table -->
  <div style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:32px;">
    <div style="background:#1e3a5f;padding:14px 16px;">
      <div style="color:#fff;font-size:13px;font-weight:700;letter-spacing:0.5px;">Officer Attendance Details</div>
    </div>
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="background:#f1f5f9;">
          <th style="padding:10px 12px;text-align:center;font-size:11px;font-weight:700;color:#64748b;letter-spacing:0.5px;border-bottom:2px solid #e2e8f0;white-space:nowrap;">#</th>
          <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#64748b;letter-spacing:0.5px;border-bottom:2px solid #e2e8f0;">Officer</th>
          <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#64748b;letter-spacing:0.5px;border-bottom:2px solid #e2e8f0;">Rank</th>
          <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#64748b;letter-spacing:0.5px;border-bottom:2px solid #e2e8f0;">Phone</th>
          <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#64748b;letter-spacing:0.5px;border-bottom:2px solid #e2e8f0;white-space:nowrap;">Check-In</th>
          <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#64748b;letter-spacing:0.5px;border-bottom:2px solid #e2e8f0;white-space:nowrap;">Check-Out</th>
          <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#64748b;letter-spacing:0.5px;border-bottom:2px solid #e2e8f0;">Duration</th>
          <th style="padding:10px 12px;text-align:center;font-size:11px;font-weight:700;color:#64748b;letter-spacing:0.5px;border-bottom:2px solid #e2e8f0;">Status</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows || `<tr><td colspan="8" style="text-align:center;padding:24px;color:#94a3b8;font-size:13px;">No attendance records found</td></tr>`}
      </tbody>
    </table>
  </div>

  <!-- Duty Location Map -->
  ${duty.location?.lat && duty.location?.lng ? (() => {
    const lat  = duty.location.lat;
    const lng  = duty.location.lng;
    const zoom = 15;

    // Tile x,y from lat/lng
    const tileX = Math.floor((lng + 180) / 360 * Math.pow(2, zoom));
    const tileY = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));

    // 3x3 tile grid = 768x768 total
    const tiles = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        tiles.push({ x: tileX + dx, y: tileY + dy, col: dx + 1, row: dy + 1 });
      }
    }

    // Sub-tile pixel offset of the exact lat/lng
    const tileCount = Math.pow(2, zoom);
    const fracX = (lng + 180) / 360 * tileCount - tileX;
    const mercN = Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180));
    const fracY = (1 - mercN / Math.PI) / 2 * tileCount - tileY;
    const markerPxX = Math.round(1 * 256 + fracX * 256);
    const markerPxY = Math.round(1 * 256 + fracY * 256);

    const tileImgs = tiles.map(t =>
      `<img src="https://tile.openstreetmap.org/${zoom}/${t.x}/${t.y}.png" style="position:absolute;left:${t.col*256}px;top:${t.row*256}px;width:256px;height:256px;" crossorigin="anonymous" />`
    ).join('');

    return `
  <div style="margin-bottom:32px;page-break-inside:avoid;">
    <div style="font-size:11px;font-weight:700;color:#64748b;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:14px;">Duty Location Map</div>
    <div style="border:2px solid #e2e8f0;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
      <div style="background:#1e3a5f;padding:12px 18px;display:flex;align-items:center;gap:10px;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#93c5fd" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
        <span style="color:#fff;font-size:13px;font-weight:700;">${duty.dutyName}</span>
        <span style="color:#94a3b8;font-size:12px;">— ${duty.locationName}</span>
        <span style="color:#64748b;font-size:11px;margin-left:auto;">${lat}, ${lng}</span>
      </div>
      <div style="position:relative;width:100%;height:400px;overflow:hidden;background:#e8e0d8;">
        <div id="tile-grid" style="position:absolute;width:768px;height:768px;display:none;">
          ${tileImgs}
        </div>
        <canvas id="map-canvas" width="768" height="400" style="display:block;width:100%;height:400px;"></canvas>
        <svg id="map-pin" viewBox="0 0 40 52" width="32" height="42"
             style="position:absolute;left:${markerPxX}px;top:${markerPxY - 42}px;transform:translateX(-50%);filter:drop-shadow(0 2px 4px rgba(0,0,0,0.4));pointer-events:none;display:none;">
          <path d="M20 0C9 0 0 9 0 20c0 14 20 32 20 32s20-18 20-32C40 9 31 0 20 0z" fill="#dc2626"/>
          <circle cx="20" cy="20" r="8" fill="#fff"/>
          <circle cx="20" cy="20" r="4" fill="#dc2626"/>
        </svg>
        <div id="map-label" style="position:absolute;left:${markerPxX}px;top:${markerPxY + 2}px;transform:translateX(-50%);
             background:rgba(30,58,95,0.92);color:#fff;font-size:11px;font-weight:700;
             padding:3px 8px;border-radius:4px;white-space:nowrap;pointer-events:none;display:none;">
          ${duty.dutyName}
        </div>
      </div>
      <div style="background:#f8fafc;padding:10px 18px;display:flex;justify-content:space-between;align-items:center;border-top:1px solid #e2e8f0;">
        <span style="font-size:11px;color:#64748b;"><strong>Coordinates:</strong> ${lat}, ${lng}</span>
        <a href="https://www.google.com/maps/search/?api=1&query=${lat},${lng}" target="_blank"
           style="font-size:11px;color:#3b82f6;font-weight:600;text-decoration:none;">
          Open in Google Maps &#8599;
        </a>
      </div>
    </div>
  </div>

  <script class="no-print">
  (function() {
    var canvas = document.getElementById('map-canvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var W = 768, H = 400;
    canvas.width = W; canvas.height = H;

    var markerPxX = ${markerPxX};
    var markerPxY = ${markerPxY};
    var offsetY = Math.max(0, Math.min(768 - H, markerPxY - H / 2));
    var offsetX = Math.max(0, Math.min(768 - W, markerPxX - W / 2));

    var pinEl = document.getElementById('map-pin');
    var lblEl = document.getElementById('map-label');

    function positionOverlays() {
      var px = markerPxX - offsetX;
      var py = markerPxY - offsetY;
      if (pinEl) { pinEl.style.left = px + 'px'; pinEl.style.top = (py - 42) + 'px'; pinEl.style.display = 'block'; }
      if (lblEl) { lblEl.style.left = px + 'px'; lblEl.style.top = (py + 2) + 'px'; lblEl.style.display = 'block'; }
    }

    ctx.fillStyle = '#e8e0d8';
    ctx.fillRect(0, 0, W, H);

    var grid = document.getElementById('tile-grid');
    var imgEls = grid.querySelectorAll('img');
    var loaded = 0;
    var images = [];

    imgEls.forEach(function(el, i) {
      var info = { left: parseInt(el.style.left), top: parseInt(el.style.top), img: null };
      images.push(info);
      var tmp = new Image();
      tmp.crossOrigin = 'anonymous';
      tmp.onload = function() {
        info.img = tmp;
        loaded++;
        if (loaded === imgEls.length) {
          images.forEach(function(t) {
            if (t.img) ctx.drawImage(t.img, t.left - offsetX, t.top - offsetY, 256, 256);
          });
          positionOverlays();
        }
      };
      tmp.onerror = function() {
        loaded++;
        if (loaded === imgEls.length) positionOverlays();
      };
      tmp.src = el.src;
    });

    function drawPinOnCanvas() {
      var px = markerPxX - offsetX;
      var py = markerPxY - offsetY;
      // Redraw tiles first
      images.forEach(function(t) {
        if (t.img) ctx.drawImage(t.img, t.left - offsetX, t.top - offsetY, 256, 256);
      });
      // Pin body
      ctx.beginPath();
      ctx.arc(px, py - 14, 12, 0, 2 * Math.PI);
      ctx.fillStyle = '#dc2626'; ctx.fill();
      ctx.beginPath();
      ctx.arc(px, py - 14, 5, 0, 2 * Math.PI);
      ctx.fillStyle = '#fff'; ctx.fill();
      // Stem
      ctx.beginPath();
      ctx.moveTo(px, py + 2);
      ctx.lineTo(px - 7, py - 6);
      ctx.lineTo(px + 7, py - 6);
      ctx.closePath();
      ctx.fillStyle = '#dc2626'; ctx.fill();
      // Label
      ctx.font = 'bold 12px Arial, sans-serif';
      var text = '${duty.dutyName}';
      var tw = ctx.measureText(text).width;
      var lx = px - tw / 2 - 6, ly = py + 6;
      ctx.fillStyle = 'rgba(30,58,95,0.92)';
      ctx.fillRect(lx, ly, tw + 12, 20);
      ctx.fillStyle = '#fff';
      ctx.fillText(text, lx + 6, ly + 14);
      if (pinEl) pinEl.style.display = 'none';
      if (lblEl) lblEl.style.display = 'none';
    }

    window.addEventListener('beforeprint', drawPinOnCanvas);
    window.addEventListener('afterprint', positionOverlays);
  })();
  </script>
`;
  })() : `
  <div style="margin-bottom:32px;border:1px solid #e2e8f0;border-radius:10px;padding:20px;text-align:center;background:#f8fafc;">
    <div style="font-size:11px;font-weight:700;color:#64748b;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:10px;">Duty Location Map</div>
    <div style="color:#94a3b8;font-size:13px;">No coordinates available for this duty location.</div>
  </div>`}

  <!-- Footer -->
  <div style="border-top:1px solid #e2e8f0;padding-top:16px;display:flex;justify-content:space-between;align-items:center;">
    <div style="font-size:11px;color:#94a3b8;">This is a system-generated report. No signature required.</div>
    <div style="font-size:11px;color:#94a3b8;">Duty ID: ${duty._id}</div>
  </div>

  <!-- Auto-print trigger -->
  <script class="no-print">
    window.onload = function() {
      var iframe = document.getElementById('duty-map-iframe');
      if (iframe) {
        var printed = false;
        var doPrint = function() {
          if (!printed) { printed = true; setTimeout(function() { window.print(); }, 300); }
        };
        iframe.addEventListener('load', doPrint);
        setTimeout(doPrint, 3500);
      } else {
        setTimeout(function() { window.print(); }, 500);
      }
    };
  </script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `inline; filename="attendance-${duty.dutyName.replace(/\s+/g, '-')}-${Date.now()}.html"`
  );
  res.send(html);
});

// ─── OFFICER: GET ATTENDANCE HISTORY ─────────────────────────────────────────

// @desc   Officer gets their own attendance history across all duties
// @route  GET /api/officer/attendance/history
// @access Officer
const getAttendanceHistory = asyncHandler(async (req, res) => {
  const officer = await Officer.findOne({ userRef: req.user._id });
  if (!officer) return errorResponse(res, 404, 'Officer profile not found');

  const page  = Math.max(1, parseInt(req.query.page)  || 1);
  const limit = Math.min(50, parseInt(req.query.limit) || 10);
  const skip  = (page - 1) * limit;

  const [records, total] = await Promise.all([
    Attendance.find({ officerRef: officer._id })
      .sort({ checkedInAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('dutyRef', 'dutyName locationName startDate endDate status'),
    Attendance.countDocuments({ officerRef: officer._id }),
  ]);

  return successResponse(res, 200, 'Attendance history fetched', {
    records,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  });
});

module.exports = {
  checkIn,
  checkOut,
  getMyAttendance,
  getDutyAttendance,
  exportAttendancePDF,
  getAttendanceHistory,
};