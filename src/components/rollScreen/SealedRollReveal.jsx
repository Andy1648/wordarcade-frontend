// SealedRollReveal.jsx — THE SEALED ROLL opening (Andy oct24: "the epic+, legendary+ rolls … i don't want dice").
// A bought (or granted) EPIC+ / LEGENDARY+ ticket is a COG-LOCKED GEAR CANISTER (VesselArt — EPIC: steel cog, purple
// plating; LEGENDARY: gold crowned cog, gold plating). Tap OPEN:
//   1. RATTLE — EPIC+ once, LEGENDARY+ three times, each harder — while the server picks (060 lb_ticket_roll: the floor
//      is ITS ticket row, the browser sends only the id);
//   2. the COG SPINS two full turns (pure rotate about its hub), then POPS OFF;
//   3. the LID BLASTS UP; the tier's GLOW + a pooled burst of SHARDS fire from the open top, a flat flash, the ray fan
//      (/art/rolls/rays.svg mask in the PICK's colour);
//   4. the GEAR CARD RISES out of the canister; a pick above the floor stamps UPGRADE!;
//   5. the landing commits it (buyTicketRoll → the save, lb_ticket_claim → the server) and wears it if it is better.
// Every motion is a finite WAAPI one-shot on a node that already exists (the shard pool is fixed), transform / opacity
// only; each node's REST style is its end state, so REDUCE MOTION simply shows the result. Nothing loops.
// No pick (offline / the server said no): the ticket stays sealed and waits in GEARS (the roll screen's OPEN button).
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
import { sndRollTell, sndRollCharge, sndShardBurst, sndRollSting } from '../../audio/rollSounds';
import { sndWordRejected } from '../../audio/gameSounds';
import { kitPlay } from '../kit/motion';
import { useReduceMotion } from '../../lib/useReduceMotion';
import VesselArt, { vesselArt, SHARD_ART } from './VesselArt';

const RATTLES = { epic: 1, legendary: 3, mythic: 3 };
const rattle = (k) => [
  { transform: 'translate(0,0) rotate(0deg)' },
  { transform: `translate(${-6 - 4 * k}px,0) rotate(${-6 - 3 * k}deg)`, offset: 0.2 },
  { transform: `translate(${6 + 4 * k}px,0) rotate(${6 + 3 * k}deg)`, offset: 0.45 },
  { transform: `translate(${-3 - 2 * k}px,0) rotate(${-3 - k}deg)`, offset: 0.7 },
  { transform: 'translate(0,0) rotate(0deg)' },
];
// THE SHARD POOL: fixed nodes, fixed flight paths (fanning up and out of the open top) — never a node per burst
const SHARDS = [
  [-150, -190, -260], [150, -200, 300], [-70, -260, 200], [80, -250, -220], [-210, -60, 340], [210, -80, -320], [-20, -300, 180], [30, -150, -160],
].map(([dx, dy, r], i) => ({ dx, dy, r, src: SHARD_ART[i % SHARD_ART.length] }));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const done = (a) => (a && a.finished ? a.finished.catch(() => {}) : Promise.resolve());
const EASE_OUT = 'cubic-bezier(.2,.8,.3,1)';

