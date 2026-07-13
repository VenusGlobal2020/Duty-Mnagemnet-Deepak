const express = require('express');
const router = express.Router();
const {
  createOperator,
  getOperators,
  updateOperator,
  getDuties,
  getDashboardStats,
  getDutyById,
  getDutiesForMap,
  getAllOfficers,
  getOfficerLocations,
} = require('../controllers/adminController');
const {
  requestLeave, getMyLeaves, cancelMyLeave,
  getPendingApprovals, decideLeave, getHierarchyLeaves, getLeaveLocks, unlockLeaveDay,
} = require('../controllers/leaveController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { uploadLeaveDoc } = require('../config/cloudinary');

router.use(protect, authorize('admin'));

router.get('/dashboard', getDashboardStats);
router.route('/operators').post(createOperator).get(getOperators);
router.put('/operators/:operatorId', updateOperator);
router.get('/duties', getDuties);
router.get('/duties/map', getDutiesForMap);
router.get('/duties/:dutyId', getDutyById);  // ← NEW: admin can view duty detail with attendance

// Read-only officer roster — officer records themselves are managed by
// operators; admin can view + filter (thana/zone/rank/availability/status).
router.get('/officers/locations', getOfficerLocations);
router.get('/officers', getAllOfficers);

// ─── Leave management ────────────────────────────────────────────────────────
// Admin's own leave — always goes to their superadmin. No leave balance
// concept applies to admins (that's officer-only), so no /leaves/balance here.
router.get('/leaves/mine', getMyLeaves);
router.post('/leaves', uploadLeaveDoc.single('document'), requestLeave);
router.patch('/leaves/:id/cancel', cancelMyLeave);

// Admin as an approver — SI/Inspector/DSP leave, and junior-tier leave that
// escalated all the way up (11-14 day casual / 8-10 day earned, or a vacant
// Inspector/DSP post).
router.get('/leaves/approvals', getPendingApprovals);
router.patch('/leaves/:id/decide', decideLeave);

// Full visibility across everyone under this admin, plus threshold-lock control.
router.get('/leaves', getHierarchyLeaves);
router.get('/leaves/locks', getLeaveLocks);
router.patch('/leaves/locks/:id/unlock', unlockLeaveDay);

module.exports = router;