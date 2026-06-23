const express = require('express');
const router = express.Router();
const {
  checkIn,
  checkOut,
  getMyAttendance,
  getDutyAttendance,
  exportAttendancePDF,
} = require('../controllers/attendanceController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);

// ─── OFFICER ROUTES ───────────────────────────────────────────────────────────
// Officer: check-in and check-out
router.post('/checkin', authorize('officer'), checkIn);
router.post('/checkout', authorize('officer'), checkOut);

// Officer: get their own attendance status for a duty
router.get('/my/:dutyId', authorize('officer'), getMyAttendance);

// ─── OPERATOR / ADMIN ROUTES ──────────────────────────────────────────────────
// View attendance for a specific duty (operator sees own duties, admin sees all their duties)
router.get(
  '/duty/:dutyId',
  authorize('operator_special', 'operator_regular', 'admin', 'superadmin', 'master'),
  getDutyAttendance
);

// Export attendance as print-ready HTML/PDF (only operator and admin)
router.get(
  '/duty/:dutyId/export-pdf',
  authorize('operator_special', 'operator_regular', 'admin'),
  exportAttendancePDF
);

module.exports = router;