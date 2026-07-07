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
    // longer defined. That stale index is what causes a "DutyRef already
    // exists" error the moment an officer tries to check in on day 2+ of a
    // multi-day duty (their day-1 record already satisfies the old, broader
    // index, so day 2's insert collides with it even though the date differs).
    //
    // Attendance.syncIndexes() reconciles the collection's actual indexes
    // with exactly what's declared in the current schema — dropping any
    // extra/outdated index and (re)creating the correct
    // (dutyRef, officerRef, date) unique index. It's safe to run on every
    // boot: a no-op once the collection is already in sync.
    try {
      const Attendance = require('../models/Attendance');
      const result = await Attendance.syncIndexes();
      console.log('✅ Attendance indexes synced:', result);
    } catch (indexErr) {
      // Never let an index-sync hiccup take the whole server down — worst
      // case the stale-index bug persists until the next successful sync.
      console.error('⚠️  Attendance index sync failed (server will continue running):', indexErr.message);
    }
  } catch (error) {
    console.error(`❌ DB Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;