// StatsBoosts — the STATS screen's BOOSTS tab (Andy oct8: "we can have a location for that in stat menu for boosting
// kind of like bee swarm sim"). Every running boost as a big tile — ×N, what it is, WHAT it boosts, time left — and,
// when nothing runs, where each boost comes from. 1 Hz only while something runs (useTimerClock).
import { activeBoosts, anyBoostRemaining } from '../progress/liveBoost.js';
import { formatFrenzy } from '../progress/frenzy.js';
import { useTimerClock } from '../frenzy/useTimerClock.js';
import { boostArt } from '../progress/boostArt.js';
import { OVERDRIVE_MULT } from '../progress/overdrive.js';

// WHERE each boost comes from — ONE line each (design audit nov2 #6: it was a three-line wall of explanation)
const WHERE = [
  [`OVERDRIVE ×${OVERDRIVE_MULT}`, 'UPGRADES'],
  ['XP / WINS +50%', 'UPGRADES'],
  ['LUCK ×2', 'UPGRADES'],
  ['FRENZY ×5', 'FUSE → ALL 26'],
];

export default function StatsBoosts() {
  useTimerClock(anyBoostRemaining);
  const list = activeBoosts();
  return (
    <div className="st2-boosts" data-testid="st2-boosts">
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
      <div className="st2-where" aria-label="Where boosts come from">
        <span className="st2-where-h">GET BOOSTS</span>
        {WHERE.map(([n, from]) => (
          <span className="st2-where-row" key={n}>
            <b>{n}</b> <i>{from}</i>
          </span>
        ))}
      </div>
    </div>
  );
}
