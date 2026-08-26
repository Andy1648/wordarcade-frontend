// FuseGame.jsx — FUSE mode screen. Loads the (lazy) word data + the fragment pools,
// builds the pure engine, and drives it through the shared clock hook + shell. Rules
// live in fuse.js; this file is glue + presentation.
import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { createFuseEngine } from './fuse.js';
import { loadSoloWords, loadSoloAcceptExt } from './words.js';
import { useSoloGame } from './useSoloGame.js';
import { recordRound, awardWins } from '../progress/wins.js';
import { touchStreak } from '../progress/streak.js';
import { PB_KEYS } from './shared.js';
import SoloShell from './SoloShell.jsx';
import poolsRaw from './fragmentPools.json';

const ACCENT = '#FFE94A'; // yellow (per-mode accent; CHAIN is teal #2EFFE0)

// Static backdrop motif: two curving cord paths, yellow stroke, round caps, NO
// animation. Purely decorative (opacity .07 via .solo-motif).
const FUSE_MOTIF = (
  <svg
    className="solo-motif"
    viewBox="0 0 400 120"
    preserveAspectRatio="xMidYMid slice"
    fill="none"
    stroke={ACCENT}
    strokeLinecap="round"
    aria-hidden="true"
  >
    <path d="M-20 44 C 70 6, 130 96, 210 52 S 350 14, 420 60" strokeWidth="9" />
    <path d="M-20 82 C 60 62, 150 26, 240 82 S 360 104, 420 70" strokeWidth="7" />
  </svg>
);
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
  // Each accepted FUSE word counts toward the daily streak (this mode never calls addWords).
  const g = useSoloGame({ createEngine, adapter, pbKey: PB_KEYS.FUSE, onAccept: touchStreak });
  const s = g.engine.state;

  // WINS (item 1): FUSE was never wired to pay out. On run-over, grant wins on the words solved
  // (the count the game already has) — same recordRound pattern SAT Rush uses. Fire ONCE per
  // run-end (guard reset on a fresh run); store the granted total for the game-over line. Also
  // lazy-load the acceptance extension here (never on mount).
  const [winsEarned, setWinsEarned] = useState(0);
  const winRecordedRef = useRef(false);
  useEffect(() => {
    if (g.phase === 'over') {
      loadSoloAcceptExt();
      if (!winRecordedRef.current) {
        winRecordedRef.current = true;
        setWinsEarned(recordRound({ mode: 'fuse', wordsAccepted: g.engine.state.wordsSolved }));
      }
    } else {
      winRecordedRef.current = false;
      setWinsEarned(0);
    }
  }, [g.phase]);

  // Live wins tally (item 2): what the run will pay so far, ticking up as words solve (0 until
  // the 3-word payout gate).
  const winsTally = awardWins({ mode: 'fuse', wordsAccepted: s.wordsSolved });

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
      motif={FUSE_MOTIF}
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
      winsTally={winsTally}
      winsWords={s.wordsSolved}
      over={{ score: s.wordsSolved, best: g.best, restartArmed: g.restartArmed, restart: g.restart, card: overCard, winsEarned }}
      onExit={onExit}
    />
  );
}
