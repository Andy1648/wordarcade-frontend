// PlayPlate.jsx — THE PLAY BUTTON of the first screen (splash) and the fresh menu's TITLE (TitlePlay). Andy oct24: "that
// giant play button on first screen horrendously lacks flavor". The plate is PAINTED (public/title/play-plate.webp — a
// yellow graffiti sticker slapped on the wall: pink tape, cyan overspray, a peeling corner, one drip; ChatGPT, cut +
// quantised to 40 flat colours) and only the words are type, so the art stays art (CLAUDE.md ART VS MOTION).
//
// MOTION — finite one-shots, transform/opacity only, nothing loops at rest:
//   · enter: the sticker SLAPS onto the wall (CSS, once)
//   · hover / focus: it lifts off its shadow and tilts; press: it sinks onto the shadow and the word squashes (CSS)
//   · NUDGE: while nobody touches it, one WAAPI wiggle every ~5 s (one setTimeout chain, hidden tab skipped,
//     will-change only for the run, never under reduced motion) — the "press me" a first-timer needs
import { useEffect, useRef } from 'react';
import { useReduceMotion } from '../../lib/useReduceMotion';
import './PlayPlate.css';

export const PLATE_SRC = '/title/play-plate.webp';
const NUDGE_FIRST_MS = 2600;
const NUDGE_EVERY_MS = 5200;
const NUDGE = [
  { transform: 'rotate(0deg) scale(1)' },
  { transform: 'rotate(-3deg) scale(1.05)', offset: 0.3 },
  { transform: 'rotate(2deg) scale(1.03)', offset: 0.6 },
  { transform: 'rotate(0deg) scale(1)' },
];

function usePlateNudge(ref, enabled) {
  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el || typeof el.animate !== 'function') return undefined;
    let timer = null;
    let run = null;
    let held = false; // hovered / focused / pressed: the player has found it, so no nudge on top of their hand
    const hold = () => { held = true; };
    const free = () => { held = false; };
    const btn = el.closest('button');
    const evs = [['pointerenter', hold], ['pointerleave', free], ['focus', hold], ['blur', free]];
    evs.forEach(([t, f]) => btn && btn.addEventListener(t, f));
    const tick = () => {
      timer = setTimeout(tick, NUDGE_EVERY_MS);
      if (held || run || (typeof document !== 'undefined' && document.visibilityState === 'hidden')) return;
      el.style.willChange = 'transform';
      run = el.animate(NUDGE, { duration: 420, easing: 'cubic-bezier(.3,1.3,.5,1)' });
      const off = () => { el.style.willChange = ''; run = null; };
      run.finished.then(off, off);
    };
    timer = setTimeout(tick, NUDGE_FIRST_MS);
    return () => {
      clearTimeout(timer);
      evs.forEach(([t, f]) => btn && btn.removeEventListener(t, f));
      if (run) { try { run.cancel(); } catch { /* gone */ } }
      el.style.willChange = '';
    };
  }, [ref, enabled]);
}

/**
 * @param className  the host's class (keeps its e2e / spotlight hooks: .splash-play, .tp-play)
 * @param word       the big word (PLAY)
 * @param children   the small line under it (TAP TO START, WORD BOMB · VS A BOT, CONNECTING…, the key pips)
 * @param nudge      false to never wiggle (e.g. while connecting)
 * Every other prop goes to the <button>.
 */
export default function PlayPlate({ className = '', word = 'PLAY', children, nudge = true, ...rest }) {
  const nudgeRef = useRef(null);
  const reduced = useReduceMotion();
  usePlateNudge(nudgeRef, nudge && !reduced);
  return (
    <button type="button" className={`pp ${className}`} {...rest}>
      <span className="pp-nudge" ref={nudgeRef}>
        <img className="pp-shadow" src={PLATE_SRC} width="720" height="299" alt="" aria-hidden="true" draggable="false" />
        <span className="pp-face">
          <img className="pp-plate" src={PLATE_SRC} width="720" height="299" alt="" aria-hidden="true" draggable="false" />
          <span className="pp-words">
            {word && <span className="pp-k">{word}</span>}
            {children}
          </span>
        </span>
      </span>
    </button>
  );
}
