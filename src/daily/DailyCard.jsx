// DailyCard.jsx — the DAILY CHALLENGE surface on the menu. It is a normal in-flow child
// of the menu panel (NOT position:fixed — it joins the cards region, so it obeys the
// NO ORPHAN FIXED UI rule), styled in the menu house look (Bungee, flat colour, thick
// coloured outline, hard black offset shadow, 8px radius) with NO idle animation
// (menu motion law: hover/press feedback only).
//
// It reads the pure daily state (dailySeed.js), and shows one of two states:
//   • not played today  → the countdown + a big PLAY TODAY'S DAILY button (launches the
//     date-seeded CHAIN board — the SAME board for everyone today).
//   • played today       → a locked receipt: today's score, all-time best, the existing
//     one-tap share card (CopyResultButton), and the live countdown to tomorrow's daily.
import { useCallback, useEffect, useState } from 'react';
import { load, todayRecord, personalBest, localDateKey } from './dailySeed.js';
import DailyCountdown from './DailyCountdown.jsx';
import CopyResultButton from '../share/CopyResultButton.jsx';
import './DailyCard.css';

const MODE = 'chain'; // the chosen daily mode: CHAIN (date-seeded opener + reroutes)

function readState() {
  try {
    return load(typeof window !== 'undefined' ? window.localStorage : null);
  } catch {
    return load(null);
  }
}

export default function DailyCard({ onPlay }) {
  const [state, setState] = useState(readState);
  const [today, setToday] = useState(() => localDateKey());

  const refresh = useCallback(() => {
    setState(readState());
    setToday(localDateKey());
  }, []);

  // Re-read when the player comes BACK to the menu (returning from a completed daily run
  // flips this card to its locked state) and when the tab regains focus/visibility.
  useEffect(() => {
    const onFocus = () => refresh();
    const onVis = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [refresh]);

  const rec = todayRecord(state, MODE, today);
  const played = !!rec;
  const best = personalBest(state, MODE);

  return (
    <section className={`daily-card${played ? ' is-done' : ''}`} aria-label="Daily Challenge">
      <div className="daily-card-head">
        <span className="daily-card-kicker">DAILY CHALLENGE</span>
        <span className="daily-card-mode">CHAIN</span>
      </div>

      {played ? (
        <>
          <div className="daily-card-tagline">TODAY&apos;S BOARD CLEARED</div>
          <div className="daily-card-scores">
            <div className="daily-score">
              <b>{rec.score}</b>
              <span>TODAY</span>
            </div>
            <div className="daily-score">
              <b>{best}</b>
              <span>BEST</span>
            </div>
          </div>
          <div className="daily-card-share">
            <CopyResultButton
              mode={MODE}
              words={rec.words}
              points={rec.score}
              tiers={rec.tiers}
              killed
              className="daily-share-btn"
            />
          </div>
          <div className="daily-card-locked">
            NEXT DAILY IN{' '}
            <DailyCountdown className="daily-card-clock" onRollover={refresh} />
          </div>
        </>
      ) : (
        <>
          <div className="daily-card-tagline">
            SAME BOARD FOR EVERYONE TODAY · ONE ATTEMPT
          </div>
          <button type="button" className="daily-card-play" onClick={onPlay}>
            PLAY TODAY&apos;S DAILY
          </button>
          <div className="daily-card-meta">
            {best > 0 ? <span className="daily-card-best">BEST {best}</span> : <span className="daily-card-best">NEW</span>}
            <span className="daily-card-sep">·</span>
            <span className="daily-card-next">
              RESETS IN <DailyCountdown className="daily-card-clock" onRollover={refresh} />
            </span>
          </div>
        </>
      )}
    </section>
  );
}
