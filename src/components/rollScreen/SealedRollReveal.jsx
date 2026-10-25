// SealedRollReveal.jsx — THE SEALED ROLL opening (Andy oct24: "the epic+, legendary+ rolls … i don't want dice").
// A bought (or granted) EPIC+ / LEGENDARY+ ticket is a SEALED CAPSULE in its tier colour. Tap OPEN:
//   1. the server picks (060 lb_ticket_roll — the floor is ITS ticket row, the browser sends only the id) while the
//      capsule SHAKES — EPIC+ one rattle, LEGENDARY+ three, each harder (one-shot WAAPI, transform only);
//   2. it BURSTS: the two halves fly apart, a flat white flash, the tier's ray fan (the /art/rolls/rays.svg mask tinted
//      with the PICK's colour) and the gear card SLAMS in; a pick above the floor (a MYTHIC out of a LEGENDARY+) stamps
//      UPGRADE!;
//   3. the landing commits it (buyTicketRoll → the save, lb_ticket_claim → the server) and wears it if it is better.
// Nothing loops: every motion is a finite one-shot, nothing animates at rest. REDUCE MOTION: the open is instant.
// No pick (offline / the server said no): the ticket stays sealed and waits in GEARS (the roll screen's USE TICKET).
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
import { sndRollTell, sndShardBurst, sndRollSting } from '../../audio/rollSounds';
import { sndWordRejected } from '../../audio/gameSounds';
import { kitPlay } from '../kit/motion';
import { useReduceMotion } from '../../lib/useReduceMotion';

// THE CAPSULE ART: placeholder vectors (claude/rolls-art/make-capsules.py) until the painted webp set lands — swap the
// extension here, nothing else changes.
export const CAPSULE_ART = Object.freeze({
  epic: { whole: '/rolls/capsule-epic.svg', top: '/rolls/capsule-epic-top.svg', bottom: '/rolls/capsule-epic-bottom.svg' },
  legendary: { whole: '/rolls/capsule-legendary.svg', top: '/rolls/capsule-legendary-top.svg', bottom: '/rolls/capsule-legendary-bottom.svg' },
});
export const capsuleArt = (tier) => CAPSULE_ART[tier] || CAPSULE_ART[tierRank(tier) >= tierRank('legendary') ? 'legendary' : 'epic'];

const RATTLES = { epic: 1, legendary: 3, mythic: 3 };
const rattle = (k) => [
  { transform: 'translate(0,0) rotate(0deg)' },
  { transform: `translate(${-6 - 4 * k}px,0) rotate(${-6 - 3 * k}deg)`, offset: 0.2 },
  { transform: `translate(${6 + 4 * k}px,0) rotate(${6 + 3 * k}deg)`, offset: 0.45 },
  { transform: `translate(${-3 - 2 * k}px,0) rotate(${-3 - k}deg)`, offset: 0.7 },
  { transform: 'translate(0,0) rotate(0deg)' },
];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const done = (a) => (a && a.finished ? a.finished.catch(() => {}) : Promise.resolve());

