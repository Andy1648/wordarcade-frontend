// useSatRushGame.js — the game loop. Owns the wall clock (stage timers, grace,
// between-word pauses) and the keyboard, and drives engine.js + input.js. It
// reimplements NO game rule: every score/tier/heat/revenant decision comes from
// the engine, every slot/alt decision from input.js. Timing constants that ARE
// rules (deep-cut interval scale, grace length) are read from engine.config; the
// only thing this hook decides is the base stage interval (dev-tunable).
import { useReducer, useRef, useEffect, useCallback } from 'react';
import { createSatRushEngine, DEFAULT_CONFIG, effectiveStageIntervalMs, lineupWindowMs } from './engine';
import { createSlotInput } from './input';
import { clearRunTimers } from './runTimers';
import { readRecentWords, pushRecentWord } from './recentWords';
import * as lexicon from './lexicon';
import { pickBriefing } from './briefing';
import { suspectsStanding } from './suspects';
import WORDS from '../data/satRush/words.json';
import { track } from '../lib/analytics';
import { wpmKeyStroke } from '../progress/wpmLive';
import { addWords } from '../wordCount';
import {
  SAT_RUSH_STAGE_MS,
  SAT_RUSH_LINEUP_SCALE,
  SAT_RUSH_SCENE,
  SAT_RUSH_DEV_TUNER,
  SAT_RUSH_FREEZE,
  SAT_RUSH_LOCK,
} from './config';
import * as juice from './juice';

const POS_LABEL = { adj: 'adjective', n: 'noun', v: 'verb', adv: 'adverb' };
const CLEAR_PAUSE_MS = 850;
const MISS_PAUSE_MS = 1800; // the miss now TEACHES (sentence + def + cousin), so hold a beat longer
// A clear that leaned on more than the free first letter didn't really land — it
// gets the same re-encode beat as a miss, over the (longer) heavy-clear pause.
const HEAVY_REVEAL_MIN = 2;
const HEAVY_CLEAR_PAUSE_MS = 1800;

