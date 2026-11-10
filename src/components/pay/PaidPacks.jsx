// PaidPacks.jsx — the PAID ROLL PACKS (089, Andy nov9 "make a 'packs' in the shop that offer mythic/secret packs for real
// money"). LAZY: only fetched when payments/flag.js says ON and the shop's PACKS shelf or the + panel's PACKS tab opens.
//
//   PacksPane   the two packs (MYTHIC PACK / SECRET PACK), the month's limit, the refund line. Driven by a usePayBuy() the
//               HOST owns (the + panel shares its own; the shop shelf below makes one) — never two buy flows on one screen.
//   PacksShelf  the shop's PACKS shelf: a PacksPane + this player's unopened packs + the opening, in place.
//   mountPackOpen(ticket)  the opening over whatever is on screen (the return from Stripe, the + panel's OPEN).
//
// THE SAFEGUARDS (the same as gems, payments-brief.md): the DOLLAR price is the face of the BUY button; the $20 a month cap is
// shared with gems and shown; no countdowns, no limited offers, no sale badges; no FIRST BUY ×2 (gems only, 088); the EXACT
// odds (each tier and each gear, %) are one tap away on every card (packOdds.js); a refund line. A pack is a SERVER ticket
// (089 pay_grant_pack): opening it plays the existing sealed-roll reveal at its tier (SealedRollReveal) — no new FX.
// Motion: hover / press transforms only; nothing loops.
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { createRoot } from 'react-dom/client';
import '../kit/tokens.css';
import '../BuyGems.css'; // the sign-in ask, the limit line and the fine print are the + panel's own
import '../rollScreen/RatesPop.css';
import './PaidPacks.css';
import { GoogleButton } from '../account/GoogleAccount.jsx';
import VesselArt from '../rollScreen/VesselArt';
import { lazyWithReload } from '../../lib/chunkReload';
import { ROLL_PACKS, formatUsd } from '../../payments/packs.js';
import { packOdds, pct, PACK_SHINY } from '../../payments/packOdds.js';
import { listTickets } from '../../leaderboard/serverTickets';
import { CARD_RAR } from '../markCard/palette.js';
import { MARK_TIERS } from '../../progress/marks';
import { usePayBuy } from './usePayBuy.js';

const SealedRollReveal = lazyWithReload(() => import('../rollScreen/SealedRollReveal'), 'SealedRollReveal');
const REFUND_EMAIL = (import.meta.env && import.meta.env.VITE_REFUND_EMAIL) || '';
const tierName = (t) => (MARK_TIERS[t] ? MARK_TIERS[t].name : String(t || '').toUpperCase());
/** "MYTHIC OR BETTER" / "ALWAYS SECRET" — what the floor promises, in words. */
export const promiseOf = (p) => (p.tier === 'secret' ? 'ALWAYS SECRET' : `${tierName(p.tier)} OR BETTER`);
/** This player's unopened PAID packs of `tier` (a reserved one = an opening that was interrupted: it lands the SAME gear). */
export const ownedPacks = (tickets, tier) => (Array.isArray(tickets) ? tickets.filter((t) => t.source === 'pay' && t.tier === tier) : []);

/** The pack's picture: its painted art once it lands at artSlot (packs.js), else the tier's existing art as a stand-in. */
function PackArt({ pack }) {
  if (pack.art) return <img className="pk-art-img" src={pack.art} width="256" height="256" alt="" draggable="false" />;
  return (
    <span className="pk-art-stand" style={{ '--pk-fill': CARD_RAR[pack.tier].fill }} aria-hidden="true">
      <span className="pk-art-win" />
      <VesselArt tier="legendary" size={null} label={false} className="pk-vessel" />
      <img className="pk-art-frame" src={`/fx/frame-${pack.tier}-v2.webp`} width="512" height="800" alt="" draggable="false" />
    </span>
  );
}

