const mongoose = require('mongoose');

const rankSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },      // e.g. "SP"
  code: { type: String, required: true, trim: true, uppercase: true }, // e.g. "A"
  priority: { type: Number, required: true, min: 1 },      // 1 = highest
  color: { type: String, default: '#3B82F6' },             // Tailwind-compatible hex
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

rankSchema.index({ priority: 1 });
rankSchema.index({ code: 1 }, { unique: true });

module.exports = mongoose.model('Rank', rankSchema);
