// BuyGems.jsx — THE place to buy gems (Andy nov5 "+ next to the gem count", replacing the shop's GEMS tab): real money, 082.
// Its own lazy chunk behind GemsPlus.jsx, which draws nothing unless payments/flag.js PAYMENTS_ON (VITE_PAYMENTS_ON=1).
// A modal with its own little root, so any screen with a gem pill can open it without wiring.
//
// ONE TAP: a pack goes straight to Stripe's page, which is where a parent reads the price again and types a card. Nothing is
// charged on this side.
// THE SAFEGUARDS (kept although the gems are pay-to-win; payments-brief.md):
//   * the DOLLAR price is the face of every pack; "ASK A PARENT FIRST" heads the panel, and says a parent pays on the next page;
//   * $20 a month per account: the server refuses past it (082 pay_reserve); the panel shows what is left and greys out a
//     pack that would cross it (price still shown);
//   * no countdowns, no "limited" offers, no sale badges: a pack is always the same price;
//   * ODDS sits here (the roll screen's RATES popup: paid gems roll at the same server odds);
//   * a refund line: reply to the Stripe receipt (or VITE_REFUND_EMAIL); refunded gems are taken back off.
// Motion: hover / press transforms and one finite enter; nothing loops.
import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './BuyGems.css';
import RatesPop from './rollScreen/RatesPop.jsx';
import { useAuthSession, GoogleButton } from './account/GoogleAccount.jsx';
import { GemIcon, useGems } from './gems/GemChip.jsx';
import { PACKS, MONTHLY_CAP_CENTS, formatUsd, capLeft, fitsCap } from '../payments/packs.js';
import { fetchPaid, applyPaid, startCheckout, hasProfile } from '../payments/payClient.js';
import { formatNum, formatShort } from '../format';

const REFUND_EMAIL = (import.meta.env && import.meta.env.VITE_REFUND_EMAIL) || '';

const NOTE = {
  no_profile: 'PICK A BOARD NAME FIRST — YOUR GEMS LAND ON IT',
  cap: 'THAT GOES PAST THIS MONTH’S $20 LIMIT',
  flagged: 'BUYING IS OFF FOR THIS ACCOUNT — A PARENT CAN REPLY TO THE RECEIPT',
  off: 'BUYING GEMS IS NOT OPEN YET',
  offline: 'CAN’T REACH CHECKOUT — TRY AGAIN',
  sign_in: 'SIGN IN WITH GOOGLE TO BUY GEMS',
  not_linked: 'THIS GOOGLE ACCOUNT IS ON A DIFFERENT NAME — CHECK SETTINGS → SAVE CODE',
};

