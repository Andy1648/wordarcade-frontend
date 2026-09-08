// RunMode.jsx — the RUN screens. One orchestrator switching on the run's phase:
// wall preview → round → draft → run-over. House style (Bungee, flat colour, thick
// coloured outline, hard black offset shadow, 8px radius). Motion is press/enter
// feedback only — no idle loops (menu motion law).
import { useEffect, useRef, useState } from 'react';
import { useRunMode } from './useRunMode.js';
import { wallSchedule } from './engine.js';
import ModifierArt from './ModifierArt.jsx';
import PlayBackdrop from '../components/PlayBackdrop';
import './RunMode.css';

// Split a modifier's "upside, but downside" text into its two halves so the trade-off
// reads instantly (green upside over a red cost). Upside-only mods return {down:null}.
function splitEffect(text) {
  const m = text.match(/^(.*?)(?:,|\s*—)?\s+but\s+(.*)$/i);
  return m ? { up: m[1].trim(), down: m[2].trim() } : { up: text, down: null };
}

export default function RunMode({ onExit }) {
  // RUN AGAIN restarts the whole run by remounting the inner run with a fresh key —
  // a new key throws away the old useRunMode reducer and deals a brand-new run (new
  // seed, empty stack). Cleaner than a reducer 'restart' action and guaranteed fresh.
  const [runKey, setRunKey] = useState(0);
  return <RunInner key={runKey} onExit={onExit} onAgain={() => setRunKey((k) => k + 1)} />;
}

function RunInner({ onExit, onAgain }) {
  const run = useRunMode();

  return (
    <div className="run-root">
      {/* Dressed graffiti-wall backdrop (same as the menu), scoped + static, behind every RUN
          phase so the wide stage around the panel reads as a wall, not a flat-black void. */}
      <PlayBackdrop />
      <button className="run-exit" onClick={onExit} aria-label="Leave run">✕</button>
      {run.phase === 'loading' && <RunLoading />}
      {run.phase === 'wall' && <WallScreen run={run} />}
      {run.phase === 'round' && <RoundScreen run={run} />}
      {run.phase === 'draft' && <DraftScreen run={run} />}
      {run.phase === 'over' && <OverScreen run={run} onExit={onExit} onAgain={onAgain} />}
    </div>
  );
}

function RunLoading() {
  return <div className="run-panel run-loading"><div className="run-kicker">RUN</div><p>DEALING THE RUN…</p></div>;
}

