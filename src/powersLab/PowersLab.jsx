// PowersLab.jsx — POWERS LAB, a PROTOTYPE (nov21). A local Word Bomb round (you vs one bot) with
// four ascension powers to FEEL: HOLD BREATH, WIND-UP, AUTOCORRECT, ONE ROW.
//
// Why a local round and not the live PLAY SOLO: Word Bomb's clock lives on the SERVER, so a power
// that slows the fuse would mean changing live (Tier 1) logic. This root is mounted by main.jsx only
// on /?powers=1, in place of <App/> — App.jsx, the WebSocket, rooms and the economy are untouched,
// and nothing here pays XP, wins or gems. Rules are in powers.js (pure, tested).
//
// Motion: finite WAAPI transform/opacity one-shots only; per-frame writes go straight to the DOM
// through refs (no layout reads in the loop); the pop + stamp + burst nodes are a fixed pool.
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { loadSoloWords } from '../solo/words';
import { formatNum } from '../format';
import pools from '../solo/fragmentPools.json';
import {
  TURN_MS, BOT_TURN_MS, BREATH, WINDUP, ONE_ROW, AUTOCORRECT, ROWS, LAB_POWERS,
  refillBreath, windupFrac, oneRowOf, draftRowOf, autocorrect, wordPoints,
} from './powers';
import * as sfx from './labSounds';
import './PowersLab.css';

const LIVES = 3;
const FUSE_PATH = 'M 80 40 Q 120 14 110 2';
const P0 = [80, 40], P1 = [120, 14], P2 = [110, 2];
function fusePoint(t) {
  const u = 1 - t;
  return [u * u * P0[0] + 2 * u * t * P1[0] + t * t * P2[0], u * u * P0[1] + 2 * u * t * P1[1] + t * t * P2[1]];
}
const MASCOT = { idle: '/mascot-idle.png', panic: '/mascot-panic.png' };

const reduceMotion = () => {
  try { return document.documentElement.hasAttribute('data-reduce-motion'); } catch { return false; }
};
const isTouch = () => {
  try { return matchMedia('(pointer: coarse)').matches; } catch { return false; }
};
function play(el, frames, opts) {
  if (!el || !el.animate) return null;
  el.style.willChange = 'transform, opacity';
  const a = el.animate(frames, { fill: 'forwards', ...opts });
  a.onfinish = () => { el.style.willChange = ''; };
  return a;
}

// ?frags=ty,as — a fixed fragment sequence (for recording clips); otherwise the solo pools.
function fragList() {
  try {
    const q = new URLSearchParams(location.search).get('frags');
    if (q) return q.toLowerCase().split(',').filter((f) => /^[a-z]{1,4}$/.test(f));
  } catch { /* no URL */ }
  return null;
}
const FIXED_FRAGS = fragList();
// ?botpace=fast — the bot answers in ~1 s (clip recording); default 2–6 s like a real opponent
const FAST_BOT = (() => { try { return new URLSearchParams(location.search).get('botpace') === 'fast'; } catch { return false; } })();
const POOL = `${pools.e || ''} ${pools.m || ''}`.split(/\s+/).filter((f) => f.length >= 2);

