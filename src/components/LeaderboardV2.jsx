// LeaderboardV2.jsx — THE v2 LEADERBOARD (claude/mockups/v2/Leaderboard.dc.html; SEASON2 only, P8).
//
// LAZY, its own chunk: LeaderboardScreen renders it in place of the live board only while the SEASON2 flag is on and a
// name is claimed (claiming / renaming stays on the live screen's form). Live players see no change until the flip.
//   * ALL TIME reads the season-2 board (client.fetchBoard → public.leaderboard_s2, 022: ★ → rebirths → level).
//   * THIS WEEK reads public.leaderboard_s2_weekly (024: ★ / rebirths / levels GAINED this ET week); until 024 runs it
//     falls back to the live weekly view filtered to season-2 rows (words this week).
//   * a WHITE PODIUM for the top 3 (vector blocks, the crown on #1), then ranks 4 … 10 in rows.
//   * every name wears its v3 RANK plate (INKLING … ENDGAME — by rebirths, then ★; s2Board.rankPlate).
//   * ▲▼ = the place each player held the last time this browser looked at the same tab (a snapshot under taw.s2.).
//   * YOUR row is lifted and pulses (a FINITE pulse when the board lands / the tab changes) — wherever you are: on the
//     podium (top 3), in the list, or pinned under it with your real rank when you are past #10.
//   * CHASE (what passes the player above, in the board's order) and CLIMB (what reaches your next rank).
// Motion: kit one-shots (transform / opacity; will-change only while playing); NOTHING loops at rest (the mockup's
// crown wobble / ▲ bob / ▼ sink / own-row pulse play once on arrival); REDUCE MOTION plays none of it.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import './kit/tokens.css';
import './LeaderboardV2.css';
import { kitPlay } from './kit/motion.js';
import { KitRankPlate } from './kit/KitRankPlate.jsx';
import {
  boardCaps,
  fetchBoard,
  fetchView,
  getMyProfile,
  submitStats,
  setLastRank,
  setRankNews,
  clearRankFrom,
  markBoardSeen,
  weekResetInMs,
  formatResetIn,
} from '../leaderboard/client.js';
import { rankPlate, boardMoves, boardSnapshot, chaseTarget, climbTarget, hasEarned } from '../leaderboard/s2Board.js';
import { V3 } from '../progress/season';
import { getRebirths } from '../progress/xp';
import { useMomentHold } from '../lib/useMomentSlot';
import { formatNum } from '../format';
import { BLOCKS } from './PodiumBlocks.jsx';

const fmt = (n) => formatNum(Number(n) || 0);
const SEEN_KEY = 'taw.s2.lbseen'; // { all: { id: rank }, week: { id: rank } } — the last look, per tab
const WEEK_COLS = 'rank,id,username,level,rebirths,stars,week_stars,week_rebirths,week_levels,week_words';

function readSeen() {
  try {
    const o = JSON.parse(localStorage.getItem(SEEN_KEY) || 'null');
    return o && typeof o === 'object' ? o : {};
  } catch {
    return {};
  }
}
function writeSeen(tab, snap) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify({ ...readSeen(), [tab]: snap }));
  } catch {
    /* storage blocked */
  }
}

/** THIS WEEK: the season-2 weekly view (024), else the live weekly view filtered to season-2 rows (words). */
async function loadWeek() {
  try {
    const w = await fetchView('leaderboard_s2_weekly', WEEK_COLS);
    return { ...w, gains: true };
  } catch (e) {
    if (!(e && e.status === 404)) throw e;
    const w = await fetchView('leaderboard_weekly', 'rank,id,username,level,rebirths,week_words', 10, '&econ=eq.13');
    // the live view numbers every row (season 1 too): renumber the season-2 rows we got
    return { rows: w.rows.map((r, i) => ({ ...r, rank: i + 1 })), me: w.me, gains: false };
  }
}

