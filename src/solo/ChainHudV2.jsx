// ChainHudV2.jsx — the SEASON 2 CHAIN HUD (claude/mockups/v2/Chain.dc.html, VERSION B "THE TOWER";
// SEASON2-QUEUE P10 10c): the chain STACKS UP THE LEFT (newest link on top, its join letters lit), the next letter
// HUGE in the middle (the same chromatic LayeredWord stack — today's CHAIN texture — on the wall surface), the
// clock bar + the input under it, and the WINS / WORD column on the right: the live rate, then every factor that
// makes it, each its own line, then what THIS CHAIN has banked.
//
// Presentation only: every number is the live one (chain.js state, the solo clock, perWordRateNow — the same
// factors the payout uses). The mockup's tier ladder (×1…×5 by links) is a placeholder economy and is NOT shipped;
// the ladder here is the real streak heat (juice/ladder.js), which pays nothing and says so by carrying no ×.
// Motion: finite kitPlay one-shots (transform/opacity, REDUCE MOTION skips); nothing loops.
import { useEffect, useRef } from 'react';
import LayeredWord from '../components/LayeredWord';
import { kitPlay } from '../components/kit/motion.js';
import { formatNum, formatRate, formatMultExact } from '../format.js';
import { TIER_THRESHOLDS, LADDER, heatTier } from '../juice/ladder.js';
import './SoloV2.css';
import './ChainHudV2.css';

const FACTOR_LABEL = {
  mode: 'CHAIN MODE',
  rebirth: 'REBIRTH',
  bonus: 'MARK',
  frenzy: 'FRENZY',
  boost: 'BOOST',
  difficulty: 'DIFFICULTY',
  streak: 'STREAK',
  forge: 'FORGE',
};

/** PURE: the per-word rate's multiplier lines — every factor that is not ×1, in payout order. */
export function factorRows(factors) {
  const out = [];
  for (const [k, v] of Object.entries(factors || {})) {
    if (k === 'baseWins' || typeof v !== 'number' || !Number.isFinite(v) || v === 1 || v <= 0) continue;
    out.push({ key: k, label: FACTOR_LABEL[k] || k.toUpperCase(), value: v });
  }
  return out;
}

const LAND = [
  { transform: 'translateY(-26px) scale(1.08)', opacity: 0 },
  { transform: 'translateY(3px) scale(.98)', opacity: 1, offset: 0.6 },
  { transform: 'translateY(0) scale(1)', opacity: 1 },
];
const STAMP = [
  { transform: 'scale(1.5) rotate(-6deg)', opacity: 0 },
  { transform: 'scale(.94) rotate(0deg)', opacity: 1, offset: 0.6 },
  { transform: 'scale(1)', opacity: 1 },
];
const BUMP = [{ transform: 'scale(1)' }, { transform: 'scale(1.18)', offset: 0.4 }, { transform: 'scale(1)' }];