// Progress rail shared by every in-run screen: 10 pips, the current one lit.
function RunRail({ round, total }) {
  return (
    <div className="run-rail" aria-label={`Round ${round} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={`run-pip${i + 1 < round ? ' done' : ''}${i + 1 === round ? ' now' : ''}`} />
      ))}
    </div>
  );
}

// The wall/round stack strip. Carries the same "YOUR STACK N" count label as the draft and
// the over screen, so a RUN AGAIN restart visibly resets to 0 on the very first wall.
function StackStrip({ stack }) {
  return (
    <>
      <div className="run-draft-stack-label">YOUR STACK <span className="run-stack-count">{stack.length}</span></div>
      {stack.length ? (
        <div className="run-stack">
          {stack.map((m) => <span key={m.id} className="run-chip" title={m.text}>{m.name}</span>)}
        </div>
      ) : (
        <div className="run-stack run-stack-empty">NO MODIFIERS YET — DRAFT ONE AFTER ROUND 1</div>
      )}
    </>
  );
}

// The pre-round screen: the WALL you must clear, the rolled mode, your stack.
function WallScreen({ run }) {
  const schedule = wallSchedule();
  return (
    <div className="run-panel run-wall">
      <RunRail round={run.round} total={run.totalRounds} />
      <div className="run-kicker">ROUND {run.round} / {run.totalRounds}</div>
      <div className="run-wall-need">
        <span className="run-wall-label">CLEAR</span>
        <span className="run-wall-num">{run.wall.toLocaleString()}</span>
        <span className="run-wall-label">OR THE RUN ENDS</span>
      </div>
      <div className="run-mode-tag" style={{ '--accent': run.roundMode.accent }}>
        <b>{run.roundMode.label}</b><span>{run.roundMode.rule}</span>
      </div>
      <StackStrip stack={run.stack} />
      <div className="run-banked">BANKED <b>{run.cumulative.toLocaleString()}</b></div>
      <button className="run-btn run-btn-go" onClick={run.startRound}>START ROUND {run.round}</button>
      <div className="run-ladder" aria-hidden="true">
        {schedule.map((w, i) => (
          <span key={i} className={`run-ladder-step${i + 1 === run.round ? ' now' : ''}${i + 1 < run.round ? ' done' : ''}`}>{w >= 1000 ? `${Math.round(w / 1000)}k` : w}</span>
        ))}
      </div>
    </div>
  );
}

function RoundScreen({ run }) {
  const { play } = run;
  const [val, setVal] = useState('');
  const [cleared, setCleared] = useState(false); // persistent "over the wall" state
  const [burst, setBurst] = useState(false);      // one-shot CLEAR flash (pooled node)
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  // THE meter reads the round-ADJUSTED projection (run.projected), the same number the
  // wall is compared against at round end — not the raw typed total.
  const projected = run.projected;
  const met = projected >= run.wall;
  const rawTyped = Math.round(run.rawRoundScore);
  const boosted = rawTyped > 0 && projected !== rawTyped;

  // CLEAR moment: fires once, the frame the true projection first crosses the wall. The
  // projection only ever climbs within a round, so this is a single one-shot.
  useEffect(() => {
    if (met && !cleared) { setCleared(true); setBurst(true); }
  }, [met, cleared]);

  if (!play) return null;

  function onSubmit(e) {
    e.preventDefault();
    const r = run.submitWord(val);
    if (r.ok) setVal('');
  }

  return (
    <div className="run-panel run-round" style={{ '--accent': run.roundMode.accent }}>
      <RunRail round={run.round} total={run.totalRounds} />
      <div className="run-round-top">
        <div className="run-round-mode"><b>{run.roundMode.label}</b><span>{run.roundMode.rule}</span></div>
        <div className={`run-clock${play.timeLeft <= 5 ? ' low' : ''}`}>{play.timeLeft}s</div>
      </div>
      <div className="run-score-row">
        <div className={`run-score${met ? ' met' : ''}`}>
          <span className={`run-score-num${burst ? ' pop' : ''}`}>{projected.toLocaleString()}</span>
          <span className="run-score-need">/ {run.wall.toLocaleString()} TO CLEAR</span>
        </div>
        <div className="run-combo">×{play.combo.toFixed(1)}</div>
      </div>
      <div className={`run-progress-track${met ? ' cleared' : ''}`}>
        <div className="run-progress-fill" style={{ transform: `scaleX(${Math.min(1, projected / run.wall)})` }} />
        <span className="run-progress-wall" aria-hidden="true">WALL {run.wall.toLocaleString()}</span>
        <div className={`run-clear-burst${burst ? ' playing' : ''}`} aria-hidden={!burst}
          onAnimationEnd={() => setBurst(false)}>CLEARED!</div>
      </div>
      <div className="run-meter-note">
        {boosted
          ? <>TYPED <b>{rawTyped.toLocaleString()}</b> · MODIFIERS → <b>{projected.toLocaleString()}</b></>
          : (met ? 'WALL CLEARED — KEEP PADDING YOUR LEAD' : 'ROUND-ADJUSTED SCORE vs WALL')}
      </div>
      {play.toast && <div className="run-toast">{play.toast}</div>}
      {run.roundMode.key === 'fuse' && play.constraint && (
        <div className="run-frag">CONTAINS <b>{play.constraint.toUpperCase()}</b></div>
      )}
      {run.roundMode.key === 'chain' && play.lastLetter && (
        <div className="run-frag">START WITH <b>{play.lastLetter.toUpperCase()}</b></div>
      )}
      <form onSubmit={onSubmit} className="run-input-wrap">
        <input ref={inputRef} className="run-input" value={val} onChange={(e) => setVal(e.target.value)}
          placeholder="TYPE A WORD" autoCapitalize="none" autoCorrect="off" autoComplete="off" spellCheck="false" />
      </form>
      <StackStrip stack={run.stack} />
    </div>
  );
}

function DraftScreen({ run }) {
  // The COMMIT moment: on pick, the chosen card pops + stamps DRAFTED while the others
  // fall back, THEN the phase advances. Purely cosmetic (finite, transform/opacity only),
  // and skipped under reduced-motion so the draft is never gated by an animation.
  const [picked, setPicked] = useState(null);
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function choose(id) {
    if (picked) return;
    if (reduce) { run.pick(id); return; }
    setPicked(id);
    setTimeout(() => run.pick(id), 470);
  }
  return (
    <div className="run-panel run-draft">
      <RunRail round={run.round} total={run.totalRounds} />
      <div className="run-draft-head">
        <div className="run-kicker">ROUND {run.round} CLEARED — <b>{run.lastRoundScore.toLocaleString()}</b> vs {run.lastWall.toLocaleString()}</div>
        <h2 className="run-draft-title">DRAFT A MODIFIER</h2>
        <div className="run-draft-hint">PICK ONE — IT STACKS FOR THE REST OF THE RUN</div>
      </div>
      <div className="run-offers">
        {run.offers.map((m) => {
          const eff = splitEffect(m.text);
          const state = picked === m.id ? ' chosen' : (picked ? ' dropped' : '');
          return (
            <button key={m.id} className={`run-card${m.down ? ' tradeoff' : ' upside'}${state}`} onClick={() => choose(m.id)} disabled={!!picked}>
              <span className="run-card-tag">{m.down ? 'TRADE-OFF' : 'PURE UPSIDE'}</span>
              <span className="run-card-art"><ModifierArt id={m.id} /></span>
              <span className="run-card-body">
                <span className="run-card-name">{m.name}</span>
                <span className="run-card-fx">
                  <span className="run-fx-up">{eff.up}</span>
                  {eff.down && <span className="run-fx-down">{eff.down}</span>}
                </span>
              </span>
              <span className="run-card-stamp" aria-hidden="true">DRAFTED</span>
            </button>
          );
        })}
      </div>
      <div className="run-draft-stack">
        <span className="run-draft-stack-label">YOUR STACK <span className="run-stack-count">{run.stack.length}</span></span>
        <StackDeck stack={run.stack} />
      </div>
    </div>
  );
}

// The growing DECK you've drafted — a real row of mini modifier cards (icon + name), so
// the choice visibly builds something. Empty until the first pick.
function StackDeck({ stack }) {
  if (!stack.length) return <div className="run-stack-empty">EMPTY — YOUR FIRST MODIFIER GOES HERE</div>;
  return (
    <div className="run-stack-deck">
      {stack.map((m) => (
        <span key={m.id} className={`run-mini${m.down ? ' tradeoff' : ' upside'}`} title={m.text}>
          <span className="run-mini-art"><ModifierArt id={m.id} className="run-mini-svg" /></span>
          <span className="run-mini-name">{m.name}</span>
        </span>
      ))}
    </div>
  );
}

// The modifier stack shown as a FANNED HAND of cards — the story of the run made
// physical. Each card overlaps the last and tilts across an arc (transform-only:
// rotate + translate), so a long run reads as a fat winning hand and a short one as
// a thin bust. A one-shot deal-in stagger plays on mount; nothing loops at rest.
function FannedHand({ stack }) {
  const n = stack.length;
  if (!n) {
    return <div className="run-hand run-hand-empty">NO MODIFIERS DRAFTED — YOU MISSED THE FIRST WALL</div>;
  }
  // Spread the fan wider the fewer cards there are (a 2-card hand shouldn't look flat);
  // clamp the per-card angle so a big stack doesn't wrap past a natural hand.
  const spread = Math.min(14, 40 / Math.max(1, n - 1)); // degrees between cards
  const mid = (n - 1) / 2;
  return (
    <>
      {/* the fan is pure ART — the recognisable hand you built; names read cleanly in the
          legend below so nothing gets clipped by the overlap, at any hand size. */}
      <div className="run-hand" style={{ '--hand-n': n }}>
        {stack.map((m, i) => {
          const off = i - mid;                 // -mid … +mid
          const angle = off * spread;          // fan rotation about the bottom pivot
          const lift = -Math.abs(off) * 4;     // outer cards ride slightly HIGHER (a held-hand arc)
          return (
            <span
              key={m.id}
              className={`run-hand-card${m.down ? ' tradeoff' : ' upside'}`}
              style={{
                '--i': i,
                transform: `rotate(${angle.toFixed(2)}deg) translateY(${lift.toFixed(0)}px)`,
                zIndex: n - Math.abs(off),
              }}
              title={m.text}
            >
              <span className="run-hand-art"><ModifierArt id={m.id} className="run-hand-svg" /></span>
            </span>
          );
        })}
      </div>
      <div className="run-hand-legend">
        {stack.map((m) => (
          <span key={m.id} className={`run-legend-chip${m.down ? ' tradeoff' : ' upside'}`} title={m.text}>{m.name}</span>
        ))}
      </div>
    </>
  );
}

function OverScreen({ run, onExit, onAgain }) {
  const won = run.reason === 'cleared';
  const walled = run.reason === 'wall'; // ended below the wall (the miss the meter warned of)
  const reached = won ? run.totalRounds : run.round;
  // The MISS moment: the panel slams + shakes in, the stamp drops. The CLEAR-run moment:
  // a gentler triumphant pop. Both are mount-time one-shots on single (pooled) nodes.
  return (
    <div className={`run-panel run-over${won ? ' won' : ' miss'}`}>
      <div className={`run-over-stamp${won ? ' pop' : ' slam'}`}>{won ? 'RUN CLEARED' : 'RUN OVER'}</div>
      <div className="run-over-sub">
        {won ? `ALL ${run.totalRounds} ROUNDS BEATEN` :
          run.reason === 'fumble' ? `GLASS CANNON FUMBLED ON ROUND ${run.round}` :
            `SHORT OF THE WALL`}
      </div>

      {/* The three numbers that define the run: how far, what you banked, what you earned. */}
      <div className="run-over-stats">
        <div className="run-over-stat">
          <b>{reached}<i>/{run.totalRounds}</i></b><span>ROUNDS</span>
        </div>
        <div className="run-over-stat">
          <b>{run.cumulative.toLocaleString()}</b><span>BANKED</span>
        </div>
        <div className="run-over-stat run-over-stat-wins">
          <b>+{run.winsEarned.toLocaleString()}</b><span>WINS</span>
        </div>
      </div>

      {walled && (
        <div className="run-over-gap">
          <div className="run-over-gap-label">THE WALL YOU MISSED BY</div>
          <div className="run-progress-track missed">
            <div className="run-progress-fill" style={{ transform: `scaleX(${Math.min(1, run.lastRoundScore / (run.lastWall || 1))})` }} />
            <span className="run-progress-wall" aria-hidden="true">WALL {run.lastWall.toLocaleString()}</span>
          </div>
          <div className="run-over-gap-nums">
            <b>{run.lastRoundScore.toLocaleString()}</b> / {run.lastWall.toLocaleString()} NEEDED
            <em> — {(run.lastWall - run.lastRoundScore).toLocaleString()} SHORT</em>
          </div>
        </div>
      )}

      {/* The stack as the story of the run — the fanned hand you built. */}
      <div className="run-over-hand-wrap">
        <div className="run-over-hand-label">THE HAND YOU BUILT <span className="run-stack-count">{run.stack.length}</span></div>
        <FannedHand stack={run.stack} />
      </div>

      <div className="run-over-actions">
        <button className="run-btn run-btn-again" onClick={onAgain}>RUN AGAIN</button>
        <button className="run-btn run-btn-leave" onClick={onExit}>LEAVE</button>
      </div>
    </div>
  );
}
