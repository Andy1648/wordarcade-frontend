// unlistedIds.js — the EAGER sliver of THE UNLISTED: just enough for the menu's first paint (the payout reads the worn
// gear through markRollsCore, which is eager) — each gear's id, name and tier, which word-secret grants it, and "do I
// own it". Everything else (riddles, the grant, the index mask, serials) lives in unlisted.js and loads lazily
// (payload ratchet, e2e/payload-budget.spec.js). A LEAF: imports nothing.
export const UNLISTED_KEY = 'taw.unlisted';
export const UNLISTED_TIER = 'unlisted';
// [id, name, the secrets.js id that grants it]
const ROWS = [
  ['mk-ul-og', 'O.G.', 'newgrounds'],
  ['mk-ul-wishbone', 'WISHBONE', 'wish'],
  ['mk-ul-typewriter', 'TYPEWRITER', 'typewriter'],
  ['mk-ul-mirror', 'MIRROR', 'palindrome'],
  ['mk-ul-midas', 'MIDAS', 'midas'],
  ['mk-ul-tripledouble', 'TRIPLE DOUBLE', 'tripledouble'],
];
const BY_ID = new Map(ROWS.map(([id, name]) => [id, Object.freeze({ id, name, tier: UNLISTED_TIER })]));
const BY_SECRET = new Map(ROWS.map(([id, , sid]) => [sid, id]));
export const UNLISTED_IDS = ROWS.map((r) => r[0]);
export const TRIPLE_DOUBLE_ID = 'mk-ul-tripledouble';

/** { id, name, tier } for an UNLISTED id, else null. */
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
    const s = storage || (typeof window !== 'undefined' ? window.localStorage : null);
    const raw = s && s.getItem ? s.getItem(UNLISTED_KEY) : null;
    const blob = raw ? JSON.parse(raw) : null;
    return !!(BY_ID.has(id) && blob && blob.owned && typeof blob.owned === 'object' && blob.owned[id]);
  } catch {
    return false;
  }
}
