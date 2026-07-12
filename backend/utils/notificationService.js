const Notification = require('../models/Notification');
const User = require('../models/User');
const { sendPushToUser, sendPushToUsers } = require('./push');

/**
 * Create a DB notification (in-app) and, unless explicitly disabled, also
 * push it to the recipient's device via Firebase Cloud Messaging.
 * WhatsApp notifications are still handled separately via whatsapp.js util.
 */
const createNotification = async ({
  recipientId,
  title,
  body,
  type = 'general',
  relatedDuty = null,
  sendPush = true, // set to false at the call site to keep a notification in-app-only
}) => {
  try {
    const notification = await Notification.create({
      recipientRef: recipientId,
      title,
      body,
      type,
      relatedDuty,
      channels: {
        push: { sent: false },
        whatsapp: { sent: false },
      },
    });

    if (sendPush) {
      const { sent } = await sendPushToUser(recipientId, {
        title,
        body,
        data: { type, notificationId: notification._id.toString(), ...(relatedDuty ? { dutyId: relatedDuty.toString() } : {}) },
      });
      if (sent) {
        notification.channels.push = { sent: true, sentAt: new Date() };
        await notification.save();
      }
    }

    return notification;
  } catch (error) {
    console.error('Notification creation error:', error.message);
  }
};

/**
 * Bulk create DB notifications for multiple recipients, and (unless
 * disabled) push to each of them too.
 */
const bulkNotify = async (recipientIds, title, body, type, relatedDuty = null, sendPush = true) => {
  try {
    const notifications = recipientIds.map((id) => ({
      recipientRef: id,
      title,
      body,
      type,
      relatedDuty,
      channels: {
        push: { sent: false },
        whatsapp: { sent: false },
      },
    }));
    const created = await Notification.insertMany(notifications);

    if (sendPush) {
      const { sentCount } = await sendPushToUsers(recipientIds, {
        title,
        body,
        data: { type, ...(relatedDuty ? { dutyId: relatedDuty.toString() } : {}) },
      });
      if (sentCount > 0) {
        // Best-effort: mark all as pushed together rather than tracking per
        // recipient, since bulkNotify is fire-and-forget by design.
        await Notification.updateMany(
          { _id: { $in: created.map((n) => n._id) } },
          { $set: { 'channels.push': { sent: true, sentAt: new Date() } } }
        );
      }
    }
  } catch (error) {
    console.error('Bulk notification error:', error.message);
  }
};

module.exports = { createNotification, bulkNotify };