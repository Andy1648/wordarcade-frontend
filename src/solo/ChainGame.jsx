// ChainGame.jsx — CHAIN mode screen. Loads the (lazy) word data, builds the pure engine,
// and drives it through the shared clock hook + shell. All rules live in chain.js; this
// file is glue + presentation.
import { useEffect, useState, useMemo, useCallback } from 'react';
import { createChainEngine } from './chain.js';
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

function ChainInner({ createEngine, adapter, onExit }) {
  const g = useSoloGame({ createEngine, adapter, pbKey: PB_KEYS.CHAIN });
  const s = g.engine.state;
  const required = s.requiredLetter;
  const supply = g.engine.supply(required);

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
      input={g.input}
      onInput={g.onInput}
      onSubmit={g.onSubmit}
      sillKey={g.sillKey}
      reason={g.reason}
      placeholder={`start with "${required.toUpperCase()}" — min 3 letters`}
      phase={g.phase}
      over={{ score: s.score, best: g.best, restartArmed: g.restartArmed, restart: g.restart, card: overCard }}
      onExit={onExit}
    />
  );
}
