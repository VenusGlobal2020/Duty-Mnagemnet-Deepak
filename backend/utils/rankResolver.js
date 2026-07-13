const Rank = require('../models/Rank');

// ─── RANK RESOLUTION ─────────────────────────────────────────────────────────
// Officer creation (single + bulk) accepts a free-text rank value that may be:
//   - an exact Rank.code ("H")
//   - a full rank name in English ("Head Constable")
//   - a shortform/abbreviation ("HC", "H.C.", "Const.")
//   - a Hindi name ("हेड कांस्टेबल", "उप निरीक्षक")
// Ranks themselves stay fully dynamic (created/edited by master via
// /api/master/ranks) — this resolver just ships with a built-in alias table
// for the 5 ranks currently in use, matched against whatever Rank documents
// actually exist in the DB (by code or name, not by hardcoded IDs). Any
// rank not covered by the alias table still works via exact code/name match.

// Normalizes a string for comparison: trims, collapses internal whitespace,
// lowercases (Hindi is left as-is — there is no meaningful case folding for
// Devanagari), and strips common punctuation used in abbreviations.
const normalize = (val) => {
  if (val === null || val === undefined) return '';
  return String(val)
    .trim()
    .replace(/[.\-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase();
};

// Alias table: canonical rank key -> every English/Hindi/shortform spelling
// we should recognize. Keys are just internal labels used to group aliases;
// actual matching happens against each live Rank's own name/code below.
const KNOWN_RANK_ALIASES = {
  constable: [
    'constable', 'const', 'cnst', 'ct', 'pc', 'sipahi', 'sipaahi',
    'कांस्टेबल', 'कान्स्टेबल', 'सिपाही', 'सिपाहि',
  ],
  head_constable: [
    'head constable', 'headconstable', 'hc', 'h c', 'hct', 'h.c',
    'हेड कांस्टेबल', 'हैड कांस्टेबल', 'मुख्य आरक्षी', 'हेड कान्स्टेबल',
  ],
  sub_inspector: [
    'sub inspector', 'subinspector', 'si', 's i', 'sub insp', 'sub-inspector',
    'उप निरीक्षक', 'सब इंस्पेक्टर', 'सब इंसपेक्टर', 'दरोगा',
  ],
  inspector: [
    'inspector', 'insp', 'ins', 'i',
    'निरीक्षक', 'इंस्पेक्टर', 'इंसपेक्टर',
  ],
  dsp: [
    'dsp', 'd s p', 'deputy superintendent', 'deputy superintendent of police',
    'डीएसपी', 'डी एस पी', 'उप पुलिस अधीक्षक',
  ],
};

// Returns the canonical alias-key ('constable' | 'head_constable' | ...) that
// `raw` matches, or null if it doesn't match any known alias.
const matchAliasKey = (raw) => {
  const norm = normalize(raw);
  if (!norm) return null;
  for (const [key, aliases] of Object.entries(KNOWN_RANK_ALIASES)) {
    if (aliases.some((a) => normalize(a) === norm)) return key;
  }
  return null;
};

// A rank whose own name/code doesn't obviously spell out its alias key gets
// tagged here so alias-based lookups still find it. Populated lazily by
// scanning each live Rank's name against the same alias tables (handles the
// case where e.g. a rank is named "H" for Head Constable in the DB).
const rankMatchesAliasKey = (rank, aliasKey) => {
  const candidates = [rank.name, rank.code].map(normalize);
  const aliases = KNOWN_RANK_ALIASES[aliasKey].map(normalize);
  return candidates.some((c) => aliases.includes(c));
};

/**
 * Pure, no-DB-call variant — resolves against an already-fetched list of
 * active ranks. Used by bulk upload so we fetch ranks ONCE for the whole
 * file instead of once per row (was the single biggest N+1 query source
 * slowing down large uploads).
 * @param {Array} activeRanks - Rank documents (isActive: true)
 * @param {string} rawValue
 */
const resolveRankFromList = (activeRanks, rawValue) => {
  const norm = normalize(rawValue);
  if (!norm) return null;

  // 1. Exact code match
  const byCode = activeRanks.find((r) => normalize(r.code) === norm);
  if (byCode) return byCode;

  // 2. Exact name match
  const byName = activeRanks.find((r) => normalize(r.name) === norm);
  if (byName) return byName;

  // 3. Alias-table match
  const aliasKey = matchAliasKey(rawValue);
  if (aliasKey) {
    const found = activeRanks.find((r) => rankMatchesAliasKey(r, aliasKey));
    if (found) return found;
  }

  return null;
};

/**
 * Resolve a free-text rank value to an active Rank document (DB-backed,
 * single query — fine for one-off lookups like single officer creation).
 * For bulk processing, fetch ranks once with Rank.find({isActive:true}) and
 * call resolveRankFromList(ranks, value) per row instead.
 * @param {string} rawValue - the raw rank text from a form/excel row
 * @returns {Promise<import('mongoose').Document|null>}
 */
const resolveRank = async (rawValue) => {
  if (!normalize(rawValue)) return null;
  const activeRanks = await Rank.find({ isActive: true });
  return resolveRankFromList(activeRanks, rawValue);
};

// ─── GENDER NORMALIZATION ────────────────────────────────────────────────────
// Bulk-upload/manual-entry gender values arrive in all sorts of casings/forms
// ("Male", "MALE", "m", "पुरुष", "महिला"...). The User/Officer schema enum is
// strictly lowercase ['male','female','other'] — normalize before saving so
// a stray capital letter never fails validation.
const GENDER_ALIASES = {
  male: ['male', 'm', 'पुरुष'],
  female: ['female', 'f', 'महिला', 'स्त्री'],
  other: ['other', 'o', 'अन्य'],
};
const normalizeGender = (raw, fallback = 'male') => {
  const norm = normalize(raw);
  if (!norm) return fallback;
  for (const [key, aliases] of Object.entries(GENDER_ALIASES)) {
    if (aliases.includes(norm)) return key;
  }
  return fallback;
};

module.exports = {
  resolveRank, resolveRankFromList, normalize, matchAliasKey, KNOWN_RANK_ALIASES, normalizeGender,
};
