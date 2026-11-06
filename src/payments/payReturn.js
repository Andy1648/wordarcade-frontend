// payReturn.js — the menu's PAID GEMS pick-up (LAZY: Homepage imports it only when payments/flag.js says ON, once a page
// load). Back from Stripe (?paid=1) it POLLS — the webhook can land a few seconds after the redirect — and the bought gems
// fly into the menu's gem pill like the wheel's: the pill holds them (gemsInFlight), six painted gems arc in from the
// middle of the screen, and it counts each one in as it lands (Homepage's KitFlyLayer). Otherwise: one quiet fetch.
import { collectPaid, readPayResume } from './payClient.js';
import { readSession } from '../leaderboard/auth.js';
import { openBuyGems } from '../components/gems/GemsPlus.jsx';
import { bootSearch } from '../lib/featureFlags.js';

// Stripe sends the payer back to /?paid=1 (api/_lib/pay.js success_url) — read as the page LOADED (the app tidies the bar).
export const paidReturn = (search = bootSearch()) => /[?&]paid=1(?:&|$)/.test(search);

export default function pickUpPaid(setGemsInFlight, setGemFly, poll = paidReturn()) {
  const fly = (amount) => {
    setGemsInFlight((n) => n + amount);
    const parts = 6;
    const share = Math.floor(amount / parts);
    const amounts = Array.from({ length: parts }, (_, i) => (i === parts - 1 ? amount - share * (parts - 1) : share)).filter((a) => a > 0);
    setGemFly({ from: { x: window.innerWidth / 2, y: window.innerHeight * 0.62 }, amounts });
  };
  if (poll) {
    try { // the address bar loses ?paid=1 so a reload does not poll again
      const u = new URL(window.location.href);
      u.searchParams.delete('paid');
      window.history.replaceState(window.history.state, '', u.pathname + u.search + u.hash);
    } catch { /* cosmetic */ }
  }
  if (readPayResume() && readSession()) openBuyGems(); // a purchase a sign-in's restore reloaded the page in the middle of
  return collectPaid({ poll, onCredit: fly });
}