function Link({ word, color, fresh }) {
  const ref = useRef(null);
  useEffect(() => {
    if (fresh) kitPlay(ref.current, LAND, { duration: 300, easing: 'cubic-bezier(.2,1.2,.4,1)' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const w = String(word || '').toUpperCase();
  return (
    <li ref={ref} className="ch2-link" style={{ '--ch2-rar': color || '#a9b4c8' }}>
      <b className="cx-join">{w.slice(0, 1)}</b>
      {w.slice(1, -1)}
      <b className="cx-join">{w.slice(-1)}</b>
    </li>
  );
}

function Letter({ letter, outState, outCap, outHeat }) {
  const ref = useRef(null);
  useEffect(() => {
    kitPlay(ref.current, STAMP, { duration: 320, easing: 'cubic-bezier(.2,1.3,.4,1)' });
  }, [letter]);
  return (
    <div className={`ch2-tile${outState ? ` is-${outState}` : ''}`}>
      <div className="ch2-tile-bar" aria-hidden="true" />
      <div ref={ref} className="solo-center ch2-letter" aria-hidden="true">
        <LayeredWord className="ch2-cl" text={String(letter || '').toUpperCase()} />
      </div>
      <div
        className={`ch2-heat${outHeat >= 0.36 ? ' is-hot' : ''}`}
        style={{ transform: `scaleX(${outHeat || 0})`, opacity: outHeat > 0 ? 1 : 0 }}
        aria-hidden="true"
      />
      {outCap ? <span className="ch2-cap">{outCap}</span> : null}
    </div>
  );
}

function Clock({ remaining, tMax, armed, redZone }) {
  const f = armed ? Math.max(0, Math.min(1, remaining / Math.max(1, tMax))) : 1;
  const secs = Math.max(0, remaining / 1000);
  return (
    <div className={`ch2-clock${redZone ? ' is-red' : ''}`} aria-hidden="true">
      <div className="ch2-clock-track">
        <div className="ch2-clock-fill" style={{ transform: `scaleX(${f})` }} />
      </div>
      <span className="ch2-secs" translate="no">{secs >= 10 ? Math.ceil(secs) : secs.toFixed(1)}</span>
    </div>
  );
}

function Ladder({ streak }) {
  const t = heatTier(streak);
  const steps = [0, ...TIER_THRESHOLDS];
  return (
    <div className="ch2-ladder" aria-label={`Streak ${streak}`}>
      <span className="ch2-ladder-k">
        STREAK <b translate="no">{formatNum(streak)}</b>
        {LADDER[t].label ? <> · {LADDER[t].label}</> : null}
      </span>
      <ol className="ch2-steps" aria-hidden="true">
        {steps.map((at, i) => (
          <li key={at} className={`ch2-step${i <= t ? ' is-on' : ''}${i === t ? ' is-now' : ''}`} style={{ '--ch2-step': LADDER[i].edge || '#a9b4c8' }}>
            {formatNum(at)}+
          </li>
        ))}
      </ol>
    </div>
  );
}

function Pay({ rate, base, factors, winsPill, k }) {
  const ref = useRef(null);
  useEffect(() => {
    if (k > 0) kitPlay(ref.current, BUMP, { duration: 300, easing: 'cubic-bezier(.2,1.4,.4,1)' });
  }, [k]);
  const rows = factorRows(factors);
  return (
    <div className="ch2-pay">
      <span className="ch2-pay-k">WINS / WORD</span>
      <span ref={ref} className="ch2-rate" translate="no">+{formatRate(rate)}</span>
      <ul className="ch2-rows">
        <li className="ch2-row ch2-row--base">
          <b translate="no">{formatRate(base)}</b>
          <span>BASE · 5-LETTER WORD</span>
        </li>
        {rows.map((r) => (
          <li key={r.key} className={`ch2-row ch2-row--${r.key}`}>
            <b translate="no">×{formatMultExact(r.value)}</b>
            <span>{r.label}</span>
          </li>
        ))}
      </ul>
      <div className="ch2-this">
        <span className="ch2-this-k">THIS CHAIN</span>
        {winsPill}
      </div>
    </div>
  );
}

/**
 * The whole play phase. `parts` are SoloShell's pieces ({ exit, form, teach, reason, winsPill, stack }).
 */
export default function ChainHudV2({
  parts, letter, links, rarityOf, k, best, score, clock, streak, outState, outCap, outHeat, rate, supplyNote,
}) {
  const shown = (links || []).slice(-5);
  const last = shown.length ? shown[shown.length - 1].word : '';
  const lastRar = last ? rarityOf(last) : null;
  return (
    <div className="ch2">
      <div className="ch2-left">
        <div className="ch2-exit">{parts.exit}</div>
        <div className="ch2-score">
          <b className="ch2-links-n" translate="no">{formatNum(k)}</b>
          <div className="ch2-score-r">
            <span className="ch2-score-k">LINKS · SCORE {formatNum(score)} · BEST {formatNum(best)}</span>
            <span className="ch2-rar" style={{ '--ch2-rar': (lastRar && lastRar.color) || '#a9b4c8' }}>
              {lastRar ? lastRar.band : 'NO LINK YET'}
            </span>
          </div>
        </div>
        <ol className="ch2-stack" aria-label={`${k} links`}>
          {shown.length ? (
            [...shown].reverse().map((l, i) => {
              const r = rarityOf(l.word);
              return <Link key={`${k - i}-${l.word}`} word={l.word} color={r && r.color} fresh={i === 0} />;
            })
          ) : (
            <li className="ch2-link is-ghost">FIRST LINK</li>
          )}
        </ol>
      </div>
      <div className="ch2-mid">
        <Letter letter={letter} outState={outState} outCap={outCap} outHeat={outHeat} />
        <Clock {...clock} />
        <div className="ch2-type">{parts.form}</div>
        <span className="ch2-hint">TYPE A WORD STARTING WITH <b translate="no">{String(letter || '').toUpperCase()}</b></span>
        {supplyNote ? <div className="ch2-supply">{supplyNote}</div> : null}
        {parts.reason}
        {parts.teach}
        <Ladder streak={streak} />
      </div>
      <div className="ch2-right">
        <Pay rate={rate.rate} base={rate.base} factors={rate.factors} winsPill={parts.winsPill} k={k} />
      </div>
    </div>
  );
}
