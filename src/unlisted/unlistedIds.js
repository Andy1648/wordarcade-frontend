// unlistedIds.js — the EAGER sliver of THE UNLISTED: just enough for the menu's first paint (the payout reads the worn
// gear through markRollsCore, which is eager) — each gear's id, name and tier, which word-secret grants it, and "do I
// own it". Everything else (riddles, the grant, the index mask, serials) lives in unlisted.js and loads lazily
// (payload ratchet, e2e/payload-budget.spec.js). A LEAF: imports nothing.
export const UNLISTED_KEY = 'taw.unlisted';
export const UNLISTED_TIER = 'unlisted';
// [id, name, the secrets.js id that grants it (null = its own detector, secrets/gearFinds.js), its ONE MAIN stat kind,
//  its substats]. GEAR VARIETY (Andy oct18 "they essentially better legendaries"): an UNLISTED is a LEGENDARY-sized gear
// — ONE main stat at the LEGENDARY value + a LEGENDARY substat budget (markRollsCore SUBSTAT_REF) — never ×3 on wins
// AND XP like an EARNED gear. A trophy you wear, never the reason a number is large.
const ROWS = [
  ['mk-ul-og', 'O.G.', 'newgrounds', 'wbWinsPct', 'C9 X5 L15 O60'],
  ['mk-ul-wishbone', 'WISHBONE', null, 'overdriveSec', 'C4.5 L30 G22.5'],
  ['mk-ul-typewriter', 'TYPEWRITER', null, 'baseXp', 'C18 P1 W10'],
  ['mk-ul-mirror', 'MIRROR', null, 'chainWinsPct', 'P1.5 W15 L15'],
  ['mk-ul-midas', 'MIDAS', 'midas', 'baseWins', 'P1 L15 G30'],
  ['mk-ul-tripledouble', 'TRIPLE DOUBLE', 'tripledouble', 'raceWinsPct', 'C13.5 X5 O90'],
];
const BY_ID = new Map(ROWS.map(([id, name, , stat, subs]) => [id, Object.freeze({ id, name, tier: UNLISTED_TIER, stat, subs })]));
const BY_SECRET = new Map(ROWS.filter((r) => r[2]).map(([id, , sid]) => [sid, id]));
export const UNLISTED_IDS = ROWS.map((r) => r[0]);
export const TRIPLE_DOUBLE_ID = 'mk-ul-tripledouble';
export const WISHBONE_ID = 'mk-ul-wishbone';
export const TYPEWRITER_ID = 'mk-ul-typewriter';

/** { id, name, tier, stat, subs } for an UNLISTED id, else null. */
export function unlistedEntry(id) {
  return BY_ID.get(id) || null;
}
/** The gear id a secrets.js find grants, or null. */
export function gearIdForSecret(secretId) {
  return BY_SECRET.get(secretId) || null;
}
/** Owns this UNLISTED gear? (reads the store; guarded) */
export function ownsUnlistedId(id, storage) {
  try {
    const s = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    const raw = s && s.getItem ? s.getItem(UNLISTED_KEY) : null;
    const blob = raw ? JSON.parse(raw) : null;
    return !!(BY_ID.has(id) && blob && blob.owned && typeof blob.owned === 'object' && blob.owned[id]);
  } catch {
    return false;
  }
}
