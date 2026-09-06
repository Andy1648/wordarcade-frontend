// RunMode.jsx — the RUN screens. One orchestrator switching on the run's phase:
// wall preview → round → draft → run-over. House style (Bungee, flat colour, thick
// coloured outline, hard black offset shadow, 8px radius). Motion is press/enter
// feedback only — no idle loops (menu motion law).
import { useEffect, useRef, useState } from 'react';
import { useRunMode } from './useRunMode.js';
import { wallSchedule } from './engine.js';
import './RunMode.css';

export default function RunMode({ onExit }) {
  const run = useRunMode();

  return (
    <div className="run-root">
      <button className="run-exit" onClick={onExit} aria-label="Leave run">✕</button>
      {run.phase === 'loading' && <RunLoading />}
      {run.phase === 'wall' && <WallScreen run={run} />}
      {run.phase === 'round' && <RoundScreen run={run} />}
      {run.phase === 'draft' && <DraftScreen run={run} />}
      {run.phase === 'over' && <OverScreen run={run} onExit={onExit} />}
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

function StackStrip({ stack }) {
  if (!stack.length) return <div className="run-stack run-stack-empty">NO MODIFIERS YET — DRAFT ONE AFTER ROUND 1</div>;
  return (
    <div className="run-stack">
      {stack.map((m) => <span key={m.id} className="run-chip" title={m.text}>{m.name}</span>)}
    </div>
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
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  if (!play) return null;
  const projected = play.score;
  const met = projected >= run.wall;

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
          <span className="run-score-num">{projected.toLocaleString()}</span>
          <span className="run-score-need">/ {run.wall.toLocaleString()} TO CLEAR</span>
        </div>
        <div className="run-combo">×{play.combo.toFixed(1)}</div>
      </div>
      <div className="run-progress-track"><div className="run-progress-fill" style={{ transform: `scaleX(${Math.min(1, projected / run.wall)})` }} /></div>
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
  return (
    <div className="run-panel run-draft">
      <RunRail round={run.round} total={run.totalRounds} />
      <div className="run-kicker">ROUND {run.round} CLEARED — <b>{run.lastRoundScore.toLocaleString()}</b> vs {run.lastWall.toLocaleString()}</div>
      <h2 className="run-draft-title">DRAFT A MODIFIER</h2>
      <div className="run-offers">
        {run.offers.map((m) => (
          <button key={m.id} className={`run-offer${m.down ? '' : ' upside'}`} onClick={() => run.pick(m.id)}>
            <span className="run-offer-name">{m.name}</span>
            <span className="run-offer-text">{m.text}</span>
            <span className="run-offer-tag">{m.down ? 'TRADE-OFF' : 'PURE UPSIDE'}</span>
          </button>
        ))}
      </div>
      <div className="run-draft-stack">
        <span className="run-draft-stack-label">YOUR STACK</span>
        <StackStrip stack={run.stack} />
      </div>
    </div>
  );
}

function OverScreen({ run, onExit }) {
  const won = run.reason === 'cleared';
  return (
    <div className={`run-panel run-over${won ? ' won' : ''}`}>
      <div className="run-over-stamp">{won ? 'RUN CLEARED' : 'RUN OVER'}</div>
      <div className="run-over-sub">
        {won ? `ALL ${run.totalRounds} ROUNDS BEATEN` :
          run.reason === 'fumble' ? `GLASS CANNON FUMBLED ON ROUND ${run.round}` :
            `ROUND ${run.round}: ${run.lastRoundScore.toLocaleString()} < ${run.lastWall.toLocaleString()}`}
      </div>
      <div className="run-over-score"><span>BANKED</span><b>{run.cumulative.toLocaleString()}</b></div>
      <div className="run-over-wins">+{run.winsEarned.toLocaleString()} WINS</div>
      <StackStrip stack={run.stack} />
      <button className="run-btn run-btn-go" onClick={onExit}>DONE</button>
    </div>
  );
}
