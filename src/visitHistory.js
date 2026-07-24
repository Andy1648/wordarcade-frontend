// visitHistory.js
// Tiny localStorage flags that let the app tell a brand-new visitor from a
// returning one. Two independent signals:
//   - intro seen:   drives skipping the SQUAD-UP / "TYPE FAST. DIE SLOW." intro
//                   animations on repeat visits.
//   - has played:   drives the default difficulty (first-timers get the gentler
//                   CHILL tier; returning players keep CRAZY).
// Every read/write is wrapped so private-mode / storage-disabled browsers simply
// behave as a first-time visitor rather than throwing.

const INTRO_KEY = 'wa_intro_seen'; // set once the intro has played at least once
const PLAYED_KEY = 'wa_has_played'; // set once the player has started a game

function readFlag(key) {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function writeFlag(key) {
  try {
    localStorage.setItem(key, '1');
  } catch {
    /* storage unavailable - stay in first-time behaviour, no harm done */
  }
}

export function hasSeenIntro() {
  return readFlag(INTRO_KEY);
}

export function markIntroSeen() {
  writeFlag(INTRO_KEY);
}

export function hasPlayedBefore() {
  return readFlag(PLAYED_KEY);
}

export function markPlayed() {
  writeFlag(PLAYED_KEY);
}
