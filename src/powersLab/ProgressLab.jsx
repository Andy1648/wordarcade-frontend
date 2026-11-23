// ProgressLab.jsx — POWERS LAB round 2, the PROGRESSION side (prototype). Andy: "creative ways to engage …
// more in progression place". Three menu moments where the keyboard is physical, plus the round-1 passives
// as a PERK row (they belong here, not in play).
//   ASCEND    HOLD SPACE (phone: hold the orb). The orb charges, the screen rumbles harder, letters light;
//             let go early and it drains. Full = the new world SLAMS in.
//   CHEST     MASH any keys (phone: tap). Every key cracks the chest and spits that letter out. 12 cracks
//             opens it; your keys-per-second is the flourish (GOLD hands) — the reward is the same for all.
//   LEVEL UP  TYPE "LEVEL UP" (phone: tap) — each letter stamps in with a rising note, then the level rolls.
import { useEffect, useReducer, useRef, useState } from 'react';
import LockChains from '../components/lockChains/LockChains';
import { play, reduceMotion } from './PowersLab';
import * as sfx from './labSounds';

const STATIONS = [
  { id: 'ascend', name: 'ASCEND' },
  { id: 'chest', name: 'CHEST' },
  { id: 'level', name: 'LEVEL UP' },
];
const PERKS = [
  { id: 'ac', name: 'AUTOCORRECT', line: '1 typo fixed every 4 words', tier: 'A1', on: true },
  { id: 'row', name: 'ONE ROW', line: 'one-row words pay ×3', tier: 'A3' },
  { id: 'rhyme', name: 'RHYME', line: 'rhymes stack +50%', tier: 'A6' },
  { id: 'beat', name: 'ON BEAT', line: 'on-beat words pay ×2', tier: 'A7' },
  { id: 'dbl', name: 'DOUBLE TAP', line: 'double letters add time', tier: 'A8' },
];
const ASCEND_MS = 2000;
const CHEST_HITS = 12;
const LEVEL_WORD = 'LEVELUP';

