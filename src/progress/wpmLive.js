// wpmLive.js — the live typing-speed tracker for the current run/menu session. A tiny module
// singleton (only one mode is ever active at a time) so a mode feeds it keystrokes + accepted
// words without threading refs through the tree, and the HUD's <LiveWpm> reads the current value
// at ~4Hz.
//
// ACTIVE-TYPING TIME ONLY (§2). A turn-based mode's wall-clock is meaningless (you spend the round
// waiting), and even in the continuous modes the pause BETWEEN words — reading the next prompt,
// thinking — isn't typing. So we don't measure wall-clock: we measure only the spans the player is
// actually typing a word. A span OPENS on the first keystroke of a word (wpmKeyStroke) and CLOSES
// when the word is submitted/accepted (wpmAddWord). The idle gap between "word accepted" and "next
// word's first keystroke" is never counted. correct-WPM: chars = summed lengths of ACCEPTED words
// only (mashing junk never inflates it). Ending a session flushes it to the persisted history
// (wpm.js recordSession, which ignores trivial sessions).
import { recordSession, wpmFrom } from './wpm.js';

const now = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());

const NO_SPAN = -1; // sentinel — 0 is a valid performance.now() timestamp, so it can't mean "closed"

let mode = null;
let chars = 0;
let activeMs = 0; // summed active-typing spans for this session (ms)
let spanStart = NO_SPAN; // timestamp of the currently-open span, or NO_SPAN when between words

// Close the open typing span (if any), banking its elapsed time into activeMs. Idempotent.
function closeSpan() {
  if (spanStart !== NO_SPAN) {
    activeMs += now() - spanStart;
    spanStart = NO_SPAN;
  }
}

// Persist the in-flight session (if it has any signal) to the history.
function flush() {
  if (mode) {
    closeSpan();
    if (chars > 0 && activeMs > 0) recordSession({ mode, chars, ms: activeMs });
  }
}

// Begin tracking a mode's run (or the menu). Flushes any previous unflushed session first, so a
// transition (menu → game, or run → run) never loses or blends sessions.
export function wpmStart(m) {
  flush();
  mode = m || null;
  chars = 0;
  activeMs = 0;
  spanStart = NO_SPAN;
}

// A keystroke while typing a word. The FIRST keystroke of a word opens its active-typing span;
// every keystroke after that (until the word is submitted) is a no-op — the span is already open.
export function wpmKeyStroke() {
  if (spanStart === NO_SPAN) spanStart = now();
}

// An accepted word: bank its active-typing span (stop the clock — the coming idle gap won't count)
// and add its characters. Calling this without an open span still adds the chars (a word that was
// auto-completed with no keystroke contributes chars but no time, which the aggregate absorbs).
export function wpmAddWord(word) {
  const n = typeof word === 'string' ? word.trim().length : 0;
  closeSpan();
  if (n <= 0) return;
  chars += n;
}

// The live WPM right now: correct-chars over the active-typing time so far (including the currently
// open span, so the number climbs as you type). 0 before any typing.
export function wpmCurrent() {
  const ms = activeMs + (spanStart !== NO_SPAN ? now() - spanStart : 0);
  return ms > 0 ? Math.round(wpmFrom(chars, ms)) : 0;
}

// End + persist the current session (call on run-over / menu-leave). Idempotent.
export function wpmEnd() {
  flush();
  mode = null;
  chars = 0;
  activeMs = 0;
  spanStart = NO_SPAN;
}

// Test hook: reset the singleton without touching storage.
export function __resetWpmLiveForTest() {
  mode = null;
  chars = 0;
  activeMs = 0;
  spanStart = NO_SPAN;
}
