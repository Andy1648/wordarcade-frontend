// config.js — WORD RACE flag + ids.
//
// DARK-LAUNCHED, like CHAIN/FUSE/SAT RUSH were: the mode needs the backend's `word-race` game
// type, which is not deployed yet, so a menu card pointing at it would be a dead button for every
// visitor. ?race=1 turns the card on and REMEMBERS it (taw.raceFlag) so a tester who enabled it
// keeps it across reloads; ?race=0 turns it back off. With neither, the menu is byte-identical.

export const WORD_RACE_ID = 'word-race';
// ENTIRE-WORD racing (Andy oct2 A6) — mirrors the backend's wordRace.js WORDS_TARGET / WORDS_CAP_MS.
export const RACE_WORDS = 25;
export const RACE_CAP_MS = 60 * 1000;
export const RACE_FLAG_KEY = 'taw.raceFlag';

function readFlag() {
  if (typeof window === 'undefined') return false;
  try {
    const q = new URLSearchParams(window.location.search).get('race');
    if (q === '1' || q === '0') {
      try {
        window.localStorage.setItem(RACE_FLAG_KEY, q);
      } catch {
        /* storage blocked: the query still applies to this load */
      }
      return q === '1';
    }
    return window.localStorage.getItem(RACE_FLAG_KEY) === '1';
  } catch {
    return false;
  }
}

// Read once at module load (the same idiom as solo/config and satRush/config).
export const WORD_RACE_ENABLED = readFlag();
