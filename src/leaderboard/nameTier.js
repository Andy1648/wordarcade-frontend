// nameTier.js — HOW HIGH YOU ARE, worn on the name (Andy oct21: "make people feel even better for being top … more
// addictive high for being highly ranked"). Research (shared notes lb-name-prestige-research.md): the strongest prestige
// marks are SCARCE hard-cutoff tiers that print your EXACT place (Apex top-750 / OW Top 500 / Clash top-1000 badges) on a
// distinct painted silhouette, and the moment you get IN is a ceremony of its own.
// v2 (Andy oct22 "gold silver bronze and then some bs design" → shared notes seals-research.md): every tier is a DIFFERENT
// SILHOUETTE that escalates — recolors don't read as rank. Mass, aggression and ornament climb; wings only on the podium,
// the crown only on #1:
//   splat  #26–50  violet ink-splat tag (drips + overspray)
//   star   #11–25  cyan jagged lightning star
//   flame  #4–10   orange hex shield crowned with flames
//   wing   #2–3    pink winged diamond crest
//   crown  #1      the one-of-one: gold winged, crowned, flaming starburst (+ a one-shot shine on appear)
//   stone  #51–100 chipped bronze-and-stone badge (oct29, the TOP 100: hero-art painted it from the five above)
//   past #100: no seal — the plain number (scarcity is the point)
// Pure (no DOM): the board, the profile card and the tests all read it.

export const SEAL_ART = {
  crown: '/lb/seal-crown.webp',
  wing: '/lb/seal-wing.webp',
  flame: '/lb/seal-flame.webp',
  star: '/lb/seal-star.webp',
  splat: '/lb/seal-splat.webp',
  stone: '/lb/seal-stone.webp',
};

// best first: a lower index is a higher tier
export const NAME_TIERS = [
  { key: 'crown', top: 1, label: '#1' },
  { key: 'wing', top: 3, label: 'TOP 3' },
  { key: 'flame', top: 10, label: 'TOP 10' },
  { key: 'star', top: 25, label: 'TOP 25' },
  { key: 'splat', top: 50, label: 'TOP 50' },
  { key: 'stone', top: 100, label: 'TOP 100' },
];

/** The tier a board rank wears, or null past #100 / for no rank. */
export function nameTier(rank) {
  const r = Math.floor(Number(rank));
  if (!(r >= 1)) return null;
  return NAME_TIERS.find((t) => r <= t.top) || null;
}

const tierIndex = (rank) => {
  const t = nameTier(rank);
  return t ? NAME_TIERS.indexOf(t) : NAME_TIERS.length;
};

/**
 * THE "YOU GOT IN" MOMENT: the tier you just climbed INTO, or null. `from` = your rank at the last look (null / 0 = no
 * last look → no ceremony: a first visit is not a climb). #2 ↔ #3 share the wing tier, so a #3 → #2 swap is a climb on
 * the board but not a new tier.
 */
export function enteredTier(from, to) {
  const f = Number(from);
  if (!(f >= 1) || !(Number(to) >= 1)) return null;
  if (tierIndex(to) >= tierIndex(f)) return null;
  return nameTier(to);
}
