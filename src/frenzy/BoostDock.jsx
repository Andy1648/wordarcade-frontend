// BoostDock — EVERY live boost, bottom-right, with its clock and what it boosts.
//
// ANDY (R5 oct8): "when boosts are active they should have a timer at the bottom right of the screen instead of
// dead center (we can have a location for that in stat menu for boosting kind of like bee swarm sim)."
//
// NOT an orphan fixed element (CLAUDE.md): it docks to the SAME bottom-right corner the sound control already
// owns and stacks ABOVE it, sharing the corner's 16px inset through --dock-inset — so the two read as one corner
// cluster and can never collide. It renders NOTHING while no timer runs, so it is not idle chrome.
//
// Motion: the only animation is a finite 320 ms slam when a row appears (transform/opacity, will-change cleared on
// finish) and the last-10s pulse the pill already had. No loop, no layout read, one 1 Hz tick while a timer lives.
import { useEffect, useRef } from 'react';
import { liveTimers } from '../progress/liveTimers';
import { anyTimerRemaining } from '../progress/anyTimer';
import { formatFrenzy } from '../progress/frenzy';
import { formatMultExact } from '../format';
import { useTimerClock } from './useTimerClock';
import { reduceMotion } from '../lib/reduceMotion';
import './BoostDock.css';

const SLAM = [
  { transform: 'translateX(22px) scale(.92)', opacity: 0 },
  { transform: 'translateX(-3px) scale(1.04)', opacity: 1, offset: 0.62 },
  { transform: 'translateX(0) scale(1)', opacity: 1 },
];

function Row({ t }) {
  const ref = useRef(null);
  // one finite slam the first time THIS row mounts (a new boost started); never on a tick
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof el.animate !== 'function' || reduceMotion()) return undefined;
    el.style.willChange = 'transform, opacity';
    const a = el.animate(SLAM, { duration: 320, easing: 'cubic-bezier(.2,1.3,.4,1)' });
    const clear = () => { el.style.willChange = ''; };
    a.onfinish = clear;
    a.oncancel = clear;
    return () => a.cancel();
  }, []);
  const ending = t.ms <= 10000;
  return (
    <div
      ref={ref}
      className={`bdock-row${ending ? ' is-ending' : ''}`}
      style={{ '--bd-tone': t.tone }}
      data-testid={`bdock-${t.id}`}
    >
      <span className="bdock-mult">×{formatMultExact(t.mult)}</span>
      <span className="bdock-text">
        <span className="bdock-name">{t.name}</span>
        <span className="bdock-says">{t.says}</span>
      </span>
      <span className="bdock-clock">{formatFrenzy(t.ms)}</span>
    </div>
  );
}

// A phone has no spare corner: the menu's last rows reach the bottom edge, and the page only yields a fixed
// band of height for the dock (Homepage.css). So phones show the THREE longest-running boosts and count the
// rest — the dock can never grow past the space the page cleared for it.
const PHONE_MAX = 3;
const isPhone = () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width: 480px)').matches;

/** The corner dock. `liftForAudio` clears the fixed sound control on screens that show one. */
export default function BoostDock({ liftForAudio = true }) {
  const { ms } = useTimerClock(anyTimerRemaining);
  const all = ms > 0 ? liveTimers() : [];
  const rows = isPhone() ? all.slice(0, PHONE_MAX) : all;
  const hidden = all.length - rows.length;
  if (!rows.length) return null;
  return (
    <div
      className={`bdock${liftForAudio ? ' bdock--lifted' : ''}`}
      role="status"
      aria-label={`${rows.length} boost${rows.length > 1 ? 's' : ''} running`}
      data-testid="boost-dock"
    >
      {rows.map((t) => <Row key={t.id} t={t} />)}
      {hidden > 0 && <div className="bdock-more">+{hidden} MORE</div>}
    </div>
  );
}
