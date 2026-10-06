// rank.js — RANK TITLES (Job 5). Level bands get a name shown next to LV on the menu and the
// stats screen. Newgrounds/FNF tone, ALL CAPS, each ≤ 8 chars so the LV chip layout holds.
// PURE (no DOM/React) so "every level maps to exactly one rank" is unit-testable.
//
// The bands partition ALL levels 1..∞ with no gaps and no overlaps: each entry owns [min, next
// entry's min). The last band (BEYOND) runs to infinity.

// PROGRESSION v3 (SEASON2, default OFF): ranks go by REBIRTHS then STARS (v3/ranks.js — KEYMASH … ENDGAME),
// never by level, and never drop. With the flag ON, RANKS is that ladder (min = the rank's index) and
// rankTitle / rankFor read the live save; the level argument is ignored. OFF = the level bands below.

const RANKS_LIVE = [
  { min: 1, name: 'ROOKIE' }, //   LV 1-4    green
  { min: 5, name: 'TYPIST' }, //   LV 5-9
  { min: 10, name: 'SPELLER' }, // LV 10-15
  { min: 16, name: 'SCRAPPER' }, //LV 16-22
  { min: 23, name: 'BRAWLER' }, // LV 23-30
  { min: 31, name: 'SHARK' }, //   LV 31-40
  { min: 41, name: 'MENACE' }, //  LV 41-55
  { min: 56, name: 'WARLORD' }, // LV 56-75
  { min: 76, name: 'DEMON' }, //   LV 76-99
  { min: 100, name: 'UNREAL' }, // LV 100-149
  // STEP 51 (Andy oct2: "add MORE RANKS") — levels now run past L1000, so the ladder does too.
  { min: 150, name: 'MYTHIC' }, //  LV 150-199
  { min: 200, name: 'TITAN' }, //   LV 200-299
  { min: 300, name: 'ORACLE' }, //  LV 300-399
  { min: 400, name: 'IMMORTAL' }, //LV 400-499
  { min: 500, name: 'COSMIC' }, //  LV 500-649
  { min: 650, name: 'ETERNAL' }, // LV 650-799
  { min: 800, name: 'INFINITE' }, //LV 800-999
  { min: 1000, name: 'BEYOND' }, // LV 1000+
];

export const RANKS = RANKS_LIVE;

export const MAX_RANK_NAME_LEN = 8;

// The rank NAME for a level. Total and deterministic: every level >= 1 returns exactly one of
// RANKS' names; anything below 1 / non-finite is treated as LV 1 (ROOKIE).
export function rankTitle(level) {
  const lvl = Number.isFinite(level) && level >= 1 ? Math.floor(level) : 1;
  let name = RANKS[0].name;
  for (const r of RANKS) {
    if (lvl >= r.min) name = r.name;
    else break; // RANKS is sorted ascending, so the first miss ends the scan
  }
  return name;
}

// The full rank entry (name + the band's min level) for a level — handy for a stats readout
// that wants "SHARK (LV 31+)".
export function rankFor(level) {
  const lvl = Number.isFinite(level) && level >= 1 ? Math.floor(level) : 1;
  let pick = RANKS[0];
  for (const r of RANKS) {
    if (lvl >= r.min) pick = r;
    else break;
  }
  return pick;
}

// v3 (SEASON2): v3/install.js swaps the v3 versions in (v3/hooks.js); never called with the flag OFF.
export function __v3(o) {
  // eslint-disable-next-line no-func-assign
  ({ a: rankTitle, b: rankFor } = o);
}
