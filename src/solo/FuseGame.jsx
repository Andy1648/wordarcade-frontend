// FuseGame.jsx — FUSE mode screen. Loads the (lazy) word data + the fragment pools,
// builds the pure engine, and drives it through the shared clock hook + shell. Rules
// live in fuse.js; this file is glue + presentation.
import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import '../frenzy/MechanicScale.css';
import { createFuseEngine } from './fuse.js';
import { loadSoloWords, loadSoloAcceptExt } from './words.js';
import { exampleContaining } from '../progress/teachExample.js';
import { loadGlossary, glossFor } from '../progress/glossary.js';
import MissedWordHold from '../components/MissedWordHold.jsx';
import { useSoloGame } from './useSoloGame.js';
import { bankWordWins, bankWeight, awardWordXp, subscribeWins, grantWins, perWordWins } from '../progress/wins.js';
import { startFrenzy, formatFrenzy, frenzyMinutes, FRENZY_MULT, FRENZY_TRIGGER_WORDS, isClutch, CLUTCH_WORDS } from '../progress/frenzy.js';
import ClutchBurst from '../frenzy/ClutchBurst.jsx';
import { useFrenzyClock } from '../frenzy/useFrenzyClock.js';
import FrenzyBurst from '../frenzy/FrenzyBurst.jsx';
import { cappedWordMult } from '../progress/xp.js';
import { recordAcceptedWord } from '../progress/collection.js';
import { noteWord } from '../progress/records.js';
import { loadRarityIndex, rarityOf } from '../progress/rarityIndex.js';
import { wpmStart, wpmAddWord, wpmEnd } from '../progress/wpmLive.js';
import RarityFlash from '../components/RarityFlash.jsx';
import { soloWordSlot } from '../juice/effectSlot.js';
import { tierCrossed } from '../juice/ladder.js';
import { useLatched } from '../components/FeelLadder.jsx';
import { useQueuedMoment } from '../lib/useQueuedMoment.js';
import { GAME_PRIORITY } from '../lib/moments.js';
import { touchStreak } from '../progress/streak.js';
import { PB_KEYS, bumpFuseRuns } from './shared.js';
import SoloShell from './SoloShell.jsx';
import { FuseNormalCard, FuseFirstRunCard } from './fuseCards.jsx';
import SoloLoadState from './SoloLoadState.jsx';
import TryModeRow from '../share/TryModeRow.jsx';
import ClaimPrompt from '../leaderboard/ClaimPrompt.jsx';
import poolsRaw from './fragmentPools.json';
import { formatNum } from '../format.js';

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
// One fuse cord = one life (this mode's death card literally reads "OUT OF FUSES"). A LIT
// cord is a braided yellow line with an orange flame at the tip; a SPENT one is a charred
// grey stub. Real vector art (SVG), static — the lit/spent flip is a STATE change on a
// life loss, never an idle loop.
function FuseCord({ lit }) {
  return (
    <svg className={`solo-cord${lit ? ' is-lit' : ''}`} viewBox="0 0 210 40" fill="none" aria-hidden="true">
      <path
        className="cord-line"
        d="M6 20 q 13 -13 26 0 t 26 0 t 26 0 t 26 0 t 26 0 t 26 0"
        strokeWidth="7"
        strokeLinecap="round"
      />
      {lit ? (
        <g className="cord-flame">
          {/* outer flame (orange) + inner (yellow) — a small cartoon petal at the tip */}
          <path className="flame-o" d="M188 20 c 9 -9 20 -6 16 6 c 6 -2 6 9 -2 14 c -6 4 -18 3 -20 -6 c -1 -6 1 -9 6 -14 z" />
          <path className="flame-i" d="M191 22 c 5 -5 12 -3 10 4 c 3 -1 3 6 -2 8 c -4 2 -10 1 -11 -4 c -1 -3 0 -5 3 -8 z" />
        </g>
      ) : (
        <circle className="cord-ash" cx="190" cy="20" r="4" />
      )}
    </svg>
  );
}

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'.split('');
const POOLS = {
  e: poolsRaw.e.split(' '),
  m: poolsRaw.m.split(' '),
  h: poolsRaw.h.split(' '),
  b: poolsRaw.b.split(' '),
};

