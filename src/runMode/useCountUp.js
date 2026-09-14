// useCountUp.js — the WALL numeral's odometer. Counts to a new value in DISCRETE TICKS
// (never a smooth lerp — the point is that it clacks) and pops the node once at the end.
//
// ANIMATION BUDGET compliance, deliberately:
//   • the numeral is ONE persistent node (pooled by definition) — nothing is created per
//     tick or per keystroke;
//   • the only style written per tick is `textContent`; the only animation is a WAAPI
//     transform/opacity one-shot, restarted by cancelling the previous one — so there is
//     never an `offsetWidth` read to restart a CSS animation;
//   • `will-change` is set when the pop plays and cleared when it finishes, never at rest;
//   • zero layout reads anywhere in the path.
import { useEffect, useRef } from 'react';

const TICKS = 14;      // how many discrete steps a count-up takes
const STEP_MS = 34;    // ms between steps -> ~475ms for a full count

const fmt = (n) => Math.round(n).toLocaleString();

// A finite scale pop on the numeral. Pure writes: cancel, animate, clear will-change.
function pop(node, strength) {
  if (!node) return;
  try {
    node.getAnimations().forEach((a) => a.cancel());
    node.style.willChange = 'transform';
    const a = node.animate(
      [
        { transform: 'scale(1)' },
        { transform: `scale(${1 + strength})`, offset: 0.34 },
        { transform: 'scale(1)' },
      ],
      { duration: 260, easing: 'cubic-bezier(.2,1.5,.4,1)' }
    );
    a.finished.then(() => { node.style.willChange = ''; }).catch(() => { node.style.willChange = ''; });
  } catch {
    /* WAAPI unavailable (jsdom / very old engine): the number still updates. */
  }
}

/**
 * @param {number} value  the number to display
 * @param {boolean} animate  false => write it straight (reduced motion / first paint)
 * @returns a ref to attach to the element that shows the number
 */
export default function useCountUp(value, animate = true) {
  const ref = useRef(null);
  const shown = useRef(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const from = shown.current;
    const to = Number(value) || 0;

    // First paint, a countdown, or motion off: land on the value with no theatre.
    if (from === null || !animate || to <= from) {
      shown.current = to;
      node.textContent = fmt(to);
      return undefined;
    }

    const delta = to - from;
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      if (i >= TICKS) {
        clearInterval(id);
        shown.current = to;
        node.textContent = fmt(to);
        // Bigger jumps land harder — capped so a 10k wall doesn't detonate.
        pop(node, Math.min(0.18, 0.05 + delta / 9000));
        return;
      }
      // ease-out so the odometer slows into place
      const t = 1 - Math.pow(1 - i / TICKS, 2.2);
      node.textContent = fmt(from + delta * t);
    }, STEP_MS);
    return () => clearInterval(id);
  }, [value, animate]);

  return ref;
}
