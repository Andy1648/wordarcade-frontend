// nextMode.js — "what should I play next?" for the end screens (feat/solo-endgame).
//
// Every mode's game-over used to be a dead end: one button back into the SAME mode. This picks
// ONE other mode to offer, and the choice is deliberate rather than random — the mode the player
// has touched LEAST. Someone who only ever plays Word Bomb gets pointed at the thing they've never
// tried, not at a coin flip that keeps landing on Blitz.
//
// PURE: no DOM, no localStorage, no React, and NO import of gameData — the caller supplies the
// level, the per-mode play counts AND the mode list. That last one is not fussiness: gameData.js
// imports satRush/config with an extensionless specifier, which node's ESM loader refuses, so
// importing it here would make this module untestable under `node --test`. The component owns the
// GAMES import; this file owns the rule.
//
// THE COUNTER. There is no dedicated "times played" store. `taw.chain.runs` / `taw.fuse.runs`
// (solo/shared.js) exist but only for those two modes, so they can't rank five. The MASTERY track
// (progress/mastery.js) does cover all five — cumulative accepted words per mode — which is a
// better "played least" signal anyway: it measures time spent, not sessions opened. A mode you have
// never touched sits at 0 and therefore always wins the tie-break against one you have.

import { MASTERY_MODES } from './mastery.js';

// Clean route path per mode id. Navigating is a real page load (see TryModeRow) because the app's
// entry-param readers resolve ONCE at import time — pushState alone would change the URL without
// opening the mode.
export const MODE_PATH = {
  'word-bomb': '/word-bomb',
  'category-blitz': '/category-blitz',
  'sat-rush': '/sat-rush',
  chain: '/chain',
  fuse: '/fuse',
  // THE RUN (run stack). gameData now offers 'run' as a chooser candidate, and
  // router.js viewIntentFromPath already routes '/run' — without this entry
  // pickTryMode fell back to '/' and the TRY THE RUN row landed on the menu.
  run: '/run',
};

/** A mode's menu name as one line ("WORD\nBOMB" -> "WORD BOMB"). */
export function modeDisplayName(game) {
  return String((game && game.name) || '').replace(/\s+/g, ' ').trim();
}

/**
 * True if a level-gated mode is open to this player. A mode with no `unlockLevel` is always open.
 * NEVER suggests a locked mode — the whole point is a next step the player can actually take.
 */
export function isModeUnlocked(game, level) {
  if (!game || game.enabled === false) return false;
  if (game.unlockLevel == null) return true;
  const lvl = Number.isFinite(level) ? level : 1;
  return lvl >= game.unlockLevel;
}

/**
 * The mode to offer after a run, or null when there is nothing legitimate to offer (everything else
 * locked, or only one mode exists). Never returns the mode just played.
 *
 *   current - the mode id just finished (excluded)
 *   level   - the player's XP level, for the unlock gate
 *   counts  - { [modeId]: playCount } (mastery words); a missing mode counts as 0
 *   games   - the mode list (the caller passes GAMES from gameData; [] yields null)
 *
 * Ties break on the order of `games` — deterministic, so a fresh account always sees the same
 * suggestion rather than a different one on every death.
 */
export function pickTryMode({ current, level, counts = {}, games = [] } = {}) {
  const candidates = (games || []).filter((g) => g && g.id !== current && isModeUnlocked(g, level));
  if (!candidates.length) return null;

  let best = null;
  let bestCount = Infinity;
  for (const g of candidates) {
    const n = Number.isFinite(counts[g.id]) ? counts[g.id] : 0;
    if (n < bestCount) {
      best = g;
      bestCount = n;
    }
  }
  return best ? { id: best.id, name: modeDisplayName(best), path: MODE_PATH[best.id] || '/', plays: bestCount } : null;
}

/** Every mode id the chooser knows about — used by the tests to keep this in step with mastery. */
export const KNOWN_MODES = MASTERY_MODES;
