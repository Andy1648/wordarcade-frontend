// popGrowth.js — the KEY POP grows with the player (Andy oct28: "make them larger scaling up with level … maybe power").
//
// WHAT IT KEYS OFF: the CAREER LEVEL — the levels this player has ever climbed: today's level plus every level a rebirth
// banked (the gate each past rebirth was taken at). Not the bare level: a rebirth resets it to 1, so a level-sized pop
// would SHRINK at the very moment the player earned the most. Not POWER (XP a key): it jumps around with boosts,
// OVERDRIVE and gear swaps, and a rebirth can still drop it — the pop would flicker in size. The career level only ever
// goes up, it climbs every level-up inside a run, and a rebirth carries all of it forward (a fresh R1 player's keys
// are exactly as big as their LV25 keys were).
//
// THE CURVE: log-shaped and capped. Early levels move the size the most (L1 → L10 is already ~+7%), later the climb
// keeps paying in smaller steps, and it stops at GROWTH_CAP_CAREER (≈ R15) — never a runaway. Phones get a smaller
// ceiling so a big +N never runs off a 360px screen. STAGES add painted dressing behind the number on top of the size.
// PURE — no storage, no DOM (menu reads it once per mount; unit-tested in popGrowth.test.js).

export const GROWTH_CAP_CAREER = 3000;
export const GROWTH_MAX = 0.25; // +25% at the cap (desktop) — Andy oct28 "getting a bit too big, tone it down a lot" (was +75%)
export const GROWTH_MAX_NARROW = 0.1; // +10% at the cap on a phone-width layer (was +30%)
// Career levels where the pop gains dressing: 1 the painted burst RING behind the +N, 2 + a SPARKLE, 3 the ring in GOLD.
export const STAGE_STARTS = [10, 100, 1000];

const int1 = (n) => (Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1);
const int0 = (n) => (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);

/** Today's level + the gate every past rebirth was taken at. `gate(r)` = the level rebirth r+1 needed. */
export function careerLevel(level, rebirths = 0, gate = () => 0) {
  let banked = 0;
  const rb = Math.min(int0(rebirths), 500); // a sane bound; the curve caps far below this anyway
  for (let r = 0; r < rb; r += 1) banked += Math.max(0, Number(gate(r)) || 0);
  return int1(level) + banked;
}

/** The pop's size multiplier (1 → 1 + max) and its dressing stage for a career level. */
export function popGrowth(career, narrow = false) {
  const c = Math.min(int1(career), GROWTH_CAP_CAREER);
  const t = Math.log10(c) / Math.log10(GROWTH_CAP_CAREER); // 0 at L1, 1 at the cap
  let stage = 0;
  for (let i = 0; i < STAGE_STARTS.length; i += 1) if (int1(career) >= STAGE_STARTS[i]) stage = i + 1;
  return { scale: 1 + (narrow ? GROWTH_MAX_NARROW : GROWTH_MAX) * t, stage, t };
}
