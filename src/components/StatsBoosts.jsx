// StatsBoosts — the STATS screen's BOOSTS tab (Andy oct8: "we can have a location for that in stat menu for boosting
// kind of like bee swarm sim"). Every running boost as a big tile — ×N, what it is, WHAT it boosts, time left — and,
// when nothing runs, where each boost comes from. 1 Hz only while something runs (useTimerClock).
import { activeBoosts, anyBoostRemaining } from '../progress/liveBoost.js';
import { formatFrenzy } from '../progress/frenzy.js';
import { useTimerClock } from '../frenzy/useTimerClock.js';

const WHERE = [
  ['OVERDRIVE ×10', 'XP + WINS', 'UPGRADES → BOOSTS (BUY AGAIN = +5 MIN)'],
  ['XP / WINS +25%', 'XP PER KEY / WINS PER WORD', 'UPGRADES → BOOSTS'],
  ['LUCK ×2', 'ROLL LUCK', 'UPGRADES → BOOSTS'],
  ['FRENZY ×5', 'XP PER KEY', 'LIGHT ALL 26 LETTERS IN FUSE (FREE)'],
];

export default function StatsBoosts() {
  useTimerClock(anyBoostRemaining);
  const list = activeBoosts();
  return (
    <div className="st2-boosts" data-testid="st2-boosts">
      {list.length ? (
        <ul className="st2-bl" aria-label="Running boosts">
          {list.map((b) => (
            <li key={b.id} className={`st2-bt bd-${b.id}`}>
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
        <span className="st2-where-h">WHERE BOOSTS COME FROM</span>
        {WHERE.map(([n, w, from]) => (
          <span className="st2-where-row" key={n}>
            <b>{n}</b> <span>ON {w}</span> <i>{from}</i>
          </span>
        ))}
      </div>
    </div>
  );
}
