// jackpotCoins.js — JACKPOT's ONE bespoke touch (Andy nov4: a bold idea on one item, never a treatment across a rarity):
// the top frame PAYS OUT — three coins pop off the stack painted at its top-left, arc out and drop. PURE: the flights
// only; JackpotCoins.jsx owns the nodes. It plays once as the frame appears and on hover: no timer, nothing at rest.
export const COIN_SRC = '/icons/wins.webp'; // the game's own coin, already in the menu's payload
export const COIN_MS = 640;
export const COIN_STAGGER_MS = 70;
const FLIGHTS = [
  { x: -150, y: -130, spin: -320 },
  { x: -40, y: -190, spin: 280 },
  { x: -230, y: -60, spin: -220 },
];
export const COIN_COUNT = FLIGHTS.length;

/** Coin `k`'s arc, in % of its own box: snaps up and out, hangs at the top, falls past its start and fades. */
export function coinFrames(k) {
  const f = FLIGHTS[k % COIN_COUNT];
  return [
    { offset: 0, opacity: 0, transform: 'translate(0%, 0%) rotate(0deg) scale(0.4)', easing: 'cubic-bezier(.15,.7,.3,1)' },
    { offset: 0.12, opacity: 1, transform: `translate(${f.x * 0.3}%, ${f.y * 0.4}%) rotate(${f.spin * 0.2}deg) scale(1)`, easing: 'cubic-bezier(.2,.7,.4,1)' },
    { offset: 0.48, opacity: 1, transform: `translate(${f.x * 0.8}%, ${f.y}%) rotate(${f.spin * 0.6}deg) scale(1)`, easing: 'cubic-bezier(.5,0,.9,.5)' },
    { offset: 1, opacity: 0, transform: `translate(${f.x}%, ${-f.y * 0.5}%) rotate(${f.spin}deg) scale(0.8)` },
  ];
}
