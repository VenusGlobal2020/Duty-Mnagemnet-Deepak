const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipientRef: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  body: { type: String, required: true },
  type: {
    type: String,
    enum: [
      'duty_assigned',
      'duty_updated',
      'duty_cancelled',
      'duty_rejected',
      'officer_replaced',
      'account_suspended',
      'account_activated',
      'attendance_checkin',
      'general',
    ],
    default: 'general',
  },
  relatedDuty: { type: mongoose.Schema.Types.ObjectId, ref: 'Duty' },
  isRead: { type: Boolean, default: false },
  readAt: Date,
  // Keeping channels schema for backward compat with existing records
  // push.sent will always be false — Firebase removed
  channels: {
    push: { sent: { type: Boolean, default: false }, sentAt: Date },
    whatsapp: { sent: { type: Boolean, default: false }, sentAt: Date },
  },
}, { timestamps: true });

notificationSchema.index({ recipientRef: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);