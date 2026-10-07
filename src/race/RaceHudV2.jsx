// RaceHudV2.jsx — the SEASON 2 WORD RACE board (claude/mockups/v2/Race.dc.html, VERSION A; SEASON2-QUEUE P10 10e):
// the RACE card's pink track stretched into one lane per racer — a name plate (colour tile, name, n/N) and a car that
// drives toward the checkered finish as its racer's words land — then under it the WPM box, the WORD tile (the word you
// are on, HUGE, each letter coloured as you type it: right = yellow, wrong = pink, still to type = lavender) and the
// NEXT queue. ENTIRE WORDS only (race.variant 'words') — the fragment variant keeps the live board.
//
// Presentation only: positions are the server's race_progress indices (raceState.js), placings the server's standings.
// The WPM / ACC are this client's own typing, measured locally (display only, never sent).
// Motion: a car slides (transform, 300 ms) when its racer scores — event-driven, finite; the countdown number pops
// once per second (kitPlay). Nothing loops. REDUCE MOTION: cars jump, nothing pops.
import { useEffect, useRef } from 'react';
import { kitPlay } from '../components/kit/motion.js';
import { formatNum } from '../format';
import './RaceHudV2.css';

// Cars must read on the PINK track, so the race keeps its own palette (the room palette leads with pink).
export const CAR_COLORS = ['#B04BFF', '#2EFFE0', '#3D8BFF', '#A9B4C8', '#FF6B3D', '#5CFF8A', '#FFFFFF'];
const ME_COLOR = '#FFE94A';

/** PURE: a stable car colour per racer — mine is yellow, the field takes the palette in lane order. */
export function carColors(racers, myId) {
  const out = {};
  let k = 0;
  for (const r of racers || []) {
    if (r.id === myId) out[r.id] = ME_COLOR;
    else { out[r.id] = CAR_COLORS[k % CAR_COLORS.length]; k += 1; }
  }
  return out;
}

/** PURE: per-letter states for the word tile — 'ok' | 'bad' | 'todo', plus the caret index. */
export function letterStates(word, typed) {
  const w = String(word || '');
  const t = String(typed || '').toLowerCase();
  const letters = w.split('').map((ch, i) => ({ ch: ch.toUpperCase(), s: t[i] == null ? 'todo' : t[i] === ch.toLowerCase() ? 'ok' : 'bad' }));
  const extra = t.length > w.length ? t.slice(w.length).toUpperCase() : '';
  return { letters, extra, caret: Math.min(t.length, w.length) };
}

function RaceCar({ color, num }) {
  return (
    <svg className="rc2-car-svg" viewBox="0 0 104 48" aria-hidden="true">
      <path d="M8 34 L16 21 L42 17 L56 9 L76 9 L84 18 L98 22 L98 36 L8 38 Z" fill="#000" transform="translate(4 4)" />
      <path d="M4 13 L18 13 L18 19 L4 19 Z M10 19 L12 25" fill={color} stroke="#000" strokeWidth="3.5" strokeLinejoin="round" />
      <path d="M8 34 L16 21 L42 17 L56 9 L76 9 L84 18 L98 22 L98 36 L8 38 Z" fill={color} stroke="#000" strokeWidth="4.5" strokeLinejoin="round" />
      <path d="M56 12 L74 12 L80 19 L54 20 Z" fill="#1a0b2e" stroke="#000" strokeWidth="3" strokeLinejoin="round" />
      <path d="M60 14 L66 14" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M20 23 L42 20" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity=".85" />
      <circle cx="40" cy="28" r="10" fill="#fff" stroke="#000" strokeWidth="3" />
      <text x="40" y="33" textAnchor="middle" fontFamily="Bungee, sans-serif" fontSize="14" fill="#000">{num}</text>
      <circle cx="26" cy="38" r="9" fill="#000" />
      <circle cx="26" cy="38" r="4" fill="#c9b8e8" />
      <circle cx="80" cy="38" r="9" fill="#000" />
      <circle cx="80" cy="38" r="4" fill="#c9b8e8" />
    </svg>
  );
}

/** The checkered finish — an SVG pattern (flat squares), never a CSS gradient. */
function Checks({ className, cell }) {
  const id = `rc2chk-${cell}`;
  return (
    <svg className={className} aria-hidden="true" preserveAspectRatio="xMinYMin slice" viewBox={`0 0 ${cell * 2} ${cell * 40}`}>
      <defs>
        <pattern id={id} width={cell * 2} height={cell * 2} patternUnits="userSpaceOnUse">
          <rect width={cell * 2} height={cell * 2} fill="#fff" />
          <rect width={cell} height={cell} fill="#000" />
          <rect x={cell} y={cell} width={cell} height={cell} fill="#000" />
        </pattern>
      </defs>
      <rect width={cell * 2} height={cell * 40} fill={`url(#${id})`} />
    </svg>
  );
}

