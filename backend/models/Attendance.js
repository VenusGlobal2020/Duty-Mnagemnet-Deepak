const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  dutyRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Duty',
    required: true,
  },
  officerRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Officer',
    required: true,
  },
  officerUserRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  // Hierarchy refs (for fast querying by admin/operator)
  operatorRef: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  adminRef: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  superadminRef: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // Calendar date (YYYY-MM-DD, server-local) this record belongs to. Multi-day
  // duties get ONE attendance record per officer PER DAY, so if an officer is
  // swapped out mid-duty their earlier days stay recorded under them and the
  // incoming officer's check-ins from the swap date onward are their own
  // separate records — nothing gets merged or overwritten.
  date: { type: String, required: true },

  // Which of the duty's defined shifts (if any) this check-in falls under —
  // a label snapshot, since shifts can themselves be edited later.
  shiftLabel: { type: String, default: null },

  // Check-in details
  checkedInAt: { type: Date },
  checkInLocation: {
    lat: { type: Number },
    lng: { type: Number },
  },
  checkInDistanceMeters: { type: Number }, // distance from duty location at check-in

  // Check-out details
  checkedOutAt: { type: Date },
  checkOutLocation: {
    lat: { type: Number },
    lng: { type: Number },
  },
  checkOutDistanceMeters: { type: Number },

  // Status
  status: {
    type: String,
    enum: ['present', 'absent', 'late', 'partial'], // partial = checked in but no check-out yet
    default: 'partial',
  },

  // Duration in minutes (calculated on check-out)
  durationMinutes: { type: Number },

  // Whether check-in was within allowed radius
  isWithinRadius: { type: Boolean, default: false },

  // Duty snapshot at time of check-in
  dutySnapshot: {
    dutyName: String,
    locationName: String,
    dutyLat: Number,
    dutyLng: Number,
    startDate: Date,
    endDate: Date,
  },
}, { timestamps: true });

attendanceSchema.index({ dutyRef: 1, officerRef: 1, date: 1 }, { unique: true });
attendanceSchema.index({ operatorRef: 1, checkedInAt: -1 });
attendanceSchema.index({ adminRef: 1, checkedInAt: -1 });
attendanceSchema.index({ officerRef: 1, checkedInAt: -1 });
attendanceSchema.index({ dutyRef: 1, status: 1 });

module.exports = mongoose.model('Attendance', attendanceSchema);