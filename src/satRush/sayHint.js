// sayHint.js — the one-time "TAP 🔊 TO HEAR IT" note (feat/french-rush-sound). Andy: "make sure they know abt
// pronunciation". The first 🔊 a player meets in French Rush (the study sheet or the first review card) carries
// the note; once it has been shown it never shows again on this device. Pure storage contract — unit-tested.
export const SAY_HINT_KEY = 'fr.sayHint.v1';

function store() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

/** Has this device not seen the 🔊 note yet? (read only — no write) */
export function sayHintDue() {
  const s = store();
  if (!s) return false; // storage blocked: never nag on every card
  try {
    return s.getItem(SAY_HINT_KEY) !== '1';
  } catch {
    return false;
  }
}

/** The note has been shown — never again. Idempotent. */
export function markSayHintSeen() {
  const s = store();
  if (!s) return;
  try {
    s.setItem(SAY_HINT_KEY, '1');
  } catch {
    /* blocked */
  }
}