export default function ProgressLab({ onBack, touch }) {
  const [station, setStation] = useState(() => {
    try { const q = new URLSearchParams(location.search).get('station'); if (STATIONS.some((s) => s.id === q)) return q; } catch { /* no URL */ }
    return 'ascend';
  });
  return (
    <div className="pl-root pg-root">
      <header className="pg-head">
        <button type="button" className="pg-back-btn" onClick={onBack} aria-label="Back">◀</button>
        <nav className="pg-tabs">
          {STATIONS.map((s) => (
            <button key={s.id} type="button" className={`pg-tab${station === s.id ? ' is-on' : ''}`} onClick={() => setStation(s.id)}>{s.name}</button>
          ))}
        </nav>
      </header>
      <div className="pg-stage">
        {station === 'ascend' && <Ascend touch={touch} />}
        {station === 'chest' && <Chest touch={touch} />}
        {station === 'level' && <LevelUp touch={touch} />}
      </div>
      <section className="pg-perks" aria-label="Perks">
        <p className="pg-perks-title">PERKS <span>· 1 SLOT AT A1, 2 AT A2, 3 AT A5</span></p>
        <div className="pg-perk-row">
          {PERKS.map((p) => (
            <div key={p.id} className={`pg-perk${p.on ? ' is-on' : ' is-locked'}`}>
              <span className="pg-perk-tier">{p.on ? 'EQUIPPED' : p.tier}</span>
              <span className="pg-perk-name">{p.name}</span>
              <span className="pg-perk-line">{p.line}</span>
              {!p.on && <LockChains />}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ------------------------------------------------------------------ ASCEND (hold)
function Ascend({ touch }) {
  const [, bump] = useReducer((x) => x + 1, 0);
  const st = useRef({ c: 0, holding: false, done: false, lit: 0, riser: null });
  const el = useRef({});

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (t) => {
      raf = requestAnimationFrame(loop);
      const s = st.current;
      const dt = Math.min(64, t - last);
      last = t;
      if (s.done) return;
      if (s.holding) s.c = Math.min(1, s.c + dt / ASCEND_MS);
      else if (s.c > 0) s.c = Math.max(0, s.c - (2 * dt) / ASCEND_MS);
      const E = el.current;
      if (E.ring) E.ring.setAttribute('stroke-dashoffset', String(100 * (1 - s.c)));
      if (E.orb) {
        const k = reduceMotion() ? 0 : s.c * s.c * 7;
        const x = (Math.random() - 0.5) * k;
        const y = (Math.random() - 0.5) * k;
        E.orb.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${(1 + 0.22 * s.c).toFixed(3)})`;
      }
      if (E.glow) E.glow.style.opacity = String(s.c * 0.9);
      const lit = Math.floor(s.c * 6.01);
      if (lit !== s.lit) { s.lit = lit; bump(); }
      if (s.c >= 1) finish();
    };
    raf = requestAnimationFrame(loop);
    const down = (e) => { if (e.code === 'Space' || e.key === ' ') { e.preventDefault(); if (!e.repeat) hold(true); } };
    const up = (e) => { if (e.code === 'Space' || e.key === ' ') { e.preventDefault(); hold(false); } };
    addEventListener('keydown', down);
    addEventListener('keyup', up);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('keydown', down);
      removeEventListener('keyup', up);
      if (st.current.riser) st.current.riser.stop(0.05);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function hold(on) {
    const s = st.current;
    if (s.done || s.holding === on) return;
    s.holding = on;
    sfx.wakeAudio();
    if (on) s.riser = sfx.ascendRiser();
    else {
      if (s.riser) s.riser.stop(0.1);
      s.riser = null;
      if (s.c > 0.05) sfx.ascendDrop();
    }
    bump();
  }
  function finish() {
    const s = st.current;
    s.done = true;
    s.holding = false;
    if (s.riser) s.riser.stop(0.05);
    s.riser = null;
    sfx.ascendBoom();
    const E = el.current;
    play(E.flash, [{ opacity: 0.95 }, { opacity: 0 }], { duration: 520, easing: 'ease-out' });
    play(E.stamp, [
      { opacity: 0, transform: 'translate(-50%,-50%) scale(2.2) rotate(-10deg)' },
      { opacity: 1, transform: 'translate(-50%,-50%) scale(0.92) rotate(-4deg)', offset: 0.3 },
      { opacity: 1, transform: 'translate(-50%,-50%) scale(1) rotate(-4deg)', offset: 0.4 },
      { opacity: 1, transform: 'translate(-50%,-50%) scale(1) rotate(-4deg)', offset: 0.88 },
      { opacity: 0, transform: 'translate(-50%,-50%) scale(1) rotate(-4deg)' },
    ], { duration: 2300, easing: 'cubic-bezier(.2,1.3,.4,1)' });
    play(E.burst, [
      { opacity: 1, transform: 'translate(-50%,-50%) scale(0.3)' },
      { opacity: 1, transform: 'translate(-50%,-50%) scale(1.3) rotate(15deg)', offset: 0.4 },
      { opacity: 0, transform: 'translate(-50%,-50%) scale(1.5) rotate(25deg)' },
    ], { duration: 900 });
    bump();
    setTimeout(() => { s.done = false; s.c = 0; s.lit = 0; bump(); }, 2600);
  }

  const s = st.current;
  const pd = (e) => { e.preventDefault(); try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ } hold(true); };
  const pu = (e) => { e.preventDefault(); hold(false); };
  return (
    <div className={`pg-ascend${s.holding ? ' is-holding' : ''}`}>
      <div className="pg-glow" ref={(e) => { el.current.glow = e; }} aria-hidden="true" />
      <div className="pg-word" aria-label="Ascend">
        {'ASCEND'.split('').map((ch, i) => <span key={i} className={i < s.lit || s.done ? 'on' : ''}>{ch}</span>)}
      </div>
      <button type="button" className="pg-orb-btn" onPointerDown={pd} onPointerUp={pu} onPointerCancel={pu} onContextMenu={(e) => e.preventDefault()} aria-label="Hold to ascend">
        <span className="pg-orb" ref={(e) => { el.current.orb = e; }}>
          <svg viewBox="0 0 200 200" aria-hidden="true">
            <circle cx="100" cy="100" r="88" fill="none" stroke="#000" strokeWidth="16" />
            <circle ref={(e) => { el.current.ring = e; }} cx="100" cy="100" r="88" fill="none" stroke="#FFE94A" strokeWidth="10" strokeLinecap="round" pathLength="100" strokeDasharray="100" strokeDashoffset="100" transform="rotate(-90 100 100)" />
          </svg>
          <img src="/icons/rebirth.webp" alt="" />
        </span>
      </button>
      <p className="pg-hint"><span className="pg-key">{touch ? 'HOLD' : 'SPACE'}</span>{touch ? ' THE ORB' : ' HOLD'}</p>
      <p className="pg-world">NEXT: SUNKEN ARCADE · ×2 FOREVER</p>
      <div className="pg-flash" ref={(e) => { el.current.flash = e; }} aria-hidden="true" />
      <img className="pg-burst" src="/fx/burst-win.webp" alt="" ref={(e) => { el.current.burst = e; }} />
      <div className="pg-stamp" ref={(e) => { el.current.stamp = e; }} aria-hidden="true">A2 · ×2 FOREVER</div>
    </div>
  );
}

// ------------------------------------------------------------------ CHEST (mash)
function Chest({ touch }) {
  const [, bump] = useReducer((x) => x + 1, 0);
  const st = useRef({ hits: 0, t0: 0, open: false, tier: null, rate: 0, best: 0, ix: 0 });
  const el = useRef({ tiles: [] });

  useEffect(() => {
    const down = (e) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      if (!/^[a-z0-9 ]$/i.test(e.key)) return;
      e.preventDefault();
      hit(e.key === ' ' ? '␣' : e.key.toUpperCase());
    };
    addEventListener('keydown', down);
    return () => removeEventListener('keydown', down);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function hit(letter) {
    const s = st.current;
    if (s.open) return;
    sfx.wakeAudio();
    const now = performance.now();
    if (!s.hits) s.t0 = now;
    s.hits++;
    sfx.chestHit(s.hits);
    const E = el.current;
    const k = 3 + s.hits * 0.7;
    if (E.chest && !reduceMotion()) {
      play(E.chest, [
        { transform: `scale(${1 + s.hits * 0.012}) rotate(0deg)` },
        { transform: `scale(${1.06 + s.hits * 0.012}) rotate(${s.hits % 2 ? k : -k}deg) translateY(-6px)` },
        { transform: `scale(${1 + s.hits * 0.012}) rotate(0deg)` },
      ], { duration: 110, easing: 'ease-out' });
    }
    const tile = E.tiles[s.ix++ % E.tiles.length];
    if (tile) {
      tile.textContent = letter;
      const a = (Math.random() - 0.5) * 2.4;
      const dx = Math.sin(a) * (90 + Math.random() * 60);
      const dy = -Math.cos(a) * (90 + Math.random() * 50);
      play(tile, [
        { opacity: 1, transform: 'translate(-50%,-50%) scale(0.6) rotate(0deg)' },
        { opacity: 1, transform: `translate(calc(-50% + ${dx.toFixed(0)}px), calc(-50% + ${dy.toFixed(0)}px)) scale(1.1) rotate(${(a * 60).toFixed(0)}deg)`, offset: 0.55 },
        { opacity: 0, transform: `translate(calc(-50% + ${(dx * 1.2).toFixed(0)}px), calc(-50% + ${(dy + 70).toFixed(0)}px)) scale(0.9) rotate(${(a * 90).toFixed(0)}deg)` },
      ], { duration: 620, easing: 'cubic-bezier(.2,.8,.4,1)' });
    }
    if (s.hits >= CHEST_HITS) {
      s.open = true;
      s.rate = (CHEST_HITS - 1) / Math.max(0.15, (now - s.t0) / 1000);
      s.best = Math.max(s.best, s.rate);
      s.tier = s.rate >= 8 ? 'GOLD' : s.rate >= 5 ? 'SILVER' : 'BRONZE';
      sfx.chestOpen(s.tier === 'GOLD');
      play(E.chest, [
        { transform: 'scale(1.15) translateY(0)', opacity: 1 },
        { transform: 'scale(1.35) translateY(-30px)', opacity: 1, offset: 0.4 },
        { transform: 'scale(0.6) translateY(-40px)', opacity: 0 },
      ], { duration: 520, easing: 'cubic-bezier(.3,1.4,.5,1)' });
      play(E.burst, [
        { opacity: 1, transform: 'translate(-50%,-50%) scale(0.3)' },
        { opacity: 1, transform: 'translate(-50%,-50%) scale(1.2) rotate(15deg)', offset: 0.4 },
        { opacity: 0, transform: 'translate(-50%,-50%) scale(1.4) rotate(25deg)' },
      ], { duration: 900 });
      play(E.prize, [
        { opacity: 0, transform: 'translate(-50%,-50%) scale(0.4)' },
        { opacity: 1, transform: 'translate(-50%,-50%) scale(1.15)', offset: 0.25 },
        { opacity: 1, transform: 'translate(-50%,-50%) scale(1)', offset: 0.35 },
        { opacity: 1, transform: 'translate(-50%,-50%) scale(1)', offset: 0.9 },
        { opacity: 0, transform: 'translate(-50%,-60%) scale(1)' },
      ], { duration: 2400, easing: 'cubic-bezier(.2,1.3,.4,1)' });
      setTimeout(() => {
        s.open = false; s.hits = 0;
        if (E.chest) play(E.chest, [{ opacity: 0, transform: 'scale(0.6)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 260, easing: 'cubic-bezier(.3,1.5,.5,1)' });
        bump();
      }, 2500);
    }
    bump();
  }

  const s = st.current;
  const tap = (e) => { e.preventDefault(); hit(String.fromCharCode(65 + Math.floor(Math.random() * 26))); };
  return (
    <div className="pg-chest">
      <button type="button" className="pg-chest-btn" onPointerDown={tap} aria-label="Tap to crack the chest">
        <img className="pg-chest-img" src="/shop/chest-v2.webp" alt="" ref={(e) => { el.current.chest = e; }} />
      </button>
      <div className="pg-cracks" aria-hidden="true">
        {Array.from({ length: CHEST_HITS }, (_, i) => <i key={i} className={i < s.hits ? 'on' : ''} />)}
      </div>
      <p className="pg-hint"><span className="pg-key">{touch ? 'TAP' : 'ANY KEY'}</span> MASH</p>
      <p className="pg-world">{s.best ? `BEST ${s.best.toFixed(1)} KEYS/S · GOLD AT 8` : 'FASTER HANDS = GOLD BURST (SAME LOOT)'}</p>
      {Array.from({ length: 8 }, (_, i) => <span key={i} className="pg-tile" aria-hidden="true" ref={(e) => { el.current.tiles[i] = e; }} />)}
      <img className="pg-burst" src="/fx/burst-win.webp" alt="" ref={(e) => { el.current.burst = e; }} />
      <div className={`pg-prize pg-tier-${(s.tier || 'bronze').toLowerCase()}`} ref={(e) => { el.current.prize = e; }} aria-hidden="true">
        <span className="pg-prize-tier">{s.tier === 'GOLD' ? 'GOLD HANDS!' : s.tier || ''}</span>
        <span className="pg-prize-loot"><img src="/icons/gems.webp" alt="" />+40</span>
        <span className="pg-prize-rate">{s.rate ? `${s.rate.toFixed(1)} KEYS/S` : ''}</span>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ LEVEL UP (type it)
function LevelUp({ touch }) {
  const [, bump] = useReducer((x) => x + 1, 0);
  const st = useRef({ ix: 0, lv: 14, done: false });
  const el = useRef({ slots: [] });

  useEffect(() => {
    const down = (e) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
      e.preventDefault();
      press(e.key.toUpperCase());
    };
    addEventListener('keydown', down);
    return () => removeEventListener('keydown', down);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function press(ch) {
    const s = st.current;
    if (s.done) return;
    sfx.wakeAudio();
    const want = LEVEL_WORD[s.ix];
    const slot = el.current.slots[s.ix];
    if (ch !== want) {
      sfx.reject();
      if (slot && !reduceMotion()) play(slot, [{ transform: 'translateX(0)' }, { transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' }, { transform: 'translateX(0)' }], { duration: 160, fill: 'none' });
      return;
    }
    sfx.stampLetter(s.ix);
    s.ix++;
    bump();
    if (slot) play(slot, [
      { transform: 'scale(2.2) rotate(-12deg)', opacity: 0.4 },
      { transform: 'scale(0.9) rotate(3deg)', opacity: 1, offset: 0.6 },
      { transform: 'scale(1) rotate(0deg)', opacity: 1 },
    ], { duration: 200, easing: 'cubic-bezier(.3,1.4,.5,1)', fill: 'none' });
    if (s.ix >= LEVEL_WORD.length) {
      s.done = true;
      setTimeout(() => {
        s.lv++;
        sfx.levelFanfare();
        const E = el.current;
        play(E.hex, [{ transform: 'scale(1) rotate(0)' }, { transform: 'scale(1.35) rotate(-8deg)' }, { transform: 'scale(1) rotate(0)' }], { duration: 380, easing: 'cubic-bezier(.3,1.5,.5,1)' });
        play(E.burst, [
          { opacity: 1, transform: 'translate(-50%,-50%) scale(0.3)' },
          { opacity: 1, transform: 'translate(-50%,-50%) scale(1.2) rotate(15deg)', offset: 0.4 },
          { opacity: 0, transform: 'translate(-50%,-50%) scale(1.4) rotate(25deg)' },
        ], { duration: 850 });
        bump();
      }, 120);
      setTimeout(() => { s.ix = 0; s.done = false; bump(); }, 2400);
    }
  }

  const s = st.current;
  const tap = (e) => { e.preventDefault(); if (!st.current.done) press(LEVEL_WORD[st.current.ix]); };
  return (
    <div className="pg-level" onPointerDown={touch ? tap : undefined}>
      <div className="pg-hex" ref={(e) => { el.current.hex = e; }}>
        <img src="/results/xp-hex.webp" alt="" />
        <span className="pg-hex-n">{s.lv}</span>
      </div>
      <div className="pg-slots" aria-label="Type LEVEL UP">
        {LEVEL_WORD.split('').map((ch, i) => (
          <span key={i} className={`pg-slot${i < s.ix ? ' is-in' : ''}${i === s.ix && !s.done ? ' is-next' : ''}${i === 5 ? ' gap' : ''}`} ref={(e) => { el.current.slots[i] = e; }}>{ch}</span>
        ))}
      </div>
      <p className="pg-hint"><span className="pg-key">{touch ? 'TAP' : 'TYPE IT'}</span></p>
      <img className="pg-burst" src="/fx/burst-win.webp" alt="" ref={(e) => { el.current.burst = e; }} />
    </div>
  );
}
