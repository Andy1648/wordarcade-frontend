// SatHudV2.jsx — the SEASON 2 SAT RUSH board (claude/mockups/v2/SatRush.dc.html, VERSION A "POSTER";
// SEASON2-QUEUE P10 10d). Left: THIS WORD PAYS — the giant number a capture scores RIGHT NOW (base × ante, × silver /
// × escaped, + the deep-cut bonus: engine.submitCorrect's own formula), its chips, the 5× / 3× / 1× ante tiles with the
// drop bar, then what the word pays in WINS (SAT ×3 and every other live factor, each its own chip). Right: the case
// card — CASE #, part of speech, letters, tier, the sentence, the reveals still locked "AT 3×", the suspects (LINEUP),
// the slots, "TYPE IT AT 5×" and the run's pips.
//
// Presentation only — the engine, the input and the payout are untouched. The ante multiplies SCORE (not wins), so the
// big number is points and the wins line stands on its own, never multiplied by the ante.
// Motion: finite (the pays number punches on an ante drop via kitPlay; the drop bar is one transform keyframe run
// per stage, like the live meter). REDUCE MOTION: no punches, the bar stays full.
import { useEffect, useRef } from 'react';
import Slots from './Slots';
import { ReEncode, SuspectLineup } from './WordCard';
import KitIcon from '../components/kit/KitIcon.jsx';
import { kitPlay } from '../components/kit/motion.js';
import { reduceMotion } from '../lib/reduceMotion.js';
import { formatNum, formatRate, formatMultExact } from '../format';
import { perWordRateNow } from '../progress/wins';
import './SatV2.css';

const FACTOR_LABEL = { mode: 'SAT', rebirth: 'REBIRTH', bonus: 'MARK', frenzy: 'FRENZY', boost: 'BOOST' };

/** PURE: what a capture scores right now + the chips that make it (the engine's submitCorrect formula). */
export function satPays(view) {
  const base = view.scoreBase || 0;
  const chips = [{ key: 'base', label: 'BASE', text: formatNum(base) }];
  chips.push({ key: 'ante', label: 'ANTE', text: `×${formatMultExact(view.stageMult || 0)}` });
  if (view.silver) chips.push({ key: 'silver', label: 'SILVER', text: `×${formatMultExact(view.silverMult || 1)}` });
  if (view.revenant) chips.push({ key: 'escaped', label: 'ESCAPED', text: `×${formatMultExact(view.revenantMult || 1)}` });
  if (view.deepCutBonus) chips.push({ key: 'deep', label: 'DEEP CUT', text: `+${formatNum(view.deepCutBonus)}` });
  const pts = Math.max(0, Math.round(base * (view.multiplier || 0))) + (view.deepCutBonus || 0);
  return { pts, chips };
}

/** PURE: the WINS chips for a word (every live factor that is not ×1). */
export function winsChips(factors) {
  const out = [];
  for (const [k, v] of Object.entries(factors || {})) {
    if (k === 'baseWins' || typeof v !== 'number' || !Number.isFinite(v) || v === 1 || v <= 0) continue;
    out.push({ key: k, label: FACTOR_LABEL[k] || k.toUpperCase(), text: `×${formatMultExact(v)}` });
  }
  return out;
}

const PUNCH = [{ transform: 'scale(1.18) rotate(-3deg)' }, { transform: 'scale(.96)', offset: 0.6 }, { transform: 'scale(1)' }];

