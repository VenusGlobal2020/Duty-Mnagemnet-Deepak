const express = require('express');
const router = express.Router();
const { getActiveDuties, getDutyHistory, rejectDuty, getOfficerProfile, getDutyDetails } = require('../controllers/officerController');
const { requestSwap, cancelMySwapRequest, getMySwapRequests, getSwapColleagues } = require('../controllers/swapController');
const { protect, authorize } = require('../middleware/authMiddleware');

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

module.exports = router;