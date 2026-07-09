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

    await User.findByIdAndUpdate(req.user._id, { fcmToken });
    return successResponse(res, 200, 'Push notification token updated');
  } catch (err) {
    return errorResponse(res, 500, err?.message || 'Server error');
  }
};

module.exports = { updateFcmToken };
