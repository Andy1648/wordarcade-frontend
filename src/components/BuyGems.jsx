// BuyGems.jsx — THE place to buy gems (Andy nov5 "+ next to the gem count", replacing the shop's GEMS tab): real money, 082.
// Its own lazy chunk behind GemsPlus.jsx, which draws nothing unless payments/flag.js PAYMENTS_ON (VITE_PAYMENTS_ON=1).
// A modal with its own little root, so any screen with a gem pill can open it without wiring.
//
// ONE TAP: signed in, a pack goes straight to Stripe's page, which shows the price again and takes the card; nothing is charged
// on this side. Signed out, the packs still show: a tap asks for Google once, then that same purchase carries on (AUTH_LANDED,
// or PAY_RESUME_KEY when a restore reloads the page on the way).
// THE SAFEGUARDS (kept although the gems are pay-to-win; payments-brief.md):
//   * the DOLLAR price is the face of every pack;
//   * $20 a month per account: the server refuses past it (082 pay_reserve); the panel shows what is left and greys out a
//     pack that would cross it (price still shown);
//   * no countdowns, no "limited" offers, no sale badges: a pack is always the same price. FIRST BUY ×2 is the one bonus: honest
//     amounts (1,000 + 1,000 BONUS), no "was" price, and the server decides it at grant time (088);
//   * ODDS sits here (the roll screen's RATES popup: paid gems roll at the same server odds);
//   * 089 PACKS tab: the paid MYTHIC / SECRET roll packs (pay/PaidPacks.jsx) through the SAME buy flow (pay/usePayBuy.js, one
//     per panel, shared by both tabs), the exact odds one tap away on each card;
//   * a refund line: reply to the Stripe receipt (or VITE_REFUND_EMAIL); refunded gems are taken back off.
// Motion: hover / press transforms and one finite enter; nothing loops.
import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './BuyGems.css';
import RatesPop from './rollScreen/RatesPop.jsx';
import { GoogleButton } from './account/GoogleAccount.jsx';
import { GemIcon, useGems } from './gems/GemChip.jsx';
import { PACKS, formatUsd, packById, isRollPack } from '../payments/packs.js';
import { fetchFirstBuy, PAY_RESUME_KEY, readPayResume } from '../payments/payClient.js';
import { usePayBuy } from './pay/usePayBuy.js';
import { PacksPane, usePackTickets, mountPackOpen } from './pay/PaidPacks.jsx';
import { formatNum, formatShort, grouped } from '../format';

const REFUND_EMAIL = (import.meta.env && import.meta.env.VITE_REFUND_EMAIL) || '';

/** 089: the PACKS tab — the paid roll packs + this player's unopened ones (OPEN closes the panel and opens the pack). */
function PacksTab({ pay, onClose }) {
  const [tickets] = usePackTickets();
  return <PacksPane pay={pay} tickets={tickets} onOpen={(t) => { onClose(); mountPackOpen(t); }} />;
}

