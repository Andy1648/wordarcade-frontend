// DailyWheel.jsx — THE DAILY WHEEL panel (progress/wheel.js + leaderboard/serverWheel.js + 067_daily_wheel.sql).
// Opened from the WHEEL tile in the menu's top-right cluster (it took the slot SETTINGS + NEWS freed). Lazy: its own
// chunk, off the menu's first paint.
//
//   SPIN → the server rolls (lb_wheel_spin) while the wheel winds back; then ONE finite WAAPI rotate (transform only,
//   ~5 s ease-out) lands on the server's slot at a random point inside it. The pointer ticks on every peg crossing —
//   the crossings are precomputed from the angle + the easing (no per-frame reads), and each tick replays ONE pooled
//   WAAPI flick on the single pointer node + a Web Audio click. Landed → the result pops, the save is paid
//   (payLanded, once) and the server hears the claim.
//   ODDS — the published table, one tap away (the server's own weights).
//   AD SPIN — behind WHEEL_AD_ON (client) AND the server's ad_on; OFF until rewarded ads are approved.
// Nothing loops: at rest the wheel is still. REDUCE MOTION parks the wheel on the result with no spin.
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './DailyWheel.css';
import '../kit/tokens.css';
import { KitButton } from '../kit/KitButton.jsx';
import { reduceMotion } from '../../lib/reduceMotion.js';
import { ready as sfxReady } from '../../audio/gameSounds';
import { tone, pentFreq, NOTE } from '../../audio/audioCore.js';
import {
  WHEEL_SLOTS, SLICE_DEG, WHEEL_AD_ON, artSrc, oddsRows, landAngle, pegCrossings, timeAtProgress, SPIN_EASE,
  resultText, bonusText, nextBonus, payLanded, noteSpun, readWheel, wheelDay,
} from '../../progress/wheel.js';
import { wheelState, spinWheel, claimWheel } from '../../leaderboard/serverWheel.js';
import { grantGems } from '../../progress/gemsCore.js';
import { grantStockFx } from '../../progress/v3/stock.js';
import { grantKit, kitById, kitSrc } from '../../cast/kit.js';
import { showRewarded, rewardedReady } from '../../ads/rewarded.js';

const SPIN_MS = 5200;
const PAY = { grantGems, grantFx: grantStockFx, grantKit };

function sndTick(i) {
  const ctx = sfxReady();
  if (!ctx) return;
  tone(ctx.currentTime, { freq: pentFreq(NOTE.G4 + (i % 2)), type: 'square', dur: 0.03, gain: 0.05, attack: 0.002 });
}
function sndLand(big) {
  const ctx = sfxReady();
  if (!ctx) return;
  const t = ctx.currentTime;
  const run = big ? [0, 2, 4, 5, 7] : [0, 2, 4];
  run.forEach((k, i) => tone(t + i * 0.08, { freq: pentFreq(NOTE.C5 + k), type: 'triangle', dur: 0.18, gain: 0.16, attack: 0.004 }));
}

/** The prize art for a landed spin (the cosmetic's own art once the server named it). */
function prizeArt(s) {
  if (s.prize === 'cosmetic' && s.cosmetic) return kitSrc(s.cosmetic, 0);
  if (s.prize === 'ticket') return artSrc(s.ticket.tier === 'legendary' || s.ticket.tier === 'mythic' ? 'prize-ticket-legendary' : 'prize-ticket-rare');
  return artSrc(WHEEL_SLOTS[s.slot].icon);
}