export default function BuyGems({ onClose }) {
  const [acct, setAcct] = useState({ spent: 0, cap: MONTHLY_CAP_CENTS, flagged: false, known: false });
  const [busy, setBusy] = useState(null); // the pack id on its way to Stripe
  const [note, setNote] = useState(null);
  const closeRef = useRef(null);
  const signed = useAuthSession(); // 085: REQUIRED TO BUY — the packs show once a Google account is signed in
  const gems = useGems();

  useEffect(() => {
    let live = true;
    (async () => {
      const d = await fetchPaid();
      if (!live || !d) return;
      setAcct({ spent: d.spent_cents, cap: d.cap_cents || MONTHLY_CAP_CENTS, flagged: d.flagged, known: true });
      if (d.rows.length) await applyPaid(d.rows); // a pack paid while away lands here too (the balance counts it)
    })();
    return () => { live = false; };
  }, []);
  useEffect(() => {
    if (closeRef.current) closeRef.current.focus();
    const onKey = (e) => {
      if (e.key !== 'Escape' || document.querySelector('[data-testid="roll-rates-pop"]')) return; // Esc closes ODDS first
      e.stopImmediatePropagation(); // and only the panel: the screen under it (the shop…) listens for Esc too
      onClose();
    };
    // Stripe's Back button can bring this very page back from the browser's cache, still saying OPENING…
    const onShow = (e) => { if (e.persisted) setBusy(null); };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('pageshow', onShow);
    return () => { window.removeEventListener('keydown', onKey, true); window.removeEventListener('pageshow', onShow); };
  }, [onClose]);
  useEffect(() => {
    if (!note) return undefined;
    const t = setTimeout(() => setNote(null), 3200);
    return () => clearTimeout(t);
  }, [note]);

  const left = capLeft(acct.spent, acct.cap);

  const onPack = async (p) => {
    if (busy) return;
    if (acct.flagged) { setNote(NOTE.flagged); return; }
    if (!fitsCap(p, acct.spent, acct.cap)) { setNote(NOTE.cap); return; }
    if (!hasProfile()) { setNote(NOTE.no_profile); return; }
    setBusy(p.id);
    const r = await startCheckout(p.id);
    if (r.ok) return; // leaving for Stripe: the pack stays on OPENING…
    setBusy(null);
    if (Number.isFinite(r.spent_cents)) setAcct((a) => ({ ...a, spent: r.spent_cents, cap: r.cap_cents || a.cap }));
    setNote(NOTE[r.reason] || NOTE.offline);
  };

  return (
    <div className="pg-scrim" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="pg" role="dialog" aria-modal="true" aria-label="Buy gems" data-testid="buy-gems">
        <div className="pg-head">
          <h2 className="pg-title">GET GEMS</h2>
          <span className="pg-have" data-testid="pay-have" aria-label={`You have ${formatNum(gems)} gems`}>
            <GemIcon size={26} /><span className="pg-have-n" aria-hidden="true">{formatShort(gems)}</span>
          </span>
          <button type="button" className="pg-close" ref={closeRef} onClick={onClose} aria-label="Close">CLOSE</button>
        </div>

        <div className="pg-parent" role="note" data-testid="pay-parent">
          <span className="pg-parent-h">ASK A PARENT FIRST</span>
          <span className="pg-parent-t">Real money. A parent pays on the next page.</span>
        </div>

        {!signed ? (
          <div className="pg-signin" data-testid="pay-signin">
            <span className="pg-signin-h">SIGN IN TO BUY GEMS</span>
            <span className="pg-signin-t">Every purchase stays on your Google account, on any device.</span>
            <GoogleButton />
          </div>
        ) : (
          <div className="pg-grid" role="list" aria-label="Gem packs">
            {PACKS.map((p) => {
              const over = acct.known && !fitsCap(p, acct.spent, acct.cap);
              return (
                <div key={p.id} role="listitem" className="pg-cell">
                  <button
                    type="button"
                    className={`pg-pack${over ? ' is-over' : ''}`}
                    data-pack={p.id}
                    disabled={!!busy}
                    onClick={() => onPack(p)}
                    aria-label={`${p.name}: ${p.gems} gems for ${formatUsd(p.cents)}${over ? ' — past this month’s limit' : ''}`}
                  >
                    <img className="pg-art" src={p.art} width="256" height="256" alt="" draggable="false" />
                    <span className="pg-gems"><GemIcon size={22} />{formatNum(p.gems)}</span>
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
        {/* a note takes the fine print's place for a moment, so a tap never moves the packs */}
        <div className="pg-low">
          {note ? <div className="pg-note" role="status" aria-live="polite" data-testid="pay-note">{note}</div> : (
            <p className="pg-fine" data-testid="pay-refund">
              Same roll odds as earned gems. Bought by mistake? Reply to the Stripe receipt
              {REFUND_EMAIL ? <> or email <b>{REFUND_EMAIL}</b></> : null} for a refund; the gems are taken back.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

let open = false;
/** Open the panel over whatever is on screen (one at a time). */
export function mountBuyGems() {
  if (open) return;
  open = true;
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  const close = () => { open = false; root.unmount(); host.remove(); };
  root.render(<BuyGems onClose={close} />);
}
