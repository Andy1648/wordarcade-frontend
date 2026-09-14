// RunMode.jsx — THE RUN. Every phase is the SAME stage: one dominant vertical WALL on the
// left, the phase's panel on the right. The wall is the mode's single accent object — it is
// the only violet-filled thing on any RUN screen, it never leaves, and it carries the huge
// odometer numeral that counts up in ticks.
//
// Colour script (RUN's own, not borrowed from another mode): violet #9A1AFF on a violet-ink
// greyscale. Word Bomb keeps pink, CHAIN cyan, Blitz orange, FUSE orange-on-plum, SAT
// ink-on-cream — nothing here reuses those.
//
// Motion: finite one-shots, transform/opacity only, no idle loops.
import { useEffect, useRef, useState } from 'react';
import { useRunMode } from './useRunMode.js';
import { isRoundLevel } from './engine.js';
import ModifierArt from './ModifierArt.jsx';
import WallArt from './WallArt.jsx';
import useCountUp from './useCountUp.js';
import PlayBackdrop from '../components/PlayBackdrop';
import './RunMode.css';

const prefersReduced = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// Split a modifier's "upside, but downside" text into its two halves so the trade-off
// reads instantly (upside over a cost). Upside-only mods return {down:null}.
function splitEffect(text) {
  const m = text.match(/^(.*?)(?:,|\s*—)?\s+but\s+(.*)$/i);
  return m ? { up: m[1].trim(), down: m[2].trim() } : { up: text, down: null };
}

