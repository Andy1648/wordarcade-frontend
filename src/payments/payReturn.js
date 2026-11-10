// payReturn.js — the menu's PAID GEMS pick-up (LAZY: Homepage imports it only when payments/flag.js says ON, once a page
// load). Back from Stripe (?paid=1) it POLLS — the webhook can land a few seconds after the redirect — and the bought gems
// fly into the menu's gem pill like the wheel's: the pill holds them (gemsInFlight), six painted gems arc in from the
// middle of the screen, and it counts each one in as it lands (Homepage's KitFlyLayer). Otherwise: one quiet fetch.
// 089 ROLL PACKS: back from buying a pack (payClient.notePackCheckout), it polls the SERVER's tickets instead (a pack is never
// gems) and opens the paid pack as soon as it is listed — the existing sealed-roll reveal at its tier (pay/PaidPacks.jsx).
// If it never shows up here (a slow webhook), it waits in the shop's PACKS shelf and the GEARS screen.
import { collectPaid, readPayResume, readPackCheckout, notePackCheckout } from './payClient.js';
import { packById } from './packs.js';
import { readSession } from '../leaderboard/auth.js';
import { openBuyGems } from '../components/gems/GemsPlus.jsx';
import { bootSearch } from '../lib/featureFlags.js';

// Stripe sends the payer back to /?paid=1 (api/_lib/pay.js success_url) — read as the page LOADED (the app tidies the bar).
export const paidReturn = (search = bootSearch()) => /[?&]paid=1(?:&|$)/.test(search);

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
/** Poll the server's tickets for an unopened PAID pack of `tier`, then open it. -> the ticket, or null. */
export async function openPaidPack(tier, { tries = 20, everyMs = 2000, list, open } = {}) {
  const listFn = list || (async () => (await import('../leaderboard/serverTickets.js')).listTickets());
  for (let i = 0; i < tries; i += 1) {
    if (i) await wait(everyMs);
    const l = await listFn().catch(() => []);
    const t = (Array.isArray(l) ? l : []).find((x) => x.source === 'pay' && x.tier === tier);
    if (t) {
      const openFn = open || (await import('../components/pay/PaidPacks.jsx')).mountPackOpen;
      openFn(t);
      return t;
    }
  }
  return null;
}

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
  const pack = poll ? packById(readPackCheckout()) : null;
  if (pack) {
    notePackCheckout(null);
    openPaidPack(pack.tier);
    return collectPaid({ poll: false, onCredit: fly }); // a pack is never gems: one quiet fetch for anything else waiting
  }
  return collectPaid({ poll, onCredit: fly });
}
