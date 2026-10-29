// BoostDock — every running boost as a stack of timer tiles in the BOTTOM-RIGHT corner (Andy oct8: "when boosts are
// active they should have a timer at the bottom right of the screen instead of dead center … kind of like bee swarm
// sim"). It is NOT a new fixed element: it renders INSIDE the corner sound control (AudioControls, the app's one
// bottom-right cluster), stacked above the 🔊 button — CLAUDE.md NO ORPHAN FIXED UI.
//
// v2 (Andy oct13 "i want the overdrive, frenzy, and boost timers to look better"): each tile is a little game HUD
// timer — the boost's kit icon on a tone badge, NAME ×N + what it boosts, a big clock, and a DRAIN BAR that empties as
// the time runs out (transform: scaleX with a 1 s linear transition per tick — compositor only, nothing loops).
// OVERDRIVE is the hero tile (its clock and bar are bigger). Buying more time (the shop's +5 MIN) bumps the tile once and refills the bar.
// The last 10 s pulse (finite: 10 × 1 s). Desktop only — on a phone the corner sits over the cards, so the phone menu
// keeps its top-row pill.
import { useRef } from 'react';
import { activeBoosts, anyBoostRemaining } from '../progress/liveBoost.js';
import { formatFrenzy } from '../progress/frenzy.js';
import { useTimerClock } from './useTimerClock.js';
import KitIcon from '../components/kit/KitIcon.jsx';
import { readSpans, spanOf, SPAN_KEY } from './boostSpan.js';
import '../components/kit/kitIconData.js'; // boost / overdrive / luck / levels live in the full set
import '../components/kit/tokens.css';
import { boostArt } from '../progress/boostArt.js';
import './BoostDock.css';

export default function BoostDock() {
  const { active } = useTimerClock(anyBoostRemaining); // re-renders once a second while anything runs
  const spans = useRef(null);
  const bumps = useRef({});
  if (!active) return null;
  const list = activeBoosts();
  if (!list.length) return null;
  if (!spans.current) spans.current = readSpans();
  const now = Date.now();
  let dirty = false;
  const rows = list.map((b) => {
    const s = spanOf(spans.current, b.id, b.ms, now);
    if (s.dirty) dirty = true;
    if (s.grew) bumps.current[b.id] = (bumps.current[b.id] || 0) + 1;
    return { ...b, frac: s.frac, bump: bumps.current[b.id] || 0 };
  });
  if (dirty) {
    try {
      localStorage.setItem(SPAN_KEY, JSON.stringify(spans.current));
    } catch {
      /* private mode: the bar just restarts full after a reload */
    }
  }
  return (
    <ul className="boost-dock" aria-label="Active boosts">
      {rows.map((b) => (
        <li key={`${b.id}:${b.bump}`}
          className={`bd-tile bd-${b.id}${b.icon === 'overdrive' ? ' bd-hero' : ''}${b.ms <= 10000 ? ' is-ending' : ''}${b.bump ? ' is-bumped' : ''}`}
          role="status" aria-label={`${b.name} ${b.mult} on ${b.what}, ${formatFrenzy(b.ms)} left`}>
          <span className={`bd-badge${boostArt(b.icon) ? ' has-art' : ''}`} aria-hidden="true">
            {boostArt(b.icon) ? <img className="bd-art" src={boostArt(b.icon)} width="256" height="256" alt="" draggable="false" /> : <KitIcon name={b.icon} size={30} />}
          </span>
          <span className="bd-name">{b.name}</span>
          <span className="bd-sub"><span className="bd-mult">{b.mult}</span><span className="bd-what">{b.what}</span></span>
          <span className="bd-clock">{formatFrenzy(b.ms)}</span>
          <span className="bd-bar" aria-hidden="true"><span className="bd-fill" style={{ transform: `scaleX(${b.frac})` }} /></span>
        </li>
      ))}
    </ul>
  );
}
