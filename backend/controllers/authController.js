const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../utils/jwt');
const { generateOTP, hashOTP, verifyOTP } = require('../utils/otp');
const { sendOTPWhatsApp } = require('../utils/whatsapp');
const { sendOTPEmail } = require('../utils/email');
const { successResponse, errorResponse } = require('../utils/response');

// @desc   Login
// @route  POST /api/auth/login
const login = asyncHandler(async (req, res) => {
  const { email, password, fcmToken } = req.body;
  if (!email || !password) return errorResponse(res, 400, 'Email and password required');

  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  if (!user) return errorResponse(res, 401, 'Invalid credentials');

  if (user.status === 'suspended') return errorResponse(res, 403, 'Account suspended. Contact administrator.');
  if (user.status === 'inactive') return errorResponse(res, 403, 'Account is inactive.');

  const isMatch = await user.matchPassword(password);
  if (!isMatch) return errorResponse(res, 401, 'Invalid credentials');

  // Save FCM token
  if (fcmToken) {
    await User.findByIdAndUpdate(user._id, { fcmToken, lastLogin: new Date() });
  } else {
    await User.findByIdAndUpdate(user._id, { lastLogin: new Date() });
  }

  const accessToken = generateAccessToken(user._id, user.role);
  const refreshToken = generateRefreshToken(user._id);

  const userData = user.toObject();
  delete userData.password;

  return res.json({ success: true, message: 'Login successful', accessToken, refreshToken, user: userData });
});

// @desc   Refresh token
// @route  POST /api/auth/refresh
const refreshToken = asyncHandler(async (req, res) => {
  const { refreshToken: token } = req.body;
  if (!token) return errorResponse(res, 400, 'Refresh token required');

  try {
    const decoded = verifyRefreshToken(token);
    const user = await User.findById(decoded.id);
    if (!user || user.status !== 'active') return errorResponse(res, 401, 'Invalid token');

    const newAccessToken = generateAccessToken(user._id, user.role);
    return successResponse(res, 200, 'Token refreshed', { accessToken: newAccessToken });
  } catch {
    return errorResponse(res, 401, 'Invalid or expired refresh token');
  }
});

// @desc   Forgot password - send OTP
// @route  POST /api/auth/forgot-password
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) return errorResponse(res, 400, 'Email required');

  const user = await User.findOne({ email: email.toLowerCase() });
  // Always return success to prevent email enumeration
  if (!user) return successResponse(res, 200, 'If this email exists, an OTP has been sent.');

  const otp = generateOTP();
  const hashedOTP = await hashOTP(otp);
  const expire = new Date(Date.now() + 10 * 60 * 1000); // 10 min

  await User.findByIdAndUpdate(user._id, {
    passwordResetOTP: hashedOTP,
    passwordResetOTPExpire: expire
  });

  // Try WhatsApp first, fallback to email
  let sent = false;
  if (user.phone) {
    const waResult = await sendOTPWhatsApp(user.phone, user.name, otp);
    sent = waResult.success;
  }
  if (!sent) {
    await sendOTPEmail(user.email, user.name, otp);
  }

  return successResponse(res, 200, 'OTP sent to your registered phone/email.');
});

// @desc   Verify OTP
// @route  POST /api/auth/verify-otp
const verifyPasswordOTP = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return errorResponse(res, 400, 'Email and OTP required');

  const user = await User.findOne({ email: email.toLowerCase() })
    .select('+passwordResetOTP +passwordResetOTPExpire');

  if (!user || !user.passwordResetOTP) return errorResponse(res, 400, 'Invalid or expired OTP');
  if (new Date() > user.passwordResetOTPExpire) return errorResponse(res, 400, 'OTP has expired');

  const isValid = await verifyOTP(otp, user.passwordResetOTP);
  if (!isValid) return errorResponse(res, 400, 'Invalid OTP');

  // Generate short-lived reset token
  const resetToken = generateAccessToken(user._id, user.role);
  return successResponse(res, 200, 'OTP verified', { resetToken });
});

// @desc   Reset password
// @route  POST /api/auth/reset-password
const resetPassword = asyncHandler(async (req, res) => {
  const { email, otp, newPassword, confirmPassword } = req.body;

  if (!email || !otp || !newPassword || !confirmPassword) {
    return errorResponse(res, 400, 'All fields required');
  }
  if (newPassword !== confirmPassword) return errorResponse(res, 400, 'Passwords do not match');
  if (newPassword.length < 8) return errorResponse(res, 400, 'Password must be at least 8 characters');

  const user = await User.findOne({ email: email.toLowerCase() })
    .select('+passwordResetOTP +passwordResetOTPExpire');

  if (!user || !user.passwordResetOTP) return errorResponse(res, 400, 'Invalid or expired OTP');
  if (new Date() > user.passwordResetOTPExpire) return errorResponse(res, 400, 'OTP has expired');

  const isValid = await verifyOTP(otp, user.passwordResetOTP);
  if (!isValid) return errorResponse(res, 400, 'Invalid OTP');

  user.password = newPassword;
  user.passwordResetOTP = undefined;
  user.passwordResetOTPExpire = undefined;
  await user.save();

  return successResponse(res, 200, 'Password reset successfully');
});

// @desc   Change own password (logged in)
// @route  PATCH /api/auth/change-password
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;

  if (!currentPassword || !newPassword || !confirmPassword) {
    return errorResponse(res, 400, 'All fields required');
  }
  if (newPassword !== confirmPassword) return errorResponse(res, 400, 'Passwords do not match');
  if (newPassword.length < 8) return errorResponse(res, 400, 'Password must be at least 8 characters');
  if (currentPassword === newPassword) return errorResponse(res, 400, 'New password must differ from current');

  const user = await User.findById(req.user._id).select('+password');
  const isMatch = await user.matchPassword(currentPassword);
  if (!isMatch) return errorResponse(res, 400, 'Current password is incorrect');

  user.password = newPassword;
  await user.save();

  return successResponse(res, 200, 'Password changed successfully');
});

// @desc   Get logged-in user profile
// @route  GET /api/auth/me
const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
    .populate('rankRef', 'name code color priority')
    .populate('adminRef', 'name email')
    .populate('superadminRef', 'name email');
  return successResponse(res, 200, 'Profile fetched', { user });
});

// @desc   Update FCM token
// @route  PATCH /api/auth/fcm-token
const updateFCMToken = asyncHandler(async (req, res) => {
  const { fcmToken } = req.body;
  await User.findByIdAndUpdate(req.user._id, { fcmToken });
  return successResponse(res, 200, 'FCM token updated');
});

module.exports = { login, refreshToken, forgotPassword, verifyPasswordOTP, resetPassword, changePassword, getMe, updateFCMToken };
