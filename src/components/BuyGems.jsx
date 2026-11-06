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
//   * a refund line: reply to the Stripe receipt (or VITE_REFUND_EMAIL); refunded gems are taken back off.
// Motion: hover / press transforms and one finite enter; nothing loops.
import { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './BuyGems.css';
import RatesPop from './rollScreen/RatesPop.jsx';
import { useAuthSession, GoogleButton } from './account/GoogleAccount.jsx';
import { GemIcon, useGems } from './gems/GemChip.jsx';
import { authAvailable, AUTH_LANDED } from '../leaderboard/auth.js';
import { PACKS, MONTHLY_CAP_CENTS, formatUsd, capLeft, fitsCap, packById } from '../payments/packs.js';
import { fetchPaid, fetchFirstBuy, applyPaid, startCheckout, hasProfile, PAY_RESUME_KEY, readPayResume } from '../payments/payClient.js';
import { formatNum, formatShort, grouped } from '../format';

const REFUND_EMAIL = (import.meta.env && import.meta.env.VITE_REFUND_EMAIL) || '';

const NOTE = {
  no_profile: 'PICK A BOARD NAME FIRST — YOUR GEMS LAND ON IT',
  cap: 'THAT GOES PAST THIS MONTH’S $20 LIMIT',
  flagged: 'BUYING IS OFF FOR THIS ACCOUNT — REPLY TO THE RECEIPT',
  off: 'BUYING GEMS IS NOT OPEN YET',
  offline: 'CAN’T REACH CHECKOUT — TRY AGAIN',
  sign_in: 'SIGN IN WITH GOOGLE TO BUY GEMS',
  not_linked: 'THIS GOOGLE ACCOUNT IS ON A DIFFERENT NAME — CHECK SETTINGS → SAVE CODE',
};

export default function BuyGems({ onClose }) {
  const [acct, setAcct] = useState({ spent: 0, cap: MONTHLY_CAP_CENTS, flagged: false, known: false });
  const [busy, setBusy] = useState(null); // the pack id on its way to Stripe
  const [want, setWantState] = useState(readPayResume); // the pack id waiting on a Google sign-in
  const [note, setNote] = useState(null);
  const [first, setFirst] = useState(false); // FIRST BUY ×2 still open for this account (088)
  const closeRef = useRef(null);
  const resumed = useRef(!!readPayResume()); // this mount picked a waiting pack back up
  const signed = useAuthSession(); // 085: REQUIRED TO BUY — the packs show once a Google account is signed in
  const gems = useGems();
  useEffect(() => {
    let live = true;
    fetchFirstBuy({ signedIn: !!signed }).then((open) => { if (live) setFirst(open); });
    return () => { live = false; };
  }, [signed]);

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
      try { sessionStorage.removeItem(PAY_RESUME_KEY); } catch { /* */ }
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
  const setWant = useCallback((id) => { // kept in the tab too: LOAD YOUR PROGRESS reloads the page mid-purchase
    setWantState(id);
    try {
      if (id) sessionStorage.setItem(PAY_RESUME_KEY, JSON.stringify({ pack: id, at: Date.now() }));
      else sessionStorage.removeItem(PAY_RESUME_KEY);
    } catch { /* private mode: it just won't survive a reload */ }
  }, []);
  const acctRef = useRef(acct);
  acctRef.current = acct;

  const buy = useCallback(async (p) => {
    const a = acctRef.current;
    if (a.flagged) { setNote(NOTE.flagged); return; }
    if (!fitsCap(p, a.spent, a.cap)) { setNote(NOTE.cap); return; }
    if (!hasProfile()) { setNote(NOTE.no_profile); return; }
    setBusy(p.id);
    const r = await startCheckout(p.id);
    if (r.ok) return; // leaving for Stripe: the pack stays on OPENING…
    setBusy(null);
    if (Number.isFinite(r.spent_cents)) setAcct((x) => ({ ...x, spent: r.spent_cents, cap: r.cap_cents || x.cap }));
    setNote(NOTE[r.reason] || NOTE.offline);
  }, []);
  const onPack = (p) => {
    if (busy) return;
    if (signed) { buy(p); return; }
    if (!authAvailable()) { setNote(NOTE.off); return; }
    setWant(p.id);
  };

  // the sign-in this purchase was waiting on has settled (linked, or its dialog answered): carry on with the same pack
  const wantRef = useRef(want);
  wantRef.current = want;
  useEffect(() => {
    const onLanded = (e) => {
      const p = packById(wantRef.current);
      if (!p) return;
      setWant(null);
      if (e.detail && e.detail.state === 'linked') buy(p);
      else if (e.detail && e.detail.state === 'no_name') setNote(NOTE.no_profile);
    };
    window.addEventListener(AUTH_LANDED, onLanded);
    return () => window.removeEventListener(AUTH_LANDED, onLanded);
  }, [buy, setWant]);
  // back from a restore's reload, signed in, with the pack still waiting
  useEffect(() => {
    const p = packById(want);
    if (!p || !signed || !resumed.current) return;
    resumed.current = false;
    setWant(null);
    buy(p);
  }, [want, signed, buy, setWant]);
  const close = () => { setWant(null); onClose(); };
  const asking = !signed ? packById(want) : null;

  return (
    <div className="pg-scrim" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="pg" role="dialog" aria-modal="true" aria-label="Buy gems" data-testid="buy-gems">
        <div className="pg-head">
          <h2 className="pg-title">GET GEMS</h2>
          <span className="pg-have" data-testid="pay-have" aria-label={`You have ${formatNum(gems)} gems`}>
            <GemIcon size={26} /><span className="pg-have-n" aria-hidden="true">{formatShort(gems)}</span>
          </span>
          <button type="button" className="pg-close" ref={closeRef} onClick={close} aria-label="Close">CLOSE</button>
        </div>

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
              const over = acct.known && !fitsCap(p, acct.spent, acct.cap);
              return (
                <div key={p.id} role="listitem" className="pg-cell">
                  <button
                    type="button"
                    className={`pg-pack${over ? ' is-over' : ''}${first ? ' is-first' : ''}`}
                    data-pack={p.id}
                    disabled={!!busy}
                    onClick={() => onPack(p)}
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
