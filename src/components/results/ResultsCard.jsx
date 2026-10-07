// results/ResultsCard.jsx — the v2 RESULTS / K.O. card (claude/mockups/v2/Results.dc.html; SEASON2-QUEUE 9b):
// "one big placement, tally counts up line by line, the multiplier chain shown once, PLAY AGAIN big. Every win credited
// must appear as its own line (no unexplained wins). Replaces the old 'where your wins came from' breakdown."
//
//   HERO      the placement, huge (#1 / #3/6), a WIN · TOP 3 · KO'D stamp, the trophy / medal / skull (SVG art), the best
//             word; on a loss the PAUSE-TO-LEARN hold (a word that would have worked) sits under it.
//   TALLY     WORDS · LETTERS → +XP (LV bar, "LV +N") → WINS: BASE × ×M = +N with the chain chips → one line per bonus
//             (WINNER BONUS ×1.5, SECRET FIND, …) → +GEMS → TOTAL WINS. Lines reveal in turn and count up.
//   PLAYERS   the table by placement, YOU marked.
//   EXITS     MENU + a big PLAY AGAIN (the old REMATCH / LEAVE: same handlers, same pending state).
//
// DISPLAY ONLY: every number is one the game already paid (resultsModel.js). The count-up is ONE rAF loop writing
// textContent (no React render per frame); reveals are finite WAAPI one-shots (kit/motion.js — transform/opacity,
// will-change only while playing). REDUCE MOTION lands every line at its final value at once. A tap on the card
// fast-forwards. Nothing loops (the mockup's spinning rays, glowing own row and pulsing button are one-shots here).
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { formatNum, formatMultExact } from '../../format';
import { kitPlay } from '../kit/motion.js';
import { reduceMotion } from '../../lib/reduceMotion';
import { GemIcon, GemsEarnedLine, useGems } from '../gems/Gems';
import { tallyLines, chainOf, stampFor } from './resultsModel.js';
import '../kit/tokens.css';
import './ResultsCard.css';

const mx = (m) => `×${formatMultExact(m)}`;
const CHIP_TONES = ['#D88BFF', '#FFC23D', '#2EFFE0', '#FF3D7F', '#FFE94A', '#B04BFF'];

