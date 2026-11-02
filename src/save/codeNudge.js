// codeNudge.js — WRITE DOWN YOUR CODE (save-safety oct28). A wiped school Chromebook loses the save AND the board account
// (localStorage + the taw_lb cookie); the only way back is a code the player wrote down. So at three milestones — LV 15
// (the first rebirth gate), the FIRST REBIRTH and LV 50 — the menu says it once, as a right-edge card with the short code
// big + COPY (SaveCodeNudge.jsx, lazy). A save that is past several milestones at once (a veteran's first visit after this
// shipped) gets ONE card and every passed milestone is noted, never a burst.
// PURE core + a guarded storage bridge. The said-list lives under taw.seen.* — UI state: never in a save code, and kept
// through a wipe (keepKeys.js KEEP_PREFIXES), so a reset never re-nags.

export const NUDGE_SEEN_KEY = 'taw.seen.codeNudge';
export const NUDGE_STEPS = [
  { id: 'lv15', hit: (s) => s.level >= 15 || s.rebirths >= 1 }, // a rebirth is past the LV 15 gate by definition
  { id: 'r1', hit: (s) => s.rebirths >= 1 },
  { id: 'lv50', hit: (s) => s.level >= 50 },
];

/** PURE: { id, mark } — the milestone to say now and every passed one to note — or null when nothing is new. */
export function dueNudge(state, said) {
  const s = { level: Number(state && state.level) || 0, rebirths: Number(state && state.rebirths) || 0 };
  const done = new Set(Array.isArray(said) ? said : []);
  const hit = NUDGE_STEPS.filter((x) => x.hit(s)).map((x) => x.id);
  const fresh = hit.filter((id) => !done.has(id));
  if (!fresh.length) return null;
  return { id: fresh[fresh.length - 1], mark: [...new Set([...done, ...hit])] };
}

export function readSaid(storage = globalThis.localStorage) {
  try {
    const v = JSON.parse(storage.getItem(NUDGE_SEEN_KEY) || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
export function writeSaid(ids, storage = globalThis.localStorage) {
  try {
    storage.setItem(NUDGE_SEEN_KEY, JSON.stringify(ids));
  } catch {
    /* blocked: it is simply said again next visit */
  }
}