// ---- the podium blocks: real vector solids, gold / silver / bronze (R5 oct8 #2 — PodiumBlocks.jsx, imported above) ----
function Crown({ crownRef }) {
  return (
    <svg ref={crownRef} className="lb2-crown" viewBox="0 0 74 50" width="74" height="50" aria-hidden="true" focusable="false">
      <path d="M8 44 L4 12 L22 26 L37 4 L52 26 L70 12 L66 44 Z" fill="#000" transform="translate(4 4)" />
      <path d="M8 44 L4 12 L22 26 L37 4 L52 26 L70 12 L66 44 Z" fill="#FFC23D" stroke="#000" strokeWidth="5" strokeLinejoin="round" />
      <path d="M10 36 L64 36" stroke="#000" strokeWidth="4" />
      <path d="M14 22 L18 32" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

// P9a: every name wears its SHAPED v3 plate (KitLevelUp.dc.html 03 — kit/KitRankPlate, FIT mode for a dense list).
function Plate({ row, className = '' }) {
  const p = rankPlate(row);
  return <KitRankPlate rank={p.i} fit shine={false} className={`lb2-plate ${className}`} />;
}

function Move({ n }) {
  if (n > 0) {
    return (
      <span className="lb2-mv is-up" aria-label={`up ${n}`}>
        <svg className="lb2-mv-ico" viewBox="0 0 18 16" width="18" height="16" aria-hidden="true"><path d="M9 2 L16 14 L2 14 Z" fill="#2EFFE0" stroke="#000" strokeWidth="3" strokeLinejoin="round" /></svg>
        <span>{fmt(n)}</span>
      </span>
    );
  }
  if (n < 0) {
    return (
      <span className="lb2-mv is-down" aria-label={`down ${-n}`}>
        <svg className="lb2-mv-ico" viewBox="0 0 18 16" width="18" height="16" aria-hidden="true"><path d="M2 2 L16 2 L9 14 Z" fill="#FF3D7F" stroke="#000" strokeWidth="3" strokeLinejoin="round" /></svg>
        <span>{fmt(-n)}</span>
      </span>
    );
  }
  // no change → nothing drawn (Andy oct8 "the leaderboard looks shit": a grey dash on every row read as filler)
  return <span className="lb2-mv is-flat" aria-label="no change" />;
}

/** The two numbers a row shows, for the tab it is on. */
function nums(row, tab, gains) {
  if (tab === 'week' && gains) {
    const st = Number(row.week_stars) || 0;
    return { r: `${st > 0 ? `+★${fmt(st)} ` : ''}+R${fmt(row.week_rebirths)}`, lv: `+${fmt(row.week_levels)}` };
  }
  if (tab === 'week') return { r: `R${fmt(row.rebirths)}`, lv: fmt(row.week_words) };
  // 028: a row that has earned nothing in season 2 keeps its old place and shows "—" for every stat
  if (!hasEarned(row)) return { r: '—', lv: '—' };
  const st = Number(row.stars) || 0;
  return { r: `${st > 0 ? `★${fmt(st)} ` : ''}R${fmt(row.rebirths)}`, lv: fmt(row.level) };
}
/** A row's values in the board's own currency for the CHASE (the week's gains on THIS WEEK). */
function chaseRow(row, tab, gains) {
  if (!row) return null;
  if (tab === 'week' && gains) return { rank: row.rank, stars: row.week_stars, rebirths: row.week_rebirths, level: row.week_levels };
  if (tab === 'week') return { rank: row.rank, stars: 0, rebirths: 0, level: row.week_words };
  return row;
}

/** The 1366×657 mockup fit to the window (measured on mount / resize only). */
function useStageScale(ref) {
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.innerWidth < 700);
  useLayoutEffect(() => {
    const set = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const k = w >= 700 ? Math.max(0.6, Math.min(1.7, Math.min((w - 8) / 1366, h / 657))) : 1;
      if (ref.current) ref.current.style.setProperty('--lb2-k', k.toFixed(4));
      setNarrow(w < 700);
    };
    set();
    window.addEventListener('resize', set);
    return () => window.removeEventListener('resize', set);
  }, [ref]);
  return narrow;
}

const RISE = [{ transform: 'translateY(46px)', opacity: 0 }, { transform: 'translateY(-5px)', opacity: 1, offset: 0.7 }, { transform: 'translateY(0)', opacity: 1 }];
const SLIDE = [{ transform: 'translateX(40px)', opacity: 0 }, { transform: 'translateX(0)', opacity: 1 }];
const FILL = [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }];
const WOBBLE = [{ transform: 'rotate(-7deg)' }, { transform: 'rotate(7deg) translateY(-3px)', offset: 0.5 }, { transform: 'rotate(-7deg)' }];
const BOB = [{ transform: 'translateY(0)' }, { transform: 'translateY(-4px)', offset: 0.5 }, { transform: 'translateY(0)' }];
const SINK = [{ transform: 'translateY(0)' }, { transform: 'translateY(3px)', offset: 0.5 }, { transform: 'translateY(0)' }];
const pulse = (base) => [{ transform: `${base} scale(1)` }, { transform: `${base} scale(1.018)`, offset: 0.5 }, { transform: `${base} scale(1)` }];

