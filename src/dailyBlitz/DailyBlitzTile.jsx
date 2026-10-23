// dailyBlitz/DailyBlitzTile.jsx — the menu's DAILY BLITZ entry. It JOINS the menu's DAILY cluster (CLAUDE.md
// "NO ORPHAN FIXED UI") in the same faces the DAILY CONTRACTS tile uses:
//   chip  — the paged desktop's right column (≥1200), stacked under the CONTRACTS chip;
//   icon  — the icon cluster, beside the contracts flame (narrower desktops);
//   row   — the phone's mode list, first row (taps only, no text box — Andy oct21).
// Static at rest (MENU MOTION LAW). Reads only localStorage (store.js) — the game, its lists and the network
// client load on the tap, in the screen's own chunk. The face is the Category Blitz brain (real art, /cards).
import { useEffect, useState } from 'react';
import { localDateKey } from '../daily/dailySeed.js';
import { dayNumberFor } from './day.js';
import { loadRun, currentStreak } from './store.js';
import { KitIconButton } from '../components/kit/KitNavButton.jsx';
import { formatNum } from '../format';
import './DailyBlitzTile.css';

const ART = '/cards/cb-hero.webp';

function readToday() {
  const day = dayNumberFor(localDateKey());
  const run = loadRun(day);
  return { day, done: !!run.done, total: Number(run.total) || 0, streak: currentStreak(day) };
}

export default function DailyBlitzTile({ onPlay, navigating = false, variant = 'chip' }) {
  const [s, setS] = useState(readToday);
  useEffect(() => {
    const vis = () => { if (document.visibilityState === 'visible') setS(readToday()); };
    document.addEventListener('visibilitychange', vis);
    return () => document.removeEventListener('visibilitychange', vis);
  }, []);
  const status = s.done ? `PLAYED · ${formatNum(s.total)}` : 'NEW TODAY';
  const label = `Daily Blitz #${s.day} — ${s.done ? `played, ${formatNum(s.total)} points` : 'new prompts today'}${s.streak ? ` · ${s.streak} day streak` : ''}`;
  const go = (e) => { if (!navigating && onPlay) onPlay(e.currentTarget); };
  if (variant === 'icon') {
    return (
      <KitIconButton art={ART} tone="hot" className="hp-ico is-dblitz" data-nav="daily-blitz" tag={`#${s.day}`}
        dot={s.done ? undefined : 1} disabled={navigating} onClick={go} ariaLabel={label} title="Daily Blitz" />
    );
  }
  return (
    <button type="button" className={`dbt dbt--${variant}${s.done ? ' is-done' : ''}`} data-nav="daily-blitz"
      data-testid="daily-blitz-entry" disabled={navigating} onClick={go} aria-label={label}>
      <img className="dbt-face" src={ART} alt="" aria-hidden="true" draggable="false" width="64" height="96" />
      <span className="dbt-txt" aria-hidden="true">
        <span className="dbt-k">DAILY BLITZ</span>
        <span className="dbt-sub">
          <span className="dbt-n">#{s.day}</span>
          <span className={`dbt-st${s.done ? '' : ' is-new'}`}>{status}</span>
        </span>
      </span>
      {s.streak > 0 ? (
        <span className="dbt-streak" aria-hidden="true">
          <img src="/cast/props/flame.webp" alt="" width="32" height="32" draggable="false" />
          <b>{formatNum(s.streak)}</b>
        </span>
      ) : null}
    </button>
  );
}
