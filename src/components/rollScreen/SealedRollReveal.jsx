// SealedRollReveal.jsx — THE SEALED ROLL opening (Andy oct24: "the epic+, legendary+ rolls … i don't want dice").
// A bought (or granted) EPIC+ / LEGENDARY+ ticket is a COG-LOCKED GEAR CANISTER (VesselArt — EPIC: steel cog, purple
// plating; LEGENDARY: gold crowned cog, gold plating). Tap OPEN:
//   1. RATTLE — EPIC+ once, LEGENDARY+ three times, each harder — while the server picks (060 lb_ticket_roll: the floor
//      is ITS ticket row, the browser sends only the id);
//   2. the COG SPINS two full turns (pure rotate about its hub), then POPS OFF;
//   3. the LID BLASTS UP; the tier's painted GLOW (rays from its bottom centre, on the rim, scaled big behind the
//      canister over a deep tier-tinted scrim — no CSS stripes) + a pooled burst of painted SHARDS, a flat flash;
//   4. the GEAR CARD RISES out of the canister; a pick above the floor stamps UPGRADE!;
//   5. the landing commits it (buyTicketRoll → the save, lb_ticket_claim → the server) and wears it if it is better.
// Every motion is a finite WAAPI one-shot on a node that already exists (the shard pool is fixed), transform / opacity
// only; each node's REST style is its end state, so REDUCE MOTION simply shows the result. Nothing loops.
// ONE CHOREOGRAPHY (Andy oct25 "unsmooth"): anticipation (squash + a counter-turn of the cog) -> release (the cog pops,
// the vessel stretches, the lid blasts 50 ms later) -> follow-through (the burst starts while the lid is still flying,
// the vessel settles with a spring). Shake / spring curves, never linear. Every part is decoded before OPEN is offered,
// and the landed card is mounted (hidden) + decoded while the cog turns, so no decode lands inside the burst.
// CLOSE: the X / Escape / a tap outside -- only while sealed, or once the card has LANDED (never mid-open: the pick is
// committed before the burst, so closing can never lose it; it just must be seen).
// No pick (offline / the server said no): the ticket stays sealed and waits in GEARS (the roll screen's OPEN button).
// THE PACK OPENING (Andy oct27: the canister reveal must have the "rare addicting feeling" — opened like a pack):
//   - YOU open it: three TAPS ratchet the cog a notch each (rattle + click + the light leaking out of the seams grows).
//     No tap for NOTCH_AUTO_MS winds the next notch by itself, so nobody is ever stuck on a canister that does nothing.
//   - THE TELL: if the server's pick is ABOVE the floor, the last notch's leak turns the PICK's colour with a white pop
//     and the scrim re-tints (the walkout moment) — you know it's big before you see what it is.
//   - the card rises FACE-DOWN (the roll screen's own card back); its edge lights in the pick colour (LEGENDARY+), it
//     shakes, and YOU flip it (a tap, or by itself after FLIP_AUTO_MS). The flip is the payoff: slam + flash.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import '../kit/tokens.css';
import './SealedRollReveal.css';
import MarkCard from '../markCard/MarkCard';
import { CARD_RAR, cardTier } from '../markCard/palette.js';
import { markEntry } from '../../progress/markRolls';
import { buyTicketRoll, applyRollEquip } from '../../progress/markRollShop';
import { rollTicket, claimTicket, noteLanded } from '../../leaderboard/serverTickets';
import { ticketLabel } from '../../progress/rollTickets';
import { tierRank } from '../../progress/markRollsCore';
import { sndRollTell, sndRollCharge, sndShardBurst, sndRollSting, sndReelTick, sndRevealFlip, sndRevealRise, sndCutStamp } from '../../audio/rollSounds';
import { sndWordRejected } from '../../audio/gameSounds';
import { kitPlay } from '../kit/motion';
import { useReduceMotion } from '../../lib/useReduceMotion';
import VesselArt, { vesselArt, SHARD_ART } from './VesselArt';
import { holdBeats } from '../../hooks/useBeatSync';

