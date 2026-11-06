// PaidGemsShelf.jsx — the shop's GEMS shelf: gem packs for real money (Andy nov3; payments/, migration 082).
// LAZY, its own chunk, and only ever mounted when payments/flag.js PAYMENTS_ON (VITE_PAYMENTS_ON=1) — ShopV2 leaves the
// tab out entirely otherwise.
//
// THE SAFEGUARDS (kept although the gems are pay-to-win; payments-brief.md):
//   * the DOLLAR price is printed on every pack, and again on the checkout button;
//   * "ASK A PARENT FIRST" heads the shelf, and a tap opens a confirm step that says a parent pays on the next page —
//     Stripe Checkout collects THE PAYER's email, we never ask the player for one;
//   * $20 a month per account: the server refuses past it (082 pay_reserve); the shelf shows what is left and greys out
//     a pack that would cross it (price still shown);
//   * no countdowns, no "limited" offers, no sale badges: a pack is always the same price;
//   * ODDS sits on the shelf (the roll screen's RATES popup — the same table the roll uses; paid gems roll at the same
//     server odds);
//   * a refund line: reply to the Stripe receipt (or VITE_REFUND_EMAIL); refunded gems are taken back off.
// Motion: hover / press transforms and one finite enter on the confirm panel; nothing loops.
import { useEffect, useRef, useState } from 'react';
import './PaidGemsShelf.css';
import KitIcon from './kit/KitIcon.jsx';
import RatesPop from './rollScreen/RatesPop.jsx';
import { useAuthSession, GoogleButton } from './account/GoogleAccount.jsx';
import { PACKS, MONTHLY_CAP_CENTS, formatUsd, capLeft, fitsCap, packById } from '../payments/packs.js';
import { fetchPaid, applyPaid, startCheckout, hasProfile } from '../payments/payClient.js';
import { formatNum } from '../format';

const REFUND_EMAIL = (import.meta.env && import.meta.env.VITE_REFUND_EMAIL) || '';

const NOTE = {
  no_profile: 'PICK A BOARD NAME FIRST — YOUR GEMS LAND ON IT',
  cap: 'THAT GOES PAST THIS MONTH’S $20 LIMIT',
  flagged: 'BUYING IS OFF FOR THIS ACCOUNT — A PARENT CAN REPLY TO THE RECEIPT',
  off: 'BUYING GEMS IS NOT OPEN YET',
  offline: 'CAN’T REACH CHECKOUT — TRY AGAIN',
  sign_in: 'SIGN IN WITH GOOGLE TO BUY GEMS',
  not_linked: 'THIS GOOGLE ACCOUNT IS ON A DIFFERENT NAME — CHECK SETTINGS → ACCOUNT',
};

export default function PaidGemsShelf() {
  const [acct, setAcct] = useState({ spent: 0, cap: MONTHLY_CAP_CENTS, flagged: false, known: false });
  const [pick, setPick] = useState(null); // the pack id waiting on the confirm step
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  const goRef = useRef(null);
  const signed = useAuthSession(); // 085: REQUIRED TO BUY — the packs show once a Google account is signed in

  useEffect(() => {
    let live = true;
    (async () => {
      const d = await fetchPaid();
      if (!live || !d) return;
      setAcct({ spent: d.spent_cents, cap: d.cap_cents || MONTHLY_CAP_CENTS, flagged: d.flagged, known: true });
      if (d.rows.length) await applyPaid(d.rows); // a pack paid while away lands here too (the pill counts it up)
    })();
    return () => { live = false; };
  }, []);
  useEffect(() => {
    if (pick && goRef.current) goRef.current.focus();
  }, [pick]);
  useEffect(() => {
    if (!note) return undefined;
    const t = setTimeout(() => setNote(null), 3200);
    return () => clearTimeout(t);
  }, [note]);

  const left = capLeft(acct.spent, acct.cap);
  const chosen = packById(pick);

  const onPack = (p) => {
    if (acct.flagged) { setNote(NOTE.flagged); return; }
    if (!fitsCap(p, acct.spent, acct.cap)) { setNote(NOTE.cap); return; }
    if (!hasProfile()) { setNote(NOTE.no_profile); return; }
    setPick(p.id);
  };
  const onGo = async () => {
    if (!chosen || busy) return;
    setBusy(true);
    const r = await startCheckout(chosen.id);
    if (r.ok) return; // leaving for Stripe: the button stays on OPENING…
    setBusy(false);
    if (Number.isFinite(r.spent_cents)) setAcct((a) => ({ ...a, spent: r.spent_cents, cap: r.cap_cents || a.cap }));
    setNote(NOTE[r.reason] || NOTE.offline);
    setPick(null);
  };

  return (
    <div className="pg" data-testid="shop-gems">
      <div className="pg-parent" role="note" data-testid="pay-parent">
        <span className="pg-parent-h">ASK A PARENT FIRST</span>
        <span className="pg-parent-t">Gems cost real money. A parent or guardian pays on the next page.</span>
      </div>

      {!signed ? (
        <div className="pg-signin" data-testid="pay-signin">
          <span className="pg-signin-h">SIGN IN TO BUY GEMS</span>
          <span className="pg-signin-t">Every purchase stays on your Google account, on any device.</span>
          <GoogleButton className="pg-gsi" />
        </div>
      ) : chosen ? (
        <div className="pg-confirm" role="group" aria-label={`Buy ${chosen.gems} gems for ${formatUsd(chosen.cents)}`} data-testid="pay-confirm">
          <img className="pg-confirm-art" src={chosen.art} width="256" height="256" alt="" draggable="false" />
          <div className="pg-confirm-txt">
            <span className="pg-confirm-h">
              <KitIcon name="gems" size={26} shadow={2} extras={false} />
              <span>{formatNum(chosen.gems)} GEMS · {formatUsd(chosen.cents)}</span>
            </span>
            <span className="pg-confirm-t">The next page is Stripe&apos;s secure checkout. A parent or guardian types their email and card there.</span>
          </div>
          <div className="pg-confirm-btns">
            <button type="button" className="pg-btn pg-go" ref={goRef} onClick={onGo} disabled={busy} data-testid="pay-go">
              {busy ? 'OPENING…' : `PARENT: PAY ${formatUsd(chosen.cents)}`}
            </button>
            <button type="button" className="pg-btn pg-back" onClick={() => setPick(null)} disabled={busy}>BACK</button>
          </div>
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
                  onClick={() => onPack(p)}
                  aria-label={`${p.name}: ${p.gems} gems for ${formatUsd(p.cents)}${over ? ' — past this month’s limit' : ''}`}
                >
                  <span className="pg-name">{p.name}</span>
                  <img className="pg-art" src={p.art} width="256" height="256" alt="" draggable="false" />
                  <span className="pg-gems"><KitIcon name="gems" size={24} shadow={2} extras={false} />{formatNum(p.gems)}</span>
                  <span className="pg-price" data-testid={`pay-price-${p.id}`}>{formatUsd(p.cents)}</span>
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
      <p className="pg-fine" data-testid="pay-refund">
        Bought gems work like earned gems, at the same roll odds. Bought by mistake? Reply to the Stripe receipt
        {REFUND_EMAIL ? <> or email <b>{REFUND_EMAIL}</b></> : null} for a full refund — the refunded gems are taken back.
      </p>
      <div className="pg-note" role="status" aria-live="polite">{note}</div>
    </div>
  );
}
