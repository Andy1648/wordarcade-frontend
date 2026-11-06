// StatsBoosts — the STATS screen's BOOSTS tab (Andy oct8: "we can have a location for that in stat menu for boosting
// kind of like bee swarm sim"). Every running boost as a big tile — ×N, what it is, WHAT it boosts, time left.
// 1 Hz only while something runs (useTimerClock).
import { activeBoosts, anyBoostRemaining } from '../progress/liveBoost.js';
import { formatFrenzy } from '../progress/frenzy.js';
import { useTimerClock } from '../frenzy/useTimerClock.js';
import { boostArt } from '../progress/boostArt.js';

export default function StatsBoosts() {
  useTimerClock(anyBoostRemaining);
  const list = activeBoosts();
  return (
    <div className={`st2-boosts${list.length ? '' : ' is-empty'}`} data-testid="st2-boosts">
      {list.length ? (
        <ul className="st2-bl" aria-label="Running boosts">
          {list.map((b) => (
            <li key={b.id} className={`st2-bt bd-${b.id}${boostArt(b.icon) ? ' has-art' : ''}`}>
              {boostArt(b.icon) ? <img className="st2-bt-art" src={boostArt(b.icon)} width="256" height="256" alt="" aria-hidden="true" draggable="false" /> : null}
              <span className="st2-bt-mult">{b.mult}</span>
              <span className="st2-bt-name">{b.name}</span>
              <span className="st2-bt-what">ON {b.what}</span>
              <span className="st2-bt-clock">{formatFrenzy(b.ms)}<small> LEFT</small></span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="st2-bl-none">NO BOOSTS RUNNING</p>
      )}
    </div>
  );
}
