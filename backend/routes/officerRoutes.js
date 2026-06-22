const express = require('express');
const router = express.Router();
const { getActiveDuties, getDutyHistory, rejectDuty, getOfficerProfile, getDutyDetails } = require('../controllers/officerController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect, authorize('officer'));

router.get('/profile', getOfficerProfile);
router.get('/duties/active', getActiveDuties);
router.get('/duties/history', getDutyHistory);
router.get('/duties/:dutyId', getDutyDetails);
router.patch('/duties/:dutyId/reject', rejectDuty);

module.exports = router;