export default function SealedRollReveal({ ticket, onDone }) {
  const floor = ticket ? ticket.tier : 'epic';
  const vTier = tierRank(floor) >= tierRank('legendary') ? 'legendary' : 'epic';
  const reduced = useReduceMotion();
  const [phase, setPhase] = useState('sealed'); // sealed → opening → open | later
  const [res, setRes] = useState(null);
  const vesselRef = useRef(null);
  const lidRef = useRef(null);
  const cogRef = useRef(null);
  const glowRef = useRef(null);
  const shardRefs = useRef([]);
  const flashRef = useRef(null);
  const raysRef = useRef(null);
  const cardRef = useRef(null);
  const stampRef = useRef(null);
  const btnRef = useRef(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    if (!reduced && vesselRef.current) kitPlay(vesselRef.current, [{ transform: 'translateY(-60px) scale(1.4)', opacity: 0 }, { transform: 'translateY(6px) scale(.95)', opacity: 1, offset: 0.6 }, { transform: 'none', opacity: 1 }], { duration: 340, easing: 'cubic-bezier(.2,1.3,.4,1)', fill: 'backwards' });
    btnRef.current?.focus();
    return () => { alive.current = false; };
  }, [reduced]);

  const open = async () => {
    if (phase !== 'sealed' || !ticket) return;
    setPhase('opening');
    const n = RATTLES[floor] || 1;
    // the server's pick, asked while the vessel rattles + unlocks (a reserved ticket hands back its SAME pick)
    const ask = ticket.pick ? Promise.resolve(ticket.pick) : rollTicket(ticket);
    if (!reduced) sndRollTell(floor, 260 * n + 900);
    for (let k = 0; k < n; k += 1) {
      await done(kitPlay(vesselRef.current, rattle(k), { duration: 240, easing: 'linear' }));
      if (k < n - 1 && !reduced) await wait(110);
    }
    // THE LOCK: the cog turns twice about its hub (pure rotate) …
    if (!reduced) sndRollCharge(700);
    await done(kitPlay(cogRef.current, [{ transform: 'rotate(0deg)' }, { transform: 'rotate(720deg)' }], { duration: 700, easing: 'cubic-bezier(.5,0,.3,1)' }));
    const pick = await ask;
    if (!alive.current) return;
    if (!pick) { sndWordRejected(); setPhase('later'); return; }
    const r = buyTicketRoll({ pick, floor });
    if (!r) { setPhase('later'); return; }
    noteLanded(ticket.id); // in this save now: a lost claim is retried, never replayed
    claimTicket(ticket.id);
    applyRollEquip(r); // wears it only if it beats the MAIN worn now
    // … then it pops off and the lid blasts up (their end state = the open phase's rest: gone)
    kitPlay(cogRef.current, [{ transform: 'none', opacity: 1 }, { transform: 'translate(150px,-230px) rotate(400deg) scale(.7)', opacity: 0 }], { duration: 360, easing: EASE_OUT, fill: 'forwards', keep: true });
    if (!reduced) await wait(110);
    await done(kitPlay(lidRef.current, [{ transform: 'none', opacity: 1 }, { transform: 'translate(-30px,-320px) rotate(-24deg)', opacity: 0 }], { duration: 400, easing: EASE_OUT, fill: 'forwards', keep: true }));
    if (!alive.current) return;
    setRes(r);
    setPhase('open');
    sndShardBurst(r.tier);
    sndRollSting(r.tier);
  };

  // THE BURST: before the open phase paints (its nodes exist; their REST is the end state, so no frame shows it early)
  useLayoutEffect(() => {
    if (phase !== 'open' || reduced || !res) return;
    const big = tierRank(res.tier) >= tierRank('legendary');
    kitPlay(flashRef.current, [{ opacity: big ? 0.95 : 0.7 }, { opacity: 0 }], { duration: big ? 520 : 320, easing: 'ease-out', fill: 'forwards' });
    kitPlay(raysRef.current, [{ transform: 'scale(.2) rotate(-40deg)', opacity: 0 }, { transform: 'scale(1.08) rotate(6deg)', opacity: 1, offset: 0.55 }, { transform: 'scale(1) rotate(0deg)', opacity: 0.7 }], { duration: big ? 700 : 480, easing: 'cubic-bezier(.2,1,.3,1)', fill: 'forwards' });
    kitPlay(glowRef.current, [{ transform: 'translateY(30px) scale(.2)', opacity: 0 }, { transform: 'translateY(-10px) scale(1.2)', opacity: 1, offset: 0.4 }, { transform: 'none', opacity: 0.85 }], { duration: big ? 640 : 460, easing: EASE_OUT, fill: 'backwards' });
    const k = big ? 1.25 : 1;
    SHARDS.forEach((sh, i) => {
      kitPlay(shardRefs.current[i], [
        { transform: 'translate(0,0) rotate(0deg) scale(.5)', opacity: 1 },
        { transform: `translate(${sh.dx * k}px,${sh.dy * k}px) rotate(${sh.r}deg) scale(1)`, opacity: 1, offset: 0.7 },
        { transform: `translate(${sh.dx * k * 1.1}px,${sh.dy * k * 1.1 + 40}px) rotate(${sh.r * 1.2}deg) scale(.8)`, opacity: 0 },
      ], { duration: 620 + (i % 3) * 80, delay: i * 18, easing: EASE_OUT, fill: 'backwards' });
    });
    kitPlay(cardRef.current, [{ transform: 'translateY(170px) scale(.45)', opacity: 0 }, { transform: 'translateY(-16px) scale(1.06)', opacity: 1, offset: 0.6 }, { transform: 'translateY(4px) scale(.99)', offset: 0.82 }, { transform: 'none', opacity: 1 }], { duration: big ? 620 : 500, delay: 120, easing: 'cubic-bezier(.2,1.2,.4,1)', fill: 'backwards' });
    if (stampRef.current) kitPlay(stampRef.current, [{ transform: 'scale(2.4) rotate(-14deg)', opacity: 0 }, { transform: 'scale(.92) rotate(-8deg)', opacity: 1, offset: 0.7 }, { transform: 'rotate(-8deg)', opacity: 1 }], { duration: 300, delay: 640, easing: 'cubic-bezier(.2,1.3,.4,1)', fill: 'backwards' });
    btnRef.current?.focus();
  }, [phase, reduced, res]);

  if (!ticket) return null;
  const m = res ? markEntry(res.markId) : null;
  const pickLine = res ? CARD_RAR[cardTier(res.tier)].line : null;
  const upgrade = res && tierRank(res.tier) > tierRank(floor);
  const close = () => { if (phase !== 'opening') onDone?.(res); };
  return (
    <div
      className={`srr is-${vTier} is-${phase}`}
      role="dialog"
      aria-modal="true"
      aria-label={`${ticketLabel(floor)} sealed roll`}
      data-testid="sealed-roll"
      data-phase={phase}
      data-tier={res ? res.tier : undefined}
      style={pickLine ? { '--srr-pick': pickLine } : undefined}
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div className="srr-rays" ref={raysRef} aria-hidden="true" />
      <div className="srr-flash" ref={flashRef} aria-hidden="true" />
      <div className="srr-stage">
        <div className="srr-floor">{ticketLabel(floor)}</div>
        <div className="srr-pod">
          <img className="srr-glow" ref={glowRef} src={vesselArt(vTier).glow.src} alt="" draggable="false" />
          <span className="srr-shards" aria-hidden="true">
            {SHARDS.map((sh, i) => <img key={i} className="srr-shard" ref={(el) => { shardRefs.current[i] = el; }} src={sh.src} alt="" draggable="false" />)}
          </span>
          <button type="button" className="srr-vessel" ref={vesselRef} onClick={open} disabled={phase !== 'sealed'} aria-label={`Open the ${ticketLabel(floor)} roll`} tabIndex={-1}>
            <VesselArt tier={vTier} size={250} refs={{ lid: lidRef, cog: cogRef }} />
          </button>
          {res ? (
            <div className="srr-card" ref={cardRef} data-testid="sealed-roll-card">
              <MarkCard id={res.markId} tier={res.tier} name={m ? m.name : ''} shiny={!!res.shiny} fx sheen w={190} />
              {upgrade ? <span className="srr-stamp" ref={stampRef}>UPGRADE!</span> : null}
            </div>
          ) : null}
        </div>
        <div className="srr-line" aria-live="polite">
          {res ? (res.newMark ? <span className="srr-chip">NEW</span> : res.copies > 1 ? <span className="srr-chip is-dupe">×{res.copies}</span> : null)
            : phase === 'later' ? <span className="srr-later">IT WAITS IN GEARS</span> : null}
        </div>
        {phase === 'open' || phase === 'later' ? (
          <button type="button" className="srr-btn" ref={btnRef} onClick={close} data-testid="sealed-roll-done">{phase === 'open' ? 'NICE' : 'OK'}</button>
        ) : (
          <button type="button" className="srr-btn is-open" ref={btnRef} onClick={open} disabled={phase !== 'sealed'} data-testid="sealed-roll-open">OPEN</button>
        )}
      </div>
    </div>
  );
}