export default function PowersLab() {
  const [phase, setPhase] = useState('pick'); // pick | play | over
  const [equip, setEquip] = useState(() => ({ breath: true, windup: true, autocorrect: true, onerow: true }));
  const [words, setWords] = useState(null);
  const [, bump] = useReducer((x) => x + 1, 0);
  const [draft, setDraft] = useState('');
  const touch = useRef(isTouch()).current;

  const g = useRef(null); // the live round (mutable; React only redraws on events)
  const r = useRef({}); // DOM refs for the per-frame writes + the effect pool

  useEffect(() => {
    let live = true;
    loadSoloWords().then((w) => {
      if (!live) return;
      const rank = new Map();
      w.recall.forEach((word, i) => rank.set(word, i));
      setWords({ ...w, rank });
    });
    return () => { live = false; };
  }, []);

  // ---------------------------------------------------------------- round helpers
  const pickFrag = useCallback(() => {
    const s = g.current;
    if (FIXED_FRAGS && FIXED_FRAGS.length) {
      const f = FIXED_FRAGS[s.fragIx % FIXED_FRAGS.length];
      s.fragIx++;
      return f;
    }
    for (let tries = 0; tries < 40; tries++) {
      const f = POOL[Math.floor(Math.random() * POOL.length)];
      if (s.recent.includes(f)) continue;
      let n = 0;
      for (let i = 0; i < 12000 && n < 30; i++) if (words.recall[i].includes(f)) n++;
      if (n < 30) continue;
      s.recent = [f, ...s.recent].slice(0, 8);
      return f;
    }
    return 'er';
  }, [words]);

  const botWordFor = useCallback((frag) => {
    const s = g.current;
    const hits = [];
    for (let i = 0; i < 9000 && hits.length < 40; i++) {
      const w = words.recall[i];
      if (w.length >= 4 && w.length <= 9 && w.includes(frag) && !s.used.has(w)) hits.push(w);
    }
    return hits.length ? hits[Math.floor(Math.random() * hits.length)] : null;
  }, [words]);

  const freeze = (ms) => {
    const s = g.current;
    s.freezeUntil = Math.max(s.freezeUntil, performance.now() + ms);
  };

  const shake = (strength = 6, ms = 220) => {
    if (reduceMotion()) return;
    const k = strength;
    play(r.current.stage, [
      { transform: 'translate(0,0)' }, { transform: `translate(${-k}px,${k / 2}px)` },
      { transform: `translate(${k}px,${-k / 2}px)` }, { transform: `translate(${-k / 2}px,${k / 3}px)` },
      { transform: 'translate(0,0)' },
    ], { duration: ms, easing: 'linear', fill: 'none' });
  };

  // ONE stamp node, reused: SLAM ×2 / ONE ROW ×3 / FIXED / SLOW-MO
  const stamp = (text, tone) => {
    const el = r.current.stamp;
    if (!el) return;
    el.textContent = text;
    el.dataset.tone = tone;
    if (reduceMotion()) {
      play(el, [{ opacity: 1 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], { duration: 900 });
      return;
    }
    play(el, [
      { opacity: 0, transform: 'translate(-50%,-50%) scale(1.8) rotate(-8deg)' },
      { opacity: 1, transform: 'translate(-50%,-50%) scale(0.94) rotate(-4deg)', offset: 0.18 },
      { opacity: 1, transform: 'translate(-50%,-50%) scale(1) rotate(-4deg)', offset: 0.26 },
      { opacity: 1, transform: 'translate(-50%,-50%) scale(1) rotate(-4deg)', offset: 0.8 },
      { opacity: 0, transform: 'translate(-50%,-60%) scale(1) rotate(-4deg)' },
    ], { duration: 1000, easing: 'cubic-bezier(.2,1.3,.4,1)' });
  };

  // a pool of 3 score pops
  const pop = (text, tone) => {
    const pool = r.current.pops;
    if (!pool) return;
    const s = g.current;
    const el = pool[s.popIx++ % pool.length];
    if (!el) return;
    el.textContent = text;
    el.dataset.tone = tone || '';
    play(el, [
      { opacity: 0, transform: 'translate(-50%,0) scale(0.6)' },
      { opacity: 1, transform: 'translate(-50%,-18px) scale(1.1)', offset: 0.25 },
      { opacity: 0, transform: 'translate(-50%,-56px) scale(1)' },
    ], { duration: 800, easing: 'cubic-bezier(.2,.9,.3,1)' });
  };

  const burst = (side) => {
    const el = r.current.burst;
    if (!el) return;
    el.dataset.side = side;
    play(el, [
      { opacity: 1, transform: 'translate(-50%,-50%) scale(0.3) rotate(0deg)' },
      { opacity: 1, transform: 'translate(-50%,-50%) scale(1.15) rotate(12deg)', offset: 0.35 },
      { opacity: 0, transform: 'translate(-50%,-50%) scale(1.3) rotate(18deg)' },
    ], { duration: 650, easing: 'cubic-bezier(.2,.9,.3,1)' });
  };

  const moveBomb = (to, fast) => {
    const el = r.current.bombMove;
    if (!el) return;
    const x = to === 'bot' ? 'var(--pl-lane)' : 'calc(-1 * var(--pl-lane))';
    const from = to === 'bot' ? 'calc(-1 * var(--pl-lane))' : 'var(--pl-lane)';
    play(el, [
      { transform: `translateX(${from}) scale(1)` },
      { transform: `translateX(0px) translateY(-30px) scale(${fast ? 1.25 : 1.08})`, offset: 0.5 },
      { transform: `translateX(${x}) scale(1)` },
    ], { duration: fast ? 220 : 340, easing: 'cubic-bezier(.3,.8,.4,1)' });
  };

  const startYou = useCallback(() => {
    const s = g.current;
    s.turn = 'you';
    s.frag = pickFrag();
    s.maxMs = TURN_MS + s.bankMs;
    s.leftMs = s.maxMs;
    s.bankShown = s.bankMs;
    s.bankMs = 0;
    s.botSaid = null;
    s.botTyped = '';
    s.said = null;
    moveBomb('you');
    freeze(340);
    bump();
  }, [pickFrag]);

  const startBot = useCallback((fast) => {
    const s = g.current;
    s.turn = 'bot';
    s.frag = pickFrag();
    s.botLeftMs = BOT_TURN_MS * s.botScale;
    s.botScale = 1;
    s.botWord = botWordFor(s.frag);
    // the bot answers in 2–6 s; 6% of the time it blanks
    s.botPlanMs = !s.botWord || (!FAST_BOT && Math.random() < 0.06) ? Infinity
      : FAST_BOT ? 1500 + Math.random() * 400 : 2000 + Math.random() * 4000;
    s.botSaid = null;
    s.botTyped = '';
    s.bankShown = 0;
    moveBomb('bot', fast);
    freeze(fast ? 220 : 340);
    bump();
  }, [pickFrag, botWordFor]);

  const endRound = useCallback((won) => {
    const s = g.current;
    s.turn = 'over';
    s.won = won;
    stopBreath(false);
    stopWindup();
    setPhase('over');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------- HOLD BREATH
  const startBreath = () => {
    const s = g.current;
    if (!s || s.turn !== 'you' || !s.equip.breath || s.breathOn) return;
    if (s.breathMs < BREATH.minToStartMs) { sfx.breathEmpty(); return; }
    s.breathOn = true;
    s.beatAt = performance.now() + 380;
    s.drone = sfx.breathIn();
    freeze(70); // the hit-stop: the world catches its breath
    stamp('SLOW-MO', 'cyan');
    s.used_breath = (s.used_breath || 0) + 1;
    bump();
  };
  function stopBreath(sound = true) {
    const s = g.current;
    if (!s || !s.breathOn) return;
    s.breathOn = false;
    if (s.drone) s.drone.stop(0.12);
    s.drone = null;
    if (sound) sfx.breathOut();
    bump();
  }

  // ---------------------------------------------------------------- WIND-UP
  const windupArmed = () => {
    const s = g.current;
    return !!(s && s.equip.windup && s.windPips >= WINDUP.pips);
  };
  const startWindup = () => {
    const s = g.current;
    if (!s || s.turn !== 'you' || s.windAt) return;
    s.windAt = performance.now();
    s.windFull = false;
    if (windupArmed()) s.riser = sfx.windupStart();
  };
  function stopWindup() {
    const s = g.current;
    if (!s) return 0;
    const held = s.windAt ? performance.now() - s.windAt : 0;
    s.windAt = 0;
    if (s.riser) s.riser.stop(0.05);
    s.riser = null;
    const fill = r.current.windFill;
    if (fill) fill.style.transform = 'scaleX(0)';
    if (r.current.svg) r.current.svg.style.transform = '';
    return held;
  }

  // ---------------------------------------------------------------- submit
  const reject = (why) => {
    sfx.reject();
    const el = r.current.input;
    if (el && !reduceMotion()) {
      play(el, [{ transform: 'translateX(0)' }, { transform: 'translateX(-8px)' }, { transform: 'translateX(8px)' }, { transform: 'translateX(0)' }], { duration: 200, fill: 'none' });
    }
    g.current.note = why;
    bump();
  };

  const submit = (heldMs) => {
    const s = g.current;
    if (!s || s.turn !== 'you') return;
    let word = draft.trim().toLowerCase();
    if (!word) return;
    if (word.length < 3) return reject('3+ LETTERS');
    if (s.used.has(word)) return reject('ALREADY USED');
    const valid = word.includes(s.frag) && words.accept.has(word);
    let fix = null;
    if (!valid && s.equip.autocorrect && s.acPips >= AUTOCORRECT.pips) {
      fix = autocorrect(word, s.frag, words.accept, s.used, words.rank);
    }
    if (!valid && !fix) return reject(word.includes(s.frag) ? 'NOT A WORD' : `NEEDS ${s.frag.toUpperCase()}`);

    const typed = word;
    if (fix) word = fix.word;
    s.used.add(word);
    let mult = 1;
    let stop = 0;
    const tags = [];

    const row = s.equip.onerow ? oneRowOf(word) : -1;
    if (row >= 0) {
      mult *= ONE_ROW.scoreMult;
      s.bankMs += ONE_ROW.bonusMs;
      stop = Math.max(stop, 110);
      tags.push('row');
      s.used_row = (s.used_row || 0) + 1;
    }
    const slam = s.equip.windup && s.windPips >= WINDUP.pips && windupFrac(heldMs) >= 1;
    if (slam) {
      mult *= WINDUP.scoreMult;
      s.botScale = WINDUP.botClockScale;
      s.windPips = 0;
      stop = Math.max(stop, 150);
      tags.push('slam');
      s.used_slam = (s.used_slam || 0) + 1;
    } else if (s.equip.windup && s.windPips < WINDUP.pips) {
      s.windPips++;
      if (s.windPips === WINDUP.pips) sfx.armed(); else sfx.pipFilled(s.windPips);
    }
    if (fix) {
      s.acPips = 0;
      stop = Math.max(stop, 90);
      tags.push('fix');
      s.used_fix = (s.used_fix || 0) + 1;
    } else if (s.equip.autocorrect && s.acPips < AUTOCORRECT.pips) {
      s.acPips++;
      if (s.acPips === AUTOCORRECT.pips && !tags.length) sfx.armed();
    }
    if (s.equip.breath) s.breathMs = refillBreath(s.breathMs, word.length);

    const pts = wordPoints(word, mult);
    s.score += pts;
    s.words++;
    s.said = { word, typed, fix, row };
    s.note = null;
    stopBreath(false);

    if (stop) freeze(stop);
    // the cue that wins speaks; the rest stay quiet so one moment reads as one moment
    if (tags.includes('slam')) { sfx.slam(); stamp(`SLAM ×${WINDUP.scoreMult * (row >= 0 ? ONE_ROW.scoreMult : 1)}`, 'pink'); shake(10, 260); }
    else if (tags.includes('row')) { sfx.oneRow(word.length); stamp(`ONE ROW ×${ONE_ROW.scoreMult}`, 'yellow'); shake(5, 200); }
    else if (tags.includes('fix')) { sfx.autocorrectFix(); stamp('FIXED', 'cyan'); }
    else sfx.accept();
    if (tags.includes('row')) flashRow(row, word);
    pop(`+${pts}`, slam ? 'pink' : row >= 0 ? 'yellow' : '');

    setDraft('');
    const fast = slam;
    // pass the bomb after the hit-stop
    // a power moment gets a beat to be read before the bomb leaves (the clock is not burning meanwhile)
    const beat = tags.includes('fix') ? 650 : tags.includes('row') ? 450 : 60;
    setTimeout(() => { if (g.current === s && s.turn === 'passing') startBot(fast); }, stop + beat);
    s.turn = 'passing';
    bump();
  };

  // ONE ROW: the matching keyboard row lights the word's letters, left to right
  const flashRow = (row, word) => {
    const keys = r.current.keys;
    const kb = r.current.kb;
    if (!keys || !kb) return;
    play(kb, [{ opacity: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], { duration: 1300, easing: 'linear' });
    const letters = new Set(word);
    ROWS[row].split('').forEach((ch, i) => {
      const el = keys[ch];
      if (!el || !letters.has(ch)) return;
      el.dataset.on = '1';
      play(el, [
        { transform: 'translateY(0) scale(1)' },
        { transform: 'translateY(-10px) scale(1.25)', offset: 0.4 },
        { transform: 'translateY(0) scale(1)' },
      ], { duration: 260, delay: 60 + i * 45, easing: 'cubic-bezier(.3,1.6,.5,1)', fill: 'none' });
    });
    setTimeout(() => { for (const ch of ROWS[row]) if (keys[ch]) delete keys[ch].dataset.on; }, 1300);
  };

  // ---------------------------------------------------------------- start / loop
  const begin = () => {
    sfx.wakeAudio();
    g.current = {
      equip: { ...equip },
      turn: 'you', frag: 'er', fragIx: 0, recent: [],
      leftMs: TURN_MS, maxMs: TURN_MS, bankMs: 0, bankShown: 0,
      botLeftMs: BOT_TURN_MS, botPlanMs: Infinity, botScale: 1, botWord: null, botSaid: null,
      lives: { you: LIVES, bot: LIVES }, used: new Set(), score: 0, words: 0,
      breathMs: BREATH.capacityMs, breathOn: false, beatAt: 0,
      windPips: 0, windAt: 0, acPips: 0,
      freezeUntil: 0, popIx: 0, said: null, note: null, lastSec: -1, pose: 'idle',
    };
    setDraft('');
    setPhase('play');
  };

  useEffect(() => {
    if (phase !== 'play') return undefined;
    startYou();
    const el = r.current.input;
    if (el) el.focus();
    let raf = 0;
    let last = performance.now();
    const loop = (t) => {
      raf = requestAnimationFrame(loop);
      const s = g.current;
      if (!s || s.turn === 'over') return;
      let dt = Math.min(64, t - last);
      last = t;
      if (t < s.freezeUntil) dt = 0;
      const R = r.current;

      if (s.turn === 'you') {
        if (s.breathOn) {
          s.breathMs -= dt;
          if (t >= s.beatAt) { sfx.heartbeat(); s.beatAt = t + 650; }
          if (s.breathMs <= 0) { s.breathMs = 0; stopBreath(true); sfx.breathEmpty(); }
        }
        s.leftMs -= dt * (s.breathOn ? BREATH.slowScale : 1);
        if (s.windAt && windupArmed()) {
          const f = windupFrac(t - s.windAt);
          if (R.windFill) R.windFill.style.transform = `scaleX(${f})`;
          // the bomb leans back as you wind up (released on the slam / stopWindup)
          if (R.svg) R.svg.style.transform = `translateX(${(-14 * f).toFixed(1)}px) rotate(${(-12 * f).toFixed(1)}deg) scale(${(1 + 0.1 * f).toFixed(3)})`;
          if (f >= 1 && !s.windFull) { s.windFull = true; sfx.windupFull(); }
        }
        if (s.leftMs <= 0) {
          s.leftMs = 0;
          stopBreath(false);
          stopWindup();
          sfx.boom();
          burst('you');
          shake(12, 320);
          s.lives.you--;
          s.note = 'BOOM';
          setDraft('');
          if (s.lives.you <= 0) { endRound(false); return; }
          s.turn = 'passing';
          setTimeout(() => { if (g.current === s && s.turn === 'passing') startBot(false); }, 700);
          bump();
        }
      } else if (s.turn === 'bot') {
        s.botLeftMs -= dt;
        s.botPlanMs -= dt;
        if (s.botWord && s.botPlanMs < 1400 && s.botPlanMs > 0) {
          const k = Math.min(s.botWord.length, Math.floor(((1400 - s.botPlanMs) / 1400) * s.botWord.length) + 1);
          if (k !== (s.botTyped || '').length) { s.botTyped = s.botWord.slice(0, k); bump(); }
        }
        if (s.botPlanMs <= 0 && s.botLeftMs > 0) {
          s.used.add(s.botWord);
          s.botSaid = s.botWord;
          sfx.tick(false);
          s.turn = 'passing';
          setTimeout(() => { if (g.current === s && s.turn === 'passing') startYou(); }, 500);
          bump();
        } else if (s.botLeftMs <= 0) {
          s.botLeftMs = 0;
          sfx.boom();
          burst('bot');
          shake(8, 280);
          s.lives.bot--;
          s.botSaid = '💥';
          if (s.lives.bot <= 0) { endRound(true); return; }
          s.turn = 'passing';
          setTimeout(() => { if (g.current === s && s.turn === 'passing') startYou(); }, 700);
          bump();
        }
      }

      // ---- per-frame DOM writes (no reads) ----
      const ratio = s.turn === 'bot'
        ? Math.max(0, s.botLeftMs / BOT_TURN_MS)
        : s.turn === 'you' ? Math.max(0, Math.min(1, s.leftMs / Math.max(TURN_MS, s.maxMs))) : null;
      if (ratio != null) {
        const off = String(100 * (1 - ratio));
        if (R.fuseA) { R.fuseA.setAttribute('stroke-dashoffset', off); R.fuseB.setAttribute('stroke-dashoffset', off); R.ring.setAttribute('stroke-dashoffset', off); }
        const [fx, fy] = fusePoint(ratio);
        const fs = (ratio < 0.3 ? 1.6 : ratio < 0.6 ? 1.3 : 1) * (s.turn === 'you' && s.breathOn ? 0.55 : 1);
        if (R.flame) R.flame.setAttribute('transform', `translate(${fx.toFixed(1)} ${fy.toFixed(1)}) scale(${fs})`);
        const col = ratio > 0.6 ? '#FFE94A' : ratio >= 0.3 ? '#FF6B3D' : '#FF4B4B';
        if (R.fuseB && R.fuseB.dataset.col !== col) { R.fuseB.dataset.col = col; R.fuseB.setAttribute('stroke', col); R.ring.setAttribute('stroke', col); }
        const pose = ratio < 0.3 ? 'panic' : 'idle';
        if (R.mascot && s.pose !== pose) { s.pose = pose; R.mascot.setAttribute('href', MASCOT[pose]); }
        const secs = s.turn === 'bot' ? s.botLeftMs : s.leftMs;
        const tenth = Math.ceil(secs / 100);
        if (R.secs && tenth !== s.lastSec) {
          s.lastSec = tenth;
          R.secs.textContent = (tenth / 10).toFixed(1);
          if (s.turn === 'you' && tenth % 10 === 0 && tenth <= 30 && tenth > 0) sfx.tick(true);
        }
      }
      if (R.breathFill) R.breathFill.style.transform = `scaleX(${(s.breathMs / BREATH.capacityMs).toFixed(3)})`;
    };
    raf = requestAnimationFrame(loop);
    // debug handle for the clip recorder (this whole root is flag-gated)
    window.__powersLab = () => {
      const s = g.current;
      return s && { turn: s.turn, frag: s.frag, leftMs: s.leftMs, breathMs: s.breathMs, windPips: s.windPips, acPips: s.acPips, lives: s.lives, score: s.score };
    };
    return () => { cancelAnimationFrame(raf); };
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // stop held sounds when leaving
  useEffect(() => () => { const s = g.current; if (s && s.drone) s.drone.stop(0.05); if (s && s.riser) s.riser.stop(0.05); }, []);

  // ---------------------------------------------------------------- input handlers
  const onKeyDown = (e) => {
    if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      if (!e.repeat) startBreath();
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.repeat) return;
      if (windupArmed()) startWindup();
      else submit(0);
    }
  };
  const onKeyUp = (e) => {
    if (e.key === ' ' || e.code === 'Space') { e.preventDefault(); stopBreath(true); return; }
    if (e.key === 'Enter') {
      const s = g.current;
      if (s && s.windAt) { const held = stopWindup(); submit(held); }
    }
  };
  const keepFocus = (e) => { e.preventDefault(); };
  const padDown = (e) => { e.preventDefault(); try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ } startBreath(); };
  const padUp = (e) => { e.preventDefault(); stopBreath(true); };
  const goDown = (e) => {
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    if (windupArmed()) startWindup();
  };
  const goUp = (e) => {
    e.preventDefault();
    const s = g.current;
    if (s && s.windAt) { const held = stopWindup(); submit(held); } else submit(0);
  };

  // ---------------------------------------------------------------- render
  if (phase === 'pick') {
    return (
      <div className="pl-root pl-pick">
        <div className="pl-pick-in">
          <p className="pl-kicker">PROTOTYPE · NOT IN THE GAME YET</p>
          <h1 className="pl-title">POWERS LAB</h1>
          <p className="pl-sub">Word Bomb vs one bot. Turn powers on or off, then play.</p>
          <div className="pl-cards">
            {LAB_POWERS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`pl-card pl-card-${p.id}${equip[p.id] ? ' is-on' : ''}`}
                aria-pressed={equip[p.id]}
                onClick={() => setEquip((q) => ({ ...q, [p.id]: !q[p.id] }))}
              >
                <span className="pl-card-top"><span className="pl-card-kind">{p.kind}</span><span className="pl-card-tier"><span className="pl-wide">UNLOCKS </span>{p.tier}</span></span>
                <span className="pl-card-name">{p.name}</span>
                <span className="pl-card-how">{touch ? p.phone : p.how}</span>
                <span className="pl-card-what">{(touch && PHONE_COPY[p.id]) || POWER_COPY[p.id]}</span>
                <span className="pl-card-tick">{equip[p.id] ? 'ON' : 'OFF'}</span>
              </button>
            ))}
          </div>
          <button type="button" className="pl-start" disabled={!words} onClick={begin}>{words ? 'PLAY' : 'LOADING WORDS…'}</button>
        </div>
      </div>
    );
  }

  const s = g.current;
  if (phase === 'over') {
    return (
      <div className="pl-root pl-pick">
        <div className="pl-pick-in pl-over">
          <h1 className="pl-title">{s.won ? 'YOU WIN' : 'K.O.'}</h1>
          <p className="pl-over-score">{formatNum(s.score)}</p>
          <p className="pl-sub">{s.words} words · powers fired: breath {s.used_breath || 0} · slam {s.used_slam || 0} · fixed {s.used_fix || 0} · one row {s.used_row || 0}</p>
          <div className="pl-over-row">
            <button type="button" className="pl-start" onClick={begin}>PLAY AGAIN</button>
            <button type="button" className="pl-ghost-btn" onClick={() => setPhase('pick')}>POWERS</button>
          </div>
        </div>
      </div>
    );
  }

  const yourTurn = s.turn === 'you';
  const draftRow = s.equip.onerow && yourTurn && draft.length >= 3 ? draftRowOf(draft) : -1;
  const said = s.said;
  return (
    <div className={`pl-root pl-play${s.breathOn ? ' is-slow' : ''}`}>
      <header className="pl-hud">
        <div className="pl-side pl-side-you">
          <span className="pl-name">YOU</span>
          <Hearts n={s.lives.you} />
        </div>
        <div className="pl-score"><span className="pl-score-n">{formatNum(s.score)}</span><span className="pl-score-l">SCORE</span></div>
        <div className="pl-side pl-side-bot">
          <Hearts n={s.lives.bot} />
          <span className="pl-name">BOT</span>
        </div>
      </header>

      <div className="pl-stage" ref={(el) => { r.current.stage = el; }}>
        <div className="pl-slowmo" aria-hidden="true" />
        <div className="pl-top">
          <span className="pl-turn">{s.turn === 'bot' ? 'BOT IS TYPING' : yourTurn ? (s.breathOn ? 'HOLDING BREATH' : 'YOUR TURN') : ' '}</span>
          <span className="pl-secs" ref={(el) => { r.current.secs = el; }}>9.0</span>
          {s.bankShown > 0 && yourTurn && <span className="pl-bank">+{s.bankShown / 1000}s ONE ROW</span>}
        </div>
        <img className={`pl-seat pl-seat-you${yourTurn ? '' : ' is-wait'}`} src="/wb/player-pink.webp" alt="" />
        <img className={`pl-seat pl-seat-bot${s.turn === 'bot' ? '' : ' is-wait'}`} src="/wb/player-cyan.webp" alt="" />
        <div className="pl-bomb-move" ref={(el) => { r.current.bombMove = el; }}>
          <div className={`pl-bomb${s.breathOn ? ' is-slow' : ''}`}>
            <svg viewBox="0 0 160 185" aria-hidden="true" ref={(el) => { r.current.svg = el; }}>
              <image ref={(el) => { r.current.mascot = el; }} href={MASCOT.idle} x="10" y="35" width="140" height="140" />
              <path ref={(el) => { r.current.fuseA = el; }} d={FUSE_PATH} fill="none" stroke="#000" strokeWidth="7" strokeLinecap="round" pathLength="100" strokeDasharray="100" />
              <path ref={(el) => { r.current.fuseB = el; }} d={FUSE_PATH} fill="none" stroke="#FFE94A" strokeWidth="3" strokeLinecap="round" pathLength="100" strokeDasharray="100" />
              <circle cx="80" cy="105" r="62" fill="none" stroke="#000" strokeWidth="7" opacity="0.35" />
              <circle ref={(el) => { r.current.ring = el; }} cx="80" cy="105" r="62" fill="none" stroke="#FFE94A" strokeWidth="5" strokeLinecap="round" pathLength="100" strokeDasharray="100" transform="rotate(-90 80 105)" />
              <g ref={(el) => { r.current.flame = el; }}>
                <ellipse cx="0" cy="-13" rx="9" ry="17" fill="#FF6B3D" stroke="#000" strokeWidth="2.5" />
                <ellipse cx="0" cy="-15" rx="5.5" ry="12" fill="#FFE94A" />
                <ellipse cx="0" cy="-16" rx="2.5" ry="7" fill="#FFF6C8" />
              </g>
            </svg>
            <span className="pl-frag" translate="no">{s.frag.toUpperCase()}</span>
          </div>
        </div>
        <div className="pl-said" translate="no">
          {s.botTyped || s.botSaid ? (
            <span className="pl-said-bot">{s.botSaid ? s.botSaid.toUpperCase() : (s.botTyped || '').toUpperCase() + '_'}</span>
          ) : said ? (
            <SaidWord key={said.word + s.words} said={said} frag={s.frag} />
          ) : null}
        </div>
        <div className="pl-kb" ref={(el) => { r.current.kb = el; }} aria-hidden="true">
          {ROWS.map((row) => (
            <div key={row} className="pl-kb-row">
              {row.split('').map((ch) => (
                <span key={ch} className="pl-key" ref={(el) => { (r.current.keys ||= {})[ch] = el; }}>{ch.toUpperCase()}</span>
              ))}
            </div>
          ))}
        </div>
        <span className="pl-stamp" ref={(el) => { r.current.stamp = el; }} aria-hidden="true" />
        <img className="pl-burst" src="/fx/burst-ko.webp" alt="" ref={(el) => { r.current.burst = el; }} />
        {[0, 1, 2].map((i) => (
          <span key={i} className="pl-pop" aria-hidden="true" ref={(el) => { (r.current.pops ||= [])[i] = el; }} />
        ))}
      </div>

      <div className={`pl-powers n${Object.values(s.equip).filter(Boolean).length}`}>
        {s.equip.breath && (
          <button
            type="button"
            className={`pl-chip pl-chip-breath${s.breathOn ? ' is-live' : ''}`}
            onPointerDown={padDown}
            onPointerUp={padUp}
            onPointerCancel={padUp}
            onContextMenu={keepFocus}
            aria-label="Hold breath: hold to slow the fuse"
          >
            <span className="pl-chip-name">BREATH</span>
            <span className="pl-chip-key">{touch ? 'HOLD HERE' : 'HOLD SPACE'}</span>
            <span className="pl-meter"><span className="pl-meter-fill" ref={(el) => { r.current.breathFill = el; }} /></span>
          </button>
        )}
        {s.equip.windup && (
          <div className={`pl-chip pl-chip-windup${s.windPips >= WINDUP.pips ? ' is-armed' : ''}`}>
            <span className="pl-chip-name">WIND-UP</span>
            <span className="pl-chip-key">{s.windPips >= WINDUP.pips ? (touch ? 'HOLD GO' : 'HOLD ENTER') : `${s.windPips}/${WINDUP.pips} WORDS`}</span>
            <Pips n={s.windPips} of={WINDUP.pips} />
          </div>
        )}
        {s.equip.autocorrect && (
          <div className={`pl-chip pl-chip-ac${s.acPips >= AUTOCORRECT.pips ? ' is-armed' : ''}`}>
            <span className="pl-chip-name">AUTOCORRECT</span>
            <span className="pl-chip-key">{s.acPips >= AUTOCORRECT.pips ? 'NEXT TYPO FIXED' : `${s.acPips}/${AUTOCORRECT.pips} WORDS`}</span>
            <Pips n={s.acPips} of={AUTOCORRECT.pips} />
          </div>
        )}
        {s.equip.onerow && (
          <div className={`pl-chip pl-chip-row${draftRow >= 0 ? ' is-armed' : ''}`}>
            <span className="pl-chip-name">ONE ROW</span>
            <span className="pl-chip-key">{draftRow >= 0 ? `ROW ${draftRow + 1} · KEEP GOING` : 'ONE KEYBOARD ROW'}</span>
            <span className="pl-rows">{ROWS.map((row, i) => <i key={row} className={draftRow === i ? 'on' : ''} />)}</span>
          </div>
        )}
      </div>

      <form className="pl-entry" onSubmit={(e) => e.preventDefault()}>
        <div className="pl-field">
          <input
            ref={(el) => { r.current.input = el; }}
            className="pl-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value.replace(/[^a-zA-Z]/g, '').slice(0, 30))}
            onKeyDown={onKeyDown}
            onKeyUp={onKeyUp}
            placeholder={yourTurn ? `A WORD WITH ${s.frag.toUpperCase()}` : 'WAIT FOR THE BOMB'}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint="go"
            aria-label="Type a word"
          />
          <span className="pl-wind"><span className="pl-wind-fill" ref={(el) => { r.current.windFill = el; }} /></span>
          {s.note && <span className="pl-note">{s.note}</span>}
        </div>
        <button
          type="button"
          className={`pl-go${s.windPips >= WINDUP.pips && s.equip.windup ? ' is-armed' : ''}`}
          onPointerDown={goDown}
          onPointerUp={goUp}
          onPointerCancel={() => stopWindup()}
          onContextMenu={keepFocus}
        >
          GO
        </button>
      </form>
    </div>
  );
}

