// wpmLive.js — the live typing-speed tracker for the current run/menu session. A tiny module
// singleton (only one mode is ever active at a time) so a mode feeds it accepted words without
// threading refs through the tree, and the HUD's <LiveWpm> reads the current value at ~4Hz.
//
// The clock starts on the FIRST accepted word (so pre-typing idle time never drags the rate
// down) and measures correct-WPM: chars = summed lengths of ACCEPTED words only. Ending a session
// flushes it to the persisted history (wpm.js recordSession, which ignores trivial sessions).
import { recordSession, wpmFrom } from './wpm.js';

const now = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());

let mode = null;
let chars = 0;
let start = 0; // 0 until the first accepted word

// Persist the in-flight session (if it has any signal) to the history.
function flush() {
  if (mode && start && chars > 0) {
    recordSession({ mode, chars, ms: now() - start });
  }
}

// Begin tracking a mode's run (or the menu). Flushes any previous unflushed session first, so a
// transition (menu → game, or run → run) never loses or blends sessions.
export function wpmStart(m) {
  flush();
  mode = m || null;
  chars = 0;
  start = 0;
}

// Count an accepted word's characters. Starts the clock on the first one.
export function wpmAddWord(word) {
  const n = typeof word === 'string' ? word.trim().length : 0;
  if (n <= 0) return;
  if (!start) start = now();
  chars += n;
}

// The live WPM right now (0 before the first word).
export function wpmCurrent() {
  return start ? Math.round(wpmFrom(chars, now() - start)) : 0;
}

// End + persist the current session (call on run-over / menu-leave). Idempotent.
export function wpmEnd() {
  flush();
  mode = null;
  chars = 0;
  start = 0;
}

// Test hook: reset the singleton without touching storage.
export function __resetWpmLiveForTest() {
  mode = null;
  chars = 0;
  start = 0;
}
