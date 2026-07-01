const mongoose = require('mongoose');

// DutyType — a saved template a regular operator can define once (name + the
// ranks/counts it normally needs) and reuse when creating duties, instead of
// re-entering the same rank requirements every time. Purely a convenience
// layer: when a duty is created from a DutyType, its rankRequirements are
// copied onto the Duty document as a snapshot (dutyTypeRef just tracks origin).
const dutyTypeSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },

  rankRequirements: [{
    rankRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Rank', required: true },
    count: { type: Number, required: true, min: 1 },
  }],

  // Only regular operators create/manage duty types — scoped to the creator.
  operatorRef: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  adminRef: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  isActive: { type: Boolean, default: true },
}, { timestamps: true });

dutyTypeSchema.index({ operatorRef: 1, isActive: 1 });

module.exports = mongoose.model('DutyType', dutyTypeSchema);