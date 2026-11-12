// soundGate.js — keeps the rush's transition sounds from stacking into noise (feat/french-rush-sound). Pure:
// no audio, no clock of its own — the caller passes `now` (ms). Every cue has a PRIORITY; inside one short
// WINDOW only the most important transition is heard:
//   - a cue is dropped when anything of the SAME or HIGHER priority already played inside the window
//     (the screen-change press + the first card landing on the same tick = one sound, the press);
//   - a higher-priority cue always plays (a capture stamp right after a stage tick still lands).
// Unit-tested in soundGate.test.js.

export const CUE_PRIORITY = {
  press: 1, // a screen change (the sheet off the press)
  cardIn: 1, // a new card slides in
  tick: 2, // the clue stage decays (the reward drops)
  strike: 2, // a choice crossed out / a letter spelled in
  deepCut: 3, // a MOST WANTED card lands
  revenant: 3, // an escaped word comes back
  capture: 4, // CAPTURED — the stamp
  miss: 4, // ESCAPED — the tear
  caseClosed: 5, // the run ends
};
export const GATE_WINDOW_MS = 140;

/** A fresh gate. */
export function createGate() {
  return { recent: [] }; // [{ prio, at }]
}

/**
 * Should cue `name` sound at `now`? Records it when it does. Unknown names never sound.
 * @returns {boolean}
 */
export function gateCue(gate, name, now) {
  const prio = CUE_PRIORITY[name];
  if (!prio) return false;
  gate.recent = gate.recent.filter((r) => now - r.at < GATE_WINDOW_MS && now >= r.at);
  if (gate.recent.some((r) => r.prio >= prio)) return false;
  gate.recent.push({ prio, at: now });
  return true;
}
