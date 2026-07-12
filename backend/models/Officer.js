const mongoose = require('mongoose');

const officerSchema = new mongoose.Schema({
  // Link to User account (officer login)
  userRef: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  // Hierarchy
  adminRef: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  superadminRef: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // Officer details
  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true },
  email: { type: String, required: true, lowercase: true },
  gender: { type: String, enum: ['male', 'female', 'other'] },
  dateOfBirth: { type: Date },
  badgeNumber: { type: String, unique: true, sparse: true },
  rankRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Rank', required: true },
  designation: { type: String },
  profileImage: { type: String },
  status: { type: String, enum: ['active', 'suspended', 'inactive'], default: 'active' },
  // Duty stats (denormalized for performance)
  totalDutiesCompleted: { type: Number, default: 0 },
  totalDutiesRejected: { type: Number, default: 0 },

  // ─── Posting (used for leave-approval routing) ────────────────────────────
  // Thana (police station) this officer is posted at — one thana has exactly
  // one Inspector, who approves short casual leave for junior officers in it.
  thana: { type: String, trim: true, default: null },
  // Zone this officer's thana falls under — one zone has exactly one DSP, who
  // approves longer casual / earned leave for junior officers in it.
  zone: { type: String, trim: true, default: null },

  // ─── Leave / duty availability ─────────────────────────────────────────────
  // 'available'       — normal state, can be assigned to duty.
  // 'on_leave'        — currently within an approved leave's date range.
  // 'pending_return'  — approved leave's date range has ended, but an
  //                      operator has not yet manually marked them back as
  //                      available (see PATCH /operator/officers/:id/mark-available).
  // Officers in 'on_leave' or 'pending_return' are excluded from duty
  // assignment (auto and manual) until flipped back to 'available'.
  dutyAvailability: { type: String, enum: ['available', 'on_leave', 'pending_return'], default: 'available' },
  currentLeaveRef: { type: mongoose.Schema.Types.ObjectId, ref: 'LeaveRequest', default: null },
}, { timestamps: true });

officerSchema.index({ adminRef: 1, status: 1 });
officerSchema.index({ superadminRef: 1 });
officerSchema.index({ rankRef: 1 });
officerSchema.index({ adminRef: 1, thana: 1 });
officerSchema.index({ adminRef: 1, zone: 1 });
officerSchema.index({ dutyAvailability: 1 });

module.exports = mongoose.model('Officer', officerSchema);