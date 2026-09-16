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
// THE BANDS IN ORDER, lowest to highest — the ladder MARK LINGUIST steps a word up.
const BAND_LADDER = [...RARITY_BANDS, OBSCURE_BAND];

/**
 * One rarity band higher than `r`, or `r` unchanged when it is already OBSCURE.
 *
 * Used by the LINGUIST mark (progress/marks.js: "12% chance a word counts one RARITY TIER
 * higher"). The bumped result keeps the word's LENGTH bonus — the mark promises a better BAND,
 * not a different word — and is re-capped, so a long OBSCURE word cannot exceed the ceiling any
 * other word could reach.
 */
export function bumpRarity(r) {
  if (!r) return r;
  const i = BAND_LADDER.findIndex((b) => b.name === r.band);
  if (i < 0 || i >= BAND_LADDER.length - 1) return r;
  const band = BAND_LADDER[i + 1];
  const lengthMult = Number.isFinite(r.lengthMult) && r.lengthMult > 0 ? r.lengthMult : 1;
  const mult = Math.min(RARITY_MAX_MULT, Math.round(band.mult * lengthMult * 100) / 100);
  return {
    ...r,
    band: band.name,
    mult,
    bandMult: band.mult,
    lengthMult: band.mult > 0 ? mult / band.mult : 1,
    color: band.color,
    announce: band.announce,
    label: band.announce ? `${band.name} ×${mult}` : '',
    bumped: true,
  };
}

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
    // The two halves of `mult`, so the payout receipt can name them separately — the player is
    // told RARITY and LENGTH, not one fused number they cannot act on. bandMult is the band's own
    // multiplier; lengthMult is whatever the length bonus added ON TOP, expressed as a ratio so
    // bandMult × lengthMult === mult exactly (including when the ×4.5 ceiling clipped the sum).
    bandMult: band.mult,
    lengthMult: band.mult > 0 ? mult / band.mult : 1,
    color: band.color,
    announce: band.announce,
    // e.g. "RARE ×2.5" — the multiplier carries the length bonus, so a long uncommon word
    // reads e.g. "UNCOMMON ×1.8". COMMON returns announce:false so callers show nothing.
    label: band.announce ? `${band.name} ×${mult}` : '',
  };
}

// ---------------------------------------------------------------------------------------------
// SAT RUSH: RARITY, RELATIVE TO THE DECK IT CAME FROM
//
// THE DOUBLE COUNT THIS FIXES. The per-word rarity multiplier exists to reward a player for
// CHOOSING an uncommon word — it is a payment for a decision. In SAT Rush the player never
// chooses: the deck serves the word. So SAT was being paid twice for the same property, once by
// a deck that is rare by construction and again by a multiplier meant for a choice that mode
// does not offer. Measured, the whole deck averages 3.42x rarity against a real typist's 1.23x —
// a flat 2.79x that no SAT player ever earned. That single free factor is what pinned the whole
// cross-mode economy: it forced SAT's CARD rate down to keep its wins/MIN in band, which is why
// "SAT near Blitz" and "spread under 2.00x" only met in a ~4-card-point sliver.
//
// THE FIX IS NORMALISATION, NOT DELETION. Scoring every SAT word at a flat x1 would remove the
// double count but also remove the reason to care which word came up. Dividing by the deck's own
// mean keeps the variance and removes the bias: the AVERAGE SAT word now scores x1, a
// harder-than-average one scores above, an easier one below. "How rare is this, for a SAT word?"
// is the question the mode can actually pose, and it is the one a player can feel.
//
// The constant is measured, not guessed, and rarity.test.js recomputes it from the shipped deck
// so it cannot silently drift when words are added.
export const SAT_DECK_MEAN_RARITY = 3.42;

// What a REAL TYPIST's word is worth in rarity terms, measured the same way: draw from the
// frequency-weighted top-12k the way a player under a clock actually types, and average the
// rarity multiplier. Every non-SAT mode collects roughly this much rarity per word.
export const TYPIST_MEAN_RARITY = 1.23;

/**
 * A SAT word's rarity weight, normalised so the mode collects the SAME rarity per word as every
 * other mode — no more (the double count) and no less.
 *
 * THE FIRST VERSION OF THIS DIVIDED BY THE DECK MEAN ALONE, which pinned a typical SAT word at
 * x1.0 — and that over-corrected. The double count was never SAT's whole rarity contribution; it
 * was the EXCESS over what other modes get. Other modes average 1.23x from rarity, so pushing SAT
 * to 1.00 did not remove a bias, it created one in the opposite direction, and the economy then
 * could not seat SAT anywhere near Blitz without blowing the spread.
 * Scaling by TYPIST_MEAN / DECK_MEAN puts the average SAT word at 1.23 — level with everyone —
 * while a harder-than-typical SAT word still pays more and an easier one less.
 */
export function satRarityMult(rarityMult) {
  const r = Number.isFinite(rarityMult) && rarityMult > 0 ? rarityMult : SAT_DECK_MEAN_RARITY;
  return r * (TYPIST_MEAN_RARITY / SAT_DECK_MEAN_RARITY);
}