export default function DailyWheel({ onClose }) {
  const [st, setSt] = useState({ phase: 'load' }); // load | off | ready | spinning | landed | done
  const [odds, setOdds] = useState(false);
  const rotorRef = useRef(null);
  const pointerRef = useRef(null);
  const resultRef = useRef(null);
  const restRef = useRef(0); // the wheel's current angle (deg)
  const timers = useRef([]);
  const live = useRef(true);

  const park = useCallback((slot) => {
    const a = landAngle(slot, 0, () => 0.5, 0) % 360;
    restRef.current = a;
    if (rotorRef.current) rotorRef.current.style.transform = `rotate(${a}deg)`;
  }, []);

  // open: what does the server say about today?
  useEffect(() => {
    live.current = true;
    const pending = timers.current;
    wheelState().then((r) => {
      if (!live.current) return;
      if (r.off) { setSt({ phase: 'off' }); return; }
      const paid = readWheel().paid;
      const f = r.free;
      if (f && (f.claimed || paid.includes(f.spin))) {
        noteSpun(f.day, f.streak);
        park(f.slot);
        setSt({ phase: 'done', spin: f, ad: r.ad, adOn: r.adOn, streak: r.streak });
        return;
      }
      // the streak today's spin continues (067: one missed day is forgiven, two or more start again at DAY 1)
      const gap = r.lastDay > 0 ? wheelDay() - r.lastDay : 99;
      setSt({ phase: 'ready', streak: gap <= 2 ? r.streak : 0, adOn: r.adOn, ad: r.ad });
    });
    return () => {
      live.current = false;
      for (const t of pending) clearTimeout(t);
    };
  }, [park]);

  const land = useCallback((s, rest) => {
    restRef.current = rest;
    if (rotorRef.current) rotorRef.current.style.transform = `rotate(${rest}deg)`;
    const paidNow = payLanded(s, PAY);
    if (s.kind === 'free') noteSpun(s.day, s.streak);
    if (paidNow || !s.claimed) claimWheel(s.spin);
    const big = s.prize === 'ticket' || s.prize === 'cosmetic';
    try { sndLand(big); } catch { /* audio */ }
    setSt((p) => ({ ...p, phase: 'landed', spin: s, [s.kind === 'ad' ? 'ad' : 'freeSpin']: s }));
  }, []);

  // the result chip pops once when it lands
  useEffect(() => {
    if (st.phase !== 'landed' || !resultRef.current || reduceMotion()) return;
    const el = resultRef.current;
    el.style.willChange = 'transform, opacity';
    const a = el.animate([
      { transform: 'scale(0.4) rotate(-6deg)', opacity: 0 },
      { transform: 'scale(1.12) rotate(2deg)', opacity: 1, offset: 0.6 },
      { transform: 'scale(1) rotate(0deg)', opacity: 1 },
    ], { duration: 360, easing: 'cubic-bezier(0.2, 0.9, 0.3, 1.2)' });
    a.onfinish = () => { el.style.willChange = ''; };
  }, [st.phase]);

  const spin = useCallback(async (kind = 'free') => {
    if (st.phase === 'spinning') return;
    setSt((p) => ({ ...p, phase: 'spinning' }));
    const rotor = rotorRef.current;
    const from = restRef.current;
    // the wind-up plays while the server answers (it never decides anything)
    let wind = null;
    if (rotor && !reduceMotion()) {
      rotor.style.willChange = 'transform';
      wind = rotor.animate([{ transform: `rotate(${from}deg)` }, { transform: `rotate(${from - 14}deg)` }], { duration: 260, easing: 'ease-out', fill: 'forwards' });
    }
    const r = await spinWheel(kind);
    if (!live.current) return;
    if (!r.spin) {
      if (wind) wind.cancel();
      if (rotor) rotor.style.willChange = '';
      setSt((p) => ({ ...p, phase: r.error === 'off' ? 'off' : 'ready', error: r.error }));
      return;
    }
    const s = r.spin;
    const to = landAngle(s.slot, from, Math.random, 5);
    if (!rotor || reduceMotion()) {
      if (wind) wind.cancel();
      land(s, to % 360);
      return;
    }
    const start = from - 14;
    const a = rotor.animate([{ transform: `rotate(${start}deg)` }, { transform: `rotate(${to}deg)` }], { duration: SPIN_MS, easing: SPIN_EASE, fill: 'forwards' });
    if (wind) wind.cancel();
    // the pointer ticks: precomputed peg crossings → setTimeouts; ONE pooled flick on the one pointer node
    const ptr = pointerRef.current;
    pegCrossings(start, to).forEach((deg, i) => {
      const at = timeAtProgress((deg - start) / (to - start)) * SPIN_MS;
      timers.current.push(setTimeout(() => {
        if (!live.current) return;
        sndTick(i);
        if (ptr) {
          const prev = ptr.__tick;
          if (prev) prev.cancel();
          ptr.__tick = ptr.animate([{ transform: 'rotate(-22deg)' }, { transform: 'rotate(0deg)' }], { duration: 140, easing: 'ease-out' });
        }
      }, at));
    });
    a.onfinish = () => {
      if (!live.current) return;
      rotor.style.transform = `rotate(${to % 360}deg)`;
      a.cancel();
      rotor.style.willChange = '';
      land(s, to % 360);
    };
  }, [st.phase, land]);

  const watchAd = useCallback(async () => {
    const r = await showRewarded('wheel_spin');
    if (r === 'viewed' && live.current) spin('ad');
  }, [spin]);

  const s = st.spin;
  const streak = s ? s.streak : (st.streak || 0) + 1; // the day this spin is (landed: the server's count)
  const bonusNow = s ? s.bonus : nextBonus(st.streak || 0);
  const canAd = WHEEL_AD_ON && st.adOn && rewardedReady() && (st.phase === 'done' || st.phase === 'landed') && !st.ad && s && s.kind === 'free';
  const cos = s && s.prize === 'cosmetic' && s.cosmetic ? kitById(s.cosmetic) : null;

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="dw-scrim" role="dialog" aria-modal="true" aria-label="Daily wheel" data-testid="daily-wheel">
      <div className="dw">
        <button type="button" className="dw-close" onClick={onClose} aria-label="Close the daily wheel">✕</button>
        <div className="dw-head">
          <h2 className="dw-title">DAILY WHEEL</h2>
          <span className={`dw-streak${bonusNow ? ` is-${bonusNow}` : ''}`} aria-label={`Spin streak ${streak} days`}>
            <span className="dw-streak-n">DAY {Math.max(1, streak)}</span>
            {bonusNow ? <span className="dw-streak-b">{bonusText(bonusNow)}</span> : null}
          </span>
        </div>

        <div className="dw-stage">
          <div className="dw-wheel">
            <div ref={rotorRef} className="dw-rotor">
              <img className="dw-face" src={artSrc('face')} alt="" aria-hidden="true" draggable="false" />
              {WHEEL_SLOTS.map((p) => (
                <div key={p.slot} className={`dw-slice${p.jackpot ? ' is-jackpot' : ''}`} style={{ transform: `rotate(${p.slot * SLICE_DEG}deg)` }} aria-hidden="true">
                  <img className="dw-slice-ico" src={artSrc(p.icon)} alt="" draggable="false" />
                  <span className="dw-slice-l">{p.label}</span>
                  <span className="dw-slice-s">{p.sub}</span>
                </div>
              ))}
            </div>
            <img className="dw-rim" src={artSrc('rim')} alt="" aria-hidden="true" draggable="false" />
            <button
              type="button"
              className="dw-hub"
              onClick={() => spin('free')}
              disabled={st.phase !== 'ready'}
              aria-label="Spin the wheel"
            >
              <img src={artSrc('hub')} alt="" aria-hidden="true" draggable="false" />
              <span className="dw-hub-l">{st.phase === 'ready' ? 'SPIN' : ''}</span>
            </button>
            <img ref={pointerRef} className="dw-pointer" src={artSrc('pointer')} alt="" aria-hidden="true" draggable="false" />
          </div>
        </div>

        <div className="dw-foot">
          {st.phase === 'load' ? <p className="dw-msg">LOADING…</p> : null}
          {st.phase === 'off' ? <p className="dw-msg">THE WHEEL NEEDS A CONNECTION · TRY AGAIN SOON</p> : null}
          {st.phase === 'ready' ? (
            <KitButton tone="pink" label="SPIN" sub="FREE TODAY" labelSize={34} width={220} onClick={() => spin('free')} data-testid="wheel-spin" />
          ) : null}
          {st.phase === 'spinning' ? <p className="dw-msg">…</p> : null}
          {(st.phase === 'landed' || st.phase === 'done') && s ? (
            <div ref={resultRef} className={`dw-result is-${s.prize}`} data-testid="wheel-result">
              <img src={prizeArt(s)} alt="" aria-hidden="true" draggable="false" />
              <span className="dw-result-t">
                <span className="dw-result-l">{cos ? cos.name : resultText(s)}</span>
                <span className="dw-result-s">
                  {s.prize === 'ticket' ? 'WAITING IN GEARS → ROLL' : cos ? 'IN PROFILE → CUSTOMIZE' : st.phase === 'done' ? 'TODAY’S SPIN' : 'YOURS!'}
                  {s.bonus === 'super' || (s.bonus === 'hot' && s.prize === 'gems') ? ` · ${bonusText(s.bonus)}` : ''}
                </span>
              </span>
            </div>
          ) : null}
          {(st.phase === 'landed' || st.phase === 'done') ? <p className="dw-msg is-next">NEXT FREE SPIN TOMORROW</p> : null}
          {canAd ? <KitButton tone="cyan" label="WATCH AD" sub="+1 SPIN TODAY" labelSize={24} width={200} onClick={watchAd} /> : null}
          <button type="button" className="dw-odds-btn" onClick={() => setOdds((o) => !o)} aria-expanded={odds}>ODDS</button>
        </div>

        {odds ? (
          <div className="dw-odds" role="group" aria-label="Wheel odds">
            <span className="dw-odds-h">WHAT THE WHEEL PAYS</span>
            <ul>
              {oddsRows().map((o) => (
                <li key={o.slot} style={{ '--o-c': o.color }}>
                  <span className="dw-odds-sw" aria-hidden="true" />
                  <span className="dw-odds-n">{o.name}</span>
                  <span className="dw-odds-p">{o.pct}%</span>
                </li>
              ))}
            </ul>
            <span className="dw-odds-f">FREE ONLY · 3+ DAY STREAK ×1.5 GEMS · DAY 7 = SUPER SPIN</span>
            <button type="button" className="dw-odds-x" onClick={() => setOdds(false)}>BACK</button>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
