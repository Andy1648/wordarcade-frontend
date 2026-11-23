// PowersLab2.jsx — POWERS LAB ROUND 2 (nov22 PROTOTYPE, /?powers=2). Andy on round 1: passives are boring
// in-game (they belong on a progression screen); he liked HOLDING SPACE as a physical way to play; WIND-UP
// (hold Enter) didn't read. Round 2 = three ACTIVE powers where the keyboard itself is the toy, each readable
// with no text, plus a PROGRESSION tab (ProgressLab.jsx) where the same physical play lives on the menu.
//   SLINGSHOT  hold SPACE while you type → the bomb pulls back on a band; LET GO to fire the word.
//              The longer the pull, the less time the bot gets (down to half). Your clock keeps burning.
//   CAPS RAGE  press CAPS LOCK → RAGE: everything goes red, words pay ×3, the fuse burns 1.6× faster.
//              Press it again to calm down.
//   STOMP      when the fuse goes red, ◀ ▶ keys pop up → mash LEFT/RIGHT to stomp the flame back down
//              the fuse (+0.35 s a stomp, up to +3 s a turn).
// Same rules as round 1: a local round (the live WB clock is server-side), its own lazy root, no economy.
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { loadSoloWords } from '../solo/words';
import { formatNum } from '../format';
import pools from '../solo/fragmentPools.json';
import { TURN_MS, BOT_TURN_MS, wordPoints } from './powers';
import { FUSE_PATH, fusePoint, MASCOT, reduceMotion, isTouch, play, Hearts } from './PowersLab';
import * as sfx from './labSounds';
import ProgressLab from './ProgressLab';
import './PowersLab.css';
import './PowersLab2.css';

const LIVES = 3;
export const SLING = { fullMs: 900, pips: 2, botMin: 0.5 };
export const RAGE = { scoreMult: 3, burn: 1.6 };
export const STOMP = { perMs: 350, budgetMs: 3000, redAt: 0.3 };

const qp = (k) => { try { return new URLSearchParams(location.search).get(k); } catch { return null; } };
const FIXED_FRAGS = (qp('frags') || '').toLowerCase().split(',').filter((f) => /^[a-z]{1,4}$/.test(f));
const FAST_BOT = qp('botpace') === 'fast';
const POOL = `${pools.e || ''} ${pools.m || ''}`.split(/\s+/).filter((f) => f.length >= 2);
const START_TAB = qp('tab') === 'progress' ? 'progress' : 'pick';

const R2_POWERS = [
  { id: 'sling', name: 'SLINGSHOT', key: 'HOLD SPACE', phone: 'HOLD SLING', tone: 'cyan',
    what: 'Hold SPACE while you type. Let go to fire the word. Longer pull, less time for the bot.',
    phoneWhat: 'Hold SLING while you type. Let go to fire the word. Longer pull, less time for the bot.' },
  { id: 'rage', name: 'CAPS RAGE', key: 'CAPS LOCK', phone: 'TAP RAGE', tone: 'red',
    what: 'Caps Lock on = RAGE: words pay ×3, the fuse burns faster. Caps Lock off to calm down.' },
  { id: 'stomp', name: 'STOMP', key: '◀ ▶ MASH', phone: 'MASH ◀ ▶', tone: 'yellow',
    what: 'When the fuse goes red, mash ◀ ▶ to stomp the flame back down the fuse.' },
];

