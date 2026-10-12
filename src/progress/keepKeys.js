// keepKeys.js — the storage keys a WIPE keeps (the season-2 reset, RESET ACCOUNT): the board identity + the settings.
// Its own side-effect-free module: season2Boot.js is LAZY (importing it pulls in the v3 install, which re-prices the
// economy), so an eager screen (SETTINGS → resetAll.js) must import the list from here, never from season2Boot.
/** Exact keys a wipe keeps: the board identity + the settings. */
export const KEEP_KEYS = [
  'taw.lb.secret', 'taw.lb.profile', // the claimed name + device secret
  'taw.reduceMotion', 'taw.theme', 'taw.themesRetired', // REDUCE MOTION, the equipped theme (and its one-time retire)
  'taw.audioVolume', 'taw.musicMuted', 'taw.sfxEvents', 'taw.clack', // sound
  'taw.chunkReload', // the stale-chunk reload guard (operational)
];
/** Key prefixes a wipe keeps: feature flags + the tutorial / "seen" marks (UI state, not progress). */
export const KEEP_PREFIXES = ['taw.flag.', 'taw.tut.', 'taw.seen'];
export const keepKey = (k) => KEEP_KEYS.includes(k) || KEEP_PREFIXES.some((p) => k.startsWith(p));
