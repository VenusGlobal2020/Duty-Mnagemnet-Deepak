const mongoose = require('mongoose');

const assignedOfficerSchema = new mongoose.Schema({
  officerRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Officer', required: true },
  rankRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Rank', required: true },
  assignedAt: { type: Date, default: Date.now },
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: {
    type: String,
    enum: ['assigned', 'accepted', 'rejected', 'replaced', 'removed'],
    default: 'accepted',
  },
  rejectionReason: { type: String },
  rejectedAt: { type: Date },
  replacedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Officer' },
  replacedAt: { type: Date },
  // Track which SwapRequest caused this replacement (if any)
  swapRequestRef: { type: mongoose.Schema.Types.ObjectId, ref: 'SwapRequest' },
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
  // Origin duty-type template used by a regular operator (optional — only
  // set when the duty was created by picking a saved DutyType instead of
  // manually entering rank requirements via "Other").
  dutyTypeRef: { type: mongoose.Schema.Types.ObjectId, ref: 'DutyType', default: null },
  description: { type: String, trim: true },

  // Dynamic shift definitions — only meaningful when the duty spans more than
  // one calendar day. Fully operator-defined (e.g. "9 to 5", "5 to 10"); each
  // officer's daily check-in is matched against whichever shift window covers
  // the time they check in, and their attendance is tracked per calendar day
  // (see Attendance model) so swaps mid-duty keep each officer's own days intact.
  shifts: [{
    label: { type: String, trim: true, required: true },  // e.g. "Morning Shift"
    startTime: { type: String, required: true },          // "HH:mm", 24hr
    endTime: { type: String, required: true },            // "HH:mm", 24hr — may be earlier than startTime for overnight shifts
  }],

  // Phone numbers to which duty info will be shared via WhatsApp
  phoneNumbers: [{ type: String }],

  // Optional vehicle number for this duty
  vehicleNumber: { type: String, trim: true, default: null },

  documents: [{
    url: String,
    publicId: String,
    originalName: String,
    uploadedAt: { type: Date, default: Date.now },
  }],

  // Rank requirements: [{ rankRef, count }]
  rankRequirements: [{
    rankRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Rank', required: true },
    count: { type: Number, required: true, min: 1 },
    assignmentType: { type: String, enum: ['auto', 'manual'], default: 'auto' },
  }],

  // Assigned officers
  assignedOfficers: [assignedOfficerSchema],

  // Status lifecycle:
  //   draft → active (cron when startDate reached)
  //   active → completed (cron when endDate reached)
  //   any → cancelled (manual operator action)
  status: {
    type: String,
    enum: ['draft', 'active', 'completed', 'cancelled'],
    default: 'draft',
  },

  // Hierarchy
  operatorRef: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  adminRef: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  superadminRef: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // Timeline/audit — every significant action lands here
  timeline: [{
    action: String,
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    performedAt: { type: Date, default: Date.now },
    note: String,
  }],
}, { timestamps: true });

dutySchema.index({ status: 1, startDate: 1 });
dutySchema.index({ status: 1, endDate: 1 });
dutySchema.index({ operatorRef: 1, status: 1 });
dutySchema.index({ adminRef: 1, status: 1 });
dutySchema.index({ superadminRef: 1, status: 1 });
dutySchema.index({ startDate: 1, endDate: 1 });
dutySchema.index({ 'assignedOfficers.officerRef': 1 });

module.exports = mongoose.model('Duty', dutySchema);