export default function RunMode({ onExit }) {
  const run = useRunMode();
  const phase = run.phase;

  return (
    <div className="run-root" data-phase={phase}>
      <PlayBackdrop />
      <button className="run-exit" onClick={onExit} aria-label="Leave run">✕</button>
      {phase === 'loading' ? (
        <div className="run-stage run-stage-loading"><p className="run-loading">DEALING THE RUN…</p></div>
      ) : (
        <div className={`run-stage run-stage-${phase}`}>
          <WallColumn run={run} />
          <div className="run-panel">
            {phase === 'wall' && <WallPanel run={run} />}
            {phase === 'round' && <RoundPanel run={run} />}
            {phase === 'draft' && <DraftPanel run={run} />}
            {phase === 'over' && <OverPanel run={run} onExit={onExit} />}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// THE WALL — the dominant object. One vertical bar, ticked, with the huge numeral.
// ---------------------------------------------------------------------------
function WallColumn({ run }) {
  const phase = run.phase;
  const live = phase === 'round';
  const ended = phase === 'over';
  const settled = phase === 'draft';

  // What the huge numeral reads, per phase: the TARGET before you play, your LIVE total
  // while you play, and what you actually put on the board once the round is judged.
  const value = live ? run.projected : (ended || settled ? run.lastRoundScore : run.wall);
  const target = (ended || settled) ? (run.lastWall || run.wall) : run.wall;
  const numRef = useCountUp(value, !prefersReduced());

  // THE FILL IS WHAT YOU HAVE PUT UP — never the target. Before the round starts you have
  // put up nothing, so the column is empty and the numeral names the height to reach; a
  // full violet column on the pre-round screen read as "already done".
  const scored = live ? run.projected : (ended || settled ? run.lastRoundScore : 0);
  // ...and it is never fully empty either: a band of paint sits in the trough so the mode's
  // one accent object is present on every screen, including a 0-score run-over.
  const pct = Math.max(0.05, target > 0 ? Math.min(1, Math.max(0, scored / target)) : 0);
  const over = scored >= target && target > 0;

  const label = live
    ? (over ? 'OVER THE WALL' : 'YOUR TOTAL')
    : (ended || settled ? (over ? 'YOU PUT UP' : 'YOU STOPPED AT') : 'THE WALL');

  return (
    <div className={`run-wallcol${over ? ' over' : ''}`}>
      <div className="run-wall-head">
        <span className="run-wall-label">{label}</span>
        {/* ONE node, written by rAF-free discrete ticks — never re-created. */}
        <span className="run-wall-num" ref={numRef}>0</span>
      </div>
      <div className="run-wall-bar" role="img"
        aria-label={`${Math.round(scored)} of ${target}`}>
        <WallArt className="run-wall-art back" tone="var(--run-rule-2)" />
        <div className="run-wall-fill" style={{ transform: `scaleY(${pct})` }} />
        <WallArt className="run-wall-art front" tone="var(--run-void)" />
      </div>
      <div className="run-wall-foot">
        <span className="run-wall-target">TARGET {target.toLocaleString()}</span>
        <span className="run-wall-round">R{run.round}/{run.totalRounds}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The modifier STRIP — mid value. Chips are quiet slabs; the ONE that fired on the last
// accepted word flashes, once, and nothing else moves.
// ---------------------------------------------------------------------------
function ModStrip({ stack, fired, firedTick }) {
  const nodes = useRef(new Map()); // id -> chip element. A fixed pool: one node per owned mod.
  const last = useRef(0);

  useEffect(() => {
    if (!firedTick || firedTick === last.current) return;
    last.current = firedTick;
    const node = nodes.current.get(fired);
    if (!node || prefersReduced()) return;
    try {
      node.getAnimations().forEach((a) => a.cancel());
      node.style.willChange = 'transform, opacity';
      const a = node.animate(
        [
          { transform: 'scale(1)', opacity: 1 },
          { transform: 'scale(1.14)', opacity: 1, offset: 0.28 },
          { transform: 'scale(1)', opacity: 1 },
        ],
        { duration: 320, easing: 'cubic-bezier(.2,1.4,.4,1)' }
      );
      a.finished.then(() => { node.style.willChange = ''; }).catch(() => { node.style.willChange = ''; });
    } catch { /* WAAPI unavailable — the chip just doesn't flash */ }
  }, [fired, firedTick]);

  if (!stack.length) {
    return <div className="run-strip run-strip-empty">NO MODIFIERS — DRAFT ONE AFTER ROUND 1</div>;
  }
  return (
    <div className="run-strip">
      {stack.map((m) => (
        <span
          key={m.id}
          ref={(el) => { if (el) nodes.current.set(m.id, el); else nodes.current.delete(m.id); }}
          className={`run-chip${isRoundLevel(m) ? ' banked' : ''}${fired === m.id ? ' lit' : ''}`}
          title={m.text}
        >
          {m.name}
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PRE-ROUND
// ---------------------------------------------------------------------------
function WallPanel({ run }) {
  const play = run.play;
  return (
    <>
      <Rail round={run.round} total={run.totalRounds} />
      <div className="run-head">
        <span className="run-kicker">ROUND {run.round}</span>
        <h2 className="run-title">CLEAR THE WALL</h2>
      </div>
      <div className="run-plate">
        <b className="run-plate-name">{run.roundMode.label}</b>
        <span className="run-plate-rule">{run.roundMode.rule}</span>
      </div>
      <ModStrip stack={run.stack} fired={play?.fired} firedTick={play?.firedTick} />
      <div className="run-readout"><span>BANKED</span><b>{run.cumulative.toLocaleString()}</b></div>
      <button className="run-btn" onClick={run.startRound}>START ROUND {run.round}</button>
    </>
  );
}

function Rail({ round, total }) {
  return (
    <div className="run-rail" aria-label={`Round ${round} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={`run-pip${i + 1 < round ? ' done' : ''}${i + 1 === round ? ' now' : ''}`} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PLAY
// ---------------------------------------------------------------------------
function RoundPanel({ run }) {
  const { play } = run;
  const [val, setVal] = useState('');
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  if (!play) return null;

  function onSubmit(e) {
    e.preventDefault();
    const r = run.submitWord(val);
    if (r.ok) setVal('');
  }

  const low = play.timeLeft <= 5;
  return (
    <>
      <Rail round={run.round} total={run.totalRounds} />
      <div className="run-head run-head-row">
        <div className="run-plate-inline">
          <b className="run-plate-name">{run.roundMode.label}</b>
          <span className="run-plate-rule">{run.roundMode.rule}</span>
        </div>
        <div className={`run-clock${low ? ' low' : ''}`}>{play.timeLeft}<i>s</i></div>
      </div>
      <div className="run-readout">
        <span>COMBO</span><b>×{play.combo.toFixed(1)}</b>
      </div>
      <div className="run-cue">
        {run.roundMode.key === 'fuse' && play.constraint
          ? <>CONTAINS <b>{play.constraint.toUpperCase()}</b></>
          : run.roundMode.key === 'chain' && play.lastLetter
            ? <>START WITH <b>{play.lastLetter.toUpperCase()}</b></>
            : (play.toast || 'TYPE ANYTHING THAT COUNTS')}
      </div>
      <form onSubmit={onSubmit} className="run-input-wrap">
        <input ref={inputRef} className="run-input" value={val} onChange={(e) => setVal(e.target.value)}
          placeholder="TYPE A WORD" autoCapitalize="none" autoCorrect="off" autoComplete="off" spellCheck="false" />
      </form>
      <ModStrip stack={run.stack} fired={play.fired} firedTick={play.firedTick} />
    </>
  );
}

// ---------------------------------------------------------------------------
// DRAFT — the hand. A card RAISES to 1.3× with a ±3° tilt, and SLAMS on pick.
// ---------------------------------------------------------------------------
function DraftPanel({ run }) {
  const [picked, setPicked] = useState(null);
  function choose(id) {
    if (picked) return;
    if (prefersReduced()) { run.pick(id); return; }
    setPicked(id);
    setTimeout(() => run.pick(id), 430);
  }
  return (
    <>
      <Rail round={run.round} total={run.totalRounds} />
      <div className="run-head">
        <span className="run-kicker">ROUND {run.round} CLEARED</span>
        <h2 className="run-title">DRAFT A MODIFIER</h2>
      </div>
      <div className="run-offers">
        {run.offers.map((m, i) => {
          const eff = splitEffect(m.text);
          const state = picked === m.id ? ' chosen' : (picked ? ' dropped' : '');
          // Alternating lean so the hand reads as cards, not a table: the raise tilts the
          // card the way it already leans.
          return (
            <button key={m.id} className={`run-card${m.down ? '' : ' upside'}${state}`}
              data-lean={i % 2 ? 'r' : 'l'} onClick={() => choose(m.id)} disabled={!!picked}>
              <span className="run-card-art"><ModifierArt id={m.id} /></span>
              <span className="run-card-body">
                <span className="run-card-name">{m.name}</span>
                <span className="run-fx-up">{eff.up}</span>
                {eff.down && <span className="run-fx-down">{eff.down}</span>}
              </span>
              <span className="run-card-stamp" aria-hidden="true">DRAFTED</span>
            </button>
          );
        })}
      </div>
      <ModStrip stack={run.stack} fired={null} firedTick={0} />
    </>
  );
}

// ---------------------------------------------------------------------------
// RUN OVER
// ---------------------------------------------------------------------------
function OverPanel({ run, onExit }) {
  const won = run.reason === 'cleared';
  const [slam, setSlam] = useState(!prefersReduced());
  return (
    <>
      <div className="run-head">
        <span className="run-kicker">{won ? `ALL ${run.totalRounds} ROUNDS BEATEN` : `ROUND ${run.round}`}</span>
        <h2 className={`run-title run-stamp${slam ? ' slam' : ''}`}
          onAnimationEnd={() => setSlam(false)}>{won ? 'RUN CLEARED' : 'RUN OVER'}</h2>
      </div>
      <div className="run-verdict">
        {won ? 'THE WHOLE LADDER, CLEARED.'
          : run.reason === 'fumble' ? `GLASS CANNON FUMBLED ON ROUND ${run.round}.`
            : `SHORT OF ${(run.lastWall || run.wall).toLocaleString()} BY ${Math.max(0, (run.lastWall || run.wall) - run.lastRoundScore).toLocaleString()}.`}
      </div>
      <div className="run-readout"><span>BANKED</span><b>{run.cumulative.toLocaleString()}</b></div>
      <div className="run-readout"><span>WINS EARNED</span><b>+{run.winsEarned.toLocaleString()}</b></div>
      <ModStrip stack={run.stack} fired={null} firedTick={0} />
      <button className="run-btn" onClick={onExit}>DONE</button>
    </>
  );
}
