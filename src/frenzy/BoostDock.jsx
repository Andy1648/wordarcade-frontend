// BoostDock — every running boost as a stack of timer tiles in the BOTTOM-RIGHT corner (Andy oct8: "when boosts are
// active they should have a timer at the bottom right of the screen instead of dead center … kind of like bee swarm
// sim"). It is NOT a new fixed element: it renders INSIDE the corner sound control (AudioControls, the app's one
// bottom-right cluster), stacked above the 🔊 button — CLAUDE.md NO ORPHAN FIXED UI.
//
// Each tile says WHAT (OVERDRIVE / XP BOOST …), HOW MUCH (×10 / +25%), ON WHAT (XP + WINS / ROLL LUCK …) and the
// time left. A 1 Hz clock runs only while a boost runs (useTimerClock re-arms on TIMERS_EVENT, focus, storage); the
// last 10 s pulse (finite: 10 × 1 s). Desktop only — on a phone the corner sits over the cards, so the phone menu
// keeps its top-row pill.
import { activeBoosts, anyBoostRemaining } from '../progress/liveBoost.js';
import { formatFrenzy } from '../progress/frenzy.js';
import { useTimerClock } from './useTimerClock.js';
import '../components/kit/tokens.css';
import './BoostDock.css';

export default function BoostDock() {
  const { active } = useTimerClock(anyBoostRemaining); // re-renders once a second while anything runs
  if (!active) return null;
  const list = activeBoosts();
  if (!list.length) return null;
  return (
    <ul className="boost-dock" aria-label="Active boosts">
      {list.map((b) => (
        <li key={b.id} className={`bd-tile bd-${b.id}${b.ms <= 10000 ? ' is-ending' : ''}`} role="status"
          aria-label={`${b.name} ${b.mult} on ${b.what}, ${formatFrenzy(b.ms)} left`}>
          <span className="bd-mult">{b.mult}</span>
          <span className="bd-name">{b.name}</span>
          <span className="bd-clock">{formatFrenzy(b.ms)}</span>
          <span className="bd-what">{b.what}</span>
        </li>
      ))}
    </ul>
  );
}
