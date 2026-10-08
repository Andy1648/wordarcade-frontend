// StatsV2.jsx — THE v2 STATS SCREEN (claude/mockups/v2/Stats.dc.html; SEASON2 only, P8).
//
// LAZY, its own chunk: StatsScreen renders it in place of the live STATS panel only while the SEASON2 flag is on (live
// players see the old panel, untouched, until the flip). Balatro-style: the TOTAL multiplier FIRST (huge), "=" the pay
// it makes, then the CHAIN of chips that builds it — BASE, then one chip per multiplier — and the ALL TIME strip.
//   * TABS: WINS (WINS / WORD) and XP (XP / LETTER), each tab carrying its own total.
//   * REPLAY: tapping the TOTAL replays the chain — the total counts up chip by chip (a tick names each multiplier as
//     it lands), then slams; a big total shakes the stage. FINITE: a fixed list of timeouts, cleared on unmount / tab.
//   * REAL NUMBERS: progress/statBoard.js statChain() over statBoard() — BASE × every chip = the TOTAL the game pays
//     (statBoard.test.js; statChain.s2.test.js pins the season-2 split REBIRTH 2^R · ASCEND (1 + ★)).
//   * ALL TIME: words · letters · rolls · rebirths · best daily streak. Its label cell opens the full panel (records,
//     collection, backup, reset) — the v2 board does not drop any of the live panel's tools.
// Motion: transform / opacity one-shots through the kit (kitPlay — will-change on for the effect only); nothing loops
// at rest; REDUCE MOTION shows the finished chain at once and plays nothing.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import './kit/tokens.css';
import './StatsV2.css';
import { kitPlay } from './kit/motion.js';
import { reduceMotion } from '../lib/reduceMotion.js';
import { V3 } from '../progress/season';
import { statBoard, statChain, boardMult, BOARD_MODE, BOARD_MODE_NAMES } from '../progress/statBoard';
import { getKeyTier, getRebirths } from '../progress/xp';
import { getLetters } from '../progress/letters';
import { loadRollState, wornMarkId, markEntry, markBaseXp } from '../progress/markRollsCore';
import { readRecords } from '../progress/records';
import { MASTERY_MODES, masteryWords } from '../progress/mastery';
import { useMomentHold } from '../lib/useMomentSlot';
import { formatNum, formatStatRate as rateText } from '../format';

const fmt = (n) => formatNum(Number.isFinite(n) ? n : 0);
const xText = (v) => `×${boardMult(v)}`;

// The mockup's per-board look: the tab / total colour, the unit and the BASE icon.
const BOARDS = {
  wins: { name: 'WINS', unit: 'WINS / WORD', color: '#FFE94A', baseIcon: 'coin' },
  xp: { name: 'XP', unit: 'XP / LETTER', color: '#2EFFE0', baseIcon: 'keycap' },
};
// Each multiplier's colour (the mockup's `c`).
const CHIP_COLOR = { mode: '#FF6B3D', rebirth: '#D88BFF', mark: '#B04BFF', index: '#B04BFF', boost: '#FF3D7F', ascend: '#FFE94A', power: '#FFC23D', shop: '#2EFFE0' };
// Chips without art of their own borrow the closest kit icon (MODE → the keycap, INDEX → the mark plate).
const CHIP_ICON = { mode: 'keycap', index: 'mark' };
const GREY = '#5d4a78';

/** Both chains + the ALL TIME numbers, read fresh from the save. */
function readBoards() {
  const stars = V3.store ? V3.store.getStarsV3() : 0;
  const rc = getRebirths() || 0;
  const kt = getKeyTier() || 0;
  let markName = 'NONE';
  try {
    const id = wornMarkId();
    const e = id ? markEntry(id) : null;
    if (e && e.name) markName = String(e.name).toUpperCase();
  } catch {
    /* no mark */
  }
  const board = statBoard();
  const boostOn = (board.wins.lines.find((l) => l.id === 'boost') || { mult: 1 }).mult > 1;
  const tags = {
    mode: BOARD_MODE_NAMES[BOARD_MODE],
    index: 'MARKS',
    rebirth: `R${fmt(rc)}`,
    mark: markName,
    boost: boostOn ? 'ON' : 'OFF',
    ascend: `${fmt(stars)} ${stars === 1 ? 'STAR' : 'STARS'}`,
    power: `TIER ${fmt(kt)}`, // POWER's tier — never "LV" (that reads as the player's level)
    shop: 'STOCK',
  };
  const opts = { v3: V3.ready ? V3 : null, stars, markBaseXp: markBaseXp(), tags };
  return { wins: statChain(board.wins, opts), xp: statChain(board.xp, opts) };
}