export default function SealedRollReveal({ ticket, onDone }) {
  const floor = ticket ? ticket.tier : 'epic';
  const art = capsuleArt(floor);
  const reduced = useReduceMotion();
  const [phase, setPhase] = useState('sealed'); // sealed → opening → open | later
  const [res, setRes] = useState(null);
  const capRef = useRef(null);
  const topRef = useRef(null);
  const botRef = useRef(null);
  const flashRef = useRef(null);
  const raysRef = useRef(null);
  const cardRef = useRef(null);
  const stampRef = useRef(null);
  const btnRef = useRef(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    if (!reduced && capRef.current) kitPlay(capRef.current, [{ transform: 'translateY(-60px) scale(1.5)', opacity: 0 }, { transform: 'translateY(6px) scale(.94)', opacity: 1, offset: 0.6 }, { transform: 'none', opacity: 1 }], { duration: 340, easing: 'cubic-bezier(.2,1.3,.4,1)', fill: 'backwards' });
    btnRef.current?.focus();
    return () => { alive.current = false; };
  }, [reduced]);

  const open = async () => {
    if (phase !== 'sealed' || !ticket) return;
    setPhase('opening');
    const n = RATTLES[floor] || 1;
    // the server's pick, asked while the capsule rattles (a reserved ticket hands back its SAME pick)
    const ask = ticket.pick ? Promise.resolve(ticket.pick) : rollTicket(ticket);
    if (!reduced) {
      sndRollTell(floor, 260 * n + 200);
      for (let k = 0; k < n; k += 1) {
        await done(kitPlay(capRef.current, rattle(k), { duration: 240, easing: 'linear' }));
        if (k < n - 1) await wait(110);
      }
    }
    const pick = await ask;
    if (!alive.current) return;
    if (!pick) { sndWordRejected(); setPhase('later'); return; }
    const r = buyTicketRoll({ pick, floor });
    if (!r) { setPhase('later'); return; }
    noteLanded(ticket.id); // in this save now: a lost claim is retried, never replayed
    claimTicket(ticket.id);
    applyRollEquip(r); // wears it only if it beats the MAIN worn now
    setRes(r);
    setPhase('open');
    sndShardBurst(r.tier);
    sndRollSting(r.tier);
  };

  // the BURST: before the open phase paints (its nodes exist; their REST is the end state, so no frame shows it early)
  useLayoutEffect(() => {
    if (phase !== 'open' || reduced || !res) return;
    const big = tierRank(res.tier) >= tierRank('legendary');
    kitPlay(topRef.current, [{ transform: 'none', opacity: 1 }, { transform: 'translate(-70px,-190px) rotate(-38deg)', opacity: 0 }], { duration: 420, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' });
    kitPlay(botRef.current, [{ transform: 'none', opacity: 1 }, { transform: 'translate(60px,200px) rotate(26deg)', opacity: 0 }], { duration: 420, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' });
    kitPlay(flashRef.current, [{ opacity: big ? 0.95 : 0.7 }, { opacity: 0 }], { duration: big ? 520 : 320, easing: 'ease-out', fill: 'forwards' });
    kitPlay(raysRef.current, [{ transform: 'scale(.2) rotate(-40deg)', opacity: 0 }, { transform: 'scale(1.08) rotate(6deg)', opacity: 1, offset: 0.55 }, { transform: 'scale(1) rotate(0deg)', opacity: 0.85 }], { duration: big ? 700 : 480, easing: 'cubic-bezier(.2,1,.3,1)', fill: 'forwards' });
    kitPlay(cardRef.current, [{ transform: 'scale(.2) rotate(-14deg)', opacity: 0 }, { transform: 'scale(1.18) rotate(3deg)', opacity: 1, offset: 0.55 }, { transform: 'scale(.97) rotate(0deg)', offset: 0.8 }, { transform: 'none', opacity: 1 }], { duration: big ? 520 : 400, delay: 90, easing: 'cubic-bezier(.2,1.3,.4,1)', fill: 'backwards' });
    if (stampRef.current) kitPlay(stampRef.current, [{ transform: 'scale(2.4) rotate(-14deg)', opacity: 0 }, { transform: 'scale(.92) rotate(-8deg)', opacity: 1, offset: 0.7 }, { transform: 'rotate(-8deg)', opacity: 1 }], { duration: 300, delay: 520, easing: 'cubic-bezier(.2,1.3,.4,1)', fill: 'backwards' });
    btnRef.current?.focus();
  }, [phase, reduced, res]);

  if (!ticket) return null;
  const m = res ? markEntry(res.markId) : null;
  const pickLine = res ? CARD_RAR[cardTier(res.tier)].line : null;
  const upgrade = res && tierRank(res.tier) > tierRank(floor);
  const close = () => { if (phase !== 'opening') onDone?.(res); };
  return (
    <div
      className={`srr is-${floor} is-${phase}`}
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
          {phase !== 'open' || !reduced ? (
            <button type="button" className="srr-cap" ref={capRef} onClick={open} disabled={phase !== 'sealed'} aria-label={`Open the ${ticketLabel(floor)} roll`} tabIndex={-1}>
              <img ref={topRef} className="srr-half" src={art.top} alt="" draggable="false" />
              <img ref={botRef} className="srr-half" src={art.bottom} alt="" draggable="false" />
            </button>
          ) : null}
          {res ? (
            <div className="srr-card" ref={cardRef} data-testid="sealed-roll-card">
              <MarkCard id={res.markId} tier={res.tier} name={m ? m.name : ''} shiny={!!res.shiny} fx sheen w={190} />
              {upgrade ? <span className="srr-stamp" ref={stampRef}>UPGRADE!</span> : null}
            </div>
          ) : null}
        </div>
        <div className="srr-line" aria-live="polite">
          {res ? (
            <>
              {res.newMark ? <span className="srr-chip">NEW</span> : res.copies > 1 ? <span className="srr-chip is-dupe">×{res.copies}</span> : null}
            </>
          ) : phase === 'later' ? <span className="srr-later">IT WAITS IN GEARS</span> : null}
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
