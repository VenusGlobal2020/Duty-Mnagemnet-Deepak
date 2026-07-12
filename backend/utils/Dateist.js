// ─── IST-SAFE DATE HELPERS ──────────────────────────────────────────────────
// Leave-day counting, lock-date computation, and "is today within this leave"
// checks all need a stable notion of "calendar date in India" that doesn't
// depend on the server's OS timezone or Node's ICU build (small-icu builds
// can't reliably use Intl.DateTimeFormat with timeZone: 'Asia/Kolkata').
// Instead we do fixed +05:30 offset arithmetic by hand — no ICU involved.

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// Returns a 'YYYY-MM-DD' string for the given date (defaults to now) as it
// would read on an IST wall clock, regardless of server timezone.
const toISTDateStr = (date = new Date()) => {
  const shifted = new Date(date.getTime() + IST_OFFSET_MS);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// Returns today's IST calendar date as a 'YYYY-MM-DD' string.
const todayISTStr = () => toISTDateStr(new Date());

// Parses a 'YYYY-MM-DD' string (or any Date-ish input) into a UTC midnight
// Date representing that IST calendar day — used for inclusive day-count math.
const dateOnlyUTC = (input) => {
  const str = typeof input === 'string' ? input : toISTDateStr(new Date(input));
  const [y, m, d] = str.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

// Inclusive day count between two dates (e.g. 10th to 12th = 3 days).
const inclusiveDayCount = (fromDate, toDate) => {
  const a = dateOnlyUTC(fromDate);
  const b = dateOnlyUTC(toDate);
  const diff = Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
  return diff + 1;
};

// Every 'YYYY-MM-DD' string from fromDate to toDate, inclusive.
const enumerateDateStrs = (fromDate, toDate) => {
  const a = dateOnlyUTC(fromDate);
  const b = dateOnlyUTC(toDate);
  const out = [];
  for (let t = a.getTime(); t <= b.getTime(); t += 24 * 60 * 60 * 1000) {
    const d = new Date(t);
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`);
  }
  return out;
};

// True if `dateStr` (or today, if omitted) falls within [fromDate, toDate] inclusive.
const isDateWithinRange = (fromDate, toDate, dateStr = todayISTStr()) => {
  const target = dateOnlyUTC(dateStr).getTime();
  return target >= dateOnlyUTC(fromDate).getTime() && target <= dateOnlyUTC(toDate).getTime();
};

// True if two [fromA,toA] / [fromB,toB] inclusive date ranges overlap at all.
const rangesOverlap = (fromA, toA, fromB, toB) => {
  return dateOnlyUTC(fromA).getTime() <= dateOnlyUTC(toB).getTime()
    && dateOnlyUTC(fromB).getTime() <= dateOnlyUTC(toA).getTime();
};

module.exports = {
  IST_OFFSET_MS, toISTDateStr, todayISTStr, dateOnlyUTC,
  inclusiveDayCount, enumerateDateStrs, isDateWithinRange, rangesOverlap,
};