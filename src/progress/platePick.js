// platePick.js — the rank plate a player CHOOSES to show next to their name (Andy oct8: "option to choose rank —
// choose which rank plate shows next to your name"). Any rank already reached can be picked; null = the current
// (highest) rank, which is also what an invalid / not-yet-reached pick falls back to. LEAF: localStorage only.
export const PLATE_PICK_KEY = 'taw.s2.platePick';
export const PLATE_PICK_EVENT = 'taw:platepick';

/** The chosen rank index, or null for "my current rank". */
export function getPlatePick() {
  try {
    const raw = localStorage.getItem(PLATE_PICK_KEY);
    if (raw == null || raw === '') return null;
    const n = Number(raw);
    return Number.isInteger(n) && n >= 0 ? n : null;
  } catch {
    return null;
  }
}
export function setPlatePick(i) {
  try {
    if (i == null) localStorage.removeItem(PLATE_PICK_KEY);
    else localStorage.setItem(PLATE_PICK_KEY, String(Math.max(0, Math.floor(i))));
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof Event === 'function') window.dispatchEvent(new Event(PLATE_PICK_EVENT));
  } catch {
    /* blocked storage: no pick */
  }
}
/** The index to SHOW for a player whose highest reached rank is `reached`: the pick if reached, else `reached`. */
export function shownPlateIndex(reached) {
  const p = getPlatePick();
  return p != null && p <= reached ? p : reached;
}
