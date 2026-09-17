// WordLanding.jsx — THE WORD ITSELF REACTS.
//
// WHY THIS REPLACED TWO FEATURES. In Steal an Egg you SEE that the egg is rare; the rarity IS the
// event. Here it was a silent multiplier folded into a number on a pill nobody watches, and the
// one thing that did announce itself — a menu secret — did it as a centre-screen modal you clicked
// away, over a card you were aiming at. Both were cut. What replaced them is one rule: when a word
// lands, it reacts WHERE THE PLAYER IS ALREADY LOOKING, which is the field they just typed into.
//
// THE TIERS ESCALATE, and each adds to the last rather than replacing it:
//   COMMON    nothing here. The existing accept pop is the whole event; a rare word has to be able
//             to feel different, and it cannot if every word gets a treatment.
//   UNCOMMON  the chip lands in yellow with a harder shadow.
//   RARE      orange, a one-shot RARE stamp rotated over it, its own sound.
//   OBSCURE   flash pink, an OBSCURE stamp, the biggest one-shot, and the PAYOUT COUNTS UP beside
//             the chip — the reward attached to the word that earned it, rather than added to a
//             running total somewhere else on the screen.
// A SECRET rides the same surface: the stamp carries its name, and it pays here too.
//
// NON-NEGOTIABLES, all three of which the deleted features broke:
//   - no centre-screen modal, no backdrop, nothing that can be clicked through. This is
//     `pointer-events: none` and anchored INSIDE the input row (CLAUDE.md: no orphan fixed UI).
//   - one-shot. It mounts, it plays, it unmounts. Nothing here loops.
//   - reduced motion is honoured: the count-up resolves instantly and the entrance is an opacity
//     fade (see WordLanding.css).
import { useEffect, useRef, useState } from 'react';
import { formatNum } from '../format';
import './WordLanding.css';

// The bands that get a treatment, in escalation order. COMMON is deliberately absent.
export const LANDING_BANDS = ['UNCOMMON', 'RARE', 'OBSCURE'];
const STAMPED = new Set(['RARE', 'OBSCURE']);
const COUNT_MS = 420;

/** Should a landing be shown at all for this word? COMMON with no secret is silent. */
export function hasLanding(band, secret) {
  return !!secret || LANDING_BANDS.includes(band);
}

// The payout counting up. A number ticking to its value is not a CSS animation (it is a text
// change), so it is driven by rAF and bounded by COUNT_MS — one short pass per landing, never a
// loop, and it resolves to the final value immediately under reduced motion.
function useCountUp(target, enabled) {
  const [n, setN] = useState(enabled ? 0 : target);
  const rafRef = useRef(0);
  useEffect(() => {
    if (!enabled) {
      setN(target);
      return undefined;
    }
    const start = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - start) / COUNT_MS);
      // ease-out: the number sprints and settles, which reads as "landing" rather than "loading"
      setN(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, enabled]);
  return n;
}

/**
 * @param {object} props
 * @param {string} props.word    the accepted word
 * @param {string} props.band    COMMON | UNCOMMON | RARE | OBSCURE
 * @param {number} [props.wins]  what it paid — shown counting up on OBSCURE and on a secret
 * @param {{stamp: string, wins: number}|null} [props.secret]  a secret found ON this word
 * @param {boolean} [props.reduced]  prefers-reduced-motion (the caller reads the media query once)
 */
export default function WordLanding({ word, band = 'COMMON', wins = 0, secret = null, reduced = false }) {
  const showCount = band === 'OBSCURE' || !!secret;
  const total = (secret ? secret.wins : 0) + (showCount ? wins : 0);
  const shown = useCountUp(total, showCount && !reduced);
  if (!hasLanding(band, secret)) return null;

  const tier = secret ? 'SECRET' : band;
  return (
    <div className={`wl wl--${tier.toLowerCase()}`} aria-hidden="true">
      <span className="wl-chip">{String(word || '').toUpperCase()}</span>
      {(secret || STAMPED.has(band)) && (
        <span className="wl-stamp">{secret ? secret.stamp : band}</span>
      )}
      {showCount && total > 0 && <span className="wl-wins">+{formatNum(shown)}</span>}
    </div>
  );
}
