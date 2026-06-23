const Notification = require('../models/Notification');
const User = require('../models/User');

/**
 * Create a DB notification (in-app only — push notifications removed)
 * WhatsApp notifications are still handled separately via whatsapp.js util.
 */
const createNotification = async ({
  recipientId,
  title,
  body,
  type = 'general',
  relatedDuty = null,
  // sendPush param accepted but ignored — Firebase removed
  // sendWhatsapp param accepted for backward compat but WA is handled at call site
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
    return notification;
  } catch (error) {
    console.error('Notification creation error:', error.message);
  }
};

/**
 * Bulk create DB notifications for multiple recipients
 */
const bulkNotify = async (recipientIds, title, body, type, relatedDuty = null) => {
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
    await Notification.insertMany(notifications);
  } catch (error) {
    console.error('Bulk notification error:', error.message);
  }
};

module.exports = { createNotification, bulkNotify };