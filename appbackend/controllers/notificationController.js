const User = require('../models/User');
const { successResponse, errorResponse } = require('../utils/response');

// @desc   Save/refresh this device's Firebase Cloud Messaging token so
//         backend's EXISTING push-notification code (utils/push.js) can
//         reach this phone. Called by the app right after login and
//         whenever Firebase hands it a fresh token.
// @route  PATCH /api/mobile/notifications/fcm-token
const updateFcmToken = async (req, res) => {
  try {
    const { fcmToken } = req.body;
    if (!fcmToken) return errorResponse(res, 400, 'fcmToken is required');

    await User.findByIdAndUpdate(req.user._id, { fcmTokenApp: fcmToken });
    return successResponse(res, 200, 'Push notification token updated');
  } catch (err) {
    return errorResponse(res, 500, err?.message || 'Server error');
  }
};

// @desc   Clear this account's FCM token on logout. Without this, logging
//         out and logging into a DIFFERENT officer's account on the SAME
//         phone leaves the old account's fcmTokenApp still pointing at this
//         device — so both accounts (and every account ever logged in on
//         this phone) would keep receiving push notifications here, even
//         though only one is actually signed in. This is what fixes that.
// @route  DELETE /api/mobile/notifications/fcm-token
const clearFcmToken = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { fcmTokenApp: null });
    return successResponse(res, 200, 'Push notification token cleared');
  } catch (err) {
    return errorResponse(res, 500, err?.message || 'Server error');
  }
};

module.exports = { updateFcmToken, clearFcmToken };
