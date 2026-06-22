const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: {
    type: String, required: true, trim: true,
    validate: { validator: v => /^[6-9]\d{9}$/.test(v), message: 'Invalid Indian phone number' }
  },
  password: { type: String, required: true, minlength: 8, select: false },
  gender: { type: String, enum: ['male', 'female', 'other'], required: true },
  dateOfBirth: { type: Date, required: true },
  role: {
    type: String,
    enum: ['master', 'superadmin', 'admin', 'operator_special', 'operator_regular', 'officer'],
    required: true
  },
  // Hierarchy references
  superadminRef: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // for admin
  adminRef: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },      // for operator
  // Status
  status: { type: String, enum: ['active', 'suspended', 'inactive'], default: 'active' },
  suspendedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  suspendedAt: Date,
  suspendReason: String,
  // Profile
  profileImage: { type: String },
  profileImagePublicId: { type: String },
  // Password reset
  passwordResetOTP: { type: String, select: false },
  passwordResetOTPExpire: { type: Date, select: false },
  // FCM token for push notifications
  fcmToken: { type: String },
  // Last login
  lastLogin: Date,
  // For officer - rank reference
  rankRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Rank' },
  badgeNumber: { type: String },           // officer badge/ID number
  designation: { type: String },           // officer designation string
}, { timestamps: true });

// Hash password before save
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password
userSchema.methods.matchPassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ role: 1, status: 1 });
userSchema.index({ superadminRef: 1, role: 1 });
userSchema.index({ adminRef: 1, role: 1 });

module.exports = mongoose.model('User', userSchema);
