// ChainGame.jsx — CHAIN mode screen. Loads the (lazy) word data, builds the pure engine,
// and drives it through the shared clock hook + shell. All rules live in chain.js; this
// file is glue + presentation.
import { useEffect, useLayoutEffect, useRef, useState, useMemo, useCallback } from 'react';
import { createChainEngine, DEAD_END_BELOW, FEW_LEFT_BELOW } from './chain.js';
import { loadSoloWords } from './words.js';
import { useSoloGame } from './useSoloGame.js';
import { PB_KEYS, bumpChainRuns } from './shared.js';
import { ChainNormalCard, ChainFirstRunCard } from './chainCards.jsx';
import { createTravelFx } from './chainTravelFx.js';
import SoloShell from './SoloShell.jsx';

const ACCENT = '#2EFFE0'; // cyan
const ARM_HINT = 'EVERY WORD STARTS WITH THE LAST LETTER OF THE ONE BEFORE';

// Static backdrop motif: a horizontal row of interlocking rounded-rect chain links,
// teal stroke, no fill, NO animation. Purely decorative (opacity .07 via .solo-motif).
const CHAIN_MOTIF = (
  <svg
    className="solo-motif"
    viewBox="0 0 400 120"
    preserveAspectRatio="xMidYMid slice"
    fill="none"
    stroke={ACCENT}
    strokeWidth="8"
    aria-hidden="true"
  >
    {/* alternating horizontal / vertical links, overlapping so they interlock */}
    <rect x="-18" y="42" width="86" height="46" rx="23" />
    <rect x="50" y="26" width="50" height="78" rx="25" />
    <rect x="90" y="42" width="86" height="46" rx="23" />
    <rect x="158" y="26" width="50" height="78" rx="25" />
    <rect x="198" y="42" width="86" height="46" rx="23" />
    <rect x="266" y="26" width="50" height="78" rx="25" />
    <rect x="306" y="42" width="86" height="46" rx="23" />
  </svg>
);

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
  // Persisted all-time CHAIN run count. onRunStart fires from the hook on the FIRST run
  // (mount) and on every restart — button OR Enter — so both restart paths are counted
  // (the Enter path lives inside the hook, which is why the bump must live there too).
  const [runs, setRuns] = useState(0);
  const g = useSoloGame({
    createEngine,
    adapter,
    pbKey: PB_KEYS.CHAIN,
    onRunStart: () => setRuns(bumpChainRuns()),
  });
  const s = g.engine.state;

  // ---- OUT → IN travel FX (presentational) -------------------------------------
  // Pooled: one traveler + one fader, reused for every accept (never a node per accept).
  // Geometry is measured on mount/resize by the helper; the accept path does no reflow.
  const rootRef = useRef(null);
  const travelerRef = useRef(null);
  const faderRef = useRef(null);
  const fxRef = useRef(null); // the createTravelFx() controller
  const prevKRef = useRef(s.k); // last links count we animated from
  const prevReqRef = useRef(s.requiredLetter); // the IN letter before this accept

  useLayoutEffect(() => {
    fxRef.current = createTravelFx({
      root: rootRef.current,
      traveler: travelerRef.current,
      fader: faderRef.current,
    });
    fxRef.current.measure();
    // A second measure after layout/fonts settle keeps the cached centres accurate.
    const raf = requestAnimationFrame(() => fxRef.current && fxRef.current.measure());
    const onResize = () => fxRef.current && fxRef.current.measure();
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  // Fire the travel whenever a link is accepted (links count increased). The traveler
  // carries the accepted word's LAST letter (from lastLinks, since the input is cleared
  // by accept); the fader carries the letter that was required before this accept.
  useEffect(() => {
    if (s.k > prevKRef.current) {
      const links = s.lastLinks;
      const travelLetter = links.length ? links[links.length - 1].word.slice(-1) : s.requiredLetter;
      if (fxRef.current) fxRef.current.play(travelLetter, prevReqRef.current);
    }
    prevKRef.current = s.k;
    prevReqRef.current = s.requiredLetter;
  }, [s.k, s.requiredLetter]);

  const fxLayer = (
    <div className="solo-fx" aria-hidden="true">
      <span className="solo-fx-glyph" ref={travelerRef} />
      <span className="solo-fx-glyph" ref={faderRef} />
    </div>
  );
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

  // First-run tutorial card: the player's very first CHAIN run (runs === 1), OR any run
  // that ended under 3 words — the runs where a how-to-play card beats a score card.
  const firstRun = runs === 1 || s.k < 3;
  const overCard = firstRun ? (
    <ChainFirstRunCard />
  ) : (
    <ChainNormalCard killedLetter={s.killedLetter} lastLinks={s.lastLinks} />
  );

  return (
    <SoloShell
      accent={ACCENT}
      title="Type a word starting with the letter"
      hud={hud}
      center={required.toUpperCase()}
      motif={CHAIN_MOTIF}
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
      armHint={ARM_HINT}
      rootRef={rootRef}
      fx={fxLayer}
      phase={g.phase}
      over={{
        score: s.score,
        best: g.best,
        restartArmed: g.restartArmed,
        restart: g.restart,
        card: overCard,
        bare: firstRun, // tutorial card: no SCORE/BEST line
        restartLabel: firstRun ? 'PLAY AGAIN' : 'RESTART',
      }}
      onExit={onExit}
    />
  );
}