function ordinal(n) {
  const s = ['TH', 'ST', 'ND', 'RD'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

/** The track: one lane per racer. `places` (id → place) only once the server's standings are in. */
export function RaceTrackV2({ racers, myId, target, places }) {
  const colors = carColors(racers, myId);
  return (
    <div className="rc2-track" style={{ '--n': Math.max(1, racers.length) }}>
      <svg className="rc2-field" viewBox="0 0 1310 278" preserveAspectRatio="none" aria-hidden="true">
        <path d="M212 120 L1270 40 L1270 210 L212 278 Z" fill="#E23A8C" />
        <g stroke="#FFE94A" strokeWidth="7" strokeLinecap="round" opacity=".55">
          <path d="M230 28 L330 20" />
          <path d="M560 250 L640 244" />
          <path d="M900 30 L960 26" />
        </g>
      </svg>
      <ol className="wr-lanes rc2-lanes" aria-label="Race lanes">
        {racers.map((r, i) => {
          const isMe = r.id === myId;
          const p = Math.max(0, Math.min(1, (r.index || 0) / Math.max(1, target)));
          const place = places ? places[r.id] : null;
          const done = (r.index || 0) >= target;
          return (
            <li
              key={r.id}
              className={`wr-lane rc2-lane${isMe ? ' is-me' : ''}${r.left ? ' is-left' : ''}`}
              data-racer-id={r.id}
              data-racer-index={r.index}
              style={{ '--c': colors[r.id] }}
            >
              <span className="rc2-plate">
                <span className="rc2-init" aria-hidden="true">{String(r.name || '?').slice(0, 1).toUpperCase()}</span>
                <span className="rc2-name" translate="no">{r.name}</span>
                {r.isBot ? <span className="rc2-tag">BOT</span> : null}
                {r.left ? <span className="rc2-tag">LEFT</span> : null}
                <span className="rc2-count" translate="no">{formatNum(r.index || 0)}/{formatNum(target)}</span>
              </span>
              <span className="rc2-road">
                <span className="rc2-run" style={{ transform: `translateX(${(p * 100).toFixed(2)}%)` }}>
                  <span className="rc2-car">
                    {isMe ? <span className="rc2-you">YOU</span> : null}
                    <RaceCar color={colors[r.id]} num={i + 1} />
                  </span>
                </span>
                {place ? <span className={`rc2-place rc2-place--${Math.min(place, 4)}`}>{ordinal(place)}</span> : done ? <span className="rc2-place rc2-place--done">DONE</span> : null}
              </span>
            </li>
          );
        })}
      </ol>
      <Checks className="rc2-finish" cell={20} />
    </div>
  );
}

const POP = [{ transform: 'scale(1.6)', opacity: 0 }, { transform: 'scale(.92)', opacity: 1, offset: 0.6 }, { transform: 'scale(1)', opacity: 1 }];

function Count({ n }) {
  const ref = useRef(null);
  useEffect(() => {
    kitPlay(ref.current, POP, { duration: 420, easing: 'cubic-bezier(.2,1.3,.4,1)' });
  }, [n]);
  return <span ref={ref} className="wr-count rc2-count-n">{n}</span>;
}

/**
 * The bottom row: WPM box · WORD tile (with the real input laid over it) · NEXT queue.
 * `form` is WordRaceScreen's own <form> (input + SEND) so every keystroke path stays where it was.
 */
export function RaceDeckV2({ counting, goIn, finished, word, typed, index, target, upcoming, wpm, acc, form, toast, earn, extra }) {
  const st = letterStates(word, typed);
  const len = Math.max(1, (word || '').length);
  return (
    <div className="rc2-deck">
      <div className="rc2-wpm" aria-label={`${wpm} words per minute`}>
        <b translate="no">{formatNum(wpm)}</b>
        <span className="rc2-wpm-k">WPM</span>
        <span className="rc2-acc" translate="no">{acc == null ? '—' : `${formatNum(acc)}%`} ACC</span>
      </div>
      <div className="rc2-tile-wrap">
        <div className="rc2-tile-back" aria-hidden="true" />
        <div className="rc2-tile wr-hero" aria-live="polite">
          {extra}
          <span className="rc2-prog" translate="no">{formatNum(Math.min(index + 1, target))}/{formatNum(target)}</span>
          {counting ? (
            <Count n={Math.ceil(goIn / 1000)} />
          ) : finished ? (
            <span className="wr-hero-done rc2-done">FINISHED — WAITING ON THE FIELD</span>
          ) : word ? (
            <>
              <span className="wr-sr">Type the word {word}</span>
              <span className="rc2-word wr-typeword" aria-hidden="true" style={{ '--len': len }} translate="no">
                {st.letters.map((l, i) => (
                  <span key={i} className={`wr-tl rc2-l is-${l.s}${i === st.caret && !st.extra ? ' is-caret' : ''}`}>{l.ch}</span>
                ))}
                {st.extra ? <span className="wr-tl rc2-l is-bad">{st.extra}</span> : null}
              </span>
            </>
          ) : null}
          <div className="rc2-form">{form}</div>
        </div>
      </div>
      <div className="rc2-next" aria-label="Next words">
        {upcoming.map((w, i) => (
          <span key={`${index}-${i}`} className="rc2-up" style={{ '--k': i }}>
            <i>{formatNum(index + i + 2)}</i>
            <span className="wr-up" translate="no">{w.toUpperCase()}</span>
          </span>
        ))}
        {index + 1 + upcoming.length >= target && !finished ? (
          <span className="rc2-up rc2-up--flag"><Checks className="rc2-flag" cell={5} />FINISH</span>
        ) : null}
      </div>
      <div className="rc2-under">
        {toast}
        {earn}
      </div>
    </div>
  );
}
