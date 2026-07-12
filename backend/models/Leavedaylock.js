const mongoose = require('mongoose');

/**
 * LeaveDayLock — one document per (adminRef, date) where the percentage of
 * that admin's officers on approved leave has crossed LEAVE_THRESHOLD_PERCENT.
 * While locked, new leave requests covering this date are blocked for every
 * officer/admin under this adminRef, until an admin explicitly unlocks it.
 *
 * Scoped per-admin (not system-wide) because each admin runs an independent
 * force — one admin's staffing crunch shouldn't lock another admin's leave system.
 */
const leaveDayLockSchema = new mongoose.Schema({
  adminRef: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // Calendar date this lock applies to, stored as 'YYYY-MM-DD' (IST) for
  // simple, timezone-safe equality lookups — see utils/dateIST.js.
  date: { type: String, required: true },

  totalOfficers: { type: Number, required: true },
  onLeaveCount: { type: Number, required: true },
  percent: { type: Number, required: true },
  thresholdPercent: { type: Number, required: true },

  isUnlocked: { type: Boolean, default: false },
  unlockedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  unlockedAt: { type: Date, default: null },
  unlockNote: { type: String, default: '' },
}, { timestamps: true });

leaveDayLockSchema.index({ adminRef: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('LeaveDayLock', leaveDayLockSchema);