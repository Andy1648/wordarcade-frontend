// FuseGame.jsx — FUSE mode screen. Loads the (lazy) word data + the fragment pools,
// builds the pure engine, and drives it through the shared clock hook + shell. Rules
// live in fuse.js; this file is glue + presentation.
import { useEffect, useState, useMemo, useCallback } from 'react';
import { createFuseEngine } from './fuse.js';
import { loadSoloWords } from './words.js';
import { useSoloGame } from './useSoloGame.js';
import { PB_KEYS } from './shared.js';
import SoloShell from './SoloShell.jsx';
import poolsRaw from './fragmentPools.json';

const ACCENT = '#FF6B3D'; // orange
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'.split('');
const POOLS = {
  e: poolsRaw.e.split(' '),
  m: poolsRaw.m.split(' '),
  h: poolsRaw.h.split(' '),
  b: poolsRaw.b.split(' '),
};

export default function FuseGame({ onExit }) {
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

  const createEngine = useCallback(() => {
    const e = createFuseEngine({ accept: data.accept, pools: POOLS });
    e.start(); // serve the first fragment so the shell has something to show
    return e;
  }, [data]);

  const adapter = useMemo(
    () => ({
      budgetMs: (e) => e.state.fuseMs,
      onTimeout: (e) => {
        const r = e.expire();
        return { dead: r.ended };
      },
      getScore: (e) => e.state.wordsSolved,
      getWords: (e) => e.state.wordsSolved,
      rejectCtx: (e) => ({ fragment: e.state.fragment }),
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
  return <FuseInner data={data} createEngine={createEngine} adapter={adapter} onExit={onExit} />;
}

function FuseInner({ data, createEngine, adapter, onExit }) {
  const g = useSoloGame({ createEngine, adapter, pbKey: PB_KEYS.FUSE });
  const s = g.engine.state;

  const hud = (
    <>
      <div className="solo-stat">
        <b>{s.wordsSolved}</b>
        <span>WORDS · BEST {g.best}</span>
      </div>
      <div className="solo-lives" aria-label={`${s.lives} lives`}>
        {'♥'.repeat(s.lives)}
        <span style={{ opacity: 0.3 }}>{'♡'.repeat(Math.max(0, 3 - s.lives))}</span>
      </div>
    </>
  );

  const strip = (
    <div className="solo-strip" aria-hidden="true">
      {ALPHABET.map((ch) => (
        <span key={ch} className={s.lettersUsed.has(ch) ? 'is-lit' : ''}>
          {ch}
        </span>
      ))}
    </div>
  );

  const overCard = (
    <>
      <h2>OUT OF FUSES</h2>
      <div className="solo-death-killed">the last fragment was “{(s.fragment || '').toUpperCase()}”</div>
      <div className="solo-death-links">
        <span>{s.wordsSolved} words defused</span>
      </div>
    </>
  );

  return (
    <SoloShell
      accent={ACCENT}
      title="Type a word containing the fragment"
      hud={hud}
      center={(s.fragment || '').toUpperCase()}
      supply={
        <>
          {s.shortPenalty ? <div className="is-dead">SHORT WORD — next fuse ×0.8</div> : null}
          {strip}
        </>
      }
      clock={{ remaining: g.remaining, tMax: g.tMax, redZone: g.redZone, armed: g.armed }}
      input={g.input}
      onInput={g.onInput}
      onSubmit={g.onSubmit}
      sillKey={g.sillKey}
      reason={g.reason}
      placeholder={`type a word with "${(s.fragment || '').toUpperCase()}" in it`}
      maxLength={data.maxAcceptLen}
      armHint="TYPE ANY WORD THAT CONTAINS THE PIECE"
      phase={g.phase}
      over={{ score: s.wordsSolved, best: g.best, restartArmed: g.restartArmed, restart: g.restart, card: overCard }}
      onExit={onExit}
    />
  );
}