const NOTCHES = 3; // taps to open (each turns the cog a third)
const NOTCH_AUTO_MS = 900; // no tap: the cog winds the next notch itself
const FLIP_AUTO_MS = { epic: 1300, legendary: 1700, mythic: 2000, secret: 2200 }; // no tap: the card flips itself
// the LEAK: how much light escapes after each notch (scale, opacity of the painted ray fan)
const LEAK = [[0.42, 0.3], [0.55, 0.5], [0.7, 0.68], [0.84, 0.85]];
// the light per tier: the painted fans (purple / gold) — MYTHIC is pink + cyan, SECRET pink + gold + cyan (a static
// hue turn of the purple fan, never animated) — a ray set offset a few degrees so the colours interleave
const GLOWS = {
  epic: [['epic', '']],
  legendary: [['legendary', '']],
  mythic: [['epic', 'is-pink'], ['epic', 'is-cyan is-off']],
  secret: [['epic', 'is-pink'], ['legendary', 'is-off'], ['epic', 'is-cyan is-off2']],
};
const tellOf = (t) => (GLOWS[t] ? t : 'epic');
// the face-down card's pre-flip shake: it BUILDS over `ms` (40% → 100% of `px`)
const jitter = (px, n = 12) => {
  const kf = [{ transform: 'none' }];
  for (let i = 1; i < n; i += 1) {
    const a = px * (0.4 + 0.6 * (i / n)) * (i % 2 ? 1 : -1);
    kf.push({ transform: `translate(${a}px,${-Math.abs(a) * 0.3}px) rotate(${a * 0.5}deg)`, offset: i / n });
  }
  kf.push({ transform: 'none' });
  return kf;
};
// a rattle: a squat, then a decaying side-to-side shake about the base (each one harder)
const rattle = (k) => [
  { transform: 'translate(0,0) rotate(0deg) scale(1,1)' },
  { transform: `translate(0,${3 + k}px) rotate(0deg) scale(${1.03 + 0.01 * k},${0.95 - 0.01 * k})`, offset: 0.14 },
  { transform: `translate(${-6 - 4 * k}px,0) rotate(${-6 - 3 * k}deg) scale(1,1.01)`, offset: 0.32 },
  { transform: `translate(${6 + 4 * k}px,0) rotate(${6 + 3 * k}deg) scale(1,1.01)`, offset: 0.52 },
  { transform: `translate(${-3 - 2 * k}px,0) rotate(${-3 - k}deg) scale(1,1)`, offset: 0.72 },
  { transform: `translate(${1 + k}px,0) rotate(${1 + 0.5 * k}deg) scale(1,1)`, offset: 0.88 },
  { transform: 'translate(0,0) rotate(0deg) scale(1,1)' },
];
const SHAKE = 'cubic-bezier(.36,.07,.19,.97)';
const SPRING = 'cubic-bezier(.2,1.25,.4,1)';
const decodeImgs = (root) => Promise.all([...(root ? root.querySelectorAll('img') : [])].map((i) => (i.decode ? i.decode().catch(() => {}) : null)));
const nextFrame = () => new Promise((r) => { requestAnimationFrame(() => r()); });
// the reveal stops the menu's pointer listeners (wall parallax / magnetic cards) restyling the covered page each move
const stopMenuPointer = (e) => e.stopPropagation();
// THE SHARD POOL: fixed nodes, fixed flight paths (fanning up and out of the open top) — never a node per burst
const SHARDS = [
  [-150, -190, -260], [150, -200, 300], [-70, -260, 200], [80, -250, -220], [-210, -60, 340], [210, -80, -320], [-20, -300, 180], [30, -150, -160],
].map(([dx, dy, r], i) => ({ dx, dy, r, src: SHARD_ART[i % SHARD_ART.length] }));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const done = (a) => (a && a.finished ? a.finished.catch(() => {}) : Promise.resolve());
const EASE_OUT = 'cubic-bezier(.2,.8,.3,1)';
// THE HERO SIZE (Andy: the canister is the screen's hero): ~half the viewport height, capped by the width. The card that
// rises out of it scales with it; the pod is tall enough for the card + the canister's badge peeking out below it.
const heroSize = () => {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1366;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 768;
  const v = Math.round(Math.max(200, Math.min(vh * 0.5, vw * 0.88, 520)));
  const card = Math.round(v * 0.6);
  return { v, card, pod: Math.round(card * 1.63 + v * 0.36), rim: Math.round(v * 0.63), k: v / 250 };
};

