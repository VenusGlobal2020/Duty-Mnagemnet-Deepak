const mongoose = require('mongoose');

const rankSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },      // e.g. "SP"
  code: { type: String, required: true, trim: true, uppercase: true }, // e.g. "A"
  priority: { type: Number, required: true, min: 1 },      // 1 = highest
  color: { type: String, default: '#3B82F6' },             // Tailwind-compatible hex
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // ─── Leave management ──────────────────────────────────────────────────────
  // Which side of the leave-approval hierarchy an officer holding this rank
  // sits on. Kept on the Rank (not hardcoded) so new ranks can be added later
  // and slotted into the existing leave-routing logic without a code change:
  //   'junior' — Constable / Head Constable style ranks. Their leave requests
  //              are routed to a thana Inspector / zone DSP / admin / superadmin
  //              depending on leave type & duration (see utils/leaveEngine.js).
  //   'senior' — SI / Inspector / DSP style ranks. Their own leave requests
  //              always go straight to admin (regular) or superadmin (special).
  leaveTier: { type: String, enum: ['junior', 'senior'], default: 'senior' },

  // Marks this rank as a leave-approval authority for junior-tier officers:
  //   'inspector' — approves casual leave (<=3 days) for junior officers
  //                 posted in the SAME thana.
  //   'dsp'       — approves casual leave (4-10 days) / earned leave (<=7 days)
  //                 for junior officers posted in the SAME zone.
  //   'none'      — this rank has no leave-approval authority of its own.
  leaveApprovalRole: { type: String, enum: ['none', 'inspector', 'dsp'], default: 'none' },
}, { timestamps: true });

rankSchema.index({ priority: 1 });
rankSchema.index({ code: 1 }, { unique: true });

module.exports = mongoose.model('Rank', rankSchema);