function readLife() {
  let words = 0;
  for (const m of MASTERY_MODES) words += masteryWords(m) || 0;
  let rolls = 0;
  try {
    const s = loadRollState();
    rolls = s && Number.isFinite(s.rolls) ? s.rolls : 0;
  } catch {
    rolls = 0;
  }
  const rec = readRecords();
  return [
    { k: 'WORDS', v: words, c: '#FFE94A' },
    { k: 'LETTERS', v: getLetters(), c: '#2EFFE0' },
    { k: 'ROLLS', v: rolls, c: '#B04BFF' },
    { k: 'REBIRTHS', v: getRebirths() || 0, c: '#D88BFF' },
    { k: 'BEST STREAK', v: rec.longestStreak || 0, c: '#FF3D7F' },
  ];
}

/** The mockup's chip icons (vector, verbatim from Stats.dc.html). `c` = the icon's fill. */
function ChipIcon({ kind, c }) {
  let body = null;
  switch (kind) {
    case 'coin':
      body = (
        <>
          <circle cx="20" cy="20" r="16" fill={c} />
          <circle cx="20" cy="20" r="10" fill="none" strokeWidth="2.5" />
          <path d="M20 14 L20 26 M16 17 L24 17 M16 23 L24 23" strokeWidth="2.5" />
          <path d="M9 13 A13 13 0 0 1 15 7" stroke="#fff" strokeWidth="2.5" fill="none" />
        </>
      );
      break;
    case 'keycap':
      body = (
        <>
          <rect x="4" y="5" width="32" height="31" rx="3" fill={c} />
          <rect x="9" y="8" width="22" height="20" rx="2" fill="#fff" strokeWidth="2.5" />
          <path d="M14 24 L20 12 L26 24 M16.5 20 L23.5 20" strokeWidth="3" fill="none" />
        </>
      );
      break;
    case 'rebirth':
      body = (
        <>
          <path d="M28.4 12.9 A11 11 0 1 0 30.8 21.9" fill="none" strokeWidth="10" />
          <path d="M28.4 12.9 A11 11 0 1 0 30.8 21.9" fill="none" stroke={c} strokeWidth="4.5" strokeLinecap="butt" />
          <path d="M32.5 13 L25.4 23.4 L37 24.6 Z" fill={c} />
          <circle cx="20" cy="20" r="3.5" fill="#fff" strokeWidth="2.5" />
        </>
      );
      break;
    case 'power':
      body = (
        <g transform="rotate(-30 20 20)">
          <rect x="18" y="17" width="20" height="7" fill={c} />
          <rect x="29" y="23" width="4" height="7" fill={c} />
          <rect x="34" y="23" width="4" height="5" fill={c} />
          <circle cx="11" cy="20" r="9" fill={c} />
          <circle cx="11" cy="20" r="3.5" fill="#0d0618" strokeWidth="2.5" />
          <path d="M5 16 A7 7 0 0 1 9 12.5" stroke="#fff" strokeWidth="2.5" fill="none" />
        </g>
      );
      break;
    case 'mark':
      body = (
        <>
          <path d="M20 2 L36 11 L36 29 L20 38 L4 29 L4 11 Z" fill={c} />
          <path d="M20 8 L31 14 L31 26 L20 32 L9 26 L9 14 Z" fill="#2a0e4a" strokeWidth="2.5" />
          <path d="M13.5 25 L13.5 15.5 L17 19.5 L20 13.5 L23 19.5 L26.5 15.5 L26.5 25 Z" fill="#FFE94A" strokeWidth="2.5" />
        </>
      );
      break;
    case 'boost':
    case 'shop':
      body = (
        <>
          <rect x="15" y="8" width="10" height="9" fill="#3a2160" />
          <circle cx="20" cy="26" r="12" fill="#3a2160" />
          <path d="M8.6 28.5 A12 12 0 0 0 31.4 28.5 Z" fill={c} stroke="none" />
          <circle cx="20" cy="26" r="12" fill="none" />
          <rect x="13" y="3" width="14" height="6" rx="1" fill="#c9b8e8" />
          <circle cx="15.5" cy="22" r="2.2" fill="#fff" stroke="none" />
          <circle cx="23" cy="31" r="1.6" fill="#fff" stroke="none" />
        </>
      );
      break;
    case 'ascend':
      body = (
        <>
          <path d="M20 3 L24.3 14.8 L36.6 15.4 L26.9 23.1 L30.3 35 L20 28.2 L9.7 35 L13.1 23.1 L3.4 15.4 L15.7 14.8 Z" fill={c} />
          <path d="M14.5 24 L20 18.5 L25.5 24" fill="none" strokeWidth="3.5" />
        </>
      );
      break;
    default:
      body = null;
  }
  return (
    <svg className="st2-icon" viewBox="0 0 40 40" width="44" height="44" aria-hidden="true" focusable="false">
      <g stroke="#000" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round">{body}</g>
    </svg>
  );
}