export default function SealedRollReveal({ ticket, onDone }) {
  const floor = ticket ? ticket.tier : 'epic';
  const vTier = tierRank(floor) >= tierRank('legendary') ? 'legendary' : 'epic';
  const reduced = useReduceMotion();
  const [phase, setPhase] = useState('sealed'); // sealed → opening (the taps) → reveal (face-down) → open | later
  const [res, setRes] = useState(null);
  const [tell, setTell] = useState(vTier); // the colour the light shows: the vessel's, until the TELL turns it the pick's
  const [landed, setLanded] = useState(false); // the card has finished landing: only now can a tap outside close it
  const [ready, setReady] = useState(false); // every vessel part decoded (OPEN waits for it, capped)
  const rootRef = useRef(null);
  const closeRef = useRef(null);
  const chipRef = useRef(null);
  const [hero] = useState(heroSize);
  const stageRef = useRef(null);
  const vesselRef = useRef(null);
  const lidRef = useRef(null);
  const cogRef = useRef(null);
  const glowRef = useRef(null);
  const shardRefs = useRef([]);
  const flashRef = useRef(null);
  const cardRef = useRef(null);
  const flipRef = useRef(null);
  const backRef = useRef(null);
  const edgeRef = useRef(null);
  const faceRef = useRef(null);
  const stampRef = useRef(null);
  const btnRef = useRef(null);
  const alive = useRef(true);
  const tellRef = useRef(vTier);
  // THE TAP: a pending wait (the next notch / the flip) resolves early on a tap — or by itself after its auto time
  // (a tap that lands while a notch is still playing is HELD for the next wait — a fast tapper is never dropped)
  const tapRef = useRef(null);
  const heldTap = useRef(false);
  const nextTap = (ms) => new Promise((r) => {
    if (heldTap.current) { heldTap.current = false; r(); return; }
    const t = setTimeout(() => { tapRef.current = null; r(); }, ms);
    tapRef.current = () => { clearTimeout(t); tapRef.current = null; r(); };
  });
  useEffect(() => {
    alive.current = true;
    if (!reduced && vesselRef.current) kitPlay(vesselRef.current, [{ transform: 'translateY(-60px) scale(1.4)', opacity: 0 }, { transform: 'translateY(6px) scale(.95)', opacity: 1, offset: 0.6 }, { transform: 'none', opacity: 1 }], { duration: 340, easing: 'cubic-bezier(.2,1.3,.4,1)', fill: 'backwards' });
    btnRef.current?.focus();
    // decode every part (vessel, glows, shards) before OPEN can start the sequence: a decode mid-burst is a dropped frame
    Promise.race([decodeImgs(rootRef.current), wait(900)]).then(() => { if (alive.current) setReady(true); });
    // the opaque scrim covers the page: hold the beat flips + skip rendering what it covers (SealedRollReveal.css)
    const release = holdBeats();
    const de = document.documentElement;
    de.setAttribute('data-srr-cover', '');
    return () => { alive.current = false; tapRef.current?.(); release(); de.removeAttribute('data-srr-cover'); };
  }, [reduced]);

  // THE TELL: the leak turns the pick's colour — a white pop hides the swap, the scrim re-tints under it
  const tellUp = (t) => {
    tellRef.current = tellOf(t);
    setTell(tellRef.current);
    if (reduced) return;
    kitPlay(flashRef.current, [{ opacity: 0.85 }, { opacity: 0 }], { duration: 320, easing: 'ease-out' });
    sndCutStamp(t);
  };

  // ONE NOTCH: the canister rattles (each harder), the cog ratchets a third of a turn about its hub (a counter-kick,
  // an overshoot, a settle), a click, and the leak grows
  const notch = (i) => {
    sndReelTick(1 + i * 2);
    kitPlay(cogRef.current, [
      { transform: `rotate(${i * 120}deg)` },
      { transform: `rotate(${i * 120 - 14}deg)`, offset: 0.18 },
      { transform: `rotate(${(i + 1) * 120 + 9}deg)`, offset: 0.78 },
      { transform: `rotate(${(i + 1) * 120}deg)` },
    ], { duration: 380, easing: 'cubic-bezier(.45,0,.2,1)', fill: 'forwards', keep: true });
    const [s0, o0] = LEAK[i];
    const [s1, o1] = LEAK[i + 1];
    kitPlay(glowRef.current, [
      { transform: `scale(${s0})`, opacity: o0 },
      { transform: `scale(${s1 * 1.08})`, opacity: Math.min(1, o1 + 0.15), offset: 0.3 },
      { transform: `scale(${s1})`, opacity: o1 },
    ], { duration: 420, easing: EASE_OUT, fill: 'forwards', keep: true });
    return kitPlay(vesselRef.current, rattle(i), { duration: 300 + 50 * i, easing: SHAKE });
  };

  const open = async () => {
    if (phase !== 'sealed' || !ticket || !ready) return;
    setPhase('opening');
    // the server's pick, asked on the FIRST tap while you work the lock (a reserved ticket hands back its SAME pick)
    const ask = ticket.pick ? Promise.resolve(ticket.pick) : rollTicket(ticket);
    let known = null; // the pick, once the server has answered (the tell needs it before the last notch)
    ask.then((p) => { known = p || null; }, () => {});
    for (let i = 0; i < NOTCHES; i += 1) {
      if (i > 0) await nextTap(reduced ? 0 : NOTCH_AUTO_MS);
      if (!alive.current) return;
      if (i === NOTCHES - 1 && known && tierRank(known.tier) > tierRank(vTier)) tellUp(known.tier);
      if (i === NOTCHES - 1 && !reduced) sndRollTell(known ? known.tier : floor, 900);
      await done(notch(i));
    }
    if (!alive.current) return;
    // THE LOCK GIVES: the canister clenches while the cog winds a last full turn
    if (!reduced) sndRollCharge(520);
    const v = vesselRef.current;
    kitPlay(v, [{ transform: 'scale(1,1)' }, { transform: 'scale(1.035,.955)', offset: 0.85 }, { transform: 'scale(1.035,.955)' }], { duration: 520, easing: 'cubic-bezier(.45,0,.55,1)', fill: 'forwards', keep: true });
    const turn = kitPlay(cogRef.current, [{ transform: 'rotate(360deg)' }, { transform: 'rotate(340deg)', offset: 0.2 }, { transform: 'rotate(720deg)' }], { duration: 520, easing: 'cubic-bezier(.45,0,.2,1)', fill: 'forwards', keep: true });
    const [pick] = await Promise.all([ask, done(turn)]);
    if (!alive.current) return;
    const unclench = () => kitPlay(v, [{ transform: 'scale(1.035,.955)' }, { transform: 'scale(1,1)' }], { duration: 260, easing: SPRING });
    const later = () => { unclench(); tellRef.current = vTier; setTell(vTier); setPhase('later'); };
    if (!pick) { sndWordRejected(); later(); return; }
    const r = buyTicketRoll({ pick, floor });
    if (!r) { later(); return; }
    noteLanded(ticket.id); // in this save now: a lost claim is retried, never replayed
    claimTicket(ticket.id);
    applyRollEquip(r); // wears it only if it beats the MAIN worn now
    // a slow server: the tell lands with the release instead (the burst's flash covers the swap)
    if (tierRank(r.tier) > tierRank(vTier) && tellOf(r.tier) !== tellRef.current) tellUp(r.tier);
    // the card mounts HIDDEN now (.srr.is-opening .srr-card) so its art decodes before the burst shows it
    setRes(r);
    await nextFrame();
    await Promise.race([decodeImgs(cardRef.current), wait(240)]);
    if (!alive.current) return;
    // RELEASE: the cog pops off, the canister stretches up out of its squat, the lid blasts 50 ms later ...
    const k = hero.k;
    kitPlay(cogRef.current, [{ transform: 'rotate(720deg)', opacity: 1 }, { transform: `translate(${60 * k}px,${-120 * k}px) rotate(940deg) scale(.9)`, opacity: 1, offset: 0.4 }, { transform: `translate(${150 * k}px,${-250 * k}px) rotate(1150deg) scale(.7)`, opacity: 0 }], { duration: 460, easing: 'cubic-bezier(.12,.7,.3,1)', fill: 'forwards', keep: true });
    kitPlay(v, [{ transform: 'scale(1.035,.955)' }, { transform: `translateY(${-10 * k}px) scale(.95,1.08)`, offset: 0.3 }, { transform: `translateY(${2 * k}px) scale(1.03,.97)`, offset: 0.62 }, { transform: 'translateY(0) scale(.995,1.005)', offset: 0.84 }, { transform: 'none' }], { duration: 620, easing: 'cubic-bezier(.25,.8,.35,1)' });
    if (!reduced) await wait(50);
    kitPlay(lidRef.current, [{ transform: 'none', opacity: 1 }, { transform: `translate(${-8 * k}px,${-130 * k}px) rotate(-9deg)`, opacity: 1, offset: 0.34 }, { transform: `translate(${-30 * k}px,${-330 * k}px) rotate(-26deg)`, opacity: 0 }], { duration: 520, easing: 'cubic-bezier(.12,.75,.3,1)', fill: 'forwards', keep: true });
    // ... and the burst follows THROUGH the lid's flight (not after it)
    if (!reduced) await wait(130);
    if (!alive.current) return;
    setPhase(reduced ? 'open' : 'reveal');
    sndShardBurst(r.tier);
  };

  // THE BURST + THE FACE-DOWN CARD: before the reveal phase paints (its nodes exist; their REST is the end state)
  useLayoutEffect(() => {
    if (phase !== 'reveal' || reduced || !res) return undefined;
    const big = tierRank(res.tier) >= tierRank('legendary');
    kitPlay(flashRef.current, [{ opacity: big ? 0.95 : 0.7 }, { opacity: 0 }], { duration: big ? 520 : 320, easing: 'ease-out', fill: 'forwards' });
    kitPlay(glowRef.current, [{ transform: 'scale(.35,.05)', opacity: 0 }, { transform: 'scale(1.08,1.18)', opacity: 1, offset: 0.4 }, { transform: 'none', opacity: 0.85 }], { duration: big ? 640 : 460, easing: EASE_OUT, fill: 'backwards' });
    const k = (big ? 1.25 : 1) * hero.k;
    SHARDS.forEach((sh, i) => {
      kitPlay(shardRefs.current[i], [
        { transform: 'translate(0,0) rotate(0deg) scale(.5)', opacity: 1 },
        { transform: `translate(${sh.dx * k}px,${sh.dy * k}px) rotate(${sh.r}deg) scale(1)`, opacity: 1, offset: 0.7 },
        { transform: `translate(${sh.dx * k * 1.1}px,${sh.dy * k * 1.1 + 40}px) rotate(${sh.r * 1.2}deg) scale(.8)`, opacity: 0 },
      ], { duration: 620 + (i % 3) * 80, delay: i * 18, easing: EASE_OUT, fill: 'backwards' });
    });
    const rise = kitPlay(cardRef.current, [{ transform: 'translateY(170px) scale(.45)', opacity: 0 }, { transform: 'translateY(-16px) scale(1.06)', opacity: 1, offset: 0.58 }, { transform: 'translateY(4px) scale(.99)', offset: 0.8 }, { transform: 'none', opacity: 1 }], { duration: big ? 660 : 540, delay: 70, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' });
    let cancelled = false;
    (async () => {
      await done(rise);
      if (cancelled || !alive.current) return;
      // the face-down card BUILDS: it shakes harder the longer you wait; LEGENDARY+ lights its edge the pick's colour
      const t = tellOf(res.tier);
      const ms = FLIP_AUTO_MS[t];
      if (big) kitPlay(edgeRef.current, [{ opacity: 0 }, { opacity: 1 }], { duration: 360, easing: 'ease-out', fill: 'forwards', keep: true });
      kitPlay(flipRef.current, jitter(big ? 7 : 4), { duration: ms, easing: 'ease-in' });
      sndRevealRise(t, ms);
      await nextTap(ms);
      if (!cancelled && alive.current) setPhase('open');
    })();
    return () => { cancelled = true; };
  }, [phase, reduced, res, hero]);

  // THE FLIP (the payoff): the back turns away, the face turns in and SLAMS (LEGENDARY+), a flash in the pick's colour
  useLayoutEffect(() => {
    if (phase !== 'open' || reduced || !res) return undefined;
    const big = tierRank(res.tier) >= tierRank('legendary');
    const huge = tierRank(res.tier) >= tierRank('mythic');
    const half = big ? 170 : 140;
    flipRef.current?.__kitAnim?.cancel(); // the shake stops dead
    kitPlay(backRef.current, [{ transform: 'scaleX(1)', opacity: 1 }, { transform: 'scaleX(0)', opacity: 1 }], { duration: half, easing: 'cubic-bezier(.5,0,1,.6)' });
    const face = kitPlay(faceRef.current, big
      ? [{ transform: 'scaleX(0) scale(1.18)' }, { transform: 'scale(1.18)', offset: 0.45 }, { transform: 'scale(.94,1.04)', offset: 0.72 }, { transform: 'none' }]
      : [{ transform: 'scaleX(0)' }, { transform: 'scale(1.06,1.03)', offset: 0.6 }, { transform: 'none' }],
    { duration: big ? 520 : 340, delay: half, easing: 'cubic-bezier(.2,1.1,.4,1)', fill: 'backwards' });
    sndRevealFlip(res.tier);
    const sting = setTimeout(() => sndRollSting(res.tier), half);
    if (flashRef.current) {
      flashRef.current.style.background = huge ? 'var(--srr-pick)' : '#fff';
      kitPlay(flashRef.current, [{ opacity: 0 }, { opacity: big ? 0.9 : 0.5, offset: 0.25 }, { opacity: 0 }], { duration: big ? 560 : 360, delay: half - 40, easing: 'ease-out' });
    }
    if (big) kitPlay(stageRef.current, [{ transform: 'none' }, { transform: 'translate(-8px,5px)', offset: 0.2 }, { transform: 'translate(7px,-4px)', offset: 0.45 }, { transform: 'translate(-3px,2px)', offset: 0.7 }, { transform: 'none' }], { duration: huge ? 420 : 300, delay: half + 140, easing: 'ease-out' });
    done(face).then(() => { if (alive.current) setLanded(true); });
    // nothing appears without motion: the NEW / xN chip and the button rise in behind the card
    const after = half + (big ? 420 : 260);
    if (chipRef.current) kitPlay(chipRef.current, [{ transform: 'translateY(14px) scale(.6)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 300, delay: after, easing: SPRING, fill: 'backwards' });
    kitPlay(btnRef.current, [{ transform: 'translateY(18px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 280, delay: after + 80, easing: SPRING, fill: 'backwards' });
    if (stampRef.current) kitPlay(stampRef.current, [{ transform: 'scale(2.4) rotate(-14deg)', opacity: 0 }, { transform: 'scale(.92) rotate(-8deg)', opacity: 1, offset: 0.7 }, { transform: 'rotate(-8deg)', opacity: 1 }], { duration: 300, delay: after + 40, easing: 'cubic-bezier(.2,1.3,.4,1)', fill: 'backwards' });
    btnRef.current?.focus();
    return () => clearTimeout(sting);
  }, [phase, reduced, res]);
  // REDUCE MOTION: the burst never plays, so the card has landed the moment the vessel is open
  useEffect(() => { if (phase === 'open' && reduced) setLanded(true); }, [phase, reduced]);
  // the X arrives with the landed card (a small pop, not a cut)
  useLayoutEffect(() => {
    if (landed && closeRef.current) kitPlay(closeRef.current, [{ transform: 'scale(.4) rotate(-20deg)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 240, easing: SPRING, fill: 'backwards' });
  }, [landed]);
  // Escape closes on the same terms as a tap outside
  const closeRefFn = useRef(null);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); closeRefFn.current?.(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!ticket) return null;
  const m = res ? markEntry(res.markId) : null;
  const pickLine = res ? CARD_RAR[cardTier(res.tier)].line : null;
  const upgrade = res && tierRank(res.tier) > tierRank(floor);
  // closable while SEALED (the ticket waits in GEARS), LATER, or once the card has LANDED -- never mid-open
  const canClose = phase === 'sealed' || phase === 'later' || (phase === 'open' && landed);
  const close = () => { if (canClose) onDone?.(res); };
  closeRefFn.current = close;
  // A TAP: sealed → OPEN; mid-open → the next notch NOW; face-down → flip it NOW
  const tap = () => {
    if (phase === 'sealed') open();
    else if (phase === 'opening' || phase === 'reveal') {
      if (tapRef.current) tapRef.current();
      else if (phase === 'opening') heldTap.current = true;
    }
  };
  // NICE / OK: the explicit button (only drawn once the pick is committed) always finishes
  const finish = () => { if (phase === 'open' || phase === 'later') onDone?.(res); };
  const working = phase === 'opening' || phase === 'reveal';
  return (
    <div
      className={`srr is-${tell} is-${phase}`}
      role="dialog"
      aria-modal="true"
      aria-label={`${ticketLabel(floor)} sealed roll`}
      data-testid="sealed-roll"
      data-phase={phase}
      data-tier={res ? res.tier : undefined}
      style={pickLine ? { '--srr-pick': pickLine } : undefined}
      ref={rootRef}
      onClick={(e) => {
        // mid-open a tap ANYWHERE works the lock / flips the card; otherwise a tap outside closes (when it may)
        if (working) { if (!e.target.closest('button')) tap(); return; }
        const c = e.target.classList;
        if (e.target === e.currentTarget || c.contains('srr-stage') || c.contains('srr-pod') || c.contains('srr-line')) close();
      }}
      onPointerMove={stopMenuPointer}
      onMouseMove={stopMenuPointer}
    >
      {canClose ? <button type="button" className="srr-x" ref={closeRef} onClick={close} aria-label="Close" data-testid="sealed-roll-close">✕</button> : null}
      <div className="srr-flash" ref={flashRef} aria-hidden="true" />
      <div className="srr-stage" ref={stageRef}>
        <div className={`srr-floor${vTier === 'legendary' ? ' is-long' : ''}`}>{ticketLabel(floor)}</div>
        <div className="srr-pod" style={{ width: hero.v, minHeight: hero.pod, '--srr-rim': `${hero.rim}px`, '--srr-v': `${hero.v}px` }}>
          <span className="srr-glow" ref={glowRef} aria-hidden="true">
            {GLOWS[tell].map(([art, cls], i) => <img key={`${tell}${i}`} className={`srr-glow-art${cls ? ` ${cls}` : ''}`} src={vesselArt(art).glow.src} alt="" draggable="false" />)}
          </span>
          <span className="srr-shards" aria-hidden="true">
            {SHARDS.map((sh, i) => <img key={i} className="srr-shard" ref={(el) => { shardRefs.current[i] = el; }} src={sh.src} alt="" draggable="false" />)}
          </span>
          <button type="button" className="srr-vessel" ref={vesselRef} onClick={tap} disabled={!ready || !(phase === 'sealed' || phase === 'opening')} aria-label={`Open the ${ticketLabel(floor)} roll`} tabIndex={-1}>
            <VesselArt tier={vTier} size={hero.v} refs={{ lid: lidRef, cog: cogRef }} />
          </button>
          {res ? (
            <div className="srr-card" ref={cardRef} data-testid="sealed-roll-card">
              <div className="srr-flip" ref={flipRef}>
                <div className="srr-face" ref={faceRef}>
                  <MarkCard id={res.markId} tier={res.tier} name={m ? m.name : ''} shiny={!!res.shiny} fx sheen w={hero.card} />
                </div>
                {/* the FACE-DOWN card (the roll screen's own card back); its edge lights in the pick colour (LEGENDARY+) */}
                <div className="srr-back" ref={backRef} style={{ width: Math.round(hero.card * 1.0444) }} aria-hidden="true">
                  <img className="srr-back-art" src="/fx/card-back.svg" alt="" draggable="false" />
                  <span className="srr-edge" ref={edgeRef} />
                </div>
              </div>
              {upgrade ? <span className="srr-stamp" ref={stampRef}>UPGRADE!</span> : null}
            </div>
          ) : null}
        </div>
        <div className="srr-line" aria-live="polite">
          {res && phase === 'open' ? (res.newMark ? <span className="srr-chip" ref={chipRef}>NEW</span> : res.copies > 1 ? <span className="srr-chip is-dupe" ref={chipRef}>×{res.copies}</span> : null)
            : phase === 'later' ? <span className="srr-later">IT WAITS IN GEARS</span> : null}
        </div>
        {phase === 'open' || phase === 'later' ? (
          <button type="button" className="srr-btn" ref={btnRef} onClick={finish} data-testid="sealed-roll-done">{phase === 'open' ? 'NICE' : 'OK'}</button>
        ) : (
          <button type="button" className="srr-btn is-open" ref={btnRef} onClick={tap} disabled={!ready || !(phase === 'sealed' || phase === 'opening')} data-testid="sealed-roll-open">OPEN</button>
        )}
      </div>
    </div>
  );
}
