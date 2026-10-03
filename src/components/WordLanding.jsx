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
import { formatNum } from '../format';
import { useCountUp } from '../hooks/useCountUp';
import './WordLanding.css';

// The bands that get a treatment, in escalation order. COMMON is deliberately absent.
export const LANDING_BANDS = ['UNCOMMON', 'RARE', 'OBSCURE'];
const STAMPED = new Set(['RARE', 'OBSCURE']);
// The landing lives 1.5 s (wl-land), so its count takes the one count-up's FLOOR (1.2 s) and is
// capped there — long enough to see it climb, and it lands before the chip fades.
const COUNT_MAX_MS = 1200;

/** Should a landing be shown at all for this word? COMMON with no secret is silent. */
export function hasLanding(band, secret) {
  return !!secret || LANDING_BANDS.includes(band);
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
  // THE one count-up (hooks/useCountUp → juice/countUp.js), from 0; instant under reduced motion.
  const shown = Math.round(useCountUp(total, { from: 0, maxMs: COUNT_MAX_MS, enabled: showCount && !reduced }).shown);
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
