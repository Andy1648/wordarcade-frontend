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
import { loadRarityIndex, rarityOf } from '../progress/rarityIndex.js';
import { wpmStart, wpmAddWord, wpmEnd } from '../progress/wpmLive.js';
import WordLanding, { hasLanding } from '../components/WordLanding.jsx';
import { touchStreak } from '../progress/streak.js';
import { PB_KEYS, bumpFuseRuns, SOLO_REDUCED } from './shared.js';
import SoloShell from './SoloShell.jsx';
import { FuseNormalCard, FuseFirstRunCard } from './fuseCards.jsx';
import { BurningCord, FragmentSlab, FuseLifeCord, DefusedWord } from './FuseArt.jsx';
import SoloLoadState from './SoloLoadState.jsx';
import CopyResultButton from '../share/CopyResultButton.jsx';
import TryModeRow from '../share/TryModeRow.jsx';
import poolsRaw from './fragmentPools.json';

// FUSE'S OWN COLOUR SCRIPT. CHAIN is teal #2EFFE0; FUSE is ORANGE — the fuse-and-fire end of
// the house palette, and nothing CHAIN uses. It is spent on ONE thing: the FRAGMENT (the slab,
// its glyph, and the same letters found again inside a word you defused). The cord is a pale
// rope, the ember is red/yellow, danger is #FF4B4B. See FuseArt.jsx.
const ACCENT = '#FF6B3D'; // orange

