// teachExample.js — a worked example that is a VALID ANSWER TO THE PROMPT ON SCREEN.
//
// WHY THIS IS NOT JUST A CONSTANT. `modeExamples.js` already holds a canned example per mode
// ("TRAIN contains TRA"), and that is right for the mode DIALOG, where there is no live prompt to
// answer. It is wrong for the in-run teach: the fragment on screen is not TRA, so a first-timer
// who copies the canned word gets rejected BY THE TEACH ITSELF — the worst possible first
// interaction, and precisely the "I don't get the gist" report.
//
// So the example is derived from the live prompt against the SAME word list the mode judges
// with. Copy it and it is accepted, every time. That is also what makes Andy's second
// measurement possible: a scripted first run that types the example must succeed.
//
// PICKING WELL, not just picking. Of all valid answers we want the one a human would think of —
// short, common, unmistakably a word. `recall` is frequency-ordered (index = rank), so walking it
// in order and taking the first match gives the most common valid answer for free.

/** Cap on how far down the frequency list to look before giving up. The first few thousand words
 *  cover every fragment a mode actually serves; scanning 31k on a first-run path is wasteful. */
const SCAN_LIMIT = 12000;

/**
 * The most common word CONTAINING `fragment` — Word Bomb and FUSE.
 * @param {string[]} recall frequency-ordered word list (index = rank)
 * @param {string} fragment the live prompt, any case
 * @param {(w:string)=>boolean} [isUsed] optional: skip words already played this run
 * @returns {string|null} an uppercase example, or null if nothing matched
 */
export function exampleContaining(recall, fragment, isUsed) {
  const f = String(fragment || '').trim().toLowerCase();
  if (!f || !Array.isArray(recall)) return null;
  const limit = Math.min(recall.length, SCAN_LIMIT);
  for (let i = 0; i < limit; i++) {
    const w = recall[i];
    // 3+ letters is every mode's floor, and a word that IS the fragment teaches nothing about
    // containing it.
    if (w.length < 3 || w === f) continue;
    if (!w.includes(f)) continue;
    if (isUsed && isUsed(w)) continue;
    return w.toUpperCase();
  }
  return null;
}

/**
 * The most common word STARTING WITH `letter` — CHAIN.
 * @param {string[]} recall frequency-ordered word list
 * @param {string} letter the required first letter
 * @param {(w:string)=>boolean} [isUsed] optional: skip words already linked this run
 * @returns {string|null} an uppercase example, or null
 */
export function exampleStartingWith(recall, letter, isUsed) {
  const c = String(letter || '').trim().toLowerCase().slice(0, 1);
  if (!c || !Array.isArray(recall)) return null;
  const limit = Math.min(recall.length, SCAN_LIMIT);
  for (let i = 0; i < limit; i++) {
    const w = recall[i];
    if (w.length < 3) continue;
    if (w[0] !== c) continue;
    if (isUsed && isUsed(w)) continue;
    return w.toUpperCase();
  }
  return null;
}
