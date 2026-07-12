const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`✅ MongoDB connected: ${conn.connection.host}`);

    // ─── Fix stale Attendance index (multi-day check-in bug) ─────────────────
    // The Attendance model is keyed uniquely on (dutyRef, officerRef, date) so
    // a multi-day duty gets ONE record per officer PER DAY. If this database
    // was created/migrated before the `date` field existed on that index, an
    // older unique index — just (dutyRef, officerRef), or even dutyRef alone —
    // may still be sitting on the collection. Mongoose's normal startup only
    // ADDS indexes defined in the schema; it never drops ones that are no
    // longer defined. That stale index is what causes a "you have already
    // checked in today" error the moment an officer tries to check in on day
    // 2+ of a multi-day duty (their day-1 record already satisfies the old,
    // broader index, so day 2's insert collides with it even though the date
    // differs).
    //
    // We do this explicitly (list indexes -> drop anything unexpected ->
    // syncIndexes) instead of only calling Attendance.syncIndexes(), and we
    // log every step loudly and RE-THROW on failure. The previous version of
    // this function swallowed index-sync errors with a plain console.error,
    // so on any deployment where the DB user lacked index-management rights,
    // or the sync silently no-op'd, the stale index kept causing the bug
    // forever with no visible signal that anything was wrong.
    try {
      const Attendance = require('../models/Attendance');
      const collection = Attendance.collection;

      const existingIndexes = await collection.indexes();
      console.log(
        'ℹ️  Current Attendance indexes:',
        JSON.stringify(existingIndexes.map((i) => ({ name: i.name, key: i.key, unique: i.unique })))
      );

      const isCorrectAttendanceIndex = (idx) => {
        const keys = Object.keys(idx.key);
        return keys.length === 3 && idx.key.dutyRef === 1 && idx.key.officerRef === 1 && idx.key.date === 1;
      };

      // Any unique index that touches dutyRef+officerRef but ISN'T exactly
      // the current (dutyRef, officerRef, date) unique index is a stale
      // pre-multi-day index and must be dropped, or it will keep colliding
      // with day-2+ check-ins forever.
      for (const idx of existingIndexes) {
        if (idx.name === '_id_') continue;
        const keys = Object.keys(idx.key);
        const touchesDutyOfficer = keys.includes('dutyRef') && keys.includes('officerRef');
        if (touchesDutyOfficer && idx.unique && !isCorrectAttendanceIndex(idx)) {
          console.warn(
            `⚠️  Dropping stale Attendance index "${idx.name}" (${JSON.stringify(idx.key)}) — this was blocking multi-day check-ins`
          );
          await collection.dropIndex(idx.name);
        }
      }

      const result = await Attendance.syncIndexes();
      console.log('✅ Attendance indexes synced:', result);
    } catch (indexErr) {
      // Surface this loudly. A silently-failed index sync means the
      // multi-day check-in bug will keep happening with no visible cause,
      // so it's better to fail startup than to run in a broken state.
      console.error('❌ Attendance index sync failed:', indexErr.message);
      throw indexErr;
    }
  } catch (error) {
    console.error(`❌ DB Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;