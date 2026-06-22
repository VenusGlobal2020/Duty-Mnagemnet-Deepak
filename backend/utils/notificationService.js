const Notification = require('../models/Notification');
const { sendPushNotification, sendMulticastNotification } = require('../config/firebase');
const { notifyDutyAssigned, notifyDutyCancelled, notifyDutyUpdated, notifyOfficerReplaced, notifyAccountSuspended } = require('./whatsapp');
const User = require('../models/User');

/**
 * Create a DB notification and optionally send push + whatsapp
 */
const createNotification = async ({
  recipientId, title, body, type = 'general',
  relatedDuty = null, sendPush = true, sendWhatsapp = false,
  whatsappFn = null
}) => {
  try {
    const notification = await Notification.create({
      recipientRef: recipientId,
      title, body, type,
      relatedDuty,
      channels: { push: { sent: false }, whatsapp: { sent: false } }
    });

    const user = await User.findById(recipientId).select('fcmToken phone');

    // Push notification
    if (sendPush && user?.fcmToken) {
      const result = await sendPushNotification(user.fcmToken, title, body, {
        type, dutyId: relatedDuty?.toString() || ''
      });
      if (result.success) {
        await Notification.findByIdAndUpdate(notification._id, {
          'channels.push.sent': true, 'channels.push.sentAt': new Date()
        });
      }
    }

    // WhatsApp
    if (sendWhatsapp && whatsappFn && user?.phone) {
      const waResult = await whatsappFn(user.phone);
      if (waResult?.success) {
        await Notification.findByIdAndUpdate(notification._id, {
          'channels.whatsapp.sent': true, 'channels.whatsapp.sentAt': new Date()
        });
      }
    }

    return notification;
  } catch (error) {
    console.error('Notification creation error:', error.message);
  }
};

/**
 * Bulk notify multiple recipients
 */
const bulkNotify = async (recipientIds, title, body, type, relatedDuty = null) => {
  try {
    const notifications = recipientIds.map(id => ({
      recipientRef: id, title, body, type, relatedDuty,
      channels: { push: { sent: false }, whatsapp: { sent: false } }
    }));
    await Notification.insertMany(notifications);

    // Push to all
    const users = await User.find({ _id: { $in: recipientIds }, fcmToken: { $exists: true } }).select('fcmToken');
    const tokens = users.map(u => u.fcmToken).filter(Boolean);
    if (tokens.length > 0) {
      await sendMulticastNotification(tokens, title, body, { type, dutyId: relatedDuty?.toString() || '' });
    }
  } catch (error) {
    console.error('Bulk notification error:', error.message);
  }
};

module.exports = { createNotification, bulkNotify };