export default function BuyGems({ onClose, tab0 = 'gems' }) {
  // GEMS | PACKS (089). A pack waiting on a sign-in (a restore reloaded the page mid-purchase) reopens on its own tab.
  const [tab, setTab] = useState(() => (isRollPack(packById(readPayResume())) || tab0 === 'packs' ? 'packs' : 'gems'));
  const [first, setFirst] = useState(false); // FIRST BUY ×2 still open for this account (088) — GEMS only
  const closeRef = useRef(null);
  const pay = usePayBuy(); // THE one buy flow for this panel, both tabs (pay/usePayBuy.js)
  const { left, busy, note, signed, setWant } = pay;
  const gems = useGems();
  useEffect(() => {
    let live = true;
    fetchFirstBuy({ signedIn: !!signed }).then((open) => { if (live) setFirst(open); });
    return () => { live = false; };
  }, [signed]);

  useEffect(() => {
    if (closeRef.current) closeRef.current.focus();
    const onKey = (e) => {
      if (e.key !== 'Escape' || document.querySelector('[data-testid="roll-rates-pop"], [data-testid="pack-odds-pop"]')) return; // Esc closes ODDS first
      e.stopImmediatePropagation(); // and only the panel: the screen under it (the shop…) listens for Esc too
      try { sessionStorage.removeItem(PAY_RESUME_KEY); } catch { /* */ }
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const close = () => { setWant(null); onClose(); };
  const asking = pay.asking && !isRollPack(pay.asking) ? pay.asking : null;

  return (
    <div className="pg-scrim" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className={`pg is-${tab}`} role="dialog" aria-modal="true" aria-label={tab === 'packs' ? 'Buy packs' : 'Buy gems'} data-testid="buy-gems">
        <div className="pg-head">
          <div className="pg-tabs" role="tablist" aria-label="What to buy">
            {[['gems', 'GEMS'], ['packs', 'PACKS']].map(([k, label]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} className={`pg-tab${tab === k ? ' is-on' : ''}`} data-tab={k}
                data-testid={`pay-tab-${k}`} disabled={!!busy} onClick={() => { setWant(null); setTab(k); }}>
                {label}
              </button>
            ))}
          </div>
          <span className="pg-have" data-testid="pay-have" aria-label={`You have ${formatNum(gems)} gems`}>
            <GemIcon size={26} /><span className="pg-have-n" aria-hidden="true">{formatShort(gems)}</span>
          </span>
          <button type="button" className="pg-close" ref={closeRef} onClick={close} aria-label="Close">CLOSE</button>
        </div>

        {tab === 'packs' ? <PacksTab pay={pay} onClose={onClose} /> : (
          <>
            {asking ? (
              <div className="pg-signin" data-testid="pay-signin" data-pack={asking.id}>
                <span className="pg-signin-h">SIGN IN TO GET {grouped(asking.gems)}{first ? ` + ${grouped(asking.gems)} BONUS` : ''} GEMS</span>
                <span className="pg-signin-t">{formatUsd(asking.cents)}. Your gems stay on your Google account, on any device.</span>
                <GoogleButton />
                <button type="button" className="pg-back" onClick={() => setWant(null)} data-testid="pay-signin-back">BACK</button>
              </div>
            ) : (
              <div className="pg-grid" role="list" aria-label="Gem packs">
                {PACKS.map((p) => {
                  const over = pay.over(p);
                  return (
                    <div key={p.id} role="listitem" className="pg-cell">
                      <button
                        type="button"
                        className={`pg-pack${over ? ' is-over' : ''}${first ? ' is-first' : ''}`}
                        data-pack={p.id}
                        disabled={!!busy}
                        onClick={() => pay.onPack(p)}
                        aria-label={`${p.name}: ${p.gems} gems${first ? ` plus ${p.gems} first-buy bonus gems` : ''} for ${formatUsd(p.cents)}${over ? ' — past this month’s limit' : ''}`}
                      >
                        <img className="pg-art" src={p.art} width="256" height="256" alt="" draggable="false" />
                        {first ? <span className="pg-first" data-testid="pay-first">FIRST BUY ×2</span> : null}
                        <span className="pg-gems"><GemIcon size={22} />{grouped(p.gems)}</span>
                        {first ? <span className="pg-bonus" data-testid={`pay-bonus-${p.id}`}>+{grouped(p.gems)} BONUS</span> : null}
                        <span className="pg-price" data-testid={`pay-price-${p.id}`}>{busy === p.id ? 'OPENING…' : formatUsd(p.cents)}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="pg-foot">
              <span className="pg-cap" data-testid="pay-cap">
                $20 A MONTH LIMIT<span className="pg-cap-sep"> · </span><b>{formatUsd(left)} LEFT</b>
              </span>
              <RatesPop label="ODDS" className="pg-odds" />
            </div>
            {/* a note lies over the fine print for a moment (same cell), so a tap never moves the packs */}
            <div className="pg-low">
              <p className={`pg-fine${note ? ' is-hid' : ''}`} data-testid="pay-refund">
                {first ? 'First buy doubles, once per Google account; a refund takes it back for good. ' : null}
                Same odds as earned gems. Mistake? Reply to the Stripe receipt{REFUND_EMAIL ? <> or email <b>{REFUND_EMAIL}</b></> : null} for a refund; the gems are taken back.
              </p>
              {note ? <div className="pg-note" role="status" aria-live="polite" data-testid="pay-note">{note}</div> : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

let open = false;
/** Open the panel over whatever is on screen (one at a time). `tab0`: 'gems' (the +) or 'packs'. */
export function mountBuyGems(tab0 = 'gems') {
  if (open) return;
  open = true;
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  const close = () => { open = false; root.unmount(); host.remove(); };
  root.render(<BuyGems onClose={close} tab0={tab0} />);
}
