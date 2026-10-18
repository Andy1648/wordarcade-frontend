// heroSeen.js — which owned heroes this save has already been SHOWN (oct18 HERO UNLOCKED reveal). A hero you earn by
// playing (GLITCH at REBIRTH 1, HEX at LEVEL 20, SHH at 50 wins, GOLD at 100 wins …) used to just quietly appear in the
// picker; now the first time the save owns one it hasn't seen, the reveal plays. `taw.s2.*`, so the save backup / cloud
// save carry it (a restored save doesn't replay reveals). The first read on a save with no list seeds it with what you
// already own — nobody gets a wall of reveals for heroes they've had for days.
import { ALL_HEROES, ownsHero } from './cast.js';

export const HEROES_SEEN_KEY = 'taw.s2.heroes.seen';

const read = () => {
  try {
    const v = JSON.parse(localStorage.getItem(HEROES_SEEN_KEY) || 'null');
    return Array.isArray(v) ? v : null;
  } catch { return null; }
};
const write = (ids) => { try { localStorage.setItem(HEROES_SEEN_KEY, JSON.stringify(ids)); } catch { /* blocked storage */ } };
const ownedIds = () => ALL_HEROES.filter((h) => ownsHero(h.id)).map((h) => h.id);

/** The heroes this save owns but has not been shown yet, rarest last (so the best one is the finale). */
export function unseenHeroes() {
  const seen = read();
  const owned = ownedIds();
  if (!seen) { write(owned); return []; }
  const s = new Set(seen);
  return owned.filter((id) => !s.has(id));
}
/** Record heroes as shown. */
export function markHeroesSeen(ids) {
  const seen = read() || [];
  const s = new Set(seen);
  let changed = false;
  for (const id of ids || []) if (id && !s.has(id)) { s.add(id); changed = true; }
  if (changed) write([...s]);
}
/** Read-only twin of unseenHeroes for a render path (the menu chip's NEW HERO! badge): never seeds or writes. */
export function peekUnseen() {
  const seen = read();
  if (!seen) return [];
  const s = new Set(seen);
  return ownedIds().filter((id) => !s.has(id));
}