export default function PowersLab2() {
  const [phase, setPhase] = useState(START_TAB); // pick | play | over | progress
  const [equip, setEquip] = useState(() => ({ sling: true, rage: true, stomp: true }));
  const [words, setWords] = useState(null);
  const [, bump] = useReducer((x) => x + 1, 0);
  const [draft, setDraft] = useState('');
  const touch = useRef(isTouch()).current;
  const g = useRef(null);
  const r = useRef({});

  useEffect(() => {
    let live = true;
    loadSoloWords().then((w) => { if (live) setWords(w); });
    return () => { live = false; };
  }, []);

  const pickFrag = useCallback(() => {
    const s = g.current;
    if (FIXED_FRAGS.length) return FIXED_FRAGS[s.fragIx++ % FIXED_FRAGS.length];
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

  const freeze = (ms) => { const s = g.current; s.freezeUntil = Math.max(s.freezeUntil, performance.now() + ms); };
  const shake = (k = 6, ms = 220) => {
    if (reduceMotion()) return;
    play(r.current.stage, [
      { transform: 'translate(0,0)' }, { transform: `translate(${-k}px,${k / 2}px)` },
      { transform: `translate(${k}px,${-k / 2}px)` }, { transform: `translate(${-k / 2}px,${k / 3}px)` },
      { transform: 'translate(0,0)' },
    ], { duration: ms, easing: 'linear', fill: 'none' });
  };
  const stamp = (text, tone) => {
    const el = r.current.stamp;
    if (!el) return;
    el.textContent = text;
    el.dataset.tone = tone;
    play(el, [
      { opacity: 0, transform: 'translate(-50%,-50%) scale(1.8) rotate(-8deg)' },
      { opacity: 1, transform: 'translate(-50%,-50%) scale(0.94) rotate(-4deg)', offset: 0.18 },
      { opacity: 1, transform: 'translate(-50%,-50%) scale(1) rotate(-4deg)', offset: 0.26 },
      { opacity: 1, transform: 'translate(-50%,-50%) scale(1) rotate(-4deg)', offset: 0.8 },
      { opacity: 0, transform: 'translate(-50%,-60%) scale(1) rotate(-4deg)' },
    ], { duration: 900, easing: 'cubic-bezier(.2,1.3,.4,1)' });
  };
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
    ], { duration: 700, easing: 'cubic-bezier(.2,.9,.3,1)' });
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
  const moveBomb = (to, power = 0) => {
    const el = r.current.bombMove;
    if (!el) return;
    const x = to === 'bot' ? 'var(--pl-lane)' : 'calc(-1 * var(--pl-lane))';
    const from = to === 'bot' ? 'calc(-1 * var(--pl-lane))' : 'var(--pl-lane)';
    play(el, [
      { transform: `translateX(${from}) scale(1)` },
      { transform: `translateX(0px) translateY(${-30 - 40 * power}px) scale(${1.08 + 0.3 * power}) rotate(${power * 200}deg)`, offset: 0.5 },
      { transform: `translateX(${x}) scale(1) rotate(${power * 360}deg)` },
    ], { duration: power ? 260 : 340, easing: power ? 'cubic-bezier(.5,0,.2,1)' : 'cubic-bezier(.3,.8,.4,1)' });
  };

  const startYou = useCallback(() => {
    const s = g.current;
    s.turn = 'you';
    s.frag = pickFrag();
    s.leftMs = TURN_MS;
    s.stompBudget = STOMP.budgetMs;
    s.stompUp = false;
    s.botSaid = null; s.botTyped = ''; s.said = null;
    moveBomb('you');
    freeze(340);
    bump();
  }, [pickFrag]);

  const startBot = useCallback((power) => {
    const s = g.current;
    s.turn = 'bot';
    s.frag = pickFrag();
    s.botLeftMs = BOT_TURN_MS * s.botScale;
    s.botScale = 1;
    s.botWord = botWordFor(s.frag);
    s.botPlanMs = !s.botWord || (!FAST_BOT && Math.random() < 0.06) ? Infinity
      : FAST_BOT ? 1500 + Math.random() * 400 : 2000 + Math.random() * 4000;
    s.botSaid = null; s.botTyped = '';
    s.stompUp = false;
    moveBomb('bot', power);
    freeze(power ? 260 : 340);
    bump();
  }, [pickFrag, botWordFor]);

  // ---------------------------------------------------------------- SLINGSHOT
  const slingReady = () => { const s = g.current; return !!(s && s.equip.sling && s.slingPips >= SLING.pips); };
  const startSling = () => {
    const s = g.current;
    if (!s || s.turn !== 'you' || s.slingAt) return;
    if (!slingReady()) { sfx.breathEmpty(); return; }
    s.slingAt = performance.now();
    s.creak = sfx.slingPull();
    bump();
  };
  const slingPull = () => {
    const s = g.current;
    return s && s.slingAt ? Math.min(1, (performance.now() - s.slingAt) / SLING.fullMs) : 0;
  };
  const releaseSling = () => {
    const s = g.current;
    if (!s || !s.slingAt) return;
    const pull = slingPull();
    s.slingAt = 0;
    if (s.creak) s.creak.stop(0.03);
    s.creak = null;
    const sv = r.current.svg;
    if (sv) sv.style.transform = '';
    const band = r.current.band;
    if (band) band.setAttribute('d', BAND_REST);
    const ok = submit(draftRef.current, { pull });
    if (!ok) {
      sfx.slingSnap();
      if (sv && !reduceMotion()) play(sv, [{ transform: `translateX(${-30 * pull}px)` }, { transform: 'translateX(12px)' }, { transform: 'translateX(-5px)' }, { transform: 'translateX(0)' }], { duration: 300, fill: 'none' });
    }
    bump();
  };

  // ---------------------------------------------------------------- CAPS RAGE
  const setRage = (on) => {
    const s = g.current;
    if (!s || !s.equip.rage || s.rage === on || s.turn === 'over') return;
    s.rage = on;
    if (on) { sfx.rageOn(); stamp('RAGE!', 'red'); shake(8, 240); } else sfx.rageOff();
    bump();
  };

  // ---------------------------------------------------------------- STOMP
  const doStomp = (dir) => {
    const s = g.current;
    if (!s || !s.equip.stomp || s.turn !== 'you' || !s.stompUp || s.lastStomp === dir) return;
    s.lastStomp = dir;
    const add = Math.min(STOMP.perMs, s.stompBudget, TURN_MS - s.leftMs);
    if (add <= 0) return;
    s.leftMs += add;
    s.stompBudget -= add;
    s.stomps = (s.stomps || 0) + 1;
    sfx.stomp(s.stomps % 12);
    const key = dir === 'L' ? r.current.keyL : r.current.keyR;
    if (key) play(key, [{ transform: 'translateY(0) scale(1)' }, { transform: 'translateY(6px) scale(0.9)' }, { transform: 'translateY(0) scale(1)' }], { duration: 120, fill: 'none' });
    const sv = r.current.svg;
    if (sv && !reduceMotion()) play(sv, [{ transform: 'scale(1,1)' }, { transform: 'scale(1.06,0.9) translateY(8px)' }, { transform: 'scale(1,1)' }], { duration: 130, fill: 'none' });
    pop(`+${(add / 1000).toFixed(2).replace(/0$/, '')}s`, 'yellow');
    s.used_stomp = (s.used_stomp || 0) + 1;
  };

  // ---------------------------------------------------------------- submit
  const draftRef = useRef('');
  draftRef.current = draft;
  const reject = (why) => {
    sfx.reject();
    const el = r.current.input;
    if (el && !reduceMotion()) play(el, [{ transform: 'translateX(0)' }, { transform: 'translateX(-8px)' }, { transform: 'translateX(8px)' }, { transform: 'translateX(0)' }], { duration: 200, fill: 'none' });
    g.current.note = why;
    bump();
    return false;
  };
  // returns true when the word landed
  function submit(raw, { pull = 0 } = {}) {
    const s = g.current;
    if (!s || s.turn !== 'you') return false;
    const word = String(raw || '').trim().toLowerCase();
    if (!word) return false;
    if (word.length < 3) return reject('3+ LETTERS');
    if (s.used.has(word)) return reject('ALREADY USED');
    if (!word.includes(s.frag)) return reject(`NEEDS ${s.frag.toUpperCase()}`);
    if (!words.accept.has(word)) return reject('NOT A WORD');

    s.used.add(word);
    let mult = 1;
    const fired = pull > 0.15;
    if (s.rage) mult *= RAGE.scoreMult;
    if (fired) {
      s.botScale = 1 - (1 - SLING.botMin) * pull;
      s.slingPips = 0;
      s.used_sling = (s.used_sling || 0) + 1;
    } else if (s.equip.sling && s.slingPips < SLING.pips) {
      s.slingPips++;
      if (s.slingPips === SLING.pips) sfx.armed(); else sfx.pipFilled(s.slingPips);
    }
    const pts = wordPoints(word, mult);
    s.score += pts;
    s.words++;
    s.said = { word };
    s.note = null;
    if (fired) {
      freeze(120);
      sfx.slingFire(pull);
      stamp(pull >= 1 ? 'LAUNCH!' : 'FIRE!', 'cyan');
      shake(10 * pull + 4, 260);
    } else if (s.rage) { sfx.slam(); shake(8, 200); } else sfx.accept();
    pop(`+${pts}`, s.rage ? 'red' : fired ? 'cyan' : '');
    setDraft('');
    s.turn = 'passing';
    s.stompUp = false;
    setTimeout(() => { if (g.current === s && s.turn === 'passing') startBot(fired ? pull : 0); }, fired ? 140 : 60);
    bump();
    return true;
  }

  // ---------------------------------------------------------------- loop
  const begin = () => {
    sfx.wakeAudio();
    g.current = {
      equip: { ...equip },
      turn: 'you', frag: 'er', fragIx: 0, recent: [],
      leftMs: TURN_MS, botLeftMs: BOT_TURN_MS, botPlanMs: Infinity, botScale: 1, botWord: null, botSaid: null, botTyped: '',
      lives: { you: LIVES, bot: LIVES }, used: new Set(), score: 0, words: 0,
      slingPips: SLING.pips, slingAt: 0, rage: false,
      stompBudget: STOMP.budgetMs, stompUp: false, lastStomp: null,
      freezeUntil: 0, popIx: 0, said: null, note: null, lastSec: -1, pose: 'idle',
    };
    setDraft('');
    setPhase('play');
  };

  const endRound = (won) => {
    const s = g.current;
    s.turn = 'over';
    s.won = won;
    if (s.creak) s.creak.stop(0.05);
    setPhase('over');
  };

  useEffect(() => {
    if (phase !== 'play') return undefined;
    startYou();
    if (r.current.input) r.current.input.focus();
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
        s.leftMs -= dt * (s.rage ? RAGE.burn : 1);
        // opens when the fuse goes red, then STAYS open (no flicker as stomps push it back) until the budget is spent
        const red = s.equip.stomp && s.stompBudget > 0 && (s.stompUp || s.leftMs / TURN_MS < STOMP.redAt);
        if (red !== s.stompUp) { s.stompUp = red; s.lastStomp = null; if (red) sfx.stompUp(); bump(); }
        if (s.slingAt) {
          const p = slingPull();
          if (R.svg) R.svg.style.transform = `translateX(${(-34 * p).toFixed(1)}px) scaleX(${(1 - 0.12 * p).toFixed(3)}) rotate(${(-8 * p).toFixed(1)}deg)`;
          if (R.band) R.band.setAttribute('d', bandPath(p));
        }
        if (s.leftMs <= 0) {
          s.leftMs = 0;
          if (s.slingAt) { s.slingAt = 0; if (s.creak) s.creak.stop(0.03); s.creak = null; if (R.svg) R.svg.style.transform = ''; if (R.band) R.band.setAttribute('d', BAND_REST); }
          sfx.boom(); burst('you'); shake(12, 320);
          s.lives.you--;
          s.note = 'BOOM';
          s.stompUp = false;
          setDraft('');
          if (s.lives.you <= 0) { endRound(false); return; }
          s.turn = 'passing';
          setTimeout(() => { if (g.current === s && s.turn === 'passing') startBot(0); }, 700);
          bump();
        }
      } else if (s.turn === 'bot') {
        s.botLeftMs -= dt;
        s.botPlanMs -= dt;
        if (s.botWord && s.botPlanMs < 1400 && s.botPlanMs > 0) {
          const k = Math.min(s.botWord.length, Math.floor(((1400 - s.botPlanMs) / 1400) * s.botWord.length) + 1);
          if (k !== s.botTyped.length) { s.botTyped = s.botWord.slice(0, k); bump(); }
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
          sfx.boom(); burst('bot'); shake(8, 280);
          s.lives.bot--;
          s.botSaid = 'BOOM';
          if (s.lives.bot <= 0) { endRound(true); return; }
          s.turn = 'passing';
          setTimeout(() => { if (g.current === s && s.turn === 'passing') startYou(); }, 700);
          bump();
        }
      }

      const ratio = s.turn === 'bot' ? Math.max(0, s.botLeftMs / BOT_TURN_MS)
        : s.turn === 'you' ? Math.max(0, Math.min(1, s.leftMs / TURN_MS)) : null;
      if (ratio != null) {
        const off = String(100 * (1 - ratio));
        if (R.fuseA) { R.fuseA.setAttribute('stroke-dashoffset', off); R.fuseB.setAttribute('stroke-dashoffset', off); R.ring.setAttribute('stroke-dashoffset', off); }
        const [fx, fy] = fusePoint(ratio);
        const fs = ratio < 0.3 ? 1.6 : ratio < 0.6 ? 1.3 : 1;
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
    };
    raf = requestAnimationFrame(loop);
    window.__powersLab = () => {
      const s = g.current;
      return s && { turn: s.turn, frag: s.frag, leftMs: s.leftMs, slingPips: s.slingPips, rage: s.rage, stompUp: s.stompUp, lives: s.lives, score: s.score };
    };
    return () => cancelAnimationFrame(raf);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { const s = g.current; if (s && s.creak) s.creak.stop(0.05); }, []);

  // ---------------------------------------------------------------- input
  const onKeyDown = (e) => {
    if (e.key === 'CapsLock') {
      e.preventDefault();
      const s = g.current;
      // a real keyboard reports the lock state; otherwise toggle
      const st = e.getModifierState ? e.getModifierState('CapsLock') : null;
      setRage(st === true ? true : st === false && s && s.rage ? false : !(s && s.rage));
      return;
    }
    if (e.key === ' ' || e.code === 'Space') { e.preventDefault(); if (!e.repeat) startSling(); return; }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const s = g.current;
      if (s && s.stompUp) { e.preventDefault(); doStomp(e.key === 'ArrowLeft' ? 'L' : 'R'); }
      return;
    }
    if (e.key === 'Enter') { e.preventDefault(); if (!e.repeat) submit(draft); }
  };
  const onKeyUp = (e) => {
    // macOS fires CapsLock keyup (not keydown) when the lock turns OFF
    if (e.key === 'CapsLock' && e.getModifierState && e.getModifierState('CapsLock') === false && g.current && g.current.rage && /Mac/.test(navigator.platform)) setRage(false);
    if (e.key === ' ' || e.code === 'Space') { e.preventDefault(); releaseSling(); }
  };
  const keep = (e) => e.preventDefault();
  const slingDown = (e) => { e.preventDefault(); try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ } startSling(); };
  const slingUp = (e) => { e.preventDefault(); releaseSling(); };
  const stompTap = (dir) => (e) => { e.preventDefault(); doStomp(dir); };

  // ---------------------------------------------------------------- render
  if (phase === 'progress') return <ProgressLab onBack={() => setPhase('pick')} touch={touch} />;

  if (phase === 'pick') {
    return (
      <div className="pl-root pl-pick">
        <div className="pl-pick-in">
          <p className="pl-kicker">PROTOTYPE · ROUND 2 · NOT IN THE GAME YET</p>
          <h1 className="pl-title">POWERS LAB</h1>
          <p className="pl-sub">The keyboard is the toy. Three powers in Word Bomb, three on the progression screen.</p>
          <div className="pl-cards pl-cards-3">
            {R2_POWERS.map((p) => (
              <button key={p.id} type="button" className={`pl-card pl2-card pl2-card-${p.tone}${equip[p.id] ? ' is-on' : ''}`} aria-pressed={equip[p.id]}
                onClick={() => setEquip((q) => ({ ...q, [p.id]: !q[p.id] }))}>
                <span className="pl-card-name">{p.name}</span>
                <span className="pl-card-how">{touch ? p.phone : p.key}</span>
                <span className="pl-card-what">{(touch && p.phoneWhat) || p.what}</span>
                <span className="pl-card-tick">{equip[p.id] ? 'ON' : 'OFF'}</span>
              </button>
            ))}
          </div>
          <div className="pl-over-row">
            <button type="button" className="pl-start" disabled={!words} onClick={begin}>{words ? 'PLAY WORD BOMB' : 'LOADING WORDS…'}</button>
            <button type="button" className="pl-ghost-btn pl2-prog-btn" onClick={() => { sfx.wakeAudio(); setPhase('progress'); }}>PROGRESSION</button>
          </div>
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
          <p className="pl-sub">{s.words} words · slingshots {s.used_sling || 0} · stomps {s.used_stomp || 0}</p>
          <div className="pl-over-row">
            <button type="button" className="pl-start" onClick={begin}>PLAY AGAIN</button>
            <button type="button" className="pl-ghost-btn" onClick={() => setPhase('pick')}>POWERS</button>
          </div>
        </div>
      </div>
    );
  }

  const yourTurn = s.turn === 'you';
  const n = ['sling', 'rage', 'stomp'].filter((k) => s.equip[k]).length;
  return (
    <div className={`pl-root pl-play${s.rage ? ' is-rage' : ''}${s.slingAt ? ' is-pull' : ''}`}>
      <header className="pl-hud">
        <div className="pl-side pl-side-you"><span className="pl-name">YOU</span><Hearts n={s.lives.you} /></div>
        <div className="pl-score"><span className="pl-score-n">{formatNum(s.score)}</span><span className="pl-score-l">SCORE</span></div>
        <div className="pl-side pl-side-bot"><Hearts n={s.lives.bot} /><span className="pl-name">BOT</span></div>
      </header>

      <div className="pl-stage" ref={(el) => { r.current.stage = el; }}>
        <div className="pl2-rage" aria-hidden="true" />
        <div className="pl-top">
          <span className="pl-turn">{s.turn === 'bot' ? 'BOT IS TYPING' : yourTurn ? (s.rage ? 'RAGE' : 'YOUR TURN') : ' '}</span>
          <span className="pl-secs" ref={(el) => { r.current.secs = el; }}>9.0</span>
        </div>
        <img className={`pl-seat pl-seat-you${yourTurn ? '' : ' is-wait'}`} src="/wb/player-pink.webp" alt="" />
        <img className={`pl-seat pl-seat-bot${s.turn === 'bot' ? '' : ' is-wait'}`} src="/wb/player-cyan.webp" alt="" />
        <div className="pl-bomb-move" ref={(el) => { r.current.bombMove = el; }}>
          {s.equip.sling && yourTurn && (
            <svg className="pl2-sling" viewBox="0 0 120 200" aria-hidden="true">
              <path d="M60 196 L60 120 M60 120 L30 52 M60 120 L90 52" stroke="#000" strokeWidth="14" strokeLinecap="round" fill="none" />
              <path d="M60 196 L60 120 M60 120 L30 52 M60 120 L90 52" stroke="#8a4b1f" strokeWidth="8" strokeLinecap="round" fill="none" />
              <path ref={(el) => { r.current.band = el; }} d={BAND_REST} stroke={slingReady() ? '#FF4FA3' : '#5a3a6e'} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          )}
          <div className="pl-bomb">
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
          {s.stompUp && yourTurn && (
            <>
              <span className="pl2-key pl2-key-l" ref={(el) => { r.current.keyL = el; }} aria-hidden="true">◀</span>
              <span className="pl2-key pl2-key-r" ref={(el) => { r.current.keyR = el; }} aria-hidden="true">▶</span>
            </>
          )}
        </div>
        <div className="pl-said" translate="no">
          {s.botTyped || s.botSaid ? (
            <span className="pl-said-bot">{s.botSaid ? s.botSaid.toUpperCase() : s.botTyped.toUpperCase() + '_'}</span>
          ) : s.said ? (
            <span className={`pl-tiles${s.rage ? ' is-rage' : ''}`}>{s.said.word.split('').map((ch, i) => <span key={i} className="pl-tile">{ch.toUpperCase()}</span>)}</span>
          ) : null}
        </div>
        <span className="pl-stamp" ref={(el) => { r.current.stamp = el; }} aria-hidden="true" />
        <img className="pl-burst" src="/fx/burst-ko.webp" alt="" ref={(el) => { r.current.burst = el; }} />
        {[0, 1, 2].map((i) => <span key={i} className="pl-pop" aria-hidden="true" ref={(el) => { (r.current.pops ||= [])[i] = el; }} />)}
      </div>

      <div className={`pl-powers n${n}`}>
        {s.equip.sling && (
          <button type="button" className={`pl-chip pl2-chip-sling${s.slingAt ? ' is-live' : ''}${slingReady() ? ' is-armed' : ''}`}
            onPointerDown={slingDown} onPointerUp={slingUp} onPointerCancel={slingUp} onContextMenu={keep} aria-label="Slingshot: hold, type, let go to fire">
            <span className="pl-chip-name">SLING</span>
            <span className="pl-chip-key">{slingReady() ? (touch ? 'HOLD + TYPE' : 'HOLD SPACE') : `${s.slingPips}/${SLING.pips} WORDS`}</span>
            <span className="pl-pips">{Array.from({ length: SLING.pips }, (_, i) => <i key={i} className={i < s.slingPips ? 'on' : ''} />)}</span>
          </button>
        )}
        {s.equip.rage && (
          <button type="button" className={`pl-chip pl2-chip-rage${s.rage ? ' is-live' : ''}`} onPointerDown={keep} onClick={() => setRage(!s.rage)} aria-pressed={s.rage}>
            <span className="pl-chip-name">RAGE</span>
            <span className="pl-chip-key">{s.rage ? '×3 · FAST FUSE' : touch ? 'TAP' : 'CAPS LOCK'}</span>
            <span className="pl2-lamp" aria-hidden="true" />
          </button>
        )}
        {s.equip.stomp && (
          <div className={`pl-chip pl2-chip-stomp${s.stompUp && yourTurn ? ' is-armed' : ''}`}>
            <span className="pl-chip-name">STOMP</span>
            <span className="pl2-stomp-pads">
              <button type="button" className="pl2-pad" disabled={!s.stompUp} onPointerDown={stompTap('L')} aria-label="Stomp left">◀</button>
              <button type="button" className="pl2-pad" disabled={!s.stompUp} onPointerDown={stompTap('R')} aria-label="Stomp right">▶</button>
            </span>
          </div>
        )}
      </div>

      <form className="pl-entry" onSubmit={(e) => e.preventDefault()}>
        <div className="pl-field">
          <input
            ref={(el) => { r.current.input = el; }}
            className={`pl-input${s.rage ? ' is-rage' : ''}`}
            value={draft}
            onChange={(e) => setDraft(e.target.value.replace(/[^a-zA-Z]/g, '').slice(0, 30))}
            onKeyDown={onKeyDown}
            onKeyUp={onKeyUp}
            placeholder={yourTurn ? `A WORD WITH ${s.frag.toUpperCase()}` : 'WAIT FOR THE BOMB'}
            autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} enterKeyHint="go"
            aria-label="Type a word"
          />
          {s.note && <span className="pl-note">{s.note}</span>}
        </div>
        <button type="button" className="pl-go" onPointerDown={keep} onClick={() => submit(draft)}>GO</button>
      </form>
    </div>
  );
}

// the slingshot band: from the two fork tips to the bomb's back, pulled left by p (0..1)
// (fork-svg units: the bomb's back sits at x ≈ -30; the bomb pulls back ~34 px ≈ 55 units)
const bandPath = (p) => `M30 52 L${(-30 - 55 * p).toFixed(1)} ${(100 + 6 * p).toFixed(1)} L90 52`;
const BAND_REST = bandPath(0);