// The replay's one-shots (transform / opacity only; the mockup's keyframes).
const BOUNCE = 'cubic-bezier(.2,1.5,.4,1)';
const bumpFx = (dir) => [{ transform: 'scale(1)' }, { transform: `scale(1.09) rotate(${dir * 1.5}deg)`, offset: 0.35 }, { transform: 'scale(1)' }];
const SLAM = [{ transform: 'scale(1.5)' }, { transform: 'scale(.94)', offset: 0.55 }, { transform: 'scale(1)' }];
const HIT = [{ transform: 'translateY(0) scale(1)' }, { transform: 'translateY(-16px) scale(1.08) rotate(-2deg)', offset: 0.4 }, { transform: 'translateY(0) scale(1)' }];
const TICK = [
  { transform: 'translateY(14px) scale(.6) rotate(5deg)', opacity: 0 },
  { transform: 'translateY(-3px) scale(1.1) rotate(5deg)', opacity: 1, offset: 0.6 },
  { transform: 'translateY(0) scale(1) rotate(5deg)', opacity: 1 },
];
const SHAKE_M = [{ transform: 'translate(0,0)' }, { transform: 'translate(-4px,2px)', offset: 0.25 }, { transform: 'translate(4px,-3px)', offset: 0.5 }, { transform: 'translate(-2px,-2px)', offset: 0.75 }, { transform: 'translate(0,0)' }];
const SHAKE_L = [
  { transform: 'translate(0,0)' },
  { transform: 'translate(-9px,5px) rotate(-.6deg)', offset: 0.2 },
  { transform: 'translate(8px,-6px) rotate(.6deg)', offset: 0.4 },
  { transform: 'translate(-5px,-4px)', offset: 0.6 },
  { transform: 'translate(4px,5px)', offset: 0.8 },
  { transform: 'translate(0,0)' },
];

/** The stage scale: the 1366×657 mockup, fit to the window (measured on mount / resize only — never per frame). */
function useStageScale(ref) {
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.innerWidth < 700);
  useLayoutEffect(() => {
    const set = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const k = w >= 700 ? Math.max(0.6, Math.min(1.7, Math.min((w - 8) / 1366, h / 657))) : 1;
      if (ref.current) ref.current.style.setProperty('--st2-k', k.toFixed(4));
      setNarrow(w < 700);
    };
    set();
    window.addEventListener('resize', set);
    return () => window.removeEventListener('resize', set);
  }, [ref]);
  return narrow;
}

