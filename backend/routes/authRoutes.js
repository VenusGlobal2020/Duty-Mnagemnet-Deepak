const express = require('express');
const router = express.Router();
const {
  login,
  refreshToken,
  forgotPassword,
  verifyPasswordOTP,
  resetPassword,
  changePassword,
  getMe,
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/login', login);
router.post('/refresh', refreshToken);
router.post('/forgot-password', forgotPassword);
router.post('/verify-otp', verifyPasswordOTP);
router.post('/reset-password', resetPassword);
router.patch('/change-password', protect, changePassword);
router.get('/me', protect, getMe);
// NOTE: /fcm-token route removed — Firebase push notifications removed

module.exports = router;