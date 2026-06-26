const cron = require('node-cron');
const Duty = require('../models/Duty');

// ─── DUTY STATUS LIFECYCLE CRON ────────────────────────────────────────────────
// Automatically keeps Duty.status in sync with real time, instead of relying on
// anyone to flip it by hand:
//
//   draft  -> active     the moment Date.now() reaches duty.startDate
//   active -> completed  the moment Date.now() reaches duty.endDate
//
// 'cancelled' is a manual, terminal state set by an operator and is never
// touched here. Both transitions run as single bulk updateMany calls (no
// per-document loop, no full-document fetch) so this stays fast and cheap to
// run every minute even with a large duties collection, and each run pushes a
// timeline entry so the change is visible/auditable from the duty's history.

const activateDueDuties = async () => {
  const now = new Date();

  // Find first (for timeline note + ids), then bulk-flip — keeps this a single
  // round trip for the update while still letting us know what changed.
  const toActivate = await Duty.find(
    { status: 'draft', startDate: { $lte: now } },
    { _id: 1 }
  ).lean();

  if (toActivate.length === 0) return 0;

  const ids = toActivate.map((d) => d._id);
  await Duty.updateMany(
    { _id: { $in: ids } },
    {
      $set: { status: 'active' },
      $push: {
        timeline: {
          action: 'DUTY_AUTO_ACTIVATED',
          performedBy: null,
          performedAt: now,
          note: 'Duty start time reached — automatically marked active',
        },
      },
    }
  );

  return ids.length;
};

const completeDueDuties = async () => {
  const now = new Date();

  const toComplete = await Duty.find(
    { status: 'active', endDate: { $lte: now } },
    { _id: 1 }
  ).lean();

  if (toComplete.length === 0) return 0;

  const ids = toComplete.map((d) => d._id);
  await Duty.updateMany(
    { _id: { $in: ids } },
    {
      $set: { status: 'completed' },
      $push: {
        timeline: {
          action: 'DUTY_AUTO_COMPLETED',
          performedBy: null,
          performedAt: now,
          note: 'Duty end time reached — automatically marked completed',
        },
      },
    }
  );

  return ids.length;
};

// Guards against two ticks overlapping if a run ever takes longer than the
// schedule interval (e.g. a slow DB moment) — without this a slow tick could
// stack with the next one and double up work.
let isRunning = false;

const runDutyStatusSweep = async () => {
  if (isRunning) return;
  isRunning = true;
  try {
    const activated = await activateDueDuties();
    const completed = await completeDueDuties();
    if (activated || completed) {
      console.log(
        `[duty-cron] ${new Date().toISOString()} — activated: ${activated}, completed: ${completed}`
      );
    }
  } catch (err) {
    console.error('[duty-cron] sweep failed:', err);
  } finally {
    isRunning = false;
  }
};

// Runs every minute — frequent enough that a duty's status flips within ~60s
// of its actual start/end time, without hammering the DB.
const startDutyStatusCron = () => {
  cron.schedule('* * * * *', runDutyStatusSweep);
  console.log('🕐 Duty status cron started (runs every minute)');

  // Run one sweep immediately on boot so duties don't sit stale for up to a
  // minute after a server restart/deploy.
  runDutyStatusSweep();
};

module.exports = { startDutyStatusCron, runDutyStatusSweep };
