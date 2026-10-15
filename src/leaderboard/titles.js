// titles.js — LEADERBOARD TITLES (Andy oct15 night "ways for people on leaderboard to feel even more addicted … cosmetics
// or smthn so people can see more of you"). Research (Brawl Stars mastery titles, Fall Guys nicknames): a TEXT title under
// your name, EARNED by doing things and PICKED by you — zero art, zero moderation (a fixed list, never typed). Earned
// checks read this save's own stats (the same ones the profile card already shows); the pick rides lb_showcase_set (050)
// and every board row shows it. Pure data + small storage helpers — no React.
import { readClaimed, readCounters, s2Rebirths, getStarsV3 } from '../progress/v3/store.js';
import { loadRollState, collection, ROLL_MARKS, markLevel } from '../progress/markRollsCore.js';
import { readRecords } from '../progress/records.js';

const PICK_KEY = 'taw.title';

// id → { t: the title, how: what earns it, ok(stats) }. Order = how they list (easiest first). Ids are the wire format
// (050 accepts ^[a-z0-9-]{1,24}$) — never rename one, only add.
export const TITLES = [
  { id: 'fresh-ink', t: 'FRESH INK', how: 'EVERYONE STARTS HERE', ok: () => true },
  { id: 'word-hoarder', t: 'WORD HOARDER', how: 'TYPE WORDS · TIER II', ok: (s) => s.claimed.type >= 2 },
  { id: 'bot-bully', t: 'BOT BULLY', how: 'BEAT BOTS · TIER II', ok: (s) => s.claimed.bots >= 2 },
  { id: 'certified-winner', t: 'CERTIFIED WINNER', how: 'WIN MULTIPLAYER · TIER II', ok: (s) => s.claimed.win >= 2 },
  { id: 'gacha-goblin', t: 'GACHA GOBLIN', how: 'ROLL EPIC+ GEARS · TIER II', ok: (s) => s.claimed.roll >= 2 },
  { id: 'chain-gang', t: 'CHAIN GANG', how: 'A 25-WORD CHAIN', ok: (s) => s.chain >= 25 },
  { id: 'unbreakable', t: 'UNBREAKABLE', how: 'A 100-WORD CHAIN', ok: (s) => s.chain >= 100 },
  { id: 'serial-rebirther', t: 'SERIAL REBIRTHER', how: 'REBIRTH 5 TIMES', ok: (s) => s.reb >= 5 },
  { id: 'jackpot-junkie', t: 'JACKPOT JUNKIE', how: 'REBIRTH 10 TIMES', ok: (s) => s.reb >= 10 },
  { id: 'collector', t: 'COLLECTOR', how: 'FIND 20 GEARS', ok: (s) => s.found >= 20 },
  { id: 'gotta-find-em', t: "GOTTA FIND 'EM ALL", how: 'FIND EVERY GEAR', ok: (s) => s.total > 0 && s.found >= s.total },
  { id: 'myth-hunter', t: 'MYTH HUNTER', how: 'OWN A MYTHIC GEAR', ok: (s) => s.mythic },
  { id: 'secret-keeper', t: 'SECRET KEEPER', how: 'OWN THE SECRET GEAR', ok: (s) => s.secret },
  { id: 'dictionary-diver', t: 'DICTIONARY DIVER', how: 'LAND AN OBSCURE WORD', ok: (s) => s.band === 'OBSCURE' },
  { id: 'keyboard-warrior', t: 'KEYBOARD WARRIOR', how: 'POWER · TIER III', ok: (s) => s.claimed.power >= 3 },
  { id: 'starborn', t: 'STARBORN', how: 'EARN A ★ STAR', ok: (s) => s.stars >= 1 },
];
const BY_ID = Object.fromEntries(TITLES.map((x) => [x.id, x]));

/** The title text for an id off the wire (or null for an unknown / missing one). */
export function titleText(id) {
  return (id && BY_ID[id] && BY_ID[id].t) || null;
}

/** This save's numbers the checks read (each read guarded — a broken store never breaks the board). */
export function myTitleStats() {
  const s = { claimed: {}, chain: 0, reb: 0, stars: 0, found: 0, total: 0, mythic: false, secret: false, band: null };
  try { s.claimed = readClaimed() || {}; } catch { /* none */ }
  try { s.chain = readCounters().chain || 0; } catch { /* none */ }
  try { s.reb = s2Rebirths(); s.stars = getStarsV3(); } catch { /* none */ }
  try {
    const st = loadRollState();
    const c = collection(st);
    s.found = c.base;
    s.total = c.total;
    for (const m of ROLL_MARKS) {
      if (markLevel(st, m.id).copies > 0) {
        if (m.tier === 'mythic') s.mythic = true;
        if (m.tier === 'secret') s.secret = true;
      }
    }
  } catch { /* none */ }
  try { const r = readRecords().rarest; s.band = r ? r.band : null; } catch { /* none */ }
  return s;
}

/** Every title with whether this save has earned it. */
export function myTitles(stats = myTitleStats()) {
  return TITLES.map((x) => ({ ...x, earned: !!x.ok(stats) }));
}

/** The title this save wears: the picked one if it is (still) earned, else the default. */
export function wornTitle(stats = myTitleStats()) {
  let pick = null;
  try { pick = localStorage.getItem(PICK_KEY); } catch { /* blocked */ }
  const t = pick && BY_ID[pick];
  return t && t.ok(stats) ? t.id : 'fresh-ink';
}
export function setTitlePick(id) {
  try {
    if (BY_ID[id]) localStorage.setItem(PICK_KEY, id);
  } catch { /* blocked */ }
}
