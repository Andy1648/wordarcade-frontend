// usePayBuy.js — THE ONE BUY FLOW for anything sold for real money (082 gems, 089 roll packs), shared by the + panel
// (BuyGems.jsx) and the shop's PACKS shelf (PaidPacks.jsx). Moved here verbatim from BuyGems so the two can never drift:
//   * ONE TAP: signed in, a pack goes straight to Stripe's page (nothing is charged on this side). Signed out, a tap asks for
//     Google once (`asking`), then that same purchase carries on (AUTH_LANDED, or PAY_RESUME_KEY when a restore reloads the
//     page on the way).
//   * the $20 a month cap: the server refuses past it (pay_reserve); the hook greys a pack that would cross it (`fits`).
//   * the account's spend / flag come from 082 pay_gems_pending (any paid gems waiting are applied on the way).
// MOUNT IT ONCE per screen: a second instance would pick the same waiting pack back up and buy it twice.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthSession } from '../account/GoogleAccount.jsx';
import { authAvailable, AUTH_LANDED } from '../../leaderboard/auth.js';
import { MONTHLY_CAP_CENTS, capLeft, fitsCap, packById, isRollPack } from '../../payments/packs.js';
import { fetchPaid, applyPaid, startCheckout, hasProfile, PAY_RESUME_KEY, readPayResume, notePackCheckout } from '../../payments/payClient.js';

export const PAY_NOTE = {
  no_profile: 'PICK A BOARD NAME FIRST — YOUR GEMS LAND ON IT',
  no_profile_pack: 'PICK A BOARD NAME FIRST — YOUR PACK LANDS ON IT',
  cap: 'THAT GOES PAST THIS MONTH’S $20 LIMIT',
  flagged: 'BUYING IS OFF FOR THIS ACCOUNT — REPLY TO THE RECEIPT',
  off: 'BUYING GEMS IS NOT OPEN YET',
  offline: 'CAN’T REACH CHECKOUT — TRY AGAIN',
  sign_in: 'SIGN IN WITH GOOGLE TO BUY GEMS',
  not_linked: 'THIS GOOGLE ACCOUNT IS ON A DIFFERENT NAME — CHECK SETTINGS → SAVE CODE',
};
const noteFor = (reason, p) => (reason === 'no_profile' && isRollPack(p) ? PAY_NOTE.no_profile_pack : PAY_NOTE[reason] || PAY_NOTE.offline);

export function usePayBuy() {
  const [acct, setAcct] = useState({ spent: 0, cap: MONTHLY_CAP_CENTS, flagged: false, known: false });
  const [busy, setBusy] = useState(null); // the pack id on its way to Stripe
  const [want, setWantState] = useState(readPayResume); // the pack id waiting on a Google sign-in
  const [note, setNote] = useState(null);
  const resumed = useRef(!!readPayResume()); // this mount picked a waiting pack back up
  const signed = useAuthSession(); // 085: REQUIRED TO BUY

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
    // Stripe's Back button can bring this very page back from the browser's cache, still saying OPENING…
    const onShow = (e) => { if (e.persisted) setBusy(null); };
    window.addEventListener('pageshow', onShow);
    return () => window.removeEventListener('pageshow', onShow);
  }, []);
  useEffect(() => {
    if (!note) return undefined;
    const t = setTimeout(() => setNote(null), 3200);
    return () => clearTimeout(t);
  }, [note]);

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
    if (a.flagged) { setNote(PAY_NOTE.flagged); return; }
    if (!fitsCap(p, a.spent, a.cap)) { setNote(PAY_NOTE.cap); return; }
    if (!hasProfile()) { setNote(noteFor('no_profile', p)); return; }
    setBusy(p.id);
    notePackCheckout(isRollPack(p) ? p.id : null); // back from Stripe, the menu opens the pack (payReturn.js); gems: no pack
    const r = await startCheckout(p.id);
    if (r.ok) return; // leaving for Stripe: the pack stays on OPENING…
    if (isRollPack(p)) notePackCheckout(null);
    setBusy(null);
    if (Number.isFinite(r.spent_cents)) setAcct((x) => ({ ...x, spent: r.spent_cents, cap: r.cap_cents || x.cap }));
    setNote(noteFor(r.reason, p));
  }, []);
  const onPack = (p) => {
    if (busy) return;
    if (signed) { buy(p); return; }
    if (!authAvailable()) { setNote(PAY_NOTE.off); return; }
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
      else if (e.detail && e.detail.state === 'no_name') setNote(noteFor('no_profile', p));
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

  const left = capLeft(acct.spent, acct.cap);
  const asking = !signed ? packById(want) : null;
  const over = (p) => acct.known && !fitsCap(p, acct.spent, acct.cap);
  return { acct, left, busy, want, setWant, note, setNote, signed, asking, onPack, over };
}
