// unlockLadder.js — the FREE, level-gated cosmetic UNLOCK LADDER (Job 3). Something new
// appears roughly every 3-5 levels through LV40, then one per rebirth. These are granted
// FREE at the level and are SEPARATE from the shop's purchasables (their own storage key,
// taw.freeUnlocks; they never touch taw.owned / the wins economy).
//
// The cosmetics are NET-NEW, trivial content that doesn't collide with the shop's pop
// styles / sound packs (those are bought with wins). Two visible kinds:
//   'theme' — a menu colour theme (a data-attr on the homepage root; wordmark stays locked)
//   'frame' — a badge frame around the LV chip
//
// PURE (no DOM/React) so the ladder's shape (monotonic, reachable, no duplicates) is
// unit-testable. The storage bridge is at the bottom, every access wrapped.

// The level ladder — strictly increasing levels, ~every 4-5 through LV40. Each entry's
// `id` is unique and its `level` is unique (nothing unlocks twice). Kinds alternate so the
// menu keeps changing character as you climb.
// FRAMES ONLY. The ladder originally interleaved menu-colour THEMES with LV-badge FRAMES, but
// main's themes system (src/theme/themes.js) supersedes the theme half — so on merge the theme
// entries were dropped and this became a frames-only ladder (one LV-badge frame every 8 levels
// through LV35, then a frame per rebirth). Each `id` + `level` is unique; every kind is 'frame'.
export const LADDER = [
  { level: 3, id: 'frame-bolt', name: 'BOLT', kind: 'frame' },
  { level: 11, id: 'frame-tape', name: 'TAPE', kind: 'frame' },
  { level: 19, id: 'frame-chrome', name: 'CHROME', kind: 'frame' },
  { level: 27, id: 'frame-spike', name: 'SPIKE', kind: 'frame' },
  { level: 35, id: 'frame-gold', name: 'GOLD', kind: 'frame' },
];

export const MAX_LADDER_LEVEL = LADDER[LADDER.length - 1].level; // 35

export const KIND_LABEL = { theme: 'THEME', frame: 'FRAME' };

// The cosmetic granted for performing the r-th rebirth (r >= 1) — the "then one per rebirth"
// tail. Defined by formula so it's infinite, monotonic, and never collides with a level id.
export function rebirthUnlock(r) {
  const n = Math.max(1, Math.floor(r));
  return { rebirth: n, id: `rebirth-${n}`, name: `PRESTIGE ${n}`, kind: 'frame' };
}

// The ordered stream of ALL unlocks: the level ladder, then rebirth unlocks 1..∞. Bounded
// scans below only ever look a little past what a player owns, so this is never realized fully.
function* unlockStream(maxRebirth) {
  for (const e of LADDER) yield e;
  for (let r = 1; r <= maxRebirth; r++) yield rebirthUnlock(r);
}

// The NEXT unlock the player has not yet earned, given what they already OWN (a Set/array of
// ids) and how many rebirths they've done. Ownership-aware so it stays correct after a rebirth
// (which resets level to 1 but keeps everything owned) — it returns the first UNOWNED unlock in
// stream order, annotated with a display `at` ("LV 7" or "REBIRTH 2"). Never returns null.
export function nextUnlock(owned, rebirthCount = 0) {
  const has = ownedSet(owned);
  for (const e of LADDER) {
    if (!has.has(e.id)) return { ...e, at: `LV ${e.level}`, kindLabel: KIND_LABEL[e.kind] };
  }
  // All level unlocks owned → walk rebirth unlocks until one is unowned.
  let r = 1;
  while (has.has(`rebirth-${r}`)) r += 1;
  const u = rebirthUnlock(r);
  return { ...u, at: `REBIRTH ${r}`, kindLabel: KIND_LABEL[u.kind] };
}

// Ids a level-N player (no rebirth grants) should own purely from leveling.
export function levelUnlockIds(level) {
  const lvl = Number.isFinite(level) && level > 0 ? Math.floor(level) : 1;
  return LADDER.filter((e) => e.level <= lvl).map((e) => e.id);
}

// The currently-APPLIED cosmetic of a kind = the highest-order owned unlock of that kind
// (latest level, then latest rebirth). Returns the id, or null if none owned yet.
export function currentCosmetic(owned, kind, rebirthCount = 0) {
  const has = ownedSet(owned);
  let pick = null;
  for (const u of unlockStream(Math.max(0, Math.floor(rebirthCount)) + 1)) {
    if (u.kind === kind && has.has(u.id)) pick = u.id; // later in the stream wins
  }
  return pick;
}

function ownedSet(owned) {
  if (owned instanceof Set) return owned;
  return new Set(Array.isArray(owned) ? owned : []);
}

// ---- storage (taw.freeUnlocks) — separate from the shop's taw.owned -------------------
export const FREE_UNLOCKS_KEY = 'taw.freeUnlocks';

export function getFreeUnlocks() {
  try {
    const raw = localStorage.getItem(FREE_UNLOCKS_KEY);
    if (raw == null) return [];
    const a = JSON.parse(raw);
    return Array.isArray(a) ? a.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function saveFreeUnlocks(ids) {
  try {
    localStorage.setItem(FREE_UNLOCKS_KEY, JSON.stringify(Array.from(new Set(ids))));
  } catch {
    /* storage blocked — unlocks just aren't persisted this session */
  }
}

// Grant every level unlock the player has reached (idempotent). Returns the newly-granted
// ids (empty if nothing new), so the caller could stamp them. Rebirth unlocks are granted
// separately via grantRebirthUnlock when a rebirth is performed.
export function grantUnlocks(level) {
  const have = new Set(getFreeUnlocks());
  const due = levelUnlockIds(level);
  const fresh = due.filter((id) => !have.has(id));
  if (fresh.length) saveFreeUnlocks([...have, ...fresh]);
  return fresh;
}

// Grant the cosmetic for a just-performed rebirth (r = the new rebirth count). Idempotent.
export function grantRebirthUnlock(r) {
  const id = rebirthUnlock(r).id;
  const have = new Set(getFreeUnlocks());
  if (have.has(id)) return null;
  saveFreeUnlocks([...have, id]);
  return id;
}
