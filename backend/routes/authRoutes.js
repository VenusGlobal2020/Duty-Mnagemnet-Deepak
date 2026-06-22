const express = require('express');
const router = express.Router();
const { login, refreshToken, forgotPassword, verifyPasswordOTP, resetPassword, changePassword, getMe, updateFCMToken } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/login', login);
router.post('/refresh', refreshToken);
router.post('/forgot-password', forgotPassword);
router.post('/verify-otp', verifyPasswordOTP);
router.post('/reset-password', resetPassword);
router.patch('/change-password', protect, changePassword);
router.get('/me', protect, getMe);
router.patch('/fcm-token', protect, updateFCMToken);

module.exports = router;
