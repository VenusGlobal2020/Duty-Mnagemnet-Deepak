const mongoose = require('mongoose');

const assignedOfficerSchema = new mongoose.Schema({
  officerRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Officer', required: true },
  rankRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Rank', required: true },
  assignedAt: { type: Date, default: Date.now },
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: {
    type: String,
    enum: ['assigned', 'accepted', 'rejected', 'replaced'],
    default: 'accepted'   // default accepted as per requirement
  },
  rejectionReason: { type: String },
  rejectedAt: { type: Date },
  replacedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Officer' },
  replacedAt: { type: Date },
}, { _id: true });

const dutySchema = new mongoose.Schema({
  dutyName: { type: String, required: true, trim: true },
  locationName: { type: String, required: true, trim: true },
  location: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
  },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  priority: { type: Number, required: true, min: 1, max: 5 },
  dutyType: {
    type: String,
    enum: ['VVIP', 'CITY-POINT', 'CRIMINAL'],
    // Only for special operator — enforced at controller level
  },
  description: { type: String, trim: true },
  phoneNumbers: [{ type: String }],
  documents: [{
    url: String,
    publicId: String,
    originalName: String,
    uploadedAt: { type: Date, default: Date.now }
  }],
  // Rank requirements: [{ rankRef, count }]
  rankRequirements: [{
    rankRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Rank', required: true },
    count: { type: Number, required: true, min: 1 },
    assignmentType: { type: String, enum: ['auto', 'manual'], default: 'auto' }
  }],
  // Assigned officers
  assignedOfficers: [assignedOfficerSchema],
  // Status
  status: {
    type: String,
    enum: ['draft', 'active', 'completed', 'cancelled'],
    default: 'active'
  },
  // Hierarchy
  operatorRef: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  adminRef: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  superadminRef: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // Timeline/audit
  timeline: [{
    action: String,
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    performedAt: { type: Date, default: Date.now },
    note: String,
  }],
}, { timestamps: true });

dutySchema.index({ operatorRef: 1, status: 1 });
dutySchema.index({ adminRef: 1, status: 1 });
dutySchema.index({ superadminRef: 1, status: 1 });
dutySchema.index({ startDate: 1, endDate: 1 });
dutySchema.index({ 'assignedOfficers.officerRef': 1 });

module.exports = mongoose.model('Duty', dutySchema);
