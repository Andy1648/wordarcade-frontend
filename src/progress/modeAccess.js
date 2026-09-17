// modeAccess.js — the ONE answer to "is this menu card locked?".
//
// THE BUG THIS FIXES: a mode's level gate lived only on the menu. App.jsx renders
// CHAIN_VIEW / FUSE_VIEW straight from a deep link (/chain/play, /fuse/play, ?chain=1)
// with NO level check — deliberately, that's the acquisition path. So a level-0 visitor
// could follow a link, play a full run, exit to the menu, and be told the mode they had
// just played "UNLOCKS AT LV 20". The app contradicted itself.
//
// THE FIX (chosen over "grant an unlock when the deep link opens"): the menu stops
// claiming a mode is locked once the player has actually played it. Reason: that needs
// NO new persistence and NO new write path. `taw.chain.runs` / `taw.fuse.runs` are
// already bumped on run start by useSoloGame's mount effect — the single path BOTH modes
// funnel through, whatever route opened them — and are already in saveBackup's
// PROGRESS_KEYS, so the fact survives an export/import. Granting on the deep link would
// instead add a key that every present and future entry point must remember to write,
// which is exactly the kind of drift that produced this bug.
//
// A lock is therefore: gated by level AND not yet played.
import { getChainRuns, getFuseRuns } from '../solo/shared.js';

// Per-mode "runs started, all-time" readers. Only gated solo modes need an entry; a mode
// with no reader simply has no play-based bypass (it falls back to the level gate alone).
const RUN_COUNT = {
  chain: getChainRuns,
  fuse: getFuseRuns,
};

// Has this browser ever STARTED a run of this mode? Guarded — a storage-blocked browser
// reads 0 and just sees the level gate.
export function hasPlayedMode(id) {
  const read = RUN_COUNT[id];
  if (!read) return false;
  try {
    return read() > 0;
  } catch {
    return false;
  }
}

// Is this game card locked for a player at `level`? Ungated modes are never locked.
export function isModeLocked(game, level) {
  if (!game || game.unlockLevel == null) return false;
  if (Number(level) >= game.unlockLevel) return false;
  return !hasPlayedMode(game.id);
}
