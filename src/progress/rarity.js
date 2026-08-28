// rarity.js — WORD RARITY multiplier for WINS. A word game should pay more for a rarer
// word: "cat" and "quixotic" must not earn the same. PURE + testable (no DOM, no storage).
//
// FREQUENCY SOURCE: words.recall.txt — the repo's frequency-ordered list where index === rank
// (rank 0 = "the", most common). It is ~31.5k words and INCLUDES short common words, so it is
// the right ranking for every mode (Word Bomb's "cat" resolves to a low rank = COMMON). There is
// NO top3k.txt / 50k+ list in the repo; recall is the ordered corpus, and any accepted word NOT
// in it is rarer than the entire ranked corpus → OBSCURE. Ranks come from a Map built once from
// recall (buildRarityIndex); the engines/UI pass that Map in, so this module never loads assets.
//
// A word's multiplier = its BAND multiplier (by rank) + a LENGTH bonus, clamped to RARITY_MAX_MULT.
// The multiplier stacks on top of mode / rebirth / difficulty / combo in wins.js.

// Band boundaries are the tunable knobs (see claude/rarity-sim.mjs for the measured
// distribution these were fit to). `max` is EXCLUSIVE: a rank r is in the first band whose
// max it is below. A word absent from recall has no rank → OBSCURE.
export const RARITY_BANDS = [
  { name: 'COMMON', maxRank: 3000, mult: 1.0, color: '#F0EAD9', announce: false },
  { name: 'UNCOMMON', maxRank: 15000, mult: 1.5, color: '#2EFFE0', announce: true },
  { name: 'RARE', maxRank: Infinity, mult: 2.5, color: '#9A1AFF', announce: true },
];
// OBSCURE is the "not in the ranked corpus" band (rarer than every recall word).
export const OBSCURE_BAND = { name: 'OBSCURE', mult: 4.0, color: '#FFD54A', announce: true };

// Length bonus: +0.1× per letter ABOVE 5, capped at +0.5× (a 10-letter word maxes it).
export const LENGTH_BONUS_PER_LETTER = 0.1;
export const LENGTH_BONUS_MAX = 0.5;
export const LENGTH_BONUS_FLOOR = 5; // letters up to & including this add nothing

// Hard cap on the total per-word multiplier so no single word can run away with the payout:
// the rarest band (4.0) + the max length bonus (0.5) = 4.5.
export const RARITY_MAX_MULT = 4.5;

// Build a word→rank Map from the frequency-ordered recall array (index === rank). First
// occurrence wins (defensive against any dup). This is the object the runtime + sim pass to
// wordRarity(); building it is the only O(n) step and it is done once per session.
export function buildRarityIndex(recallArray) {
  const idx = new Map();
  if (!Array.isArray(recallArray)) return idx;
  for (let i = 0; i < recallArray.length; i++) {
    const w = recallArray[i];
    if (w && !idx.has(w)) idx.set(w, i);
  }
  return idx;
}

// The band for a rank (or null rank = not in corpus). Pure.
export function bandForRank(rank) {
  if (!Number.isFinite(rank)) return OBSCURE_BAND;
  for (const b of RARITY_BANDS) {
    if (rank < b.maxRank) return b;
  }
  return OBSCURE_BAND; // unreachable (last band is Infinity) but keeps the contract total
}

// The length bonus for a word length. Pure.
export function lengthBonus(len) {
  const over = (Number.isFinite(len) ? len : 0) - LENGTH_BONUS_FLOOR;
  if (over <= 0) return 0;
  return Math.min(LENGTH_BONUS_MAX, over * LENGTH_BONUS_PER_LETTER);
}

// The rarity verdict for one word given a rank index.
//   { band, mult, color, announce, label }  — mult is the CLAMPED total (band + length),
//   announce is false for COMMON (it stays silent) and true for UNCOMMON+; label is the pop
//   text e.g. "RARE ×2.5". A missing/empty word or index → COMMON, silent, ×1 (safe default,
//   so a not-yet-loaded index never inflates or crashes a payout).
export function wordRarity(word, rankIndex) {
  const w = typeof word === 'string' ? word.trim().toLowerCase() : '';
  if (!w || !(rankIndex instanceof Map)) {
    const c = RARITY_BANDS[0];
    return { band: c.name, mult: 1, color: c.color, announce: false, label: '' };
  }
  const rank = rankIndex.has(w) ? rankIndex.get(w) : NaN;
  const band = bandForRank(rank);
  const raw = band.mult + lengthBonus(w.length);
  const mult = Math.min(RARITY_MAX_MULT, Math.round(raw * 100) / 100);
  return {
    band: band.name,
    mult,
    color: band.color,
    announce: band.announce,
    // e.g. "RARE ×2.5" — the multiplier carries the length bonus, so a long uncommon word
    // reads e.g. "UNCOMMON ×1.8". COMMON returns announce:false so callers show nothing.
    label: band.announce ? `${band.name} ×${mult}` : '',
  };
}