export default function StatsV2({ onBack, onMore }) {
  useMomentHold(true); // no queued moment starts under this screen
  const rootRef = useRef(null);
  const stageRef = useRef(null);
  const heroRef = useRef(null);
  const boxRef = useRef(null);
  const tickRef = useRef(null);
  const chipRefs = useRef([]);
  const timers = useRef([]);
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;
  const narrow = useStageScale(rootRef);

  const [boards] = useState(readBoards);
  const [life] = useState(readLife);
  const [tab, setTab] = useState('wins');
  // the replay: idx = chips landed (after BASE), cur = the running multiplier, done = slammed
  const [play, setPlay] = useState({ idx: 0, cur: 1, done: false });

  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms));

  const run = useCallback((key) => {
    clear();
    setTab(key);
    const b = boards[key];
    const n = b.chips.length;
    if (reduceMotion()) {
      setPlay({ idx: n, cur: b.mult, done: true }); // REDUCE MOTION: the finished chain, nothing plays
      return;
    }
    setPlay({ idx: 0, cur: 1, done: false });
    let at = 420;
    let prod = 1;
    b.chips.forEach((m, i) => {
      const from = prod;
      const to = prod * m.mult;
      prod = to;
      later(() => {
        setPlay((p) => ({ ...p, idx: i + 1 }));
        kitPlay(boxRef.current, bumpFx(i % 2 ? 1 : -1), { duration: 280, easing: BOUNCE });
        if (m.mult > 1) {
          kitPlay(chipRefs.current[i + 1], HIT, { duration: 400, easing: BOUNCE });
          kitPlay(tickRef.current, TICK, { duration: 300, easing: 'cubic-bezier(.2,1.4,.4,1)' });
        }
      }, at);
      if (m.mult > 1) {
        const F = 9;
        for (let f = 1; f <= F; f++) later(() => setPlay((p) => ({ ...p, cur: from * Math.pow(to / from, f / F) })), at + f * 38);
        at += 560;
      } else {
        at += 240;
      }
    });
    // the end: exactly the paid multiplier (TOTAL / BASE — the product above can differ by the payout's rounding)
    later(() => {
      setPlay({ idx: n, cur: b.mult, done: true });
      kitPlay(boxRef.current, SLAM, { duration: 420, easing: 'cubic-bezier(.2,1.3,.4,1)' });
      kitPlay(heroRef.current, b.mult >= 1000 ? SHAKE_L : SHAKE_M, { duration: b.mult >= 1000 ? 420 : 300, easing: 'linear' });
    }, at + 60);
  }, [boards]);

  useEffect(() => {
    run('wins');
    rootRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') onBackRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      clear();
    };
  }, [run]);

  const look = BOARDS[tab];
  const b = boards[tab];
  const n = b.chips.length;
  const last = play.idx > 0 && !play.done ? b.chips[play.idx - 1] : null;
  const showTick = !!last && last.mult > 1;
  const totalText = xText(play.cur);
  const resultText = rateText(play.done ? b.total : b.base * play.cur);
  const compact = n > 4; // six chips or more: tighter gaps so the chain still fits one row

  const chips = [
    { id: 'base', label: 'BASE', tag: look.name, v: rateText(b.base), on: true, icon: look.baseIcon, c: '#fff', ic: look.color },
    ...b.chips.map((m) => ({ id: m.id, label: m.label, tag: m.tag, v: xText(m.mult), on: m.mult > 1, icon: CHIP_ICON[m.id] || m.id, c: CHIP_COLOR[m.id] || '#fff', ic: CHIP_COLOR[m.id] || '#fff' })),
  ];

  return (
    <div
      className={`st2${narrow ? ' st2--narrow' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="STATS"
      tabIndex={-1}
      ref={rootRef}
      style={{ '--st2-c': look.color }}
    >
      <div className="st2-stripes" aria-hidden="true" />
      <div className="st2-stage" ref={stageRef}>
        <header className="st2-head">
          <button type="button" className="st2-back" onClick={onBack} aria-label="Back to menu">← MENU</button>
          <h2 className="st2-title">STATS</h2>
          <div className="st2-tabs" role="tablist" aria-label="Stat boards">
            {['wins', 'xp'].map((key) => {
              const B = BOARDS[key];
              const on = key === tab;
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  data-tab={key}
                  className={`st2-tab${on ? ' is-on' : ''}`}
                  style={{ '--tab-c': B.color }}
                  onClick={() => run(key)}
                >
                  <span className="st2-tab-name">{B.name}</span>
                  <span className="st2-tab-total">{xText(boards[key].mult)}</span>
                </button>
              );
            })}
          </div>
        </header>

        <div className="st2-hero" ref={heroRef}>
          <div className="st2-totalwrap">
            <span className="st2-total-k">TOTAL</span>
            <button type="button" className="st2-big" data-juice-self onClick={() => run(tab)} aria-label="Replay multiplier" title="REPLAY">
              <span className="st2-box" ref={boxRef}>
                <span className="st2-box-lip" aria-hidden="true" />
                <span className="st2-total" data-testid="st2-total" style={{ '--len': Math.max(4, totalText.length) }}>{totalText}</span>
              </span>
            </button>
            <span className="st2-tick" ref={tickRef} style={{ opacity: showTick ? 1 : 0, '--tick-c': last ? CHIP_COLOR[last.id] || '#fff' : '#fff' }} aria-hidden="true">
              <span className="st2-tick-name">{last ? last.label : ''}</span>
              <span className="st2-tick-v">{last ? xText(last.mult) : ''}</span>
            </span>
          </div>
          <span className="st2-eq" aria-hidden="true">=</span>
          <div className="st2-result">
            <span className="st2-result-v" data-testid="st2-result" style={{ '--len': Math.max(4, resultText.length) }}>{resultText}</span>
            <div className="st2-result-sub">
              <span className="st2-unit">{look.unit}</span>
              <span className="st2-basex">BASE {rateText(b.base)} × {boardMult(b.mult)}</span>
            </div>
          </div>
        </div>

        <div className={`st2-chain${compact ? ' is-compact' : ''}`} style={{ '--n': chips.length }}>
          <div className="st2-rail" aria-hidden="true">
            <span className="st2-rail-fill" style={{ transform: `scaleX(${n ? play.idx / n : 1})` }} />
          </div>
          {chips.map((r, j) => {
            const reached = j === 0 || play.idx >= j;
            const lit = r.on;
            return (
              <div className="st2-cell" key={r.id}>
                {j > 0 && (
                  <span className="st2-x" aria-hidden="true" style={{ color: play.idx >= j ? (lit ? look.color : GREY) : '#2a1a40' }}>
                    <span>
                      <span>×</span>
                    </span>
                  </span>
                )}
                <div
                  className={`st2-chip${lit ? '' : ' is-off'}`}
                  data-chip={r.id}
                  ref={(el) => {
                    chipRefs.current[j] = el;
                  }}
                  style={{ opacity: reached ? 1 : 0.35, '--chip-c': lit ? r.c : GREY, '--edge-c': j === 0 ? '#fff' : lit ? r.c : '#2a1a40' }}
                >
                  <div className="st2-chip-top">
                    <span className="st2-chip-tile" aria-hidden="true">
                      <ChipIcon kind={r.icon} c={lit ? r.ic : GREY} />
                    </span>
                    <span className="st2-chip-names">
                      <span className="st2-chip-name">{r.label}</span>
                      <span className="st2-chip-tag">{r.tag}</span>
                    </span>
                  </div>
                  <span className="st2-chip-v">{r.v}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="st2-life" role="group" aria-label="All time">
          <button type="button" className="st2-life-k" onClick={onMore} aria-label="All time — records, collection, backup">
            <span>ALL</span>
            <span>TIME</span>
            <span className="st2-life-more">MORE ›</span>
          </button>
          {life.map((l) => (
            <div className="st2-life-cell" key={l.k}>
              <span className="st2-life-v" style={{ color: l.c }}>{fmt(l.v)}</span>
              <span className="st2-life-l">{l.k}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