// timeline (ms) — the mockup's beats, compressed a little
const T = { stats: 350, xp: 900, wins: 1900, step: 520, count: 520 };
// reveals come in from ABOVE / the LEFT: a transform below the card's bottom edge would count as scrollable overflow
// for the length of the animation (the card must never scroll, even mid-tally)
const RISE = [{ transform: 'translateY(-22px)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }];
const SLAM = [{ transform: 'scale(1.8) rotate(-8deg)', opacity: 0 }, { transform: 'scale(.88) rotate(-2deg)', opacity: 1, offset: 0.55 }, { transform: 'scale(1.06) rotate(-3deg)', offset: 0.75 }, { transform: 'scale(1) rotate(-3deg)', opacity: 1 }];
const STAMP = [{ transform: 'scale(2) rotate(4deg)', opacity: 0 }, { transform: 'scale(.9) rotate(-14deg)', opacity: 1, offset: 0.6 }, { transform: 'scale(1) rotate(-12deg)', opacity: 1 }];
const DROP = [{ transform: 'translateY(-90px) rotate(-14deg)', opacity: 0 }, { transform: 'translateY(8px) rotate(4deg)', opacity: 1, offset: 0.6 }, { transform: 'translateY(-4px) rotate(-2deg)', offset: 0.8 }, { transform: 'translateY(0) rotate(0)', opacity: 1 }];
const CHIP = [{ transform: 'scale(0) rotate(-10deg)', opacity: 0 }, { transform: 'scale(1.3) rotate(4deg)', opacity: 1, offset: 0.6 }, { transform: 'scale(1) rotate(0)', opacity: 1 }];
const POP = [{ transform: 'translateY(-20px) scale(.3) rotate(-12deg)', opacity: 0 }, { transform: 'translateY(-8px) scale(1.35) rotate(4deg)', opacity: 1, offset: 0.3 }, { transform: 'translateY(-4px) scale(1) rotate(-6deg)', opacity: 1 }];
// LAND / PULSE never push DOWN past where the node rests (the card must not scroll even mid-animation: a transform
// below the bottom edge is scroll overflow) — up and in only; the PLAY AGAIN pulse grows from its bottom edge.
const LAND = [{ transform: 'translate(0,0)' }, { transform: 'translate(-4px,-6px) scale(1.02)', offset: 0.35 }, { transform: 'translate(0,0) scale(1)' }];
const PULSE = [{ transform: 'scale(1)' }, { transform: 'scale(1.05)', offset: 0.5 }, { transform: 'scale(1)' }];
const SLIDE = [{ transform: 'translateX(-40px)', opacity: 0 }, { transform: 'translateX(0)', opacity: 1 }];
const eo = (k) => 1 - Math.pow(1 - k, 3);

function Trophy() {
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true" focusable="false">
      <path d="M30 26 C6 26 6 64 36 66" fill="none" stroke="#000" strokeWidth="13" strokeLinecap="round" />
      <path d="M90 26 C114 26 114 64 84 66" fill="none" stroke="#000" strokeWidth="13" strokeLinecap="round" />
      <path d="M30 26 C6 26 6 64 36 66" fill="none" stroke="#F2A900" strokeWidth="5" strokeLinecap="round" />
      <path d="M90 26 C114 26 114 64 84 66" fill="none" stroke="#F2A900" strokeWidth="5" strokeLinecap="round" />
      <path d="M54 76 H66 L70 92 H50 Z" fill="#F2A900" stroke="#000" strokeWidth="5" strokeLinejoin="round" />
      <path d="M28 18 H92 V42 C92 64 78 78 60 78 C42 78 28 64 28 42 Z" fill="#FFC23D" stroke="#000" strokeWidth="5" strokeLinejoin="round" />
      <path d="M76 21 H89 V42 C89 60 80 72 68 75 C76 64 80 54 80 42 Z" fill="#F2A900" />
      <rect x="20" y="10" width="80" height="12" fill="#FFE94A" stroke="#000" strokeWidth="5" strokeLinejoin="round" />
      <path d="M60 33 L64.5 42 L74 43 L67 49.5 L69 59 L60 54 L51 59 L53 49.5 L46 43 L55.5 42 Z" fill="#FFE94A" stroke="#000" strokeWidth="3.5" strokeLinejoin="round" />
      <path d="M36 28 V42 C36 50 39 57 44 62" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
      <rect x="34" y="92" width="52" height="18" fill="#FFC23D" stroke="#000" strokeWidth="5" strokeLinejoin="round" />
      <rect x="46" y="97" width="28" height="7" fill="#000" />
    </svg>
  );
}
function Medal({ place }) {
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true" focusable="false">
      <path d="M30 4 L52 52 L38 58 L14 10 Z" fill="#FF3D7F" stroke="#000" strokeWidth="5" strokeLinejoin="round" />
      <path d="M90 4 L68 52 L82 58 L106 10 Z" fill="#B04BFF" stroke="#000" strokeWidth="5" strokeLinejoin="round" />
      <path d="M24 12 L36 38" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity=".7" />
      <circle cx="60" cy="80" r="34" fill="#D88BFF" stroke="#000" strokeWidth="5" />
      <path d="M60 46 A34 34 0 0 1 94 80 A34 34 0 0 1 60 114 Z" fill="#B04BFF" opacity=".55" />
      <circle cx="60" cy="80" r="23" fill="#B04BFF" stroke="#000" strokeWidth="4" />
      <text x="60" y="93" textAnchor="middle" fontFamily="Bungee, sans-serif" fontSize="34" fill="#fff" stroke="#000" strokeWidth="5" paintOrder="stroke">{place}</text>
      <path d="M36 70 A26 26 0 0 1 50 54" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}
function Skull() {
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true" focusable="false">
      <path d="M60 10 C30 10 15 32 17 56 C18 68 25 75 30 79 V93 C30 99 34 103 40 103 H80 C86 103 90 99 90 93 V79 C95 75 102 68 103 56 C105 32 90 10 60 10 Z" fill="#F4EAFF" stroke="#000" strokeWidth="5" strokeLinejoin="round" />
      <path d="M80 18 C94 28 100 42 98 56 C97 66 92 72 86 76 V93 C86 97 84 99 80 99 H74 C80 90 82 74 84 60 C86 42 84 28 80 18 Z" fill="#c9b8e8" />
      <path d="M60 10 L56 22 L64 29 L58 39" fill="none" stroke="#000" strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round" />
      <ellipse cx="43" cy="55" rx="12" ry="13" fill="#0d0618" stroke="#000" strokeWidth="3" />
      <ellipse cx="77" cy="55" rx="12" ry="13" fill="#0d0618" stroke="#000" strokeWidth="3" />
      <path d="M38 50 L48 60 M48 50 L38 60 M72 50 L82 60 M82 50 L72 60" stroke="#FF3D7F" strokeWidth="4" strokeLinecap="round" />
      <path d="M60 66 L54 79 H66 Z" fill="#0d0618" stroke="#000" strokeWidth="3" strokeLinejoin="round" />
      <path d="M30 86 H90" stroke="#000" strokeWidth="4" />
      <path d="M46 86 V103 M60 86 V103 M74 86 V103" stroke="#000" strokeWidth="4" />
      <path d="M30 36 C33 26 40 19 49 16" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}
function XpHex() {
  return (
    <svg viewBox="0 0 44 44" className="rs2-xphex" aria-hidden="true" focusable="false">
      <path d="M22 3 L39 12.5 V31.5 L22 41 L5 31.5 V12.5 Z" fill="#B04BFF" stroke="#000" strokeWidth="4" strokeLinejoin="round" />
      <path d="M22 3 L39 12.5 V31.5 L22 41 Z" fill="#8a2fd6" />
      <text x="22" y="28" textAnchor="middle" fontFamily="Bungee, sans-serif" fontSize="14" fill="#fff" stroke="#000" strokeWidth="3" paintOrder="stroke">XP</text>
      <path d="M10 15 L18 10.5" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** A number the tally counts up to: data-to / data-at / data-ms drive the loop; the text starts at the final value
 *  (so a no-JS / reduce-motion render is already right) and the loop rewinds it to 0 on mount. */
function N({ to, at, ms = T.count, prefix = '', className = '' }) {
  return (
    <span className={`rs2-n ${className}`} data-to={to} data-at={at} data-ms={ms} data-pre={prefix}>
      {prefix}{formatNum(to)}
    </span>
  );
}

/**
 * @param {object} p
 * @param {React.Ref} p.cardRef     the card root (GameScreen's fit check + tap-to-skip)
 * @param {boolean} p.iWon
 * @param {number}  p.place / p.of   my placement / seats
 * @param {string}  p.winnerName
 * @param {string}  p.modeLabel      'WORD BOMB'
 * @param {{words:number, letters:number, best:string}} p.me
 * @param {{gained:number|null, from:{level,frac}, to:{level,frac}}} p.xp
 * @param {object}  p.ledger         readPayoutLedger()
 * @param {number}  p.wordsWins      the run's per-word wins
 * @param {Array}   p.bonusLines     the run's named bonus credits
 * @param {number}  p.gemsSince      the gems ledger mark for this game
 * @param {Array}   p.table          placementOrder() rows (+ me flag)
 * @param {React.ReactNode} p.learn  the PAUSE-TO-LEARN hold (loss)
 * @param {React.ReactNode} p.actions the exits row (PLAY AGAIN / MENU / offer)
 * @param {React.ReactNode} p.extras  rebirth-ready, claim prompt, near miss, try-a-mode
 */
export default function ResultsCard({ cardRef, split = null, iWon, place, of, winnerName = '', modeLabel = 'WORD BOMB', me, xp, ledger, wordsWins = 0, bonusLines = [], gemsSince = 0, table = [], learn = null, actions = null, extras = null }) {
  const local = useRef(null);
  const root = cardRef || local;
  // ONE drawing (the mockup's 1366×657 sheet) scaled by --rs-k to the window; a phone gets its own stack.
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 700);
  useLayoutEffect(() => {
    const fit = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      setNarrow(w <= 700);
      const k = Math.max(0.5, Math.min((w - 24) / 1366, (h - 24) / 657));
      if (root.current) root.current.style.setProperty('--rs-k', k.toFixed(4));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const gemsBal = useGems();
  const { lines, total } = tallyLines({ wordsWins, bonusLines, ledger });
  const chain = chainOf(ledger, wordsWins, split);
  const stamp = stampFor(place, iWon);
  const bestWord = `${me.best || ''}`.toUpperCase();
  const lvGain = xp && xp.to && xp.from ? Math.max(0, Math.floor(xp.to.level) - Math.floor(xp.from.level)) : 0;
  const xpGained = xp && Number.isFinite(xp.gained) ? Math.max(0, xp.gained) : null;
  const perLetter = xpGained != null && me.letters > 0 ? xpGained / me.letters : 0;
  // the beats after WINS: one per bonus line, then gems, then the total
  const tWords = T.wins + 220 + chain.chips.length * 220;
  const tBonus = (i) => tWords + T.step * (i + 1);
  const bonusCount = lines.length - 1;
  const tGems = tBonus(bonusCount) + 80;
  const tTotal = tGems + T.step;
  const tEnd = tTotal + T.count;

  useEffect(() => {
    const el = root.current;
    if (!el) return undefined;
    const nums = [...el.querySelectorAll('.rs2-n')];
    const reveals = [...el.querySelectorAll('[data-rv]')];
    if (reduceMotion()) {
      el.dataset.tally = 'done';
      return undefined;
    }
    el.dataset.tally = 'run';
    for (const r of reveals) r.classList.add('rs2-pending');
    const timers = [];
    const done = new Set();
    const fire = (node) => {
      if (done.has(node)) return;
      done.add(node);
      node.classList.remove('rs2-pending');
      const k = node.dataset.rv;
      const frames = k === 'slam' ? SLAM : k === 'stamp' ? STAMP : k === 'drop' ? DROP : k === 'chip' ? CHIP : k === 'pop' ? POP : k === 'slide' ? SLIDE : RISE;
      const dur = k === 'slam' || k === 'drop' ? 550 : k === 'chip' ? 300 : k === 'pop' ? 500 : k === 'stamp' ? 400 : 350;
      kitPlay(node, frames, { duration: dur, easing: 'cubic-bezier(.2,1.2,.4,1)', fill: 'backwards' });
    };
    for (const r of reveals) timers.push(setTimeout(() => fire(r), Number(r.dataset.at) || 0));
    const land = (sel, at) => timers.push(setTimeout(() => { const n = el.querySelector(sel); if (n) kitPlay(n, LAND, { duration: 320, easing: 'cubic-bezier(.2,1.5,.4,1)' }); }, at));
    land('.rs2-xp', T.xp + 200 + T.count * 2);
    land('.rs2-wins', tWords + T.count);
    land('.rs2-gems', tGems + T.count);
    timers.push(setTimeout(() => { const b = el.querySelector('.game-over-rematch'); if (b) kitPlay(b, PULSE, { duration: 500, easing: 'ease-in-out' }); }, tEnd + 200));
    // the count-up: one loop, text writes only when the shown figure changes
    for (const n of nums) n.textContent = `${n.dataset.pre}${formatNum(0)}`;
    const t0 = performance.now();
    let raf = 0;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      for (const n of nums) n.textContent = `${n.dataset.pre}${formatNum(Number(n.dataset.to) || 0)}`;
      for (const r of reveals) { r.classList.remove('rs2-pending'); done.add(r); }
      el.dataset.tally = 'done';
    };
    const step = (now) => {
      const t = now - t0;
      let live = false;
      for (const n of nums) {
        const at = Number(n.dataset.at) || 0;
        const ms = Number(n.dataset.ms) || T.count;
        const to = Number(n.dataset.to) || 0;
        const k = t <= at ? 0 : Math.min(1, (t - at) / ms);
        if (k < 1) live = true;
        const txt = `${n.dataset.pre}${formatNum(to * eo(k))}`;
        if (n.textContent !== txt) n.textContent = txt;
      }
      if (live || t < tEnd) raf = requestAnimationFrame(step);
      else finish();
    };
    raf = requestAnimationFrame(step);
    // TAP TO SKIP: any press on the card (not a button) lands everything now
    const skip = (e) => {
      if (e.target && e.target.closest && e.target.closest('button, a')) return;
      cancelAnimationFrame(raf);
      for (const id of timers) clearTimeout(id);
      for (const r of reveals) { if (r.__kitAnim) { try { r.__kitAnim.finish(); } catch { /* gone */ } } }
      finish();
    };
    el.addEventListener('pointerdown', skip);
    return () => {
      cancelAnimationFrame(raf);
      for (const id of timers) clearTimeout(id);
      el.removeEventListener('pointerdown', skip);
    };
    // mount-only: the card is re-keyed per game
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const heroLabel = iWon
    ? `You win. Placed #${place} of ${of}.`
    : `Knocked out. ${winnerName ? `${String(winnerName).toUpperCase()} WINS` : 'NO WINNER'}. You placed #${place} of ${of}.`;
  const rows = table;
  return (
    <div ref={root} className={`game-over-card rs2${narrow ? ' rs2--narrow' : ''}${learn ? ' has-learn' : ''} ${iWon ? 'go-card-win' : 'go-card-loss'}`} data-place={place} data-outcome={iWon ? 'win' : 'loss'} data-stamp={stamp.tone}>
      <div className="rs2-top">
        <div className="rs2-mode">{modeLabel}<span className="rs2-mode-n">· {formatNum(of)}P</span></div>
        <div className="rs2-wallet" aria-label={`Gems ${formatNum(gemsBal)}`}>
          <GemIcon size={44} className="rs2-wallet-gem" />
          <span className="rs2-wallet-n">{formatNum(gemsBal)}</span>
        </div>
      </div>

      {/* ===== HERO: the placement ===== */}
      <section className={`rs2-hero rs2-hero--${stamp.tone}`} role="heading" aria-level={2} aria-label={heroLabel}>
        <div className="rs2-hero-plate" aria-hidden="true" />
        <div className="rs2-hero-in" aria-hidden="true">
          <div className="rs2-icon" data-rv="drop" data-at="150">{iWon ? <Trophy /> : stamp.tone === 'top' ? <Medal place={place} /> : <Skull />}</div>
          <div className="rs2-place" data-rv="slam" data-at="0">
            <span className="rs2-place-n">#{formatNum(place)}</span>
            {place > 1 ? <span className="rs2-place-of">/{formatNum(of)}</span> : null}
          </div>
          <div className={`rs2-stamp rs2-stamp--${stamp.tone}${iWon ? ' game-over-title win' : ''}`} data-rv="stamp" data-at="500">
            <span>{stamp.text}</span>
          </div>
          {me.best ? (
            <div className="rs2-best" data-rv="rise" data-at="700">
              <span className="rs2-best-k">BEST<br />WORD</span>
              <span className="rs2-best-w" translate="no">{bestWord}</span>
              <span className="rs2-best-n">{formatNum(bestWord.length)}</span>
            </div>
          ) : null}
        </div>
        {!iWon && winnerName ? <div className="rs2-winner" aria-hidden="true"><span translate="no">{String(winnerName).toUpperCase()}</span> WINS</div> : null}
      </section>
      {learn ? <div className="rs2-learn">{learn}</div> : null}

      {/* ===== TALLY: line by line ===== */}
      <section className="rs2-tally" aria-label="This game">
        <div className="rs2-stats" data-rv="rise" data-at={T.stats}>
          <div className="rs2-stat rs2-stat--w"><N to={me.words} at={T.stats + 100} /><span className="rs2-stat-k">WORDS</span></div>
          <div className="rs2-stat rs2-stat--l"><N to={me.letters} at={T.stats + 100} /><span className="rs2-stat-k">LETTERS</span></div>
        </div>
        <div className="rs2-xp" data-rv="rise" data-at={T.xp}>
          <div className="rs2-xp-top">
            <XpHex />
            {xpGained != null ? <N to={xpGained} at={T.xp + 200} ms={T.count * 2} prefix="+" className="rs2-xp-n" /> : <span className="rs2-xp-n">LEVELS</span>}
            {perLetter > 0 ? <span className="rs2-xp-why">{formatNum(me.letters)} × {formatNum(perLetter)}</span> : null}
          </div>
          <div className="rs2-xp-bar-row">
            <span className="rs2-xp-lv">LV {formatNum(xp && xp.to ? xp.to.level : 1)}</span>
            <span className="rs2-xp-bar"><span className="rs2-xp-fill" style={{ transform: `scaleX(${xp && xp.to ? Math.min(1, Math.max(0, xp.to.frac)) : 0})` }} /></span>
          </div>
          {lvGain > 0 ? <span className="rs2-xp-pop" data-rv="pop" data-at={T.xp + 200 + T.count * 2}>LV +{formatNum(lvGain)}</span> : null}
        </div>
        <div className="rs2-wins" data-rv="rise" data-at={T.wins} data-wins-line="WORDS" data-wins-amount={lines[0].amount}>
          <div className="rs2-wins-eq">
            <span className="rs2-base"><b>{formatNum(chain.base)}</b><small>BASE</small></span>
            <span className="rs2-op">×</span>
            <span className="rs2-mult">{chain.base > 0 ? mx(chain.mult) : '×0'}</span>
            <span className="rs2-op">=</span>
            <N to={lines[0].amount} at={tWords} prefix="+" className="rs2-wins-n" />
          </div>
          <div className="rs2-chain" aria-label="Multipliers">
            {chain.chips.length < 3 ? <span className="rs2-chain-k">WINS</span> : null}
            {chain.chips.length ? chain.chips.map((c, i) => (
              <span key={c.key} className="rs2-chip" style={{ '--c': CHIP_TONES[i % CHIP_TONES.length] }} data-rv="chip" data-at={T.wins + 220 + i * 220}>
                <b>{mx(c.mult)}</b>{c.label}
              </span>
            )) : <span className="rs2-chip rs2-chip--none">{lines[0].amount > 0 ? 'NO MULTIPLIERS' : '3 WORDS TO START EARNING'}</span>}
          </div>
        </div>
        {lines.slice(1).map((l, i) => (
          <div key={l.key} className="rs2-line rs2-bonus" data-rv="rise" data-at={tBonus(i)} data-wins-line={l.label} data-wins-amount={l.amount}>
            <span className="rs2-line-k">{l.label}</span>
            {l.mult ? <span className="rs2-line-x">{mx(l.mult)}</span> : null}
            <N to={l.amount} at={tBonus(i) + 120} prefix="+" className="rs2-line-n" />
            {l.note ? <span className="rs2-line-note">{l.note}</span> : null}
          </div>
        ))}
        <div className="rs2-sum">
          <div className="rs2-gems" data-rv="rise" data-at={tGems}>
            <GemsEarnedLine since={gemsSince} className="rs2-gems-line" />
            <span className="rs2-gems-k">GEMS</span>
          </div>
          <div className="rs2-total" data-rv="rise" data-at={tTotal}>
            <span className="rs2-total-k">WINS<br />EARNED</span>
            <span className="rs2-total-num" data-wins-total={total}><N to={total} at={tTotal + 80} prefix="+" /></span>
          </div>
        </div>
      </section>

      {/* ===== PLAYERS ===== */}
      <section className="rs2-players" aria-label="Players">
        <div className="rs2-players-h" aria-hidden="true"><span>RANK</span><span>WORDS</span></div>
        <ol className="rs2-plist">
          {rows.map((p, i) => (
            <li key={p.id} className={`rs2-prow${p.me ? ' is-me' : ''}`} data-place={p.place} data-rv="slide" data-at={300 + i * 70}>
              <span className={`rs2-prk rs2-prk--${p.place <= 3 ? p.place : 'n'}`}>{formatNum(p.place)}</span>
              <span className="rs2-pname" translate="no">{p.name}</span>
              {p.me ? <span className="rs2-you">YOU</span> : null}
              <span className="rs2-pw">{formatNum(p.words)}</span>
            </li>
          ))}
        </ol>
      </section>

      <div className="rs2-foot">
        <div className="rs2-extras">{extras}</div>
        {actions}
      </div>
    </div>
  );
}