// Static backdrop motif: two curving cord paths, round caps, NO animation. Purely decorative
// (opacity .07 via .solo-motif). Drawn in the MUTED lilac, never the accent — FUSE spends its
// accent on the fragment and on nothing else, backdrop included.
const FUSE_MOTIF = (
  <svg
    className="solo-motif"
    viewBox="0 0 400 120"
    preserveAspectRatio="xMidYMid slice"
    fill="none"
    stroke="#b9a7d6"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <path d="M-20 44 C 70 6, 130 96, 210 52 S 350 14, 420 60" strokeWidth="9" />
    <path d="M-20 82 C 60 62, 150 26, 240 82 S 360 104, 420 70" strokeWidth="7" />
  </svg>
);
// Module-scope so their identity is stable across FuseInner renders (the shell re-renders
// every animation frame while the clock runs).
const renderCord = (clock) => <BurningCord {...clock} />;
const renderSlab = (fragment) => <FragmentSlab fragment={fragment} />;

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
  // The word that just landed, for the reaction above the field: { key, word, band, wins }.
  const [landing, setLanding] = useState(null);
  // THE DEFUSED TRAIL — every word this run, with the fragment it matched. `s.lastFragment` is
  // the fragment as of the accept (the engine has already served the next one by then), which
  // is what lets the trail pick those exact letters out of the word.
  const [defused, setDefused] = useState([]);
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
      setDefused([]); // fresh run → empty trail
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
      fuseWeightRef.current += wWeight + Math.max(0, delta - 1);
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
      // THE PAYOFF, in the deck: the word, with the fragment it matched picked out of it.
      if (s.lastWord) {
        setDefused((prev) => [...prev, { key: solved, word: s.lastWord, frag: s.lastFragment }].slice(-6));
      }
      // THE REACTION, at the field — the same ladder Word Bomb lands, on the word just solved.
      if (s.lastWord && hasLanding(rw.band, null)) {
        setLanding({ key: solved, word: s.lastWord, band: rw.band, wins: banked });
      }
    }
  }, [s.wordsSolved]);
  // Clear the reaction when a run ends, so it never hangs over the death card.
  useEffect(() => {
    if (g.phase !== 'playing') setLanding(null);
  }, [g.phase]);

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
      {/* LIVES = SPARE FUSES. Hearts were both off-metaphor (the death card reads OUT OF
          FUSES) and a DUPLICATE of the three big cords that used to sit in the deck; the
          cords move up here, the deck space goes to the defused trail. */}
      <div className="solo-lives fuse-lives" aria-label={`${s.lives} fuses left`}>
        {[0, 1, 2].map((i) => (
          <FuseLifeCord key={i} lit={i < s.lives} />
        ))}
      </div>
    </>
  );

  // LOWER DECK (fill): the DEFUSED TRAIL is the composition — each word you got, with the
  // fragment it matched picked out of it, so the payoff has somewhere to live after the
  // one-second rarity chip has gone. Under it, the letters-used strip (a real mechanic: a
  // full a–z grants a spare fuse). The three life cords moved to the HUD; they were a
  // duplicate of the hearts that used to sit there.
  const usedCount = s.lettersUsed.size;
  const ghostCount = Math.max(0, 4 - defused.length);
  const fuseDeck = (
    <div className="solo-fusedeck" aria-hidden="true">
      <div className="solo-deck-label">DEFUSED</div>
      <div className="fuse-trail">
        {defused.slice(-4).map((d) => (
          <DefusedWord key={d.key} word={d.word} fragment={d.frag} />
        ))}
        {Array.from({ length: ghostCount }).map((_, i) => (
          <span className="fd-chip is-ghost" key={`ghost-${i}`}>
            ···
          </span>
        ))}
      </div>
      <div className="solo-strip-big">
        {ALPHABET.map((ch) => (
          <span key={ch} className={s.lettersUsed.has(ch) ? 'is-lit' : ''}>
            {ch}
          </span>
        ))}
      </div>
      <div className="solo-deck-hint">
        {usedCount}/26 LETTERS
        <span className="fd-hint-more"> · FULL SET = SPARE FUSE</span>
      </div>
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
    <SoloShell
      reaction={landing && (
        <WordLanding
          key={landing.key}
          word={landing.word}
          band={landing.band}
          wins={landing.wins}
          reduced={SOLO_REDUCED}
        />
      )}
      accent={ACCENT}
      mode="fuse"
      title="Type a word containing the fragment"
      hud={hud}
      center={(s.fragment || '').toUpperCase()}
      motif={FUSE_MOTIF}
      supply={s.shortPenalty ? <span className="is-dead">SHORT WORD — fuse ×{s.shortFactor}</span> : null}
      clock={{ remaining: g.remaining, tMax: g.tMax, redZone: g.redZone, armed: g.armed }}
      // FUSE's own clock + hero art (the shared ring / `.solo-center` stay CHAIN's).
      clockArt={renderCord}
      centerArt={renderSlab}
      deck={fuseDeck}
      input={g.input}
      onInput={g.onInput}
      onSubmit={g.onSubmit}
      sillKey={g.sillKey}
      reason={g.reason}
      placeholder={`SNEAK "${(s.fragment || '').toUpperCase()}" INTO A WORD`}
      maxLength={data.maxAcceptLen}
      // NOT "SNEAK THOSE LETTERS INTO A WORD" — that is word-for-word what the field's own
      // placeholder already says, stacked eight pixels under it. The arm hint's job is the
      // one thing the placeholder does not say: the cord is not lit yet.
      armHint="THE CORD LIGHTS ON YOUR FIRST KEYSTROKE"
      firstRunRule="SNEAK THE LETTERS INTO A WORD"
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
        // FUSE's score IS its word count, so a PTS fragment would just repeat the number on the
        // same line — omit it (points=null). The alphabet strip rides the glyph row instead:
        // "LETTERS n/26", the live count of distinct letters lit this cycle.
        share: (
          <CopyResultButton
            mode="fuse"
            words={s.wordsSolved}
            points={null}
            tiers={g.tierLog}
            killed
            suffix={`LETTERS ${s.lettersUsed.size}/26`}
            className="solo-share-btn"
          />
        ),
        tryRow: <TryModeRow current="fuse" />,
      }}
      onExit={onExit}
    />
    </>
  );
}