export default function FuseGame({ onExit, offerMenu = false }) {
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [loadKey, setLoadKey] = useState(0);

  useEffect(() => {
    let live = true;
    setLoadError(false);
    // Edge state (Job 16): a failed word-data chunk fetch no longer strands the player on "…".
    loadSoloWords()
      .then((d) => {
        if (live) setData(d);
      })
      .catch(() => {
        if (live) setLoadError(true);
      });
    return () => {
      live = false;
    };
  }, [loadKey]);

  // STEERING WARM-UP: each letter's "leads to" set is a one-off ~50ms scan (cached for the session
  // in fuse.js). Build all 26 in idle slices while the player reads the screen, so the late-run
  // steering never stalls a keystroke on a slow Chromebook.
  useEffect(() => {
    if (!data) return undefined;
    const e = createFuseEngine({ accept: data.accept, pools: POOLS });
    const letters = 'jqxzvkwybgpfmhcudlrsntoiae'.split(''); // rarest first: the ones steering needs
    const idle = window.requestIdleCallback || ((cb) => setTimeout(() => cb({ timeRemaining: () => 0 }), 120));
    const cancel = window.cancelIdleCallback || clearTimeout;
    let id = null;
    const step = () => {
      const ch = letters.shift();
      if (!ch) return;
      e.fragmentsLeadingTo(ch);
      id = idle(step);
    };
    id = idle(step);
    return () => cancel(id);
  }, [data]);

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

  if (loadError || !data) {
    return (
      <SoloLoadState
        accent={ACCENT}
        error={loadError}
        onRetry={() => setLoadKey((k) => k + 1)}
        onExit={onExit}
      />
    );
  }
  return <FuseInner data={data} createEngine={createEngine} adapter={adapter} onExit={onExit} offerMenu={offerMenu} />;
}