/** ODDS, one tap away: every tier and every gear inside the pack, %. A list, so it may scroll on a short screen. */
export function PackOdds({ pack }) {
  const [open, setOpen] = useState(false);
  const closeRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    closeRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open]);
  const rows = open ? packOdds(pack.tier) : [];
  return (
    <>
      <button type="button" className="pk-odds" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label={`Odds inside the ${pack.name.toLowerCase()}`} data-testid={`pack-odds-${pack.id}`}>
        <span className="rs-rates-i" aria-hidden="true">i</span>ODDS
      </button>
      {open ? createPortal(
        <div className="rs-rates-scrim pk-odds-scrim" role="presentation" onClick={() => setOpen(false)}>
          <div className="rs-rates pk-odds-pop" role="dialog" aria-modal="true" aria-label={`${pack.name} odds`} data-testid="pack-odds-pop" onClick={(e) => e.stopPropagation()}>
            <button ref={closeRef} type="button" className="rs-rates-x" onClick={() => setOpen(false)} aria-label="Close odds">✕</button>
            <div className="rs-rates-head"><span>{pack.name}</span></div>
            <p className="pk-odds-lede">ONE GEAR ROLL · {promiseOf(pack)}</p>
            <div className="pk-odds-list">
              {rows.map((r) => (
                <section key={r.tier} className="pk-odds-tier" style={{ '--rs-tier': CARD_RAR[r.tier].line }} data-tier={r.tier}>
                  <div className="rs-rates-row">
                    <span className="rs-rates-tier">{tierName(r.tier)}</span>
                    <span className="rs-rates-odds" data-testid={`pack-odds-tier-${r.tier}`}>{pct(r.p)}</span>
                  </div>
                  <ul className="pk-odds-items">
                    {r.items.map((it) => (
                      <li key={it.id} className="pk-odds-item"><span className="pk-odds-name">{it.name}</span><span className="pk-odds-p">{pct(it.p)}</span></li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
            <p className="pk-odds-fine">
              Inside a tier, a gear you don&rsquo;t own yet comes first, evenly: these are the odds while you own none of it.
              {' '}SHINY {pct(PACK_SHINY)}. Chase heroes never drop from packs.
            </p>
          </div>
        </div>,
        document.body,
      ) : null}
    </>
  );
}

/** One pack: art, name, what it promises, the dollar price (the tap), ODDS, and OPEN for one you already own. */
function PackCard({ pack, pay, owned, onOpen }) {
  const over = pay.over(pack);
  const busy = pay.busy === pack.id;
  return (
    <div className={`pk-card is-${pack.tier}${over ? ' is-over' : ''}`} role="listitem" data-pack={pack.id} style={{ '--pk-line': CARD_RAR[pack.tier].line, '--pk-edge': CARD_RAR[pack.tier].edge }}>
      <PackArt pack={pack} />
      <span className="pk-name">{pack.name}</span>
      <span className="pk-what">1 GEAR ROLL</span>
      <span className="pk-floor">{promiseOf(pack)}</span>
      <button
        type="button"
        className="pk-buy"
        disabled={!!pay.busy}
        onClick={() => pay.onPack(pack)}
        data-testid={`pack-buy-${pack.id}`}
        aria-label={`${pack.name}: one gear roll, ${promiseOf(pack).toLowerCase()}, for ${formatUsd(pack.cents)}${over ? ' — past this month’s limit' : ''}`}
      >
        {busy ? 'OPENING…' : formatUsd(pack.cents)}
      </button>
      <div className="pk-row">
        <PackOdds pack={pack} />
        {owned.length ? (
          <button type="button" className="pk-open" onClick={() => onOpen(owned[0])} data-testid={`pack-open-${pack.id}`} aria-label={`Open your ${pack.name.toLowerCase()} (${owned.length} waiting)`}>
            OPEN{owned.length > 1 ? ` ×${owned.length}` : ''}
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** The packs (or the Google ask), the month's limit and the refund line, for the host's usePayBuy(). */
export function PacksPane({ pay, tickets = [], onOpen }) {
  const asking = pay.asking && pay.asking.kind === 'roll' ? pay.asking : null;
  return (
    <div className="pk" data-testid="paid-packs">
      {asking ? (
        <div className="pg-signin pk-signin" data-testid="pay-signin" data-pack={asking.id}>
          <span className="pg-signin-h">SIGN IN TO GET THE {asking.name}</span>
          <span className="pg-signin-t">{formatUsd(asking.cents)}. Your pack stays on your Google account, on any device.</span>
          <GoogleButton />
          <button type="button" className="pg-back" onClick={() => pay.setWant(null)} data-testid="pay-signin-back">BACK</button>
        </div>
      ) : (
        <div className="pk-grid" role="list" aria-label="Packs">
          {ROLL_PACKS.map((p) => <PackCard key={p.id} pack={p} pay={pay} owned={ownedPacks(tickets, p.tier)} onOpen={onOpen} />)}
        </div>
      )}
      <div className="pk-foot">
        <span className="pg-cap pk-cap" data-testid="pack-cap">
          $20 A MONTH LIMIT, GEMS + PACKS<span className="pg-cap-sep"> · </span><b>{formatUsd(pay.left)} LEFT</b>
        </span>
      </div>
      <div className="pg-low">
        <p className={`pg-fine${pay.note ? ' is-hid' : ''}`} data-testid="pack-refund">
          Mistake? Reply to the Stripe receipt{REFUND_EMAIL ? <> or email <b>{REFUND_EMAIL}</b></> : null} for a refund: an unopened pack is taken back, an opened one its value in gems.
        </p>
        {pay.note ? <div className="pg-note" role="status" aria-live="polite" data-testid="pay-note">{pay.note}</div> : null}
      </div>
    </div>
  );
}

/** This player's unopened PAID packs, from the server only (lb_tickets; [] when off / offline). */
export function usePackTickets() {
  const [tickets, setTickets] = useState([]);
  const live = useRef(true);
  const refresh = useCallback(() => listTickets().then((l) => { if (live.current) setTickets(l.filter((t) => t.source === 'pay')); }), []);
  useEffect(() => { live.current = true; refresh(); return () => { live.current = false; }; }, [refresh]);
  return [tickets, refresh];
}

/** The shop's PACKS shelf: buy, see the odds, open what you own, in place. */
export default function PacksShelf() {
  const pay = usePayBuy();
  const [tickets, refresh] = usePackTickets();
  const [sealed, setSealed] = useState(null);
  return (
    <div className="pk-shelf">
      <PacksPane pay={pay} tickets={tickets} onOpen={setSealed} />
      {/* portaled to the body: inside the shop's scaled stage a fixed layer is trapped (and the cover CSS hides every
          .sp2 child but a direct .srr) */}
      {sealed ? createPortal(
        <Suspense fallback={null}>
          <SealedRollReveal ticket={sealed} onDone={() => { setSealed(null); refresh(); }} />
        </Suspense>,
        document.body,
      ) : null}
    </div>
  );
}

let opening = false;
/** Open `ticket` (a paid pack) over whatever is on screen: the existing sealed-roll reveal at its tier. One at a time. */
export function mountPackOpen(ticket) {
  if (opening || !ticket) return;
  opening = true;
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  const close = () => { opening = false; root.unmount(); host.remove(); };
  root.render(<Suspense fallback={null}><SealedRollReveal ticket={ticket} onDone={close} /></Suspense>);
}
