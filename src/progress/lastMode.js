// lastMode.js — remembers the mode you last launched, so the menu can FEATURE it.
// The menu's five cards were all the same size and weight, which gave the eye no
// entry point; spotlighting the card you actually play makes the common case one
// glance instead of a scan. Storage-guarded (private mode / blocked storage reads
// back as "no memory", never throws).
const KEY = 'taw.lastMode';

export function recordLastMode(id) {
  if (!id) return;
  try { window.localStorage.setItem(KEY, String(id)); } catch { /* no memory is fine */ }
}

export function loadLastMode() {
  try { return window.localStorage.getItem(KEY) || null; } catch { return null; }
}
