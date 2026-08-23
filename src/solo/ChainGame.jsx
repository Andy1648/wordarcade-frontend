// ChainGame.jsx — CHAIN mode screen. Loads the (lazy) word data, builds the pure engine,
// and drives it through the shared clock hook + shell. All rules live in chain.js; this
// file is glue + presentation.
import { useEffect, useState, useMemo, useCallback } from 'react';
import { createChainEngine, DEAD_END_BELOW, FEW_LEFT_BELOW } from './chain.js';
import { loadSoloWords } from './words.js';
import { useSoloGame } from './useSoloGame.js';
import { PB_KEYS } from './shared.js';
import SoloShell from './SoloShell.jsx';

const ACCENT = '#2EFFE0'; // cyan

export default function ChainGame({ onExit }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    let live = true;
    loadSoloWords().then((d) => {
      if (live) setData(d);
    });
    return () => {
      live = false;
    };
  }, []);

  const createEngine = useCallback(
    () => createChainEngine({ accept: data.accept, topCommon: data.topCommon }),
    [data]
  );

  const adapter = useMemo(
    () => ({
      budgetMs: (e) => e.currentTMax(),
      onTimeout: (e) => {
        e.timeout();
        return { dead: true };
      },
      getScore: (e) => e.state.score,
      getWords: (e) => e.state.k,
      rejectCtx: (e) => ({ letter: e.state.requiredLetter }),
    }),
    []
  );

  if (!data) {
    return (
      <div className="solo-root" style={{ '--solo-accent': ACCENT }}>
        <div className="solo-center">…</div>
      </div>
    );
  }
  return <ChainInner data={data} createEngine={createEngine} adapter={adapter} onExit={onExit} />;
}

function ChainInner({ data, createEngine, adapter, onExit }) {
  const g = useSoloGame({ createEngine, adapter, pbKey: PB_KEYS.CHAIN });
  const s = g.engine.state;
  const required = s.requiredLetter;
  const supply = g.engine.supply(required);

  // OUT tile — the last letter of the word being typed RIGHT NOW (recomputed every
  // keystroke, since onInput bumps `input` and re-renders this component). Purely a
  // read of state chain.js already tracks: supply() for the FEW LEFT / DEAD END states
  // and endCountOf() for the heat bar. No engine mutation, no input animation.
  const typed = g.input.trim().toLowerCase();
  const outLetter = typed.length ? typed[typed.length - 1] : '';
  const outSupply = outLetter ? g.engine.supply(outLetter) : null;
  const outState = outSupply
    ? outSupply.count < DEAD_END_BELOW
      ? 'dead' // < 3 unused common continuations → dead end (dashed red)
      : outSupply.count < FEW_LEFT_BELOW
        ? 'thin' // < 35 → few left (dashed yellow)
        : ''
    : '';
  // Heat as a 0..1 fill: endCount * 0.06 / 0.95 (the heatMul ramp, normalised to its cap).
  const outHeat = outLetter ? Math.min(1, (g.engine.endCountOf(outLetter) * 0.06) / 0.95) : 0;
  const outTile = (
    <div className={`solo-out${outState ? ` is-${outState}` : ''}`} aria-hidden="true">
      <div className="solo-out-face">
        <span className={`solo-out-letter${outLetter ? '' : ' is-empty'}`}>
          {outLetter ? outLetter.toUpperCase() : '·'}
        </span>
        <div
          className={`solo-out-heat${outHeat >= 0.36 ? ' is-hot' : ''}`}
          style={{ transform: `scaleX(${outHeat})`, opacity: outHeat > 0 ? 1 : 0 }}
        />
      </div>
      <div className="solo-out-cap">
        {outState === 'dead' ? 'DEAD END' : outState === 'thin' ? 'FEW LEFT' : ''}
      </div>
    </div>
  );

  const hud = (
    <>
      <div className="solo-stat">
        <b>{s.score}</b>
        <span>SCORE</span>
      </div>
      <div className="solo-mult">x{g.engine.state.multiplier.toFixed(2)}</div>
      <div className="solo-stat" style={{ textAlign: 'right' }}>
        <b>{s.k}</b>
        <span>LINKS · BEST {g.best}</span>
      </div>
    </>
  );

  const overCard = (
    <>
      <h2>CHAIN BROKE</h2>
      <div className="solo-death-killed">
        {s.killedLetter ? `nothing left starting with "${s.killedLetter.toUpperCase()}"` : 'time ran out'}
      </div>
      <div className="solo-death-links">
        {s.lastLinks.map((l, i) => (
          <span key={i}>
            {l.word.toUpperCase()} · +{l.score}
          </span>
        ))}
      </div>
    </>
  );

  return (
    <SoloShell
      accent={ACCENT}
      title="Type a word starting with the letter"
      hud={hud}
      center={required.toUpperCase()}
      supply={<span className={supply.count < 3 ? 'is-dead' : ''}>{supply.label}</span>}
      clock={{ remaining: g.remaining, tMax: g.tMax, redZone: g.redZone, armed: g.armed }}
      outTile={outTile}
      input={g.input}
      onInput={g.onInput}
      onSubmit={g.onSubmit}
      sillKey={g.sillKey}
      reason={g.reason}
      placeholder={`start with "${required.toUpperCase()}" — min 3 letters`}
      maxLength={data.maxAcceptLen}
      phase={g.phase}
      over={{ score: s.score, best: g.best, restartArmed: g.restartArmed, restart: g.restart, card: overCard }}
      onExit={onExit}
    />
  );
}
