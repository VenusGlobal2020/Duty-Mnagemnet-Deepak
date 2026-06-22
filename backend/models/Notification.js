const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipientRef: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  body: { type: String, required: true },
  type: {
    type: String,
    enum: ['duty_assigned', 'duty_updated', 'duty_cancelled', 'duty_rejected',
      'officer_replaced', 'account_suspended', 'account_activated', 'general'],
    default: 'general'
  },
  relatedDuty: { type: mongoose.Schema.Types.ObjectId, ref: 'Duty' },
  isRead: { type: Boolean, default: false },
  readAt: Date,
  channels: {
    push: { sent: Boolean, sentAt: Date },
    whatsapp: { sent: Boolean, sentAt: Date },
  }
}, { timestamps: true });

notificationSchema.index({ recipientRef: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
