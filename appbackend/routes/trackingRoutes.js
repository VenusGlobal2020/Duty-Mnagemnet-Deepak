const express = require('express');
const router = express.Router();

const { protect } = require('../middleware/authMiddleware');
const { logTrack, getMyRoute, getMyRouteDays } = require('../controllers/trackingController');

router.post('/tracking/log', protect, logTrack);
router.get('/tracking/duty/:dutyId/days', protect, getMyRouteDays);
router.get('/tracking/duty/:dutyId', protect, getMyRoute);

module.exports = router;