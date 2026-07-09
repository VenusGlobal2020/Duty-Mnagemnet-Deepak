const express = require('express');
const router = express.Router();

const { protect } = require('../middleware/authMiddleware');
const { updateFcmToken } = require('../controllers/notificationController');

router.patch('/notifications/fcm-token', protect, updateFcmToken);

module.exports = router;
