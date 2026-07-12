const mongoose = require('mongoose');

// This model is READ-ONLY from the main backend's point of view — the
// mobile app's backend (appbackend/serverMobile.js) is the one actually
// writing to this collection via services/trackingService.js. Both backends
// connect to the SAME MONGO_URI, so this just points at the exact same
// 'tracklogs' collection Mongoose already created there. Schema kept
// identical to the appbackend version so populate()/field access behaves
// the same on both sides.

const MAX_POINTS_PER_SHIFT = 6000;

const trackPointSchema = new mongoose.Schema(
  {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    accuracy: { type: Number, default: null },
    speed: { type: Number, default: null },
    recordedAt: { type: Date, required: true },
  },
  { _id: false }
);

const trackLogSchema = new mongoose.Schema(
  {
    // The EXACT check-in/check-out session (Attendance document) this route
    // belongs to. One TrackLog per Attendance record = one TrackLog per shift.
    attendanceRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Attendance', required: true },

    dutyRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Duty', required: true },
    officerUserRef: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    date: { type: String, required: true }, // YYYY-MM-DD

    points: { type: [trackPointSchema], default: [] },

    pointCount: { type: Number, default: 0 },
    totalDistanceMeters: { type: Number, default: 0 },
    firstPointAt: { type: Date, default: null },
    lastPointAt: { type: Date, default: null },
  },
  { timestamps: true }
);

trackLogSchema.index({ attendanceRef: 1 }, { unique: true });
trackLogSchema.index({ dutyRef: 1, officerUserRef: 1, date: -1 });
trackLogSchema.index({ officerUserRef: 1, date: -1 });

trackLogSchema.statics.MAX_POINTS_PER_SHIFT = MAX_POINTS_PER_SHIFT;

module.exports = mongoose.models.TrackLog || mongoose.model('TrackLog', trackLogSchema);