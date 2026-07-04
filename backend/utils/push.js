const User = require('../models/User');
const { isFirebaseConfigured, getMessaging } = require('../config/firebase');

// Token error codes that mean the token is dead and should be forgotten so we
// stop trying to push to it (app uninstalled, browser data cleared, etc.)
const DEAD_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

/**
 * Send an FCM push notification to a single user (by User._id), using
 * whatever fcmToken is currently stored on their account. No-ops quietly
 * (returns { sent: false }) if Firebase isn't configured, the user has no
 * token, or the send fails — callers never need to branch on this.
 */
const sendPushToUser = async (userId, { title, body, data = {} }) => {
  if (!userId || !isFirebaseConfigured()) return { sent: false };

  const user = await User.findById(userId).select('fcmToken');
  if (!user?.fcmToken) return { sent: false };

  try {
    await getMessaging().send({
      token: user.fcmToken,
      notification: { title, body },
      // FCM data payloads must be flat string key/value pairs.
      data: Object.fromEntries(
        Object.entries(data)
          .filter(([, v]) => v !== undefined && v !== null)
          .map(([k, v]) => [k, String(v)])
      ),
      webpush: {
        notification: { icon: '/shield.svg' },
        fcmOptions: { link: '/' },
      },
    });
    return { sent: true };
  } catch (error) {
    if (DEAD_TOKEN_CODES.has(error.code)) {
      // Stale token — clear it so we don't keep retrying a dead device.
      await User.findByIdAndUpdate(userId, { fcmToken: null }).catch(() => {});
    } else {
      console.error(`[push] Failed to send to user ${userId}:`, error.message);
    }
    return { sent: false };
  }
};

/**
 * Send the same push notification to several users at once. Fires all sends
 * in parallel; failures for individual recipients never affect the others.
 */
const sendPushToUsers = async (userIds, { title, body, data = {} }) => {
  if (!Array.isArray(userIds) || userIds.length === 0 || !isFirebaseConfigured()) {
    return { sentCount: 0 };
  }
  const results = await Promise.all(
    userIds.map((id) => sendPushToUser(id, { title, body, data }))
  );
  return { sentCount: results.filter((r) => r.sent).length };
};

module.exports = { sendPushToUser, sendPushToUsers };