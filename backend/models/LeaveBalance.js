const mongoose = require('mongoose');

/**
 * LeaveBalance — one document per officer per calendar year, tracking the
 * only two leave types that draw against a numeric quota (casual & earned).
 * Special leaves (emergency/medical/maternity/childcare) are approval-gated
 * only and never touch this balance.
 *
 * Maintained by the zone DSP (view/adjust) and consumed automatically on
 * leave approval / restored automatically on cancellation of an approved leave.
 */
const leaveBalanceSchema = new mongoose.Schema({
  officerRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Officer', required: true },
  adminRef: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  year: { type: Number, required: true },

  casual: {
    allocated: { type: Number, default: 14 },
    used: { type: Number, default: 0 },
  },
  earned: {
    allocated: { type: Number, default: 10 },
    used: { type: Number, default: 0 },
  },

  // Free-form adjustments a DSP/admin makes (carry-forward, correction, etc.)
  adjustments: [{
    leaveType: { type: String, enum: ['casual', 'earned'] },
    days: Number, // positive = credit, negative = debit
    reason: String,
    adjustedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    adjustedAt: { type: Date, default: Date.now },
  }],
}, { timestamps: true });

leaveBalanceSchema.index({ officerRef: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('LeaveBalance', leaveBalanceSchema);