function Pays({ view }) {
  const { pts, chips } = satPays(view);
  const ref = useRef(null);
  const stageKey = `${view.wordNumber}-${view.stage}`;
  useEffect(() => {
    if (view.stage > 0) kitPlay(ref.current, PUNCH, { duration: 300, easing: 'cubic-bezier(.2,1.4,.4,1)' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageKey]);
  const mults = view.stageMults || [];
  const next = mults[view.stage + 1];
  const running = view.pending === 'idle';
  const still = reduceMotion();
  const now = perWordRateNow({ mode: 'sat-rush', wordLength: view.wordLength });
  const wchips = winsChips(now.factors);
  return (
    <section className="sat2-pays" aria-label={`This word pays ${pts} points at ${view.multiplier} times`}>
      <header className="sat2-pays-h">
        <span>THIS WORD PAYS</span>
        <b translate="no">AT {formatMultExact(view.multiplier)}×</b>
      </header>
      <div className="sat2-pays-body">
        <div className="sat2-big">
          <span ref={ref} className="sat2-big-n" translate="no">{formatNum(pts)}</span>
          <span className="sat2-big-u">PTS</span>
        </div>
        <ul className="sat2-chips">
          {chips.map((c) => (
            <li key={c.key} className={`sat2-chip sat2-chip--${c.key}`}>
              <b translate="no">{c.text}</b> {c.label}
            </li>
          ))}
        </ul>
        <ol className="sat2-antes" aria-hidden="true">
          {mults.map((m, i) => (
            <li key={i} className={`sat2-ante${i === view.stage ? ' is-now' : i < view.stage ? ' is-gone' : ''}`}>
              {formatMultExact(m)}×
            </li>
          ))}
        </ol>
        <div className={`sat2-drop${view.atFinal ? ' is-final' : ''}`}>
          <div className="sat2-drop-track">
            <div
              className={`sat2-drop-fill${running && !still ? ' is-run' : ''}`}
              key={stageKey + (view.atFinal ? '-g' : '')}
              style={{ animationDuration: `${view.atFinal ? view.graceMs : view.interval}ms` }}
            />
          </div>
          <span className="sat2-drop-k">{view.atFinal ? 'LAST CALL' : next != null ? `DROPS TO ${formatMultExact(next)}× NEXT` : ''}</span>
        </div>
      </div>
      <footer className="sat2-wins">
        <span className="sat2-wins-k">WINS FOR THIS WORD</span>
        <span className="sat2-wins-n" translate="no">+{formatRate(now.rate)}</span>
        <ul className="sat2-wchips">
          {wchips.map((c) => (
            <li key={c.key} className={`sat2-wchip sat2-wchip--${c.key}`}>
              <b translate="no">{c.text}</b> {c.label}
            </li>
          ))}
        </ul>
      </footer>
    </section>
  );
}

function Blank({ length }) {
  return (
    <span className="sat2-blank" aria-label={`${length}-letter blank`}>
      {'_'.repeat(length)}
    </span>
  );
}

function CaseCard({ view }) {
  const { fx, msg, stamp, reEncode, suspects } = view;
  const isLineup = view.mode === 'lineup';
  const [before, after] = String(view.context || '').split(/_+/);
  const mults = view.stageMults || [];
  const rows = (view.reveals || []).filter((r) => r.type === 'gloss' || (r.type === 'root' && view.root));
  return (
    <section className={`sat2-case${view.deepCut ? ' is-deep' : ''}${view.revenant ? ' is-rev' : ''}`}>
      {stamp && (
        <div className={`sr-stamp sat2-stamp ${stamp.tone}`} key={`stamp-${stamp.id}`} aria-label={stamp.text}>
          {stamp.text}
        </div>
      )}
      <header className="sat2-case-h">
        <span className="sat2-tag sat2-tag--case" translate="no">CASE #{String(view.wordNumber).padStart(2, '0')}</span>
        <span className="sat2-tag">{String(view.pos || '').toUpperCase()}</span>
        <span className="sat2-tag">{formatNum(view.wordLength)} LETTERS</span>
        <span className="sat2-tag sat2-tag--tier">TIER {formatNum(view.tier)}</span>
        {view.deepCut ? <span className="sat2-tag sat2-tag--hot">MOST WANTED</span> : null}
        {view.revenant ? <span className="sat2-tag sat2-tag--hot">ESCAPED ×{formatNum(view.missCount)}</span> : null}
      </header>
      <p className="sat2-sentence">
        {before}
        <Blank length={view.wordLength} />
        {after}
      </p>
      {rows.some((r) => r.visible) ? (
        <div className="sat2-reveals">
          {rows.filter((r) => r.visible).map((r) => (
            <div key={r.type} className={`sat2-reveal sat2-reveal--${r.type}`}>
              {r.type === 'gloss' ? (
                <>“{view.gloss}”</>
              ) : (
                <>
                  <b>{view.root.morpheme}</b> — {view.root.meaning} <span className="cz">· {view.root.cousins.join(' · ')}</span>
                </>
              )}
            </div>
          ))}
        </div>
      ) : null}
      {rows.some((r) => !r.visible) ? (
        <div className="sat2-locks">
          {rows.filter((r) => !r.visible).map((r) => (
            <div key={r.type} className="sat2-lock">
              <KitIcon name="lock" size={26} />
              <span translate="no">{r.type === 'gloss' ? 'DESCRIPTION' : 'ROOT'} AT {formatMultExact(mults[r.stage] || 1)}×</span>
            </div>
          ))}
        </div>
      ) : null}
      {isLineup && suspects ? <SuspectLineup suspects={suspects} /> : null}
      <div className="sat2-slots">
        {fx && fx.badKey ? (
          <span className="sr-tch" key={`tch-${fx.badKey}`} aria-hidden="true">
            TCH!
          </span>
        ) : null}
        <Slots slots={view.slots} badIndex={fx && fx.badIndex} badKey={fx && fx.badKey} />
      </div>
      <footer className="sat2-case-f">
        <span className="sat2-typeit" translate="no">
          {view.atFinal ? 'LAST CALL' : `TYPE IT AT ${formatMultExact(view.multiplier)}×`}
        </span>
        <div className={`sat2-msg${msg ? ` ${msg.kind}` : ''}`}>{msg ? msg.text : ''}</div>
        <span className="sat2-run" aria-label="this run">
          <span className="sat2-run-k">RUN</span>
          {(view.runLog || []).map((e, i) => (
            <i key={i} className={`sat2-pip${e.ok ? (e.silver ? ' is-silver' : ' is-ok') : ' is-miss'}`} />
          ))}
        </span>
      </footer>
      {reEncode && <ReEncode data={reEncode} />}
    </section>
  );
}

/** The whole play board (SEASON 2). `winsPill` + `exit` + `children` (the key input + the gem pop) come from the shell. */
export default function SatHudV2({ view, winsPill, onExit, children }) {
  const hearts = [];
  for (let i = 0; i < view.maxLives; i++) hearts.push(<span key={i} className={`sat2-heart${i < view.lives ? ' is-full' : ''}`} aria-hidden="true">♥</span>);
  const heat = [];
  for (let i = 0; i < view.heatCap; i++) heat.push(<i key={i} className={`sat2-heat-b${i < view.heat ? ' is-on' : ''}`} />);
  return (
    <div className="sat2">
      <div className="sat2-top">
        {onExit ? (
          <button type="button" className="sat2-exit" onClick={onExit} aria-label="Exit to menu">
            <span aria-hidden="true">←</span> MENU
          </button>
        ) : null}
        <span className="sat2-title">SAT RUSH <small>{view.mode === 'lineup' ? 'LINEUP' : 'BRIEFING'}</small></span>
        <span className="sat2-word" translate="no">WORD {String(view.wordNumber).padStart(2, '0')}</span>
        <span className="sat2-lives" aria-label={`${view.lives} of ${view.maxLives} lives left`}>{hearts}</span>
        <span className="sat2-heat" aria-label={`heat ${view.heat} of ${view.heatCap}`}>
          <span className="sat2-heat-k">HEAT</span>
          {heat}
        </span>
        <span className="sat2-streak">STREAK <b translate="no">{formatNum(view.streak)}</b></span>
        <span className="sat2-score">SCORE <b translate="no">{formatNum(view.score)}</b></span>
        <div className="sat2-pill">{winsPill}</div>
      </div>
      <div className="sat2-body">
        <Pays view={view} />
        <CaseCard view={view} />
        {children}
      </div>
    </div>
  );
}
