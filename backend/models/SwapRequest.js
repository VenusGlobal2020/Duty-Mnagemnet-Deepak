const mongoose = require('mongoose');

/**
 * SwapRequest — tracks officer-initiated swap requests AND operator-forced swaps.
 *
 * Lifecycle for officer-initiated:
 *   pending  →  accepted (operator approved, swap executed)
 *   pending  →  rejected (operator declined)
 *   pending  →  cancelled (officer withdrew before decision)
 *
 * Lifecycle for operator-forced (no officer request):
 *   Created with status 'executed' directly — serves purely as an audit log entry.
 */
const swapRequestSchema = new mongoose.Schema({
  // ─── Source ────────────────────────────────────────────────────────────────
  duty: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Duty',
    required: true,
    index: true,
  },

  // The officer being swapped OUT
  fromOfficer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Officer',
    required: true,
    index: true,
  },

  // The assignment subdoc _id inside duty.assignedOfficers for fromOfficer
  fromAssignmentId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },

  // ─── Target ────────────────────────────────────────────────────────────────
  // The officer being swapped IN
  toOfficer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Officer',
    required: true,
    index: true,
  },

  // If toOfficer is currently on another duty, we record it here for full audit
  toOfficerCurrentDuty: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Duty',
    default: null,
  },
  toOfficerCurrentAssignmentId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null,
  },

  // ─── Reason / Notes ────────────────────────────────────────────────────────
  // Reason given by the requesting officer (required for officer-initiated)
  requestReason: {
    type: String,
    trim: true,
  },

  // Operator's note when accepting or rejecting
  operatorNote: {
    type: String,
    trim: true,
  },

  // ─── Initiator ─────────────────────────────────────────────────────────────
  // 'officer' = officer requested, 'operator' = operator forced without request
  initiatedBy: {
    type: String,
    enum: ['officer', 'operator'],
    required: true,
  },

  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // the User who triggered this (officer's userRef OR operator)
  },

  // ─── Status ────────────────────────────────────────────────────────────────
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'cancelled', 'executed'],
    default: 'pending',
    index: true,
  },

  // ─── Resolution ────────────────────────────────────────────────────────────
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  resolvedAt: {
    type: Date,
  },

}, { timestamps: true });

// Compound indexes for quick lookups
swapRequestSchema.index({ duty: 1, status: 1 });
swapRequestSchema.index({ fromOfficer: 1, status: 1 });
swapRequestSchema.index({ toOfficer: 1, status: 1 });
swapRequestSchema.index({ createdAt: -1 });

module.exports = mongoose.model('SwapRequest', swapRequestSchema);