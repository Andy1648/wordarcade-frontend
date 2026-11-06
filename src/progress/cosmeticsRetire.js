// cosmeticsRetire.js — WIN FX and SOUND PACKS are retired (Andy nov2: "dont want win fx or sound"). Once per save, at
// boot (main.jsx, beside the gear-pool refund): every one the player PAID GEMS for is refunded through the one gem door
// (grantGems 'refund'), the ids leave the save, the worn slots fall back to the default burst and the default THOCK
// click, and the total waits under NOTE_KEY for ONE small menu notice (Homepage). Nothing silently disappears.
//
// What counts as PAID: a WIN FX in taw.s2.kit `own` (only buyKit / the wheel ever wrote there — the wheel-only PRIZE
// SHOWER and FX earned by WINS were never paid for), and a non-default SOUND PACK in taw.owned (season 2 sold them for
// gems). Prices are FROZEN here — what was actually charged (kit.js WIN_FX, v3/econ cosmeticGemPrice rungs 1–9) — so a
// later price change can never move a refund. LEAF: localStorage + the gem door.
import { grantGems } from './gemsCore.js';

export const RETIRED_KEY = 'taw.s2.cosmeticsRetired'; // '1' once run (a season-2 key: the save backup carries it)
export const NOTE_KEY = 'taw.s2.cosmeticsRefund'; // the gems refunded, until the menu has said so once
export const FX_PAID = Object.freeze({ firework: 500, splat: 700, thunder: 900, blast: 1500 });
export const FX_IDS = Object.freeze([...Object.keys(FX_PAID), 'confetti']);
export const SOUND_PAID = Object.freeze({ marble: 75, typewriter: 115, silent: 170, arcade: 255, vinyl: 380, glass: 570, steel: 855, bass: 1280, crystal: 1920 });
export const SOUND_IDS = Object.freeze(['thock', 'clack', 'cream', ...Object.keys(SOUND_PAID)]);
const KIT_KEY = 'taw.s2.kit'; // = cast/kit.js KIT_KEY
const OWNED_KEY = 'taw.owned'; // = progress/shop.js
const EQUIPPED_KEY = 'taw.equipped';

const json = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch { return d; } };

/** PURE: what a save is owed — { gems, fx: [paid fx ids], sounds: [paid sound ids] }. */
export function refundOf(kitOwn = [], owned = []) {
  const fx = [...new Set((Array.isArray(kitOwn) ? kitOwn : []).filter((id) => FX_PAID[id]))];
  const sounds = [...new Set((Array.isArray(owned) ? owned : []).filter((id) => SOUND_PAID[id]))];
  const gems = fx.reduce((n, id) => n + FX_PAID[id], 0) + sounds.reduce((n, id) => n + SOUND_PAID[id], 0);
  return { gems, fx, sounds };
}

/** Once per save: refund, strip the ids, reset the worn slots. Returns the refund (null when already done / blocked). */
export function retireCosmetics(grant = grantGems) {
  try {
    if (localStorage.getItem(RETIRED_KEY) === '1') return null;
    const kit = json(KIT_KEY, null);
    const owned = json(OWNED_KEY, null);
    const r = refundOf(kit && kit.own, owned);
    if (kit && typeof kit === 'object') {
      const own = Array.isArray(kit.own) ? kit.own.filter((id) => !FX_IDS.includes(id)) : [];
      localStorage.setItem(KIT_KEY, JSON.stringify({ ...kit, own, fx: null }));
    }
    if (Array.isArray(owned)) localStorage.setItem(OWNED_KEY, JSON.stringify(owned.filter((id) => !SOUND_PAID[id])));
    const eq = json(EQUIPPED_KEY, null);
    if (eq && typeof eq === 'object' && eq.soundPack && eq.soundPack !== 'thock') localStorage.setItem(EQUIPPED_KEY, JSON.stringify({ ...eq, soundPack: 'thock' }));
    if (r.gems > 0) {
      grant(r.gems, 'refund', { detail: 'cosmetics-retired' });
      localStorage.setItem(NOTE_KEY, String(r.gems));
    }
    localStorage.setItem(RETIRED_KEY, '1');
    return r;
  } catch {
    return null; // blocked storage: try again next boot
  }
}

/** The menu's one notice: the refunded gems (once), or 0. Reading it clears it. */
export function takeRefundNote() {
  try {
    const n = Math.max(0, Math.floor(Number(localStorage.getItem(NOTE_KEY)) || 0));
    localStorage.removeItem(NOTE_KEY);
    return n;
  } catch { return 0; }
}
