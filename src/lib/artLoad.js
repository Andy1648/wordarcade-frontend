// artLoad.js — ONE system for art that has not arrived yet (Andy nov6: "a loading symbol or a filler for things that don't load
// immediately … remember the idea of smoothness"). Listed <img> slots (theme/artSlots.css) show a flat plate of their reserved
// box until the file lands; one capture-phase listener then marks them, and art that really had to travel fades in.
//   - data-art="in"   the art is here: the plate is gone
//   - data-art="fail" it would not load: the plate stays, no broken-image icon
// Nothing is wrapped and no component changes. No timers run, no layout is read, and a cached file (under
// FADE_MIN_MS on the network) simply appears: no flash, no fade. The fade is one finite opacity one-shot.
import { reduceMotion } from './reduceMotion.js';

export const ART_SLOTS = 'img.sp2-art, img.sp2-chest-paint, img.sp2-plate-art, img.lb2-buddy, .lb2-face img, .hpv-ver-art img';
// no plate behind these (a rectangle behind a hero on a stage reads as a bug), only the fade
const FADE_ONLY = 'img.hpv-pedestal, img.hpv-art';
export const FADE_MIN_MS = 150;
const FADE_MS = 160;

/** The time the file spent on the network, or 0 if the browser has no record of it (treated as cached). */
export function networkMs(entries) {
  const e = entries && entries.length ? entries[entries.length - 1] : null;
  return e ? e.duration : 0;
}

function onLoad(ev) {
  const el = ev.target;
  if (!el || el.tagName !== 'IMG') return;
  if (!el.matches(ART_SLOTS) && !el.matches(FADE_ONLY)) return;
  el.setAttribute('data-art', 'in');
  if (reduceMotion()) return;
  if (networkMs(performance.getEntriesByName(el.src)) < FADE_MIN_MS) return;
  el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: FADE_MS, easing: 'ease-out' });
}

function onError(ev) {
  const el = ev.target;
  if (!el || el.tagName !== 'IMG' || !el.matches(ART_SLOTS)) return;
  el.setAttribute('data-art', 'fail');
}

export function installArtLoad() {
  document.addEventListener('load', onLoad, true);
  document.addEventListener('error', onError, true);
}
