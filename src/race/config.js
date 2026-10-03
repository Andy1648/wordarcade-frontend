// config.js — WORD RACE flag + ids.
//
// R1 (Andy oct2): ON FOR EVERYONE. The backend's `word-race` game type is live (be#10, A6), so the card
// is no longer dark-launched. ?race=0 is the OFF SWITCH and is REMEMBERED (taw.raceFlag = '0') across
// reloads; ?race=1 turns it back on.

export const WORD_RACE_ID = 'word-race';
// ENTIRE-WORD racing (Andy oct2 A6) — mirrors the backend's wordRace.js WORDS_TARGET / WORDS_CAP_MS.
export const RACE_WORDS = 25;
export const RACE_CAP_MS = 60 * 1000;
export const RACE_FLAG_KEY = 'taw.raceFlag';

function readFlag() {
  if (typeof window === 'undefined') return true;
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
    return window.localStorage.getItem(RACE_FLAG_KEY) !== '0';
  } catch {
    return true;
  }
}

// Read once at module load (the same idiom as solo/config and satRush/config).
export const WORD_RACE_ENABLED = readFlag();
