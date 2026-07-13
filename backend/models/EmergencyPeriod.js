const mongoose = require('mongoose');

/**
 * EmergencyPeriod — "Emergency Lockdown".
 *
 * A superadmin can declare a lockdown window (reason + start/end date) that:
 *   1. Immediately cancels every currently-APPROVED leave request in their
 *      hierarchy that overlaps the window (see emergencyController.declareEmergency).
 *   2. Force-routes any NEW leave request whose dates overlap the window
 *      straight to the superadmin, bypassing the normal Inspector/DSP/Admin
 *      chain (see utils/emergencyEngine.getActiveEmergencyPeriod, consumed by
 *      leaveController.requestLeave).
 *   3. Is broadcast (in-app + Firebase push) to every admin, operator and
 *      officer under that superadmin.
 *
 * Only one 'active' period should exist per superadmin at a time — enforced
 * in the controller, not at the schema level, so history is easy to query.
 */
const emergencyPeriodSchema = new mongoose.Schema({
  superadminRef: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  reason: { type: String, required: true, trim: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },

  status: {
    type: String,
    enum: ['active', 'ended', 'cancelled'],
    default: 'active',
    index: true,
  },
  // 'manual' -> superadmin ended it early. 'auto' -> the leaveCron sweep
  // ended it once endDate passed. null while still active.
  endedBy: { type: String, enum: ['manual', 'auto', null], default: null },

  // How many previously-approved leave requests got auto-cancelled the
  // moment this lockdown was declared — surfaced in the UI as a summary.
  cancelledLeavesCount: { type: Number, default: 0 },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  timeline: [{
    action: { type: String, enum: ['DECLARED', 'ENDED', 'CANCELLED'] },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    performedAt: { type: Date, default: Date.now },
    note: String,
  }],
}, { timestamps: true });

emergencyPeriodSchema.index({ superadminRef: 1, status: 1 });
emergencyPeriodSchema.index({ status: 1, endDate: 1 });

module.exports = mongoose.model('EmergencyPeriod', emergencyPeriodSchema);