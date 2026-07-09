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
 * Send an FCM push notification to a single user (by User._id). Sends to
 * BOTH the web dashboard's token (fcmToken) and the mobile app's token
 * (fcmTokenApp) whenever each is present, so an officer logged into both
 * gets the notification on both. No-ops quietly (returns { sent: false })
 * if Firebase isn't configured, the user has no token on either device, or
 * every send fails — callers never need to branch on this.
 */
const sendPushToUser = async (userId, { title, body, data = {} }) => {
  if (!userId || !isFirebaseConfigured()) return { sent: false };

  const user = await User.findById(userId).select('fcmToken fcmTokenApp');
  const targets = [
    { field: 'fcmToken', token: user?.fcmToken },
    { field: 'fcmTokenApp', token: user?.fcmTokenApp },
  ].filter((t) => !!t.token);

  if (targets.length === 0) return { sent: false };

  const payload = {
    notification: { title, body },
    data: Object.fromEntries(
      Object.entries(data)
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([k, v]) => [k, String(v)])
    ),
    webpush: {
      notification: { icon: '/shield.svg' },
      fcmOptions: { link: '/' },
    },
  };

  const results = await Promise.all(
    targets.map(async ({ field, token }) => {
      try {
        await getMessaging().send({ token, ...payload });
        return true;
      } catch (error) {
        if (DEAD_TOKEN_CODES.has(error.code)) {
          await User.findByIdAndUpdate(userId, { [field]: null }).catch(() => {});
        } else {
          console.error(`[push] Failed to send to user ${userId} (${field}):`, error.message);
        }
        return false;
      }
    })
  );

  return { sent: results.some(Boolean) };
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