function FuseInner({ data, createEngine, adapter, onExit, offerMenu }) {
  // Persisted all-time run count (modeAccess / nextMode read it). onRunStart fires from the hook
  // on the FIRST run (mount) and on every restart — button OR Enter — so both paths count.
  // Each accepted FUSE word counts toward the daily streak (this mode never calls addWords).
  const g = useSoloGame({
    createEngine,
    adapter,
    pbKey: PB_KEYS.FUSE,
    mode: 'fuse',
    onRunStart: () => { bumpFuseRuns(); },
    onAccept: touchStreak,
  });
  const s = g.engine.state;

  // WINS (§2): BANK per solved word as the run plays so leaving mid-run keeps what was earned —
  // no end-of-run payout (that would double-pay). `s.wordsSolved` is the running count; bank the
  // delta as it climbs, reset the ledger when a fresh run drops it to 0. Gated on 3 words.
  const [winsEarned, setWinsEarned] = useState(0);
  // BONUS CREDITS THIS RUN (Batch G). A collection milestone can land mid-run — every solo mode
  // calls recordAcceptedWord, and collection.js grants the milestone through the wins ledger — and
  // the end card used to show only the per-word money. The balance then moved by far more than the
  // card claimed, which is exactly the report that produced no-hidden-wins.spec.js: "I be here
  // getting like 800 but it gives like over 2k". That fix reached Word Bomb and Category Blitz
  // (App.jsx collects the same lines for GameScreen) and never reached the solo modes.
  //
  // Subscribed per RUN rather than reusing App's winsBonusLines: App resets that array on
  // game_started / round_start, neither of which fires for a solo run, so reusing it would list a
  // WELCOME BACK bonus from page load — or a milestone from the previous run — on this run's card.
  const [winsBonusLines, setWinsBonusLines] = useState([]);
  useEffect(() => subscribeWins((e) => {
    if (e && e.kind === 'bonus' && e.amount > 0) setWinsBonusLines((prev) => [...prev, e]);
  }), []);

  // FUSE FRENZY (frenzy.js): a full a–z strip starts 5 real minutes of ×5 wins. The engine counts
  // strips; a new one here starts/extends the clock, pays the trigger bonus through the labelled
  // door (so it is itemised on the receipt) and fires the burst.
  const frenzy = useFrenzyClock();
  const stripsRef = useRef(0);
  // Both are HEAVY moments played through the shared moments queue (useQueuedMoment): the payload
  // while it holds the queue, else null.
  const [burst, playBurst, endBurst] = useQueuedMoment(); // { key, bonus, started } — FRENZY trigger
  const [clutch, playClutch, endClutch] = useQueuedMoment(); // { key, leftMs, bonus } — STEP 56 CLUTCH
  const fuseBankedRef = useRef(0);
  const fuseWeightRef = useRef(0); // RARITY: running sum of solved words' rarity multipliers
  useEffect(() => {
    loadRarityIndex();
    wpmStart('fuse');
    return () => wpmEnd();
  }, []);
  useEffect(() => {
    const solved = s.wordsSolved || 0;
    if (solved < fuseBankedRef.current) {
      fuseBankedRef.current = 0;
      fuseWeightRef.current = 0;
      stripsRef.current = 0;
      wpmStart('fuse'); // fresh run → fresh WPM session
      setWinsEarned(0);
      setWinsBonusLines([]); // fresh run → the card itemises THIS run only
    }
    if (solved > fuseBankedRef.current) {
      // RARITY: score the just-solved word (s.lastWord, aligned with wordsSolved). A solve bumps
      // the count by 1; a rare jump credits the extra words at ×1.
      const delta = solved - fuseBankedRef.current;
      const prevWeight = fuseWeightRef.current;
      // COMBO (Job 2) + LUCKY (Job 4): the solved word's rarity is scaled by the live combo
      // multiplier AND the word's lucky factor (×5 on a hit, else ×1); jump filler stays ×1,
      // matching CHAIN. Capped at ×40 (Job 1). The SAME weight also grants XP (unified loop).
      const rw = rarityOf(s.lastWord);
      const wWeight = cappedWordMult(rw.mult, g.combo.mult, g.luckyMult);
      fuseWeightRef.current += bankWeight(wWeight, s.lastWord || '') + Math.max(0, delta - 1); // + LETTER FORGE
      awardWordXp({ mode: 'fuse', wordLength: (s.lastWord || '').length, weight: wWeight, word: s.lastWord || '' });
      recordAcceptedWord(s.lastWord, { mode: 'fuse', band: rw.band }); // Collection (Job 3)
      wpmAddWord(s.lastWord); // WPM: count the solved word's chars
      noteWord(s.lastWord, rw); // permanent record: distinct / obscure / rarest-ever (guarded)
      const banked = bankWordWins({
        mode: 'fuse',
        wordLength: (s.lastWord || '').length,
        prevWords: fuseBankedRef.current,
        nowWords: solved,
        prevWeight,
        nowWeight: fuseWeightRef.current,
      });
      fuseBankedRef.current = solved;
      if (banked > 0) setWinsEarned((prev) => prev + banked);
      // STEP 56 — CLUTCH: this word landed with ≤2 s on the fuse.
      const leftMs = g.lastLeftMsRef ? g.lastLeftMsRef.current : null;
      let clutchMoment = null;
      if (isClutch(leftMs)) {
        const cb = Math.round(CLUTCH_WORDS * perWordWins({ mode: 'fuse' }));
        if (cb > 0) grantWins(cb, 'CLUTCH!', { mode: 'fuse', detail: 'clutch' });
        clutchMoment = { key: Date.now(), leftMs, bonus: cb };
      }
      if ((s.stripsCleared || 0) > stripsRef.current) {
        stripsRef.current = s.stripsCleared;
        const fz = startFrenzy();
        frenzy.bump();
        // Priced AFTER the clock starts, so the bonus is quoted at the frenzy rate it advertises.
        // A clear during a running FRENZY doesn't extend it, but still pays this bonus.
        const bonus = Math.round(FRENZY_TRIGGER_WORDS * perWordWins({ mode: 'fuse' }));
        if (bonus > 0) grantWins(bonus, fz.started ? 'FRENZY!' : 'FULL STRIP', { mode: 'fuse', detail: 'frenzy' });
        // HEAVY moments go through the ONE moments queue (lib/moments.js): never two at once,
        // a gap between, FRENZY start outranks CLUTCH. Announced first so it plays first.
        playBurst(
          { key: Date.now(), bonus, started: fz.started },
          { id: `fuse-frenzy-${s.stripsCleared}-${solved}`, priority: GAME_PRIORITY.FRENZY_START, maxMs: 2400 }
        );
      }
      if (clutchMoment) {
        // Queued behind a FRENZY burst on the same word (as before, it waited for the burst); a
        // CLUTCH that cannot get its turn within 3s is dropped rather than celebrated late.
        playClutch(clutchMoment, {
          id: `fuse-clutch-${solved}`,
          priority: GAME_PRIORITY.CLUTCH,
          maxMs: 1800,
          expireMs: 3000,
        });
      }
    }
  }, [s.wordsSolved]);
  // Lazy-load the acceptance extension on run-over (never on mount) — unrelated to wins.
  useEffect(() => {
    if (g.phase === 'over') loadSoloAcceptExt();
  }, [g.phase]);

  // Live wins tally (item 2): what the run HAS BANKED so far — the same running total the end
  // card shows (H6/H1: the old `awardWins(wordCount)` estimate ignored length/rarity/combo/forge
  // and disagreed with the bank). 0 until the 3-word payout gate.
  const winsTally = winsEarned;

  const hud = (
    <>
      <div className="solo-stat">
        <b>{formatNum(s.wordsSolved)}</b>
        <span>WORDS · BEST {formatNum(g.best)}</span>
      </div>
      <div className="solo-lives" aria-label={`${s.lives} lives`}>
        {'♥'.repeat(s.lives)}
        <span style={{ opacity: 0.3 }}>{'♡'.repeat(Math.max(0, 3 - s.lives))}</span>
      </div>
    </>
  );

  // LOWER DECK (fill): FUSE's own elements at the size they deserve — the three lives drawn
  // as burning fuse cords (lit = a fuse still going, charred = spent), and the letters-used
  // strip as a real band. JOB 8: the "N/26 LETTERS USED" label is GONE — the lit tiles ARE
  // the count, and a caption under a thing that already says it is chrome, not information.
  const fuseDeck = (
    <div className="solo-fusedeck" aria-hidden="true">
      <div className="solo-cords">
        {[0, 1, 2].map((i) => (
          <FuseCord key={i} lit={i < s.lives} />
        ))}
      </div>
      {/* THE GOAL, SAID ONCE (Andy oct2: FRENZY must be OBVIOUS in-game). Dark: what the strip is
          for. Live: the countdown, in the mode's flame orange. */}
      <div className={`solo-frenzy-goal${frenzy.active ? ' is-live' : ''}${frenzy.active && frenzy.ms <= 10000 ? ' is-ending' : ''}`}>
        {frenzy.active ? `FRENZY ×${FRENZY_MULT} · ${formatFrenzy(frenzy.ms)}` : `LIGHT ALL LETTERS → FRENZY ×${FRENZY_MULT} FOR ${frenzyMinutes()} MIN`}
      </div>
      <div className="solo-strip-big">
        {ALPHABET.map((ch) => (
          <span key={ch} className={s.lettersUsed.has(ch) ? 'is-lit' : ''}>
            {ch}
          </span>
        ))}
      </div>
    </div>
  );

  // Tutorial card (Job 14): any run that ended under 3 words (nothing banked yet). Matches CHAIN.
  // H6: no longer fires on run #1 regardless — that hid a real first run's WINS EARNED.
  const firstRun = s.wordsSolved < 3;
  // PAUSE TO LEARN — same shape as CHAIN. FUSE ends on a FRAGMENT it could not place, so the
  // word held is one that would have satisfied it, skipping everything already solved.
  const missedWord = g.phase === 'over' && data
    ? exampleContaining(data.recall, s.fragment, (w) => s.used.has(w))
    : null;
  const [glossTick, setGlossTick] = useState(0);
  useEffect(() => {
    if (!missedWord) return;
    loadGlossary().then(() => setGlossTick((n) => n + 1));
  }, [missedWord]);
  // THE HOLD IS ON BOTH CARDS. It sits outside the first-run branch on purpose: a run that ends
  // under three words gets the TUTORIAL card, and that is exactly the player who most needs to be
  // shown a word that would have worked. Putting the lesson only on the score card would have
  // hidden it from every beginner — which is the same mistake the old one-flag teach made.
  const overCard = (
    <>
      {firstRun ? <FuseFirstRunCard /> : (
      <FuseNormalCard fragment={s.fragment} wordsSolved={s.wordsSolved} />
      )}
      {/* The RESULT leads, the hint follows (fine-tune oct2: "you could have played" sat above
          the card's own title and outshouted it). */}
      <MissedWordHold
        key={glossTick}
        word={missedWord}
        gloss={glossFor(missedWord)}
        prompt={s.fragment}
        promptLabel="A WORD CONTAINING"
      />
    </>
  );

  // THE LIGHT SLOT for the word just solved (juice/effectSlot.js): CLUTCH > LUCKY > RARE > TIER-UP.
  // One plays; the rest are said as a small tag. Everything here is THIS word's (the clock left at
  // its accept, its lucky factor, its rarity, whether it crossed a combo tier), LATCHED per word so a
  // later change (a reject, a timeout) can never mount a word's effect late.
  const fuseRarity = s.wordsSolved > 0 ? rarityOf(s.lastWord) : null;
  const fuseSlot = useLatched(s.wordsSolved, () =>
    s.wordsSolved > 0
      ? soloWordSlot({
          clutch: isClutch(g.lastLeftMsRef ? g.lastLeftMsRef.current : null),
          luckyMult: g.luckyMult,
          rarity: fuseRarity,
          tierUp: tierCrossed(g.combo.streak - 1, g.combo.streak),
        })
      : { main: 'hype', tags: [], showRarity: false, labels: [] }
  );

  return (
    <>
    {fuseSlot.showRarity && <RarityFlash key={s.wordsSolved} rarity={fuseRarity} />}
    {burst && <FrenzyBurst key={burst.key} bonus={burst.bonus} started={burst.started} onDone={endBurst} />}
    {clutch && <ClutchBurst key={clutch.key} leftMs={clutch.leftMs} bonus={clutch.bonus} onDone={endClutch} />}
    <SoloShell
      mode="fuse"
      accent={ACCENT}
      title="Type a word containing the fragment"
      hud={hud}
      center={(s.fragment || '').toUpperCase()}
      motif={FUSE_MOTIF}
      supply={s.shortPenalty ? <span className="is-dead">SHORT WORD — FUSE {Math.round((1 - s.shortFactor) * 100)}% SHORTER</span> : null}
      clock={{ remaining: g.remaining, tMax: g.tMax, redZone: g.redZone, armed: g.armed }}
      deck={fuseDeck}
      input={g.input}
      onInput={g.onInput}
      onSubmit={g.onSubmit}
      sillKey={g.sillKey}
      reason={g.reason}
      placeholder={`SNEAK "${(s.fragment || '').toUpperCase()}" INTO A WORD`}
      maxLength={data.maxAcceptLen}
      armHint="SNEAK THOSE LETTERS INTO A WORD"
      /* FIRST-RUN TEACH (per mode) — a real word containing the fragment that is on screen right
         now, skipping any already solved, so copying it always works. */
      teachMode="fuse"
      teachRule="THE LETTERS SHOWN MUST APPEAR SOMEWHERE IN IT"
      teachExample={data ? exampleContaining(data.recall, s.fragment, (w) => s.used.has(w)) : null}
      phase={g.phase}
      winsTally={winsTally}
      winsWords={s.wordsSolved}
      comboMult={g.combo.mult}
      comboBreaks={g.combo.breaks}
      comboStreak={g.combo.streak}
      luckyKey={g.luckyKey}
      slotMain={fuseSlot.main}
      slotTags={fuseSlot.labels}
      slotKey={s.wordsSolved}
      over={{
        score: s.wordsSolved,
        best: g.best,
        restartArmed: g.restartArmed,
        restart: g.restart,
        card: overCard,
        bare: firstRun, // tutorial card: no SCORE/BEST line (Job 14)
        restartLabel: firstRun ? 'PLAY AGAIN' : 'RESTART',
        winsEarned,
        winsBonusLines,
        // FUSE's score IS its word count, so a PTS fragment would just repeat the number on the
        // same line — omit it (points=null). The alphabet strip rides the glyph row instead:
        // "LETTERS n/26", the live count of distinct letters lit this cycle.
        tryRow: (
          <>
            <ClaimPrompt />
            <TryModeRow current="fuse" />
          </>
        ),
      }}
      onExit={onExit}
      offerMenu={offerMenu}
    />
    </>
  );
}
