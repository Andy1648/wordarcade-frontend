// crit.js — CRITICAL KEYS (Andy oct8): "when a user gets lucky typing a key it shows a cooler key animation and gives
// crit-power × the normal amount, occurring at crit-rate probability". PURE — no storage, no DOM; the rng is injectable.
//
// The STATS live on the gears (markRollsCore CRIT_BY_TIER / critStatsOf / critTotals — RATE from 0%, POWER from ×2).
// This module is the ROLL:
//   rollCrit(rate, rng)          one key: true with probability `rate` (0 → never, ≥ 1 → always)
//   critKey(perKey, crit, rng)   one key's XP: perKey, or perKey × POWER on a crit → { gain, crit }
//   critBatch(n, perKey, crit)   n keys, EACH rolled independently → { total, crits } (the exact sum of the n gains)
//   critAvgGain(crit)            the average XP bonus a key earns: rate × (power − 1)  (12% · ×2.5 → +18%)
// Only MENU keys roll (the XP source in season 2) — taps and game letters do not.
// The WORDS (the STATS row, the gear lines) live in critText.js — kept out of the menu's eager chunk.

const rate01 = (r) => (Number.isFinite(r) && r > 0 ? Math.min(1, r) : 0);
const powerOf = (p) => (Number.isFinite(p) && p > 0 ? p : 1);

/** One key's crit roll: `rng() < rate`. A rate of 0 never crits (the rng is not even called). */
export function rollCrit(rate, rng = Math.random) {
  const r = rate01(rate);
  if (!r) return false;
  return rng() < r;
}

/** One key's XP: `perKey`, × POWER when it crits. { gain, crit }. */
export function critKey(perKey, { rate = 0, power = 2 } = {}, rng = Math.random) {
  const base = Number.isFinite(perKey) && perKey > 0 ? perKey : 0;
  const crit = rollCrit(rate, rng);
  return { gain: crit ? base * powerOf(power) : base, crit };
}

/**
 * One key's XP when it is the `seq`-th MENU key of a session (1-based): EVERY `crit.every`-th key is a GUARANTEED crit
 * (GEAR POOL v2 — METRONOME's EVERY 4TH KEY CRITS, THUNDERCLAP's DRUMROLL every 10th); any other key rolls as critKey.
 * `every` 0 / absent = no guaranteed crits. { gain, crit, forced }.
 */
export function critKeyAt(seq, perKey, crit = {}, rng = Math.random) {
  const every = Number.isFinite(crit.every) && crit.every >= 1 ? Math.floor(crit.every) : 0;
  const n = Number.isFinite(seq) ? Math.floor(seq) : 0;
  if (every && n > 0 && n % every === 0) {
    const base = Number.isFinite(perKey) && perKey > 0 ? perKey : 0;
    return { gain: base * powerOf(crit.power), crit: true, forced: true };
  }
  return { ...critKey(perKey, crit, rng), forced: false };
}

/**
 * `n` keys credited together (a batch): every key rolls on its own, and `total` is EXACTLY the sum of the n gains —
 * (n − crits) × perKey + crits × perKey × POWER. { total, crits }.
 */
export function critBatch(n, perKey, crit = {}, rng = Math.random) {
  const k = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  const base = Number.isFinite(perKey) && perKey > 0 ? perKey : 0;
  let crits = 0;
  for (let i = 0; i < k; i++) if (rollCrit(crit.rate, rng)) crits += 1;
  return { total: (k - crits) * base + crits * base * powerOf(crit.power), crits };
}

/** The AVERAGE XP bonus per key from crits, as a fraction: rate × (power − 1). */
export function critAvgGain({ rate = 0, power = 2 } = {}) {
  return rate01(rate) * Math.max(0, powerOf(power) - 1);
}

/** "1 KEY IN N": the whole-number gap between crits (null at 0%). */
export function critOneIn(rate) {
  const r = rate01(rate);
  return r > 0 ? Math.max(1, Math.round(1 / r)) : null;
}
