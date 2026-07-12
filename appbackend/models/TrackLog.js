const mongoose = require('mongoose');

const MAX_POINTS_PER_DAY = 6000; // ~ one point every ~14s over a 24h shift — generous ceiling

const trackPointSchema = new mongoose.Schema(
  {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    accuracy: { type: Number, default: null }, // meters, from device GPS
    speed: { type: Number, default: null },    // m/s, from device GPS (if available)
    recordedAt: { type: Date, required: true }, // when the device captured the fix
  },
  { _id: false }
);

const trackLogSchema = new mongoose.Schema(
  {
    dutyRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Duty', required: true },

    // Mirrors how appbackend's own attendanceController keys records — by the
    // logged-in User's _id — so no extra Officer-model lookup is needed here.
    officerUserRef: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // Calendar date (YYYY-MM-DD, server-local) this route belongs to.
    date: { type: String, required: true },

    points: { type: [trackPointSchema], default: [] },

    pointCount: { type: Number, default: 0 },
    totalDistanceMeters: { type: Number, default: 0 },
    firstPointAt: { type: Date, default: null },
    lastPointAt: { type: Date, default: null },
  },
  { timestamps: true }
);

trackLogSchema.index({ dutyRef: 1, officerUserRef: 1, date: 1 }, { unique: true });
trackLogSchema.index({ officerUserRef: 1, date: -1 });

trackLogSchema.statics.MAX_POINTS_PER_DAY = MAX_POINTS_PER_DAY;

module.exports = mongoose.models.TrackLog || mongoose.model('TrackLog', trackLogSchema);