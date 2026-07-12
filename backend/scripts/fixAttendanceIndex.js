// One-off manual fix for the "multi-day check-in" bug.
//
// Run this ONCE directly against your production database to immediately
// unblock officers, without waiting for a redeploy:
//
//   node scripts/fixAttendanceIndex.js
//
// (Needs MONGO_URI available, e.g. via your .env file in this folder.)
//
// What it does: finds any unique index on the `attendances` collection that
// still matches the OLD pre-multi-day shape — just (dutyRef, officerRef), or
// dutyRef alone — and drops it, then creates the correct
// (dutyRef, officerRef, date) unique index used by the current schema. This
// is the same logic now run automatically on every server boot in
// config/db.js; this script just lets you apply it right now.

require('dotenv').config();
const mongoose = require('mongoose');

const run = async () => {
  if (!process.env.MONGO_URI) {
    console.error('❌ MONGO_URI not set (check your .env file)');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected to MongoDB');

  const collection = mongoose.connection.collection('attendances');

  const existingIndexes = await collection.indexes();
  console.log('\nCurrent indexes on `attendances`:');
  existingIndexes.forEach((i) => console.log(`  - ${i.name}: ${JSON.stringify(i.key)}  unique=${!!i.unique}`));

  const isCorrectAttendanceIndex = (idx) => {
    const keys = Object.keys(idx.key);
    return keys.length === 3 && idx.key.dutyRef === 1 && idx.key.officerRef === 1 && idx.key.date === 1;
  };

  let droppedAny = false;
  for (const idx of existingIndexes) {
    if (idx.name === '_id_') continue;
    const keys = Object.keys(idx.key);
    const touchesDutyOfficer = keys.includes('dutyRef') && keys.includes('officerRef');
    if (touchesDutyOfficer && idx.unique && !isCorrectAttendanceIndex(idx)) {
      console.log(`\n⚠️  Dropping stale index "${idx.name}" (${JSON.stringify(idx.key)})...`);
      await collection.dropIndex(idx.name);
      droppedAny = true;
    }
  }

  if (!droppedAny) {
    console.log('\nℹ️   No stale index found — nothing to drop.');
  }

  const hasCorrectIndex = (await collection.indexes()).some(isCorrectAttendanceIndex);
  if (!hasCorrectIndex) {
    console.log('\nCreating correct (dutyRef, officerRef, date) unique index...');
    await collection.createIndex({ dutyRef: 1, officerRef: 1, date: 1 }, { unique: true });
  }

  console.log('\n✅ Done. Final indexes on `attendances`:');
  (await collection.indexes()).forEach((i) => console.log(`  - ${i.name}: ${JSON.stringify(i.key)}  unique=${!!i.unique}`));

  await mongoose.disconnect();
  process.exit(0);
};

run().catch((err) => {
  console.error('❌ Script failed:', err);
  process.exit(1);
});