export default function LeaderboardV2({ onBack, onManageName }) {
  useMomentHold(true); // no queued moment starts under the board
  const rootRef = useRef(null);
  const crownRef = useRef(null);
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;
  const narrow = useStageScale(rootRef);
  const [profile] = useState(() => getMyProfile());
  const [caps, setCaps] = useState({ weekly: false });
  const [tab, setTab] = useState('all');
  const [all, setAll] = useState({ rows: [], me: null, loaded: false, error: false, moves: {} });
  const [week, setWeek] = useState({ rows: [], me: null, loaded: false, error: false, moves: {}, gains: true });

  const loadAll = useCallback(async () => {
    try {
      await submitStats();
      const b = await fetchBoard();
      const moves = boardMoves([...b.rows, ...(b.me ? [b.me] : [])], readSeen().all);
      writeSeen('all', boardSnapshot(b.rows, b.me));
      setAll({ ...b, loaded: true, error: false, moves });
      // reading the board is reading the news (as the live board): clear the badge, keep this rank as the baseline
      const mine = getMyProfile();
      const meNow = mine && (b.rows.find((r) => r.id === mine.id) || b.me);
      setRankNews(false);
      clearRankFrom();
      if (meNow) setLastRank(Number(meNow.rank));
    } catch {
      setAll((s) => ({ ...s, loaded: true, error: true }));
    }
  }, []);
  const loadWeekTab = useCallback(async () => {
    try {
      const w = await loadWeek();
      const moves = boardMoves([...w.rows, ...(w.me ? [w.me] : [])], readSeen().week);
      writeSeen('week', boardSnapshot(w.rows, w.me));
      setWeek({ ...w, loaded: true, error: false, moves });
    } catch {
      setWeek((s) => ({ ...s, loaded: true, error: true }));
    }
  }, []);

  useEffect(() => {
    markBoardSeen();
    let live = true;
    boardCaps().then((c) => { if (live) setCaps(c); });
    loadAll();
    rootRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') onBackRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      live = false;
      window.removeEventListener('keydown', onKey);
    };
  }, [loadAll]);

  const pick = (t) => {
    if (t === tab) return;
    setTab(t);
    if (t === 'week' && !week.loaded) loadWeekTab();
  };

  const data = tab === 'week' ? week : all;
  const gains = tab === 'week' ? week.gains : true;
  const myId = profile && profile.id;
  const rows = data.rows;
  const meRow = myId ? rows.find((r) => r.id === myId) || data.me : null;
  const meOnBoard = !!(meRow && rows.some((r) => r.id === myId));
  const podium = [rows[0], rows[1], rows[2]];
  // ranks 4 … 10; past #10 your own row takes the last place, with your real rank
  let list = rows.slice(3, 10);
  if (meRow && !meOnBoard) list = [...rows.slice(3, 9), meRow];
  const allMe = myId ? all.rows.find((r) => r.id === myId) || all.me : null;
  const above = meRow ? rows.filter((r) => Number(r.rank) < Number(meRow.rank)).sort((a, b) => b.rank - a.rank)[0] : null;
  const chase = meRow ? chaseTarget(chaseRow(meRow, tab, gains), chaseRow(above, tab, gains)) : null;
  const climb = climbTarget(allMe || { rebirths: getRebirths() || 0, stars: V3.store ? V3.store.getStarsV3() : 0 });
  const wk = tab === 'week';
  const hR = wk ? (gains ? '+REBIRTHS' : 'REBIRTHS') : 'REBIRTHS';
  const hL = wk ? (gains ? '+LEVELS' : 'WORDS') : 'LEVELS';
  const chaseUnit = chase && chase.unit === 'LV' && wk && !gains ? 'WORDS' : chase && chase.unit;
  const fromTo = (u, v) => (u === '★' ? `★${fmt(v)}` : u === 'R' ? `R${fmt(v)}` : fmt(v));
  // the unit in WORDS (Andy oct8: things must explain themselves) — "2 REBIRTHS → #10", "1 REBIRTH → HOTKEY"
  const unitWord = (u, n) => {
    const one = Number(n) === 1;
    if (u === 'R') return one ? 'REBIRTH' : 'REBIRTHS';
    if (u === 'LV') return one ? 'LEVEL' : 'LEVELS';
    if (u === 'WORDS') return one ? 'WORD' : 'WORDS';
    return u; // ★
  };

  // ARRIVAL: the podium rises, the list + panels slide in, the bars fill, the crown wobbles once, ▲ / ▼ bob once and
  // YOUR row pulses (twice — finite). Re-played when the tab's data lands. No layout reads; nodes are the pool.
  const shown = `${tab}:${data.loaded ? 1 : 0}:${rows.length}`;
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !data.loaded) return;
    root.querySelectorAll('.lb2-col').forEach((el, i) => kitPlay(el, RISE, { duration: 500, delay: [80, 0, 160][i] || 0, easing: 'cubic-bezier(.2,1.2,.4,1)', fill: 'backwards' }));
    root.querySelectorAll('.lb2-slide').forEach((el, i) => kitPlay(el, SLIDE, { duration: 350, delay: i * 100, easing: 'ease-out', fill: 'backwards' }));
    root.querySelectorAll('.lb2-fill').forEach((el) => kitPlay(el, FILL, { duration: 800, delay: 200, easing: 'cubic-bezier(.2,.9,.3,1)', fill: 'backwards' }));
    if (crownRef.current) kitPlay(crownRef.current, WOBBLE, { duration: 2200, iterations: 1, easing: 'ease-in-out' });
    root.querySelectorAll('.lb2-mv.is-up .lb2-mv-ico').forEach((el) => kitPlay(el, BOB, { duration: 900, delay: 400, easing: 'ease-in-out' }));
    root.querySelectorAll('.lb2-mv.is-down .lb2-mv-ico').forEach((el) => kitPlay(el, SINK, { duration: 1300, delay: 400, easing: 'ease-in-out' }));
    root.querySelectorAll('.lb2-row.is-me').forEach((el) => kitPlay(el, pulse('rotate(-1deg)'), { duration: 750, iterations: 2, delay: 500, easing: 'ease-in-out' }));
    root.querySelectorAll('.lb2-col.is-me .lb2-who').forEach((el) => kitPlay(el, pulse(''), { duration: 750, iterations: 2, delay: 600, easing: 'ease-in-out' }));
    // shown is the trigger; data.loaded guards it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown]);

  const tabs = [
    { key: 'all', label: 'ALL TIME', sub: '★ → R → LV' },
    ...(caps.weekly ? [{ key: 'week', label: 'THIS WEEK', sub: formatResetIn(weekResetInMs()) }] : []),
  ];

  return (
    <div className={`lb2${narrow ? ' lb2--narrow' : ''}`} role="dialog" aria-modal="true" aria-label="Leaderboard" tabIndex={-1} ref={rootRef}>
      <div className="lb2-stripes" aria-hidden="true" />
      <div className="lb2-stage">
        <header className="lb2-head">
          <div className="lb2-left">
            <button type="button" className="lb2-back" onClick={onBack} aria-label="Back to menu">← MENU</button>
            {profile && onManageName && (
              <button type="button" className="lb2-me-btn" onClick={onManageName} aria-label={`Your name is ${profile.username}. Change name or show recovery code`}>
                <span className="lb2-me-k">YOU</span>
                <span className="lb2-me-v">{profile.username}</span>
                <span className="lb2-me-a">CHANGE</span>
              </button>
            )}
          </div>
          <h2 className="lb2-title">LEADERBOARD</h2>
          <div className="lb2-tabs" role="tablist" aria-label="Board">
            {tabs.map((t) => (
              <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} data-tab={t.key} className={`lb2-tab${tab === t.key ? ' is-on' : ''}`} onClick={() => pick(t.key)}>
                <span className="lb2-tab-l">{t.label}</span>
                <span className="lb2-tab-s">{t.sub}</span>
              </button>
            ))}
          </div>
        </header>

        <div className="lb2-podium" aria-label="Top three">
          <div className="lb2-floor" aria-hidden="true" />
          {[2, 1, 3].map((place) => {
            const p = podium[place - 1];
            const B = BLOCKS[place];
            const mine = !!(p && myId && p.id === myId);
            const n = p ? nums(p, tab, gains) : null;
            return (
              <div key={place} className={`lb2-col lb2-col--${place}${mine ? ' is-me' : ''}`} data-place={place} data-id={p ? p.id : ''}>
                {place === 1 && <Crown crownRef={crownRef} />}
                <div className="lb2-who">
                  {p ? <Plate row={p} className="lb2-pod-plate" /> : <span className="lb2-plate lb2-pod-plate is-empty"><span>OPEN</span></span>}
                  <span className="lb2-pod-name">
                    {mine && <span className="lb2-you">YOU</span>}
                    <span className="lb2-pod-name-t">{p ? p.username : 'YOUR NAME HERE?'}</span>
                  </span>
                  <span className="lb2-pod-r">{n ? n.r : '—'}</span>
                  <span className="lb2-pod-lv">{n ? n.lv : ''} {n ? <span className="lb2-pod-lvk">{wk && !gains ? 'WORDS' : 'LV'}</span> : null}</span>
                </div>
                <div className="lb2-blockwrap">
                  <B />
                  <span className="lb2-place">{place}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="lb2-cols" aria-hidden="true">
          <span>#</span><span>PLAYER</span><span /><span className="lb2-num">{hR}</span><span className="lb2-num">{hL}</span>
        </div>
        <div className="lb2-list lb2-slide">
          {!data.loaded && <p className="lb2-note">LOADING THE BOARD…</p>}
          {data.loaded && data.error && (
            <p className="lb2-note">COULDN’T LOAD THE BOARD. <button type="button" className="lb2-retry" onClick={tab === 'week' ? loadWeekTab : loadAll}>RETRY</button></p>
          )}
          {data.loaded && !data.error && rows.length === 0 && <p className="lb2-note">{wk ? 'NOBODY HAS CLIMBED THIS WEEK YET. BE FIRST.' : 'NOBODY IS ON THE BOARD YET.'}</p>}
          {data.loaded && !data.error && list.map((r, k) => {
            const mine = !!(myId && r.id === myId);
            const n = nums(r, tab, gains);
            return (
              <div key={r.id} className={`lb2-row${mine ? ' is-me' : ''}${k % 2 ? ' is-odd' : ''}`} data-rank={r.rank} data-id={r.id}>
                <span className="lb2-rk">{fmt(r.rank)}</span>
                <span className="lb2-who-cell">
                  <span className="lb2-name-line">
                    {mine && <span className="lb2-you">YOU</span>}
                    <span className="lb2-name">{r.username}</span>
                  </span>
                  <Plate row={r} className="lb2-row-plate" />
                </span>
                <Move n={data.moves[r.id] || 0} />
                <span className="lb2-r">{n.r}</span>
                <span className="lb2-lv">{n.lv}</span>
              </div>
            );
          })}
        </div>

        <div className="lb2-panels lb2-slide">
          <div className="lb2-panel lb2-chase">
            {chase ? (
              <>
                <div className="lb2-panel-top">
                  <span className="lb2-need" style={{ color: '#2EFFE0' }}>{fmt(chase.need)}</span>
                  <span className="lb2-unit" data-unit={chaseUnit}>{unitWord(chaseUnit, chase.need)}</span>
                  <span className="lb2-arrow">→</span>
                  <span className="lb2-target">#{fmt(chase.target)}</span>
                </div>
                <div className="lb2-bar"><span className="lb2-fill" style={{ background: '#2EFFE0', width: `${chase.pct}%` }} /><span className="lb2-mark" style={{ left: `${chase.pct}%` }} /></div>
                <div className="lb2-ends"><span>YOU {fromTo(chase.unit, chase.from)}</span><span>#{fmt(chase.target)} {fromTo(chase.unit, chase.to)}</span></div>
              </>
            ) : (
              <div className="lb2-panel-msg">{meRow ? (Number(meRow.rank) === 1 ? 'YOU’RE #1 — HOLD IT' : 'CLIMB TO CHASE') : 'TYPE TO GET ON THE BOARD'}</div>
            )}
          </div>
          <div className="lb2-panel lb2-climb">
            {climb ? (
              <>
                <div className="lb2-panel-top">
                  <span className="lb2-need" style={{ color: '#FFE94A' }}>{fmt(climb.need)}</span>
                  <span className="lb2-unit" data-unit={climb.unit}>{unitWord(climb.unit, climb.need)}</span>
                  <span className="lb2-arrow">→</span>
                  <KitRankPlate rank={climb.next.i} fit shine={false} className="lb2-plate lb2-next" />
                </div>
                <div className="lb2-bar"><span className="lb2-fill" style={{ background: '#FFE94A', width: `${climb.pct}%` }} /><span className="lb2-mark" style={{ left: `${climb.pct}%` }} /></div>
                <div className="lb2-ends"><span>YOU {fromTo(climb.unit, climb.from)}</span><span>{fromTo(climb.unit, climb.to)}</span></div>
              </>
            ) : (
              <div className="lb2-panel-msg">ENDGAME — THE TOP RANK</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