// localStorage, but access-safe: even reading window.localStorage can throw in a
// locked-down browser. lexicon.load/save also guard, so a null here just means
// "remember nothing" — the mode plays fully in memory.
function safeStorage() {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function useSatRushGame() {
  const [, force] = useReducer((x) => x + 1, 0);

  const engineRef = useRef(null);
  const inputRef = useRef(null);
  const phaseRef = useRef('start'); // 'start' | 'mode' | 'briefing' | 'playing' | 'over'
  // The mode of the CURRENT run: 'briefing' (study screen + spell-along net) or
  // 'lineup' (suspect lineup, no spell-along). Chosen at mode-select and fixed for
  // the run; it drives the engine config, the final-stage endgame, and every event.
  const modeRef = useRef('briefing');
  const pendingRef = useRef('idle'); // 'idle' | 'clear' | 'miss' — the between-word pause
  const msgRef = useRef(null); // { text, kind }

  // ---- learning memory (lexicon) + THE BRIEFING ----
  const storageRef = useRef(null);
  if (storageRef.current === null) storageRef.current = safeStorage();
  const lexRef = useRef(null);
  if (lexRef.current === null) lexRef.current = lexicon.load(storageRef.current);
  const briefingRef = useRef(null); // the current run's { words, familyMorpheme, reviewCount, reviewWords }
  const briefedSetRef = useRef(new Set()); // word strings briefed this run (for wasBriefed analytics)
  const dwellStartRef = useRef(null); // performance.now() when the briefing screen opened
  // The re-encode BEAT shown during the between-word pause on a miss (or a clear
  // that leaned on the spell-along): sentence filled in + definition + one cousin.
  // { word, context, gloss, cousin, kind: 'miss' | 'weak' } | null
  const reEncodeRef = useRef(null);
  const prevSilverRef = useRef(false);
  const fxRef = useRef({ shake: 0, badIndex: -1, badKey: 0 }); // transient visual cues
  // The paper stamp shown on the page's top corner. One at a time; set at each
  // event (clear/miss/revenant entry), cleared at the next fresh word. `id` bumps
  // per set so the component re-keys and the PUNCH-in replays.
  const stampRef = useRef(null); // { text, tone, kind, id } | null
  const stampSeq = useRef(0);
  const pauseTimer = useRef(null);
  const stageTimer = useRef(null);
  // The full spell-along drain window (ms), fixed at final-stage entry so the
  // AnteMeter's drain bar spans the whole endgame without restarting per reveal.
  const graceMsRef = useRef(0);

  // Dev-tunable settings. Stage/spell intervals seed from the config defaults (the
  // stage interval also honours the ?stage= override) and can be changed live
  // without restarting; the structural knobs apply on next game. deepEvery/climb
  // mirror the engine's deepCutEvery/tierEvery defaults so the tuner starts in
  // sync with the shipped values.
  const cfgRef = useRef({
    stageMs: SAT_RUSH_STAGE_MS,
    spellMs: DEFAULT_CONFIG.spellAlongMs,
    // LINEUP-only stage-cadence multiplier (seeds from the ?lineupx= escape hatch,
    // live-tunable). Applied to the stage delay in lineup runs only — never to the
    // last-call window, never in briefing.
    lineupScale: SAT_RUSH_LINEUP_SCALE,
    deepEvery: DEFAULT_CONFIG.deepCutEvery,
    revGap: DEFAULT_CONFIG.revenantOffset,
    climb: DEFAULT_CONFIG.tierEvery,
  });

  // Cancel both run-clock timers (see runTimers.js). The single stop path used by
  // abandon + unmount, so no queued doMiss / stage tick fires after a run ends.
  const clearTimers = () => clearRunTimers(pauseTimer, stageTimer);

  // Persist the learning memory (fire-and-forget, guarded). Called after each
  // recorded outcome and on unmount, so a mid-run exit is never lost.
  const persistLexicon = useCallback(() => {
    lexicon.save(storageRef.current, lexRef.current);
  }, []);

  // Fire-and-forget analytics. Every SAT RUSH event carries `game:'sat-rush'` (the
  // stable namespace so the shared event names never collide with other modes) AND
  // `mode:'briefing'|'lineup'` — the sub-mode is THE experiment: cleared-rate and
  // 7-day return, briefing vs lineup. `word_resolved`'s `stage`/`suspectsStanding`
  // answer whether players are actually anteing (answering early).
  const trackSR = useCallback((event, props = {}) => {
    track(event, { game: 'sat-rush', mode: modeRef.current, ...props });
  }, []);

  const trackRunEnd = useCallback(() => {
    const r = engineRef.current.results();
    trackSR('run_end', {
      score: r.score,
      cleared: r.cleared,
      bestStreak: r.bestStreak,
      avgAnte: r.avgAnte,
      mastered: lexicon.masteredCount(lexRef.current),
    });
    persistLexicon();
  }, [persistLexicon, trackSR]);

  // ---- engine/input orchestration (no rules here) ----
  const beginWord = useCallback(() => {
    const eng = engineRef.current;
    const cur = eng.nextWord();
    if (!cur) {
      trackRunEnd(); // pool exhausted — the run ends
      phaseRef.current = 'over';
      force();
      return;
    }
    // Remember every FRESHLY drawn word (not revenant re-entries) so future runs
    // deprioritize it. Persisted immediately, so a mid-run quit still counts.
    if (!cur.isRevenant) pushRecentWord(cur.word);
    trackSR('word_served', {
      tier: cur.tier,
      isDeepCut: cur.isDeepCut,
      isRevenant: cur.isRevenant,
      wasBriefed: !!cur.isBriefed,
    });
    // LINEUP mode: report the served lineup (size + which fallback rung fired) —
    // this is where the mode's honesty lives. A widened lineup (rung 3) means the
    // pool is too thin at that exact length: a CONTENT problem, so warn LOUDLY
    // (always, not just dev). Lesser fallbacks get a dev-only info note.
    if (cur.suspects) {
      trackSR('suspects_served', {
        count: cur.suspects.count,
        fallbackTier: cur.suspects.fallbackTier,
      });
      if (cur.suspects.widened) {
        // eslint-disable-next-line no-console
        console.warn(
          `[satRush] LINEUP CONTENT GAP: "${cur.word}" (${cur.word.length} letters, ${cur.pos}) has no same-length suspects — widened the letter count (fake suspects). Add more ${cur.word.length}-letter words to the pool.`
        );
      } else if (
        (cur.suspects.fallbackTier > 0 || cur.suspects.reducedCount) &&
        typeof import.meta !== 'undefined' &&
        import.meta.env &&
        import.meta.env.DEV
      ) {
        // eslint-disable-next-line no-console
        console.info(
          `[satRush] lineup fallback: ${cur.word} → ${cur.suspects.count} suspects (rung ${cur.suspects.fallbackTier})`
        );
      }
    }
    inputRef.current = createSlotInput({ target: cur.word });
    pendingRef.current = 'idle';
    msgRef.current = null;
    reEncodeRef.current = null; // a fresh word clears the previous re-encode beat
    fxRef.current = { shake: 0, badIndex: -1, badKey: 0 };
    // A fresh word clears the previous clear/miss stamp. A revenant shows the
    // ESCAPED overprint across the poster header (view-driven, held for the whole
    // word) rather than a corner stamp; a deep cut shows the MOST WANTED header.
    stampRef.current = null;
    // Entry juice (real play only — dev scenes set state without calling this).
    if (cur.isRevenant) juice.revenantEnter();
    else if (cur.isDeepCut) juice.deepCutEnter();
    force();
  }, [trackRunEnd, trackSR]);

  // RARITY (word-value): the most recently cleared word + a monotonic id, surfaced on the view
  // so SatRushGame can score/bank it and pop its tier. A ref (not state) — it rides the existing
  // re-render that state.cleared triggers, adding no render of its own.
  const lastClearedRef = useRef({ word: '', id: 0 });

  const resolveClear = useCallback(
    () => {
      const eng = engineRef.current;
      const cw = eng.getState().current;
      const word = cw ? cw.word : '';
      const wasBriefed = cw ? !!cw.isBriefed : false;
      // RARITY (word-value): remember the word just cleared + a monotonic id so the banking
      // effect can score it and the pop can announce its tier. Set BEFORE submitCorrect bumps
      // state.cleared, so the next render's view carries the matching cleared word.
      lastClearedRef.current = { word, id: lastClearedRef.current.id + 1 };
      // How many letters were revealed at completion — gates the heat bump in the
      // engine, and tells PostHog whether players ante early or ride the spell-along.
      const revealed = inputRef.current ? inputRef.current.getState().revealed : 0;
      const r = eng.submitCorrect({ revealed });
      if (!r) return;
      // Lifetime WORDS TYPED: a cleared word is the local player's own accepted
      // word (SAT Rush is solo). Same spot the word_resolved analytic fires below.
      addWords('sat-rush');
      // Learning memory: a clear promotes the word's Leitner box.
      lexicon.recordResult(lexRef.current, word, {
        cleared: true,
        stage: r.breakdown.stage,
        revealedCount: revealed,
      });
      persistLexicon();
      const rec = lexRef.current.records[word];
      trackSR('word_resolved', {
        stage: r.breakdown.stage, // THE key metric — are players anteing early?
        revealed,
        // LINEUP: how many suspects were still standing when they answered — the
        // recognition analogue of "anteing early" (more standing = harder call).
        suspectsStanding: cw && cw.suspects ? suspectsStanding(cw.suspects.lineup, r.breakdown.stage) : null,
        multiplier: r.breakdown.effectiveMultiplier,
        outcome: 'exact', // only the target's own letters can complete a word now
        wasBriefed,
        box: rec ? rec.box : 0,
      });
      // A clear that leaned on the spell-along (more than the free first letter)
      // didn't really land — give it the same re-encode beat a miss gets, so the
      // word gets a proper second look instead of vanishing.
      if (revealed >= HEAVY_REVEAL_MIN && cw) {
        reEncodeRef.current = buildReEncode(cw, 'weak');
      }
      pendingRef.current = 'clear';
      const silverJustOn = r.silverTongue && !prevSilverRef.current;
      // The clear SFX (tone 'capture'): SILVER TONGUE entry gets its own; otherwise
      // "CAPTURED!!" (the fugitive is caught).
      stampSeq.current += 1;
      stampRef.current = {
        text: silverJustOn ? 'SILVER TONGUE!' : 'CAPTURED!!',
        tone: 'capture',
        kind: silverJustOn ? 'silver' : 'got',
        id: stampSeq.current,
      };
      // Clear juice: the SILVER TONGUE crack is its own big moment; otherwise a
      // state-coloured burst whose cue pitch rises with the streak.
      if (silverJustOn) juice.silverEnter();
      else
        juice.answerCorrect({
          streak: eng.getState().currentStreak,
          silver: r.silverTongue,
          deepCut: r.breakdown.deepCutBonus > 0,
          revenant: r.breakdown.revenant,
        });
      if (silverJustOn) {
        msgRef.current = { text: 'SILVER TONGUE — multipliers doubled', kind: 'good' };
      } else {
        const bonus = r.breakdown.deepCutBonus ? ' · DEEP CUT BONUS' : '';
        msgRef.current = {
          text: `+${r.gained} · ${r.breakdown.stageMultiplier}× ante${bonus}`,
          kind: 'good',
        };
      }
      prevSilverRef.current = r.silverTongue;
      force();
      clearTimeout(pauseTimer.current);
      const pause = reEncodeRef.current ? HEAVY_CLEAR_PAUSE_MS : CLEAR_PAUSE_MS;
      pauseTimer.current = setTimeout(beginWord, pause);
    },
    [beginWord, persistLexicon, trackSR]
  );

  const doMiss = useCallback(() => {
    const eng = engineRef.current;
    const cw = eng.getState().current;
    const word = cw ? cw.word : '';
    const wasBriefed = cw ? !!cw.isBriefed : false;
    const stage = cw ? cw.stage : 0;
    const revealed = inputRef.current ? inputRef.current.getState().revealed : 0;
    const answer = inputRef.current ? inputRef.current.answer() : '';
    const brokeSilver = prevSilverRef.current; // read before the reset below
    const r = eng.miss();
    if (!r) return;
    // Learning memory: a miss drops the word to box 0 (due again soon).
    lexicon.recordResult(lexRef.current, word, { cleared: false, stage, revealedCount: revealed });
    persistLexicon();
    trackSR('word_missed', { missCount: r.missCount, wasBriefed });
    if (r.gameOver) trackRunEnd();
    // The miss now TEACHES: the sentence filled in + definition + one cousin.
    if (cw) reEncodeRef.current = buildReEncode(cw, 'miss');
    pendingRef.current = 'miss';
    prevSilverRef.current = false;
    // The miss stamp = the fugitive got away (drives the page-tear too, via
    // kind === 'miss').
    stampSeq.current += 1;
    stampRef.current = { text: 'ESCAPED?!', tone: 'escape', kind: 'miss', id: stampSeq.current };
    // Death dominates; otherwise a chrome-shatter if this miss broke SILVER
    // TONGUE, else a plain KO miss.
    if (r.gameOver) juice.death();
    else if (brokeSilver) juice.silverBreak();
    else juice.miss();
    msgRef.current = { text: `the fugitive was ${answer.toUpperCase()} — it'll be back`, kind: 'bad' };
    force();
    clearTimeout(pauseTimer.current);
    pauseTimer.current = setTimeout(() => {
      if (r.gameOver) {
        phaseRef.current = 'over';
        force();
      } else {
        beginWord();
      }
    }, MISS_PAUSE_MS);
  }, [beginWord, trackRunEnd, persistLexicon, trackSR]);

  // ---- the stage clock: advance reveals, then run the grace window ----
  const state = engineRef.current ? engineRef.current.getState() : null;
  const cur = state ? state.current : null;
  const stageForEffect = cur ? cur.stage : -1;
  const wordForEffect = cur ? cur.word : '';
  const phase = phaseRef.current;
  const pending = pendingRef.current;

  useEffect(() => {
    clearTimeout(stageTimer.current);
    if (phase !== 'playing' || pending !== 'idle' || SAT_RUSH_FREEZE) return;
    const eng = engineRef.current;
    const c = eng.getState().current;
    if (!c || c.resolved) return;

    const lastStage = eng.config.stageMultipliers.length - 1;
    // Effective stage delay: deep-cut and LINEUP scales stack multiplicatively on
    // the base. lineupScale is read LIVE from cfgRef (dev-tunable), so it overrides
    // the value baked into eng.config at engine creation.
    const interval = effectiveStageIntervalMs(
      cfgRef.current.stageMs,
      { isDeepCut: c.isDeepCut, mode: modeRef.current },
      { ...eng.config, lineupStageScale: cfgRef.current.lineupScale }
    );
    // LINEUP mode has NO spell-along: the narrowed lineup (2 suspects, differing at
    // the first letter) is the aid, so the final stage is a plain decision window
    // then a walked-away miss — and the free first letter is NOT revealed (it would
    // give away which of the two remaining suspects is the answer).
    const spellAlong = modeRef.current !== 'lineup';

    // The whole spell-along drain window from RIGHT NOW: one final-hold plus one
    // tick per remaining auto-reveal. Fixed into graceMsRef at final-stage entry
    // so the AnteMeter drain bar spans the endgame in a single sweep. tickMs is
    // the live spell cadence (never deep-cut-scaled).
    const spellWindowMs = () => {
      const eg = eng.endgame();
      if (!eg) return 0;
      const tickMs = cfgRef.current.spellMs;
      const revealedNow = inputRef.current ? inputRef.current.getState().revealed : 0;
      return Math.max(0, eg.autoRevealMax - revealedNow) * tickMs + 2 * tickMs;
    };
    // LINEUP's final-stage decision window: a base beat plus a little per-letter
    // typing time, so long fugitives are still reachable once you've spotted them.
    // CRITICAL: computed from the UNSCALED base cfgRef.current.stageMs — the
    // lineupScale must never stretch the last-call coin flip (a 3x window = 12s+).
    const lineupWindow = (len) => lineupWindowMs(cfgRef.current.stageMs, len);

    if (c.stage < lastStage) {
      stageTimer.current = setTimeout(() => {
        eng.advanceStage();
        const now = eng.getState().current;
        // PRIORITY 1: the multiplier drop — punch the number + a DESCENDING tick.
        juice.multiplierDrop(now.stage, lastStage);
        // Entering the final stage fixes the drain window for the meter. Briefing
        // also reveals the FREE first letter (only if none revealed yet); lineup
        // does not (see above).
        if (now.stage >= lastStage) {
          if (spellAlong) {
            if (inputRef.current.getState().revealed === 0) inputRef.current.revealNextLetter();
            graceMsRef.current = spellWindowMs();
          } else {
            graceMsRef.current = lineupWindow(now.length);
          }
        }
        force();
      }, interval);
    } else if (!spellAlong) {
      // Final stage, LINEUP — hold the decision window, then a walked-away miss.
      // Completing at any point runs the normal clear path (keyboard effect);
      // Escape still skips. No auto-reveal.
      graceMsRef.current = lineupWindow(c.length);
      stageTimer.current = setTimeout(doMiss, graceMsRef.current);
    } else {
      // Final stage — the SPELL-ALONG endgame. Instead of a silent grace then a
      // miss, keep auto-revealing one letter every tickMs until only the last
      // letter is missing (autoRevealMax = length - 1), re-rendering each tick, so
      // the player always gets to finish the word. Completing at any point runs
      // the normal clear path (keyboard effect); Escape still skips. After the
      // last possible reveal, one final hold, then it's a "walked away" miss.
      graceMsRef.current = spellWindowMs();
      const tickMs = cfgRef.current.spellMs;
      const finalHoldMs = 2 * tickMs;
      const autoRevealMax = eng.endgame().autoRevealMax;
      const tick = () => {
        if (pendingRef.current !== 'idle') return;
        const input = inputRef.current;
        if (!input) return;
        const rev = input.revealNextLetter(); // locks the next target letter
        force();
        if (rev.complete) {
          resolveClear();
          return;
        }
        if (input.getState().revealed < autoRevealMax) {
          stageTimer.current = setTimeout(tick, tickMs);
        } else {
          stageTimer.current = setTimeout(doMiss, finalHoldMs);
        }
      };
      if (inputRef.current.getState().revealed < autoRevealMax) {
        stageTimer.current = setTimeout(tick, tickMs);
      } else {
        stageTimer.current = setTimeout(doMiss, finalHoldMs);
      }
    }
    return () => clearTimeout(stageTimer.current);
  }, [phase, pending, stageForEffect, wordForEffect, doMiss, resolveClear]);

  // ---- keyboard ----
  useEffect(() => {
    if (phase !== 'playing') return undefined;
    const onKey = (e) => {
      juice.unlockAudio(); // real keydown is a valid gesture to start the audio context
      if (pendingRef.current !== 'idle') {
        // A re-encode teaching beat (miss / heavy clear) is showing: any key skips
        // it so fast players aren't held on the second look they don't need.
        if (reEncodeRef.current) {
          clearTimeout(pauseTimer.current);
          if (pendingRef.current === 'miss' && engineRef.current.getState().gameOver) {
            reEncodeRef.current = null;
            phaseRef.current = 'over';
            force();
          } else {
            beginWord();
          }
        }
        return;
      }
      const eng = engineRef.current;
      const input = inputRef.current;
      const c = eng.getState().current;
      if (!c || c.resolved || !input) return;

      if (e.key === 'Escape') {
        doMiss();
        return;
      }
      if (e.key === 'Backspace') {
        input.backspace();
        force();
        return;
      }
      if (!/^[a-zA-Z]$/.test(e.key)) return;
      e.preventDefault();
      wpmKeyStroke(); // WPM (§2): a letter keystroke opens this word's active-typing span

      const res = input.typeLetter(e.key);
      if (res.accepted) {
        if (res.complete) resolveClear();
        else force();
      } else {
        // Rejected key: engine bleeds score / decides the every-3rd reveal.
        const k = eng.registerWrongKeystroke();
        if (k && k.revealedLetter) {
          const rev = input.revealNextLetter();
          if (rev.complete) {
            resolveClear();
            return;
          }
        }
        juice.wrongKey();
        fxRef.current = {
          shake: fxRef.current.shake + 1,
          badIndex: input.getState().typed.length,
          badKey: fxRef.current.badKey + 1,
        };
        force();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, doMiss, resolveClear, beginWord]);

  // Persist the learning memory on unmount (a mid-run exit still counts).
  useEffect(() => () => {
    clearTimers();
    persistLexicon();
  }, [persistLexicon]);

  // ---- public actions ----
  const freshEngine = useCallback((briefed = [], mode = 'briefing') => {
    clearTimers();
    const { stageMs, spellMs, lineupScale, deepEvery, revGap, climb } = cfgRef.current;
    engineRef.current = createSatRushEngine({
      words: WORDS,
      recent: readRecentWords(), // cross-run memory: deprioritize recently-served words
      briefed, // THE BRIEFING's words, served first this run (briefing mode only)
      config: {
        mode, // 'briefing' (spell-along net) | 'lineup' (suspect lineup, no spell-along)
        stageIntervalMs: stageMs,
        spellAlongMs: spellMs,
        lineupStageScale: lineupScale, // LINEUP stage-cadence multiplier (mode-agnostic in the engine)
        deepCutEvery: deepEvery,
        revenantOffset: revGap,
        tierEvery: climb,
      },
    });
    prevSilverRef.current = false;
  }, []);

  // Start the actual run in the given mode. BRIEFING serves the studied words first
  // (engine) and fires the dwell metric; LINEUP serves no briefed words. modeRef is
  // set here so every event and the final-stage endgame branch read the live mode.
  const startRun = useCallback(
    (mode) => {
      juice.unlockAudio();
      modeRef.current = mode;
      const briefed =
        mode === 'briefing' && briefingRef.current
          ? briefingRef.current.words.map((r) => r.word)
          : [];
      briefedSetRef.current = new Set(briefed);
      trackSR('mode_start');
      if (mode === 'briefing' && dwellStartRef.current != null && typeof performance !== 'undefined') {
        const ms = Math.round(performance.now() - dwellStartRef.current);
        const words = briefed.length;
        trackSR('briefing_word_dwell_ms', { ms, words, perWord: words ? Math.round(ms / words) : ms });
      }
      dwellStartRef.current = null;
      freshEngine(briefed, mode);
      phaseRef.current = 'playing';
      beginWord();
    },
    [beginWord, freshEngine, trackSR]
  );

  // Cover Play / results Run-it-back: bump the session counter once, then open the
  // mode picker (always shown, preselected to the last choice — see chooseMode).
  const startGame = useCallback(() => {
    juice.unlockAudio(); // Play click is a valid gesture to unlock the audio context
    const lex = lexRef.current;
    lex.session = (lex.session || 0) + 1; // one bump per run start (session-counter time)
    reEncodeRef.current = null;
    briefingRef.current = null;
    phaseRef.current = 'mode';
    force();
  }, []);

  // From the mode picker. Remember the choice (so it preselects next time). BRIEFING
  // computes + shows the MANDATORY study screen; LINEUP drops straight into the run
  // (the suspect lineup is served per word by the engine). The mode choice IS the
  // skip now — a decision the player owns, not a reflexive button.
  const chooseMode = useCallback(
    (mode) => {
      juice.unlockAudio();
      const lex = lexRef.current;
      lex.mode = mode;
      persistLexicon();
      modeRef.current = mode;
      trackSR('mode_selected');
      if (mode === 'lineup') {
        briefingRef.current = null;
        startRun('lineup');
        return;
      }
      // Exclude the last 3 decks so the briefing refreshes every time (never
      // re-deals a word from the recent window); then append THIS deck and keep only
      // the newest 3. lastBriefed is an array of decks (word-string arrays).
      const recentDecks = Array.isArray(lex.lastBriefed) ? lex.lastBriefed : [];
      briefingRef.current = pickBriefing({
        state: lex,
        session: lex.session,
        words: WORDS,
        rng: Math.random,
        exclude: recentDecks.flat(),
      });
      const dealtDeck = briefingRef.current.words.map((r) => r.word);
      lex.lastBriefed = [...recentDecks, dealtDeck].slice(-3);
      persistLexicon();
      trackSR('briefing_shown', {
        familyMorpheme: briefingRef.current.familyMorpheme,
        reviewCount: briefingRef.current.reviewCount,
      });
      dwellStartRef.current = typeof performance !== 'undefined' ? performance.now() : null;
      phaseRef.current = 'briefing';
      force();
    },
    [persistLexicon, startRun, trackSR]
  );

  // From the briefing screen: begin the (briefing-mode) run. No skip path exists.
  const beginRunFromBriefing = useCallback(() => startRun('briefing'), [startRun]);

  // CLEAN mid-run abandon (the HUD exit ✕): stop the run without finishing it.
  //  - clearTimers() cancels the between-word pause + the stage/spell tick, so NO
  //    queued doMiss / stage tick fires after we leave (see runTimers.js).
  //  - drop out of 'playing' (→ 'start') so the stage effect can't reschedule and
  //    the music-duck effect restores the normal level BEFORE unmount — the same
  //    restore the results-screen exit gets (verified: phase ≠ 'playing' ⇒ 0.3,
  //    and the effect cleanup restores 0.3 again on unmount either way).
  //  - fire run_abandoned for analytics. NOT run_end: the run didn't finish.
  //  - lexicon/localStorage is already persisted at every outcome (and again on
  //    unmount), so there is nothing to save here — this only STOPS the clock.
  // The component follows this with onExit() (goHome); no results screen is shown.
  const abandonRun = useCallback(() => {
    clearTimers();
    const wordNumber = engineRef.current ? engineRef.current.getState().wordNumber : 0;
    trackSR('run_abandoned', { wordNumber });
    pendingRef.current = 'idle';
    phaseRef.current = 'start';
    force();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackSR]);

  const setStageMs = useCallback((ms) => {
    cfgRef.current.stageMs = ms;
    force(); // the running stage effect picks up the new value on its next schedule
  }, []);

  const setSpellMs = useCallback((ms) => {
    cfgRef.current.spellMs = ms;
    force(); // the spell-along endgame picks up the new cadence on its next tick
  }, []);

  const setKnob = useCallback((key, value) => {
    cfgRef.current[key] = value;
    force();
  }, []);

  // ---- dev-only scenes (drive the engine into a state via public methods only,
  // so nothing here is a rule shortcut — it's just fast-forwarded real play) ----
  const scene = useCallback(
    (which) => {
      freshEngine();
      phaseRef.current = 'playing';
      const eng = engineRef.current;

      // 'results' synthesizes a finished run (varied ante clears + a hot streak,
      // then out of lives) and jumps to the results screen for the shot.
      if (which === 'results') {
        for (let i = 0; i < 14; i++) {
          eng.nextWord();
          const st = i % 3; // clears at stages 0/1/2 for a realistic avg ante
          for (let s = 0; s < st; s++) eng.advanceStage();
          eng.submitCorrect();
        }
        for (let i = 0; i < 3; i++) {
          eng.nextWord();
          eng.miss();
        }
        phaseRef.current = 'over';
        force();
        return;
      }

      const present = () => {
        const c = eng.getState().current;
        inputRef.current = createSlotInput({ target: c.word });
        pendingRef.current = 'idle';
        msgRef.current = null;
        prevSilverRef.current = eng.getState().silverTongue;
      };
      if (which === 'silver') {
        for (let i = 0; i < 5; i++) {
          eng.nextWord();
          eng.submitCorrect();
        }
        eng.nextWord(); // fresh word 6, heat at cap
        present();
      } else if (which === 'deep') {
        while (!eng.getState().current || !eng.getState().current.isDeepCut) eng.nextWord();
        present();
      } else if (which === 'revenant') {
        eng.nextWord();
        eng.miss();
        while (!eng.getState().current || !eng.getState().current.isRevenant) eng.nextWord();
        present();
      } else {
        beginWord();
      }
      // Advance to a representative stage so the card is populated for the shot.
      // In the 3-stage model stage 1 shows sentence + definition + aliases (a full,
      // pre-endgame clue stack) — the right "mid-word" look for a scene; stage 2 is
      // the final/spell-along stage, so scenes stop at 1. A ?lock= letter shot goes
      // to the final stage (usually paired with ?freeze=1 to hold it still).
      const maxStage = eng.config.stageMultipliers.length - 1;
      const target = Math.min(maxStage, SAT_RUSH_LOCK ? maxStage : 1);
      while (eng.getState().current.stage < target) eng.advanceStage();
      for (let i = 0; i < SAT_RUSH_LOCK && inputRef.current; i++) {
        inputRef.current.revealNextLetter();
      }
      // Event framing is view-driven on the poster now (revenant = ESCAPED
      // overprint, deep cut = MOST WANTED header), so no corner stamp is set here.
      stampRef.current = null;
      force();
    },
    [beginWord, freshEngine]
  );

  // Dev/QA: jump straight into a scene on load when `?scene=` is set.
  useEffect(() => {
    if (SAT_RUSH_DEV_TUNER && SAT_RUSH_SCENE) scene(SAT_RUSH_SCENE);
  }, [scene]);

  // Reveal a couple of letters on the current word (for the mid-word shot).
  const debugRevealTwo = useCallback(() => {
    const input = inputRef.current;
    if (!input) return;
    input.revealNextLetter();
    input.revealNextLetter();
    engineRef.current.advanceStage();
    engineRef.current.advanceStage();
    force();
  }, []);

  // ---- derived view model for the components ----
  const view = buildView(state, cur, engineRef.current, inputRef.current, {
    phase,
    pending,
    msg: msgRef.current,
    fx: fxRef.current,
    cfg: cfgRef.current,
    graceMs: graceMsRef.current, // spell-along drain window, fixed at final-stage entry
    stamp: stampRef.current, // paper stamp for the top corner (or null)
    reEncode: reEncodeRef.current, // the teaching beat shown during a miss/heavy-clear pause
    briefing: briefingRef.current,
    lex: lexRef.current,
    mode: modeRef.current, // the current run's mode (drives the lineup UI / spell block)
    lastMode: lexRef.current.mode, // remembered choice, for the picker's preselect
    lastCleared: lastClearedRef.current, // {word,id} — RARITY scoring + pop
  });

  return {
    view,
    startGame,
    chooseMode,
    startRun: beginRunFromBriefing,
    abandonRun,
    setStageMs,
    setSpellMs,
    setKnob,
    scene,
    debugRevealTwo,
  };
}

// Pure: the data for the re-encode teaching beat — the sentence (the UI fills the
// blank with the answer and highlights it), the definition, and ONE cousin from
// the root if there is one. Built from the live presentation at the moment of a
// miss or a heavy-reveal clear.
function buildReEncode(cw, kind) {
  const cousin = cw.root && Array.isArray(cw.root.cousins) && cw.root.cousins.length ? cw.root.cousins[0] : null;
  return { word: cw.word, context: cw.context, gloss: cw.gloss, root: cw.root, cousin, kind };
}

// Pure: build the per-card data THE BRIEFING renders — the filled sentence is the
// encode step, so it's front and centre; cousins the player has already met get a
// "you know this one" tick (the transfer moment made visible).
function buildBriefingView(briefing, lex) {
  if (!briefing) return null;
  const cards = briefing.words.map((row) => ({
    word: row.word,
    pos: POS_LABEL[row.pos] || row.pos,
    length: row.word.length,
    context: row.context,
    gloss: row.gloss,
    root: row.root,
    isReview: briefing.reviewWords.has(row.word),
    knownCousins:
      row.root && Array.isArray(row.root.cousins)
        ? row.root.cousins.filter((c) => lexicon.hasSeen(lex, c))
        : [],
  }));
  return { familyMorpheme: briefing.familyMorpheme, familyCount: briefing.familyCount, reviewCount: briefing.reviewCount, cards };
}

// Pure: assemble everything the components render from the engine/input state.
function buildView(state, cur, eng, input, extra) {
  const base = {
    phase: extra.phase,
    pending: extra.pending,
    msg: extra.msg,
    fx: extra.fx,
    cfg: extra.cfg,
    stamp: extra.stamp,
    reEncode: extra.reEncode,
    briefing: buildBriefingView(extra.briefing, extra.lex),
    mode: extra.mode, // 'briefing' | 'lineup' — the current run's mode
    lastMode: extra.lastMode, // remembered choice, for the picker's preselect
    // RARITY: the last cleared word + its monotonic id (aligned with `cleared`), for scoring/pop.
    lastClearedWord: extra.lastCleared ? extra.lastCleared.word : '',
    clearId: extra.lastCleared ? extra.lastCleared.id : 0,
  };
  if (!state || !cur || !eng) return { ...base, hasWord: false };

  // The drain-bar animation must match the ACTUAL stage timer, so it carries the
  // same deep-cut × lineup scaling (lineupScale read live from cfg). atFinal words
  // drain over graceMs instead (the lineup last-call / spell-along window).
  const interval = effectiveStageIntervalMs(
    extra.cfg.stageMs,
    { isDeepCut: cur.isDeepCut, mode: extra.mode },
    { ...eng.config, lineupStageScale: extra.cfg.lineupScale }
  );
  const atFinal = cur.stage >= eng.config.stageMultipliers.length - 1;

  // Which state the card is in (for the tag + styling). Silver can co-exist with
  // deep/revenant; the tag prioritises the rarer overlay but silver still styles.
  // The poster also reads the raw booleans directly: a revenant that is ALSO a
  // deep cut wears the MOST WANTED header AND the ESCAPED overprint.
  let kind = 'normal';
  if (cur.isRevenant) kind = 'rev';
  else if (cur.isDeepCut) kind = 'deep';

  return {
    ...base,
    hasWord: true,
    revenant: cur.isRevenant,
    deepCut: cur.isDeepCut,
    missCount: cur.missCount,
    score: state.score,
    streak: state.currentStreak,
    bestStreak: state.bestStreak,
    wordNumber: state.wordNumber,
    cleared: state.cleared, // running count of cleared words (drives the live wins pill)
    lives: state.lives,
    maxLives: eng.config.lives,
    heat: state.heat,
    heatCap: eng.config.heatCap,
    silver: state.silverTongue,
    kind,
    multiplier: eng.currentMultiplier(),
    stage: cur.stage,
    maxStage: eng.config.stageMultipliers.length - 1,
    atFinal,
    interval,
    graceMs: extra.graceMs, // full spell-along window (fixed at final-stage entry)
    meta: `${POS_LABEL[cur.pos] || cur.pos} · ${cur.length} letters · tier ${cur.tier}`,
    reveals: cur.reveals.map((r) => ({ type: r.type, stage: r.stage, visible: r.stage <= cur.stage })),
    context: cur.context,
    gloss: cur.gloss,
    root: cur.root,
    wordLength: cur.length,
    slots: input ? input.getSlots() : [],
    // LINEUP mode: the suspect lineup for the current word, each marked eliminated
    // once its stage is reached. `isAnswer` is deliberately NOT exposed — the UI can
    // never reveal which suspect is the fugitive. null in briefing mode.
    suspects: cur.suspects
      ? {
          count: cur.suspects.count,
          standing: suspectsStanding(cur.suspects.lineup, cur.stage),
          lineup: cur.suspects.lineup.map((s) => ({
            word: s.word,
            eliminated: s.eliminatedAtStage != null && cur.stage >= s.eliminatedAtStage,
          })),
        }
      : null,
    // Results carry the mastered count (box ≥ 3) so the end screen can headline it
    // as the number that makes the mode legibly a study tool.
    results: { ...eng.results(), mastered: lexicon.masteredCount(extra.lex) },
  };
}
