const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema(
  {
    dutyRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Duty' },
  },
  { strict: false, collection: 'attendances' }
);

module.exports = mongoose.models.Attendance || mongoose.model('Attendance', attendanceSchema);