const POWER_COPY = {
  breath: 'Hold it and the fuse burns at 30%. Your breath refills by the letters you land.',
  windup: 'Hold Enter before you send. A full wind-up slams the word: ×2 and the bot gets half a clock.',
  autocorrect: 'Every 4 words it arms. Your next one-letter typo becomes the real word.',
  onerow: 'A word on one keyboard row (TYPEWRITER, FLASK) pays ×3 and banks +2 s.',
};

const PHONE_COPY = {
  breath: 'Hold the BREATH pad with one thumb and the fuse burns at 30%. Landed letters refill it.',
  windup: 'Hold GO before you send. A full wind-up slams the word: ×2 and the bot gets half a clock.',
};

function Hearts({ n }) {
  return (
    <span className="pl-hearts" aria-label={`${n} lives`}>
      {Array.from({ length: LIVES }, (_, i) => (
        <img key={i} src={i < n ? '/fx/heart.webp' : '/fx/heart-empty.webp'} alt="" />
      ))}
    </span>
  );
}

function Pips({ n, of }) {
  return (
    <span className="pl-pips">
      {Array.from({ length: of }, (_, i) => <i key={i} className={i < n ? 'on' : ''} />)}
    </span>
  );
}

// The last word you landed, as letter tiles. AUTOCORRECT shows the wrong letter knocked out and the
// right one dropping in (finite one-shot on mount).
function SaidWord({ said }) {
  const ref = useRef(null);
  useEffect(() => {
    const root = ref.current;
    if (!root || !said.fix) return;
    const nu = root.querySelector('.is-fixed');
    const old = root.querySelector('.pl-old');
    if (nu) play(nu, [
      { transform: 'translateY(-34px) rotate(-20deg) scale(1.4)', opacity: 0 },
      { transform: 'translateY(4px) rotate(4deg) scale(1.1)', opacity: 1, offset: 0.6 },
      { transform: 'translateY(0) rotate(0) scale(1)', opacity: 1 },
    ], { duration: 360, delay: 120, easing: 'cubic-bezier(.3,1.5,.5,1)', fill: 'backwards' });
    if (old) play(old, [
      { transform: 'translateY(0) rotate(0)', opacity: 1 },
      { transform: 'translateY(40px) rotate(35deg)', opacity: 0 },
    ], { duration: 420, easing: 'cubic-bezier(.5,0,.8,.4)' });
  }, [said]);
  const { word, fix, typed } = said;
  const oldCh = fix ? (fix.kind === 'sub' ? typed[fix.at] : fix.kind === 'del' ? '' : null) : null;
  return (
    <span className={`pl-tiles${said.row >= 0 ? ' is-row' : ''}`} ref={ref}>
      {word.split('').map((ch, i) => {
        const fixed = fix && (fix.kind === 'swap' ? i === fix.at || i === fix.at + 1 : i === fix.at);
        return (
          <span key={i} className={`pl-tile${fixed ? ' is-fixed' : ''}`}>
            {ch.toUpperCase()}
            {fixed && oldCh && i === fix.at && <span className="pl-old">{oldCh.toUpperCase()}</span>}
          </span>
        );
      })}
      {fix && <span className="pl-was">you typed {typed.toUpperCase()}</span>}
    </span>
  );
}
