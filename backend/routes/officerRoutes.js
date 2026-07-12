const express = require('express');
const router = express.Router();
const { getActiveDuties, getDutyHistory, rejectDuty, getOfficerProfile, getDutyDetails } = require('../controllers/officerController');
const { requestSwap, cancelMySwapRequest, getMySwapRequests, getSwapColleagues } = require('../controllers/swapController');
const {
  requestLeave, getMyLeaves, getMyLeaveBalance, cancelMyLeave,
  getPendingApprovals, decideLeave, getThanaOverview, getZoneOverview, adjustLeaveBalance,
} = require('../controllers/leaveController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { uploadLeaveDoc } = require('../config/cloudinary');

router.use(protect, authorize('officer'));

router.get('/profile', getOfficerProfile);
router.get('/duties/active', getActiveDuties);
router.get('/duties/history', getDutyHistory);
router.get('/duties/:dutyId', getDutyDetails);
router.patch('/duties/:dutyId/reject', rejectDuty);

// Swap requests (officer-initiated)
router.get('/colleagues', getSwapColleagues);
router.get('/swaps', getMySwapRequests);
router.post('/swaps/request', requestSwap);
router.patch('/swaps/:swapId/cancel', cancelMySwapRequest);

// ─── Leave management ────────────────────────────────────────────────────────
// Every officer: apply for their own leave, view their own history/balance.
router.get('/leaves/balance', getMyLeaveBalance);
router.get('/leaves', getMyLeaves);
router.post('/leaves', uploadLeaveDoc.single('document'), requestLeave);
router.patch('/leaves/:id/cancel', cancelMyLeave);

// Inspector/DSP-rank officers only (enforced inside the controller by
// checking the officer's own rank.leaveApprovalRole) — approving junior
// officers' leave requests routed to them, plus their staff overview.
router.get('/leaves/approvals', getPendingApprovals);
router.patch('/leaves/:id/decide', decideLeave);
router.get('/leaves/thana-overview', getThanaOverview);     // Inspector
router.get('/leaves/zone-overview', getZoneOverview);       // DSP
router.patch('/leaves/balance/:officerId/adjust', adjustLeaveBalance); // DSP

module.exports = router;