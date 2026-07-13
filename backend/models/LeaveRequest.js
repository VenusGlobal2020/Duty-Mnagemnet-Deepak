const mongoose = require('mongoose');

/**
 * LeaveRequest — one application, from submission through final decision.
 *
 * Routing summary (see utils/leaveEngine.js for the authoritative logic):
 *   Constable / Head Constable (rank.leaveTier === 'junior'):
 *     casual <=3d               -> Inspector of same thana
 *     casual 4-10d OR earned<=7d-> DSP of same zone
 *     casual 11-14d OR earned 8-10d -> Admin
 *     special (emergency/medical/maternity/childcare) -> Superadmin
 *   SI / Inspector / DSP (rank.leaveTier === 'senior'):
 *     casual / earned           -> Admin
 *     special                   -> Superadmin
 *   Admin:
 *     any type                  -> Superadmin
 *
 * Lifecycle: pending -> approved | rejected | cancelled | auto_rejected
 */
const leaveRequestSchema = new mongoose.Schema({
  // ─── Applicant ─────────────────────────────────────────────────────────────
  // Set when the applicant is an officer (Officer doc). Null for admin applicants.
  officerRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Officer', default: null, index: true },
  // The User account that submitted this request (officer's userRef OR an admin).
  applicantRef: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  applicantRole: { type: String, enum: ['officer', 'admin'], required: true },
  // Snapshot of the applicant's rank at time of request (officers only) — kept
  // even if the officer's rank later changes, so historical routing stays legible.
  rankRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Rank', default: null },
  rankTierAtRequest: { type: String, enum: ['junior', 'senior', null], default: null },
  thanaAtRequest: { type: String, default: null },
  zoneAtRequest: { type: String, default: null },

  // Hierarchy scoping (always set, used for every query in this collection)
  adminRef: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  superadminRef: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

  // ─── Leave details ─────────────────────────────────────────────────────────
  leaveType: {
    type: String,
    enum: ['casual', 'earned', 'emergency', 'medical', 'maternity', 'childcare'],
    required: true,
  },
  // Derived from leaveType — kept as its own field so queries/UX don't need
  // to hardcode the casual/earned vs emergency/medical/maternity/childcare split.
  leaveCategory: { type: String, enum: ['regular', 'special'], required: true },

  fromDate: { type: Date, required: true },
  toDate: { type: Date, required: true },
  totalDays: { type: Number, required: true, min: 1 },

  remark: { type: String, trim: true, default: '' },
  document: {
    url: { type: String, default: null },
    publicId: { type: String, default: null },
    originalName: { type: String, default: null },
  },

  // ─── Routing / approval ────────────────────────────────────────────────────
  // Human-readable label of which authority this went to, e.g. "Inspector (Thana X)".
  approverLevel: { type: String, enum: ['inspector', 'dsp', 'admin', 'superadmin'], required: true },
  // Any one of these Users may decide this request (normally length 1; can be
  // >1 only if a thana/zone genuinely has more than one officer holding the
  // approver rank — first decision wins, see leaveController.decideLeave).
  eligibleApprovers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  // True when routing had to fall back up the chain because no Inspector/DSP
  // was found for the officer's thana/zone (vacant post, missing posting data, etc).
  routingFallback: { type: Boolean, default: false },
  routingNote: { type: String, default: null },

  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'cancelled', 'auto_rejected'],
    default: 'pending',
    index: true,
  },
  decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  decidedAt: { type: Date, default: null },
  decisionNote: { type: String, default: '' },

  // Set true if this request was blocked/queued because the requested dates
  // hit the leave-threshold lock — surfaced to the applicant + admin.
  wasThresholdLocked: { type: Boolean, default: false },

  // ─── Mid-duty conflict tracking ────────────────────────────────────────────
  // If, at approval time, the officer had a live (assigned/accepted) duty
  // assignment overlapping this leave's dates, we record it here so the
  // operator alert / reassignment UI has something to point at.
  conflictingDuties: [{
    dutyRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Duty' },
    assignmentId: { type: mongoose.Schema.Types.ObjectId },
    operatorRef: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resolved: { type: Boolean, default: false },
    resolvedAt: { type: Date, default: null },
  }],

  // Whether this leave has been "consumed" against the officer's annual
  // balance (only true for approved casual/earned leave).
  balanceDeducted: { type: Boolean, default: false },

  // Set when this request was force-routed to the Superadmin (submitted) or
  // auto-cancelled (previously approved) because of an active Emergency
  // Lockdown covering its dates — see utils/emergencyEngine.js.
  emergencyPeriodRef: { type: mongoose.Schema.Types.ObjectId, ref: 'EmergencyPeriod', default: null, index: true },

  timeline: [{
    action: String,
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    performedAt: { type: Date, default: Date.now },
    note: String,
  }],
}, { timestamps: true });

leaveRequestSchema.index({ officerRef: 1, status: 1 });
leaveRequestSchema.index({ adminRef: 1, status: 1 });
leaveRequestSchema.index({ superadminRef: 1, status: 1 });
leaveRequestSchema.index({ eligibleApprovers: 1, status: 1 });
leaveRequestSchema.index({ fromDate: 1, toDate: 1 });
leaveRequestSchema.index({ status: 1, fromDate: 1, toDate: 1 });

module.exports = mongoose.model('LeaveRequest', leaveRequestSchema);
