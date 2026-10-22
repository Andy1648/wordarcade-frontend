// nameTier.js — HOW HIGH YOU ARE, worn on the name (Andy oct21: "make people feel even better for being top … more
// addictive high for being highly ranked"). Research (shared notes lb-name-prestige-research.md): the strongest prestige
// marks are SCARCE hard-cutoff tiers that print your EXACT place (Apex top-750 / OW Top 500 / Clash top-1000 badges) on a
// distinct painted silhouette, and the moment you get IN is a ceremony of its own.
//   crown  #1        — the crowned gold shield (and the name in Bungee Shade)
//   silver #2, bronze #3 — the podium shields
//   gold   #4–10, cyan #11–25, violet #26–50 — the notched seals (the board's existing band colours)
//   past #50: no seal — the plain number (scarcity is the point)
// Pure (no DOM): the board, the profile card and the tests all read it.

export const SEAL_ART = {
  crown: '/lb/seal-crown.webp',
  silver: '/lb/seal-silver.webp',
  bronze: '/lb/seal-bronze.webp',
  gold: '/lb/seal-gold.webp',
  cyan: '/lb/seal-cyan.webp',
  violet: '/lb/seal-violet.webp',
};

// best first: a lower index is a higher tier
export const NAME_TIERS = [
  { key: 'crown', top: 1, label: '#1' },
  { key: 'silver', top: 2, label: 'TOP 3' },
  { key: 'bronze', top: 3, label: 'TOP 3' },
  { key: 'gold', top: 10, label: 'TOP 10' },
  { key: 'cyan', top: 25, label: 'TOP 25' },
  { key: 'violet', top: 50, label: 'TOP 50' },
];

/** The tier a board rank wears, or null past #50 / for no rank. */
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
 * last look → no ceremony: a first visit is not a climb). #2 ↔ #3 are one tier for this (the podium), so a #3 → #2 swap
 * is a climb on the board but not a new tier.
 */
export function enteredTier(from, to) {
  const f = Number(from);
  if (!(f >= 1) || !(Number(to) >= 1)) return null;
  const a = tierIndex(f);
  const b = tierIndex(to);
  const podium = (i) => (i === 1 || i === 2 ? 1 : i);
  if (podium(b) >= podium(a)) return null;
  const t = nameTier(to);
  return t;
}
