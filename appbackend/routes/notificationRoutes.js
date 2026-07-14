const express = require('express');
const router = express.Router();

const { protect } = require('../middleware/authMiddleware');
const { updateFcmToken, clearFcmToken } = require('../controllers/notificationController');

router.patch('/notifications/fcm-token', protect, updateFcmToken);
router.delete('/notifications/fcm-token', protect, clearFcmToken);

module.exports = router;
