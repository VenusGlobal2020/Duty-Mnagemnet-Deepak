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
}, { timestamps: true });

officerSchema.index({ adminRef: 1, status: 1 });
officerSchema.index({ superadminRef: 1 });
officerSchema.index({ rankRef: 1 });

module.exports = mongoose.model('Officer', officerSchema);
