// useSatRushGame.js — the game loop. Owns the wall clock (stage timers, grace,
// between-word pauses) and the keyboard, and drives engine.js + input.js. It
// reimplements NO game rule: every score/tier/heat/revenant decision comes from
// the engine, every slot/alt decision from input.js. Timing constants that ARE
// rules (deep-cut interval scale, grace length) are read from engine.config; the
// only thing this hook decides is the base stage interval (dev-tunable).
import { useReducer, useRef, useEffect, useCallback } from 'react';
import { createSatRushEngine } from './engine';
import { createSlotInput } from './input';
import WORDS from '../data/satRush/words.json';
import { track } from '../lib/analytics';
import {
  SAT_RUSH_STAGE_MS,
  SAT_RUSH_SCENE,
  SAT_RUSH_DEV_TUNER,
  SAT_RUSH_FREEZE,
  SAT_RUSH_LOCK,
} from './config';
import * as juice from './juice';

const POS_LABEL = { adj: 'adjective', n: 'noun', v: 'verb', adv: 'adverb' };
const CLEAR_PAUSE_MS = 850;
const ALT_PAUSE_MS = 1500;
const MISS_PAUSE_MS = 1600;

export function useSatRushGame() {
  const [, force] = useReducer((x) => x + 1, 0);

  const engineRef = useRef(null);
  const inputRef = useRef(null);
  const phaseRef = useRef('start'); // 'start' | 'playing' | 'over'
  const pendingRef = useRef('idle'); // 'idle' | 'clear' | 'miss' — the between-word pause
  const msgRef = useRef(null); // { text, kind }
  const prevSilverRef = useRef(false);
  const fxRef = useRef({ shake: 0, badIndex: -1, badKey: 0 }); // transient visual cues
  const pauseTimer = useRef(null);
  const stageTimer = useRef(null);

  // Dev-tunable settings. Stage interval seeds from the ?stage= override and can
  // be changed live without restarting; the structural knobs apply on next game.
  const cfgRef = useRef({ stageMs: SAT_RUSH_STAGE_MS, deepEvery: 10, revGap: 6, climb: 8 });

  const clearTimers = () => {
    clearTimeout(pauseTimer.current);
    clearTimeout(stageTimer.current);
  };

  // Fire-and-forget analytics. `word_resolved`'s `stage` is the key metric — it
  // answers whether players are actually anteing (answering early). All events
  // carry mode:'sat-rush' so the shared names never collide with other modes.
  const trackRunEnd = useCallback(() => {
    const r = engineRef.current.results();
    track('run_end', {
      mode: 'sat-rush',
      score: r.score,
      cleared: r.cleared,
      bestStreak: r.bestStreak,
      avgAnte: r.avgAnte,
    });
  }, []);

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
    track('word_served', {
      mode: 'sat-rush',
      tier: cur.tier,
      isDeepCut: cur.isDeepCut,
      isRevenant: cur.isRevenant,
    });
    inputRef.current = createSlotInput({ target: cur.word, alts: cur.alts });
    pendingRef.current = 'idle';
    msgRef.current = null;
    fxRef.current = { shake: 0, badIndex: -1, badKey: 0 };
    // Entry juice (real play only — dev scenes set state without calling this).
    if (cur.isRevenant) juice.revenantEnter();
    else if (cur.isDeepCut) juice.deepCutEnter();
    force();
  }, [trackRunEnd]);

  const resolveClear = useCallback(
    (viaAlt) => {
      const eng = engineRef.current;
      const r = eng.submitCorrect({ viaAlt });
      if (!r) return;
      track('word_resolved', {
        mode: 'sat-rush',
        stage: r.breakdown.stage, // THE key metric — are players anteing early?
        multiplier: r.breakdown.effectiveMultiplier,
        outcome: viaAlt ? 'near' : 'exact',
      });
      pendingRef.current = 'clear';
      const silverJustOn = r.silverTongue && !prevSilverRef.current;
      // Clear juice: the SILVER TONGUE crack is its own big moment; otherwise a
      // state-coloured burst whose cue pitch rises with the streak.
      if (silverJustOn) juice.silverEnter();
      else
        juice.answerCorrect({
          streak: eng.getState().currentStreak,
          viaAlt,
          silver: r.silverTongue,
          deepCut: r.breakdown.deepCutBonus > 0,
          revenant: r.breakdown.revenant,
        });
      if (silverJustOn) {
        msgRef.current = { text: 'SILVER TONGUE — multipliers doubled', kind: 'good' };
      } else if (viaAlt) {
        msgRef.current = {
          text: `accepted — the word was ${r.actualWord.toUpperCase()} · half credit +${r.gained}`,
          kind: 'near',
        };
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
      pauseTimer.current = setTimeout(beginWord, viaAlt ? ALT_PAUSE_MS : CLEAR_PAUSE_MS);
    },
    [beginWord]
  );

  const doMiss = useCallback(() => {
    const eng = engineRef.current;
    const answer = inputRef.current ? inputRef.current.answer() : '';
    const brokeSilver = prevSilverRef.current; // read before the reset below
    const r = eng.miss();
    if (!r) return;
    track('word_missed', { mode: 'sat-rush', missCount: r.missCount });
    if (r.gameOver) trackRunEnd();
    pendingRef.current = 'miss';
    prevSilverRef.current = false;
    // Death dominates; otherwise a chrome-shatter if this miss broke SILVER
    // TONGUE, else a plain KO miss.
    if (r.gameOver) juice.death();
    else if (brokeSilver) juice.silverBreak();
    else juice.miss();
    msgRef.current = { text: `the word was ${answer.toUpperCase()} — it'll be back`, kind: 'bad' };
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
  }, [beginWord, trackRunEnd]);

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

    const scale = c.isDeepCut ? eng.config.deepCutIntervalScale : 1;
    const interval = Math.round(cfgRef.current.stageMs * scale);

    if (c.stage < eng.config.stageMultipliers.length - 1) {
      stageTimer.current = setTimeout(() => {
        eng.advanceStage();
        const now = eng.getState().current;
        // PRIORITY 1: the multiplier drop — punch the number + a DESCENDING tick.
        juice.multiplierDrop(now.stage, eng.config.stageMultipliers.length - 1);
        // Stage 4 reveals the FIRST letter (only if none revealed yet).
        if (now.stage >= 4 && inputRef.current.getState().revealed === 0) {
          inputRef.current.revealNextLetter();
        }
        force();
      }, interval);
    } else {
      // Final stage: a grace window (graceStages * interval) then it's a miss.
      const grace = interval * eng.config.graceStages;
      stageTimer.current = setTimeout(doMiss, grace);
    }
    return () => clearTimeout(stageTimer.current);
  }, [phase, pending, stageForEffect, wordForEffect, doMiss]);

  // ---- keyboard ----
  useEffect(() => {
    if (phase !== 'playing') return undefined;
    const onKey = (e) => {
      juice.unlockAudio(); // real keydown is a valid gesture to start the audio context
      if (pendingRef.current !== 'idle') return;
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

      const res = input.typeLetter(e.key);
      if (res.accepted) {
        if (res.complete) resolveClear(res.viaAlt);
        else force();
      } else {
        // Rejected key: engine bleeds score / decides the every-3rd reveal.
        const k = eng.registerWrongKeystroke();
        if (k && k.revealedLetter) {
          const rev = input.revealNextLetter();
          if (rev.complete) {
            resolveClear(input.getState().viaAlt);
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
  }, [phase, doMiss, resolveClear]);

  useEffect(() => () => clearTimers(), []);

  // ---- public actions ----
  const freshEngine = useCallback(() => {
    clearTimers();
    const { stageMs, deepEvery, revGap, climb } = cfgRef.current;
    engineRef.current = createSatRushEngine({
      words: WORDS,
      config: {
        stageIntervalMs: stageMs,
        deepCutEvery: deepEvery,
        revenantOffset: revGap,
        tierEvery: climb,
      },
    });
    prevSilverRef.current = false;
  }, []);

  const startGame = useCallback(() => {
    juice.unlockAudio(); // Play click is a valid gesture to unlock the audio context
    track('mode_start', { mode: 'sat-rush' });
    freshEngine();
    phaseRef.current = 'playing';
    beginWord();
  }, [beginWord, freshEngine]);

  const setStageMs = useCallback((ms) => {
    cfgRef.current.stageMs = ms;
    force(); // the running stage effect picks up the new value on its next schedule
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
        inputRef.current = createSlotInput({ target: c.word, alts: c.alts });
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
      // Advance to a representative stage so the card is populated for the shot:
      // 'normal' shows just the sentence at 4x; the others reveal one step more;
      // a ?lock= mid-word shot reveals the full clue stack.
      const target = SAT_RUSH_LOCK ? 3 : which === 'normal' ? 1 : 2;
      while (eng.getState().current.stage < target) eng.advanceStage();
      for (let i = 0; i < SAT_RUSH_LOCK && inputRef.current; i++) {
        inputRef.current.revealNextLetter();
      }
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
  });

  return {
    view,
    startGame,
    setStageMs,
    setKnob,
    scene,
    debugRevealTwo,
  };
}

// Pure: assemble everything the components render from the engine/input state.
function buildView(state, cur, eng, input, extra) {
  const base = {
    phase: extra.phase,
    pending: extra.pending,
    msg: extra.msg,
    fx: extra.fx,
    cfg: extra.cfg,
  };
  if (!state || !cur || !eng) return { ...base, hasWord: false };

  const scale = cur.isDeepCut ? eng.config.deepCutIntervalScale : 1;
  const interval = Math.round(extra.cfg.stageMs * scale);
  const atFinal = cur.stage >= eng.config.stageMultipliers.length - 1;

  // Which state the card is in (for the tag + styling). Silver can co-exist with
  // deep/revenant; the tag prioritises the rarer overlay but silver still styles.
  let kind = 'normal';
  if (cur.isRevenant) kind = 'rev';
  else if (cur.isDeepCut) kind = 'deep';

  return {
    ...base,
    hasWord: true,
    score: state.score,
    streak: state.currentStreak,
    bestStreak: state.bestStreak,
    wordNumber: state.wordNumber,
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
    graceMs: interval * eng.config.graceStages,
    meta: `${POS_LABEL[cur.pos] || cur.pos} · ${cur.length} letters · tier ${cur.tier}`,
    reveals: cur.reveals.map((type, idx) => ({ type, idx, visible: idx <= cur.stage })),
    context: cur.context,
    gloss: cur.gloss,
    root: cur.root,
    wordLength: cur.length,
    slots: input ? input.getSlots() : [],
    results: eng.results(),
  };
}
