// FuseGame.jsx — FUSE mode screen. Loads the (lazy) word data + the fragment pools,
// builds the pure engine, and drives it through the shared clock hook + shell. Rules
// live in fuse.js; this file is glue + presentation.
import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { createFuseEngine } from './fuse.js';
import { loadSoloWords, loadSoloAcceptExt } from './words.js';
import { useSoloGame } from './useSoloGame.js';
import { bankWordWins, awardWins } from '../progress/wins.js';
import { awardWordXp, cappedWordMult } from '../progress/xp.js';
import { recordAcceptedWord } from '../progress/collection.js';
import { noteWord } from '../progress/records.js';
import { wordSenseWinsFactor } from '../progress/wordSense.js';
import { loadRarityIndex, rarityOf } from '../progress/rarityIndex.js';
import { wpmStart, wpmAddWord, wpmEnd } from '../progress/wpmLive.js';
import RarityFlash from '../components/RarityFlash.jsx';
import { touchStreak } from '../progress/streak.js';
import { PB_KEYS, bumpFuseRuns } from './shared.js';
import SoloShell from './SoloShell.jsx';
import { FuseNormalCard, FuseFirstRunCard } from './fuseCards.jsx';
import SoloLoadState from './SoloLoadState.jsx';
import CopyResultButton from '../share/CopyResultButton.jsx';
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

export default function FuseGame({ onExit }) {
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
  return <FuseInner data={data} createEngine={createEngine} adapter={adapter} onExit={onExit} />;
}

function FuseInner({ data, createEngine, adapter, onExit }) {
  // Persisted all-time FUSE run count (Job 14) — drives the first-run tutorial card, exactly like
  // CHAIN. onRunStart fires from the hook on the first run + every restart (button OR Enter).
  const [runs, setRuns] = useState(0);
  // Each accepted FUSE word counts toward the daily streak (this mode never calls addWords).
  const g = useSoloGame({
    createEngine,
    adapter,
    pbKey: PB_KEYS.FUSE,
    mode: 'fuse',
    onRunStart: () => setRuns(bumpFuseRuns()),
    onAccept: touchStreak,
  });
  const s = g.engine.state;

  // WINS (§2): BANK per solved word as the run plays so leaving mid-run keeps what was earned —
  // no end-of-run payout (that would double-pay). `s.wordsSolved` is the running count; bank the
  // delta as it climbs, reset the ledger when a fresh run drops it to 0. Gated on 3 words.
  const [winsEarned, setWinsEarned] = useState(0);
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
      wpmStart('fuse'); // fresh run → fresh WPM session
      setWinsEarned(0);
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
      fuseWeightRef.current += wWeight * wordSenseWinsFactor(rw.mult) + Math.max(0, delta - 1); // WORD SENSE (Job 4)
      awardWordXp({ mode: 'fuse', wordLength: (s.lastWord || '').length, weight: wWeight });
      recordAcceptedWord(s.lastWord, { mode: 'fuse', band: rw.band }); // Collection (Job 3)
      wpmAddWord(s.lastWord); // WPM: count the solved word's chars
      noteWord(s.lastWord, rw); // permanent record: distinct / obscure / rarest-ever (guarded)
      const banked = bankWordWins({
        mode: 'fuse',
        prevWords: fuseBankedRef.current,
        nowWords: solved,
        prevWeight,
        nowWeight: fuseWeightRef.current,
      });
      fuseBankedRef.current = solved;
      if (banked > 0) setWinsEarned((prev) => prev + banked);
    }
  }, [s.wordsSolved]);
  // Lazy-load the acceptance extension on run-over (never on mount) — unrelated to wins.
  useEffect(() => {
    if (g.phase === 'over') loadSoloAcceptExt();
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

  // LOWER DECK (fill): FUSE's own elements at the size they deserve — the three lives drawn
  // as burning fuse cords (lit = a fuse still going, charred = spent), and the letters-used
  // strip enlarged into a real band. Fills the lower half instead of two thin strips at top.
  const usedCount = s.lettersUsed.size;
  const fuseDeck = (
    <div className="solo-fusedeck" aria-hidden="true">
      <div className="solo-cords">
        {[0, 1, 2].map((i) => (
          <FuseCord key={i} lit={i < s.lives} />
        ))}
      </div>
      <div className="solo-strip-big">
        {ALPHABET.map((ch) => (
          <span key={ch} className={s.lettersUsed.has(ch) ? 'is-lit' : ''}>
            {ch}
          </span>
        ))}
      </div>
      <div className="solo-deck-label">{usedCount}/26 LETTERS USED</div>
    </div>
  );

  // First-run tutorial card (Job 14): the player's very first FUSE run (runs === 1), OR any run
  // that ended under 3 words — the runs where a how-to-play card beats a score card. Matches CHAIN.
  const firstRun = runs === 1 || s.wordsSolved < 3;
  const overCard = firstRun ? (
    <FuseFirstRunCard />
  ) : (
    <FuseNormalCard fragment={s.fragment} wordsSolved={s.wordsSolved} />
  );

  return (
    <>
    <RarityFlash key={s.wordsSolved} rarity={rarityOf(s.lastWord)} />
    <SoloShell
      accent={ACCENT}
      title="Type a word containing the fragment"
      hud={hud}
      center={(s.fragment || '').toUpperCase()}
      motif={FUSE_MOTIF}
      supply={s.shortPenalty ? <span className="is-dead">SHORT WORD — next fuse ×0.8</span> : null}
      clock={{ remaining: g.remaining, tMax: g.tMax, redZone: g.redZone, armed: g.armed }}
      deck={fuseDeck}
      input={g.input}
      onInput={g.onInput}
      onSubmit={g.onSubmit}
      sillKey={g.sillKey}
      reason={g.reason}
      placeholder={`any word containing "${(s.fragment || '').toUpperCase()}"`}
      maxLength={data.maxAcceptLen}
      armHint="TYPE ANY WORD THAT CONTAINS THE PIECE"
      firstRunRule="USE THE FRAGMENT IN A WORD"
      phase={g.phase}
      winsTally={winsTally}
      winsWords={s.wordsSolved}
      comboMult={g.combo.mult}
      comboBreaks={g.combo.breaks}
      luckyKey={g.luckyKey}
      over={{
        score: s.wordsSolved,
        best: g.best,
        restartArmed: g.restartArmed,
        restart: g.restart,
        card: overCard,
        bare: firstRun, // tutorial card: no SCORE/BEST line (Job 14)
        restartLabel: firstRun ? 'PLAY AGAIN' : 'RESTART',
        winsEarned,
        // FUSE score == word count, so pts is redundant — omit it (points=null).
        share: (
          <CopyResultButton
            mode="fuse"
            words={s.wordsSolved}
            points={null}
            tiers={g.tierLog}
            killed
            className="solo-share-btn"
          />
        ),
      }}
      onExit={onExit}
    />
    </>
  );
}
