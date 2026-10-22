// contracts/StreakCalendar.jsx — the STREAK CALENDAR strip at the top of the CONTRACTS screen (preview). The painted
// flame with your streak, then the week's SEVEN reward tiles — got (dimmed, ticked), TODAY (raised, yellow; the tile
// itself is the CLAIM button once you have played a word), the rest waiting — ending on the gold LEGENDARY ROLL.
// Rules: contracts/calendar.js. Motion: a claimed tile pops once (WAAPI); nothing loops at rest.
import { useEffect, useRef, useState } from 'react';
import { liveCalendar, claimToday, CALENDAR_CHANGE } from '../../progress/contracts/calendar.js';
import { KitIcon } from '../kit/index.js';
import { kitPlay } from '../kit/motion.js';
import { formatNum } from '../../format';

const POP = [{ transform: 'translateY(-8px) scale(1)' }, { transform: 'translateY(-14px) scale(1.18) rotate(-4deg)', offset: 0.4 }, { transform: 'translateY(0) scale(1)' }];
const CARD = '/fx/card-back.svg'; // the gear card's own back — a ROLL is a card you have not flipped yet

function Reward({ d }) {
  if (d.kind === 'gems') {
    const size = d.gems >= 100 ? 46 : d.gems >= 50 ? 40 : 34;
    return <span className="cal-art"><KitIcon name="gems" size={size} shadow={2} extras={false} /></span>;
  }
  return (
    <span className={`cal-art is-card${d.kind === 'legendary' ? ' is-leg' : ''}`}>
      {d.kind === 'legendary' ? <img className="cal-shine" src="/fx/shine-legendary.svg" alt="" aria-hidden="true" draggable="false" /> : null}
      <img className="cal-card" src={CARD} alt="" aria-hidden="true" draggable="false" />
    </span>
  );
}

const PAY = (d) => (d.kind === 'gems' ? `+${formatNum(d.gems)}` : d.kind === 'roll' ? 'ROLL' : 'LEGENDARY');

export default function StreakCalendar({ streak }) {
  const [v, setV] = useState(() => liveCalendar());
  const tiles = useRef([]);
  useEffect(() => {
    const on = () => setV(liveCalendar());
    window.addEventListener(CALENDAR_CHANGE, on);
    return () => window.removeEventListener(CALENDAR_CHANGE, on);
  }, []);
  const claim = (i) => {
    const r = claimToday();
    if (!r) return;
    kitPlay(tiles.current[i], POP, { duration: 380, easing: 'cubic-bezier(.2,1.4,.4,1)' });
    setV(liveCalendar());
  };
  return (
    <section className="cx3-cal" aria-label={`Streak calendar — week ${v.week}`} data-testid="streak-calendar">
      <div className={`cal-flame${streak > 0 ? '' : ' is-cold'}`} aria-label={`${streak} day streak`}>
        <img src="/cast/props/flame.webp" alt="" aria-hidden="true" draggable="false" />
        <b>{formatNum(streak)}</b>
        <span className="cal-flame-k">DAY STREAK</span>
        <span className="cal-week">WEEK {formatNum(v.week)}</span>
      </div>
      <ol className="cal-days">
        {v.days.map((d, i) => {
          const isToday = d.state === 'today';
          const can = isToday && v.claimable;
          const body = (
            <>
              <span className="cal-day-k"><span className="cal-day-w">DAY </span>{d.day}</span>
              <Reward d={d} />
              <span className="cal-pay">{PAY(d)}</span>
              {isToday ? <span className="cal-cta">{can ? 'CLAIM!' : 'PLAY A WORD'}</span> : null}
              {d.state === 'got' ? <span className="cal-got" aria-hidden="true">✓</span> : null}
            </>
          );
          return (
            <li key={d.day} ref={(el) => { tiles.current[i] = el; }} className={`cal-day is-${d.state} is-${d.kind}`} data-day={d.day}>
              {can ? (
                <button type="button" className="cal-day-btn" onClick={() => claim(i)} aria-label={`Claim day ${d.day}: ${PAY(d)}`}>{body}</button>
              ) : (
                <div className="cal-day-btn" aria-label={`Day ${d.day}: ${PAY(d)} — ${d.state === 'got' ? 'claimed' : isToday ? 'play a word today to claim' : 'later'}`}>{body}</div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
