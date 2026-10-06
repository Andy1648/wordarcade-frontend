// v3/convertLocal.js — THE SEASON 2 CONVERSION, THE BROWSER'S SAVE (Andy oct6: no reset — players keep their progress).
// SYNC and node-safe: v3/install.js runs it right after the storage layer is mapped (patchStorage) and BEFORE the first
// render, so every module reads the converted season-2 save from its first read. SEASON2 only (install never loads
// with the flag off, and this returns at once anyway).
//
// ONCE per browser (the taw.s2.conv marker + a cookie mirror, so Stats → RESET ALL PROGRESS — which clears taw.s2.*
// but cannot reach the mapped season-1 keys — never re-converts the old save back in):
//   READ the season-1 save through the RAW storage methods (v3 maps taw.xp → taw.s2.xp; the season-1 key is meant):
//     level + bar fraction (xp.js resolveXpState), rebirths, KEY tier, the wins wallet, lifetime wins, gems, records.
//   CONVERT with the one rule (v3/convert.js): R ≤ 10, ★ from the rebirths above 10, KEY → POWER, the wallet capped at
//     the next POWER's price; level, lifetime wins, gems, records kept as-is. (Marks, achievements, words and letters
//     are not season keys — they are simply still there.)
//   WRITE the season-2 keys (taw.s2.*). NOTHING IS REMOVED: every season-1 key stays exactly as it was (turning the
//     flag off returns that save untouched). A pre-launch season-2 test save (?season2=1) is copied to taw.s2.preconv
//     before it is overwritten.
//   The marker is written LAST: { v, st: 'pending' (the UPDATE card is due) | 'shown' | 'none' (no season-1 save — a
//     new player: no card), had, srv (the server half applied, v3/season2Update.js), from, to }.
import { SEASON2 } from '../season.js';
import { convertSave } from './convert.js';
import { rawStorage, S2_KEYS, s2MapKey } from './hooks.js';
import { resolveXpState } from '../xp.js';

export const CONV_KEY = 'taw.s2.conv';
export const PRECONV_KEY = 'taw.s2.preconv';
export const CONV_COOKIE = 'taw_s2c';
export const STARS_KEY_S2 = 'taw.s2.stars';
const S1 = {
  xp: 'taw.xp', shadow: 'taw.xpv10', rebirths: 'taw.rebirths', key: 'taw.keytier', wins: 'taw.wins',
  winsLifetime: 'taw.winsLifetime', winsCarry: 'taw.winsCarry', gems: 'taw.gems', records: 'taw.records',
};
/** Season-1 keys copied VERBATIM into their season-2 key (kept as-is). */
export const KEPT_AS_IS = [S1.winsLifetime, S1.winsCarry, S1.gems, S1.records];

const int0 = (v) => {
  const n = Number(v);
  return v != null && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};
const num0 = (v) => {
  const n = Number(v);
  return v != null && Number.isFinite(n) && n > 0 ? n : 0;
};

export function readConv(raw) {
  try {
    const o = JSON.parse(raw.getItem(CONV_KEY) || 'null');
    return o && typeof o === 'object' ? o : null;
  } catch {
    return null;
  }
}
export function writeConv(raw, o) {
  try {
    raw.setItem(CONV_KEY, JSON.stringify(o));
    return true;
  } catch {
    return false;
  }
}

export function cookieConverted() {
  try {
    return new RegExp(`(?:^|;\\s*)${CONV_COOKIE}=1`).test(document.cookie);
  } catch {
    return false;
  }
}
export function setCookieConverted() {
  try {
    document.cookie = `${CONV_COOKIE}=1; max-age=${400 * 24 * 3600}; path=/; samesite=lax; secure`;
  } catch {
    /* no cookies (node) */
  }
}

/** The season-1 save's numbers, read through `raw` (unmapped key methods). `had` = it holds any progress. */
export function readSeason1(raw) {
  const g = (k) => {
    try {
      return raw.getItem(k);
    } catch {
      return null;
    }
  };
  const had = [S1.xp, S1.shadow, S1.rebirths, S1.key, S1.wins, S1.gems].some((k) => g(k) != null);
  let xs = { level: 1, frac: 0 };
  try {
    xs = resolveXpState(g);
  } catch {
    /* corrupt: LV1 */
  }
  let gems = 0;
  try {
    const o = JSON.parse(g(S1.gems) || 'null');
    gems = o && typeof o === 'object' ? int0(o.bal) : 0;
  } catch {
    gems = 0;
  }
  return {
    had, level: Math.max(1, int0(xs.level)), frac: Number(xs.frac) || 0, rebirths: int0(g(S1.rebirths)),
    keyTier: int0(g(S1.key)), wins: num0(g(S1.wins)), winsLifetime: num0(g(S1.winsLifetime)), gems, stars: 0,
  };
}

/** Write a level state in xp.js's v10 shape ({lv, f, rc, v:10}) to the season-2 level keys. */
export function writeS2Level(raw, level, frac, rc) {
  const v = JSON.stringify({ lv: Math.max(1, Math.floor(level)), f: frac > 0 ? Math.min(frac, 1 - 1e-9) : 0, rc: int0(rc), v: 10 });
  raw.setItem(s2MapKey(S1.xp), v);
  raw.setItem(s2MapKey(S1.shadow), v);
}

/**
 * THE LOCAL CONVERSION. Returns the marker (new or existing), or null with the flag off. Never throws, never removes a
 * key. `storage` = the (patched) localStorage; `now`, `cookie`, `setCookie` are injectable for tests.
 */
export function convertLocal({ storage = globalThis.localStorage, season2 = SEASON2, now = Date.now(), cookie = cookieConverted, setCookie = setCookieConverted } = {}) {
  if (!season2 || !storage) return null;
  let raw;
  try {
    raw = rawStorage(storage);
    const prev = readConv(raw);
    if (prev) return prev;
    if (cookie()) {
      // converted before on this browser, then its season-2 keys were cleared (RESET ALL PROGRESS): never re-convert
      const o = { v: 1, st: 'shown', had: false, srv: 1, at: now, note: 'cookie' };
      writeConv(raw, o);
      return o;
    }
    const s1 = readSeason1(raw);
    if (!s1.had) {
      const o = { v: 1, st: 'none', had: false, srv: 1, at: now };
      writeConv(raw, o);
      setCookie();
      return o;
    }
    // a pre-launch season-2 test save is kept aside (copied, never deleted) before the conversion writes over it
    const pre = {};
    for (const k of [...S2_KEYS.map(s2MapKey), STARS_KEY_S2]) {
      const v = raw.getItem(k);
      if (v != null) pre[k] = v;
    }
    if (Object.keys(pre).length && raw.getItem(PRECONV_KEY) == null) raw.setItem(PRECONV_KEY, JSON.stringify(pre));

    const c = convertSave(s1);
    raw.setItem(s2MapKey(S1.rebirths), String(c.rebirths));
    writeS2Level(raw, c.level, c.frac, c.rebirths);
    raw.setItem(s2MapKey(S1.key), String(c.power));
    raw.setItem(STARS_KEY_S2, `${c.stars}`); // storage, not display
    raw.setItem(s2MapKey(S1.wins), `${c.wins}`);
    for (const k of KEPT_AS_IS) {
      const v = raw.getItem(k);
      if (v != null) raw.setItem(s2MapKey(k), v);
    }
    const o = {
      v: 1, st: 'pending', had: true, srv: 0, at: now,
      from: { rebirths: s1.rebirths, keyTier: s1.keyTier, level: c.level, wins: c.from.wins, gems: s1.gems },
      to: { rebirths: c.rebirths, stars: c.stars, power: c.power, level: c.level, wins: c.wins },
    };
    writeConv(raw, o);
    setCookie();
    return o;
  } catch {
    return null; // blocked storage: nothing written, nothing lost (it runs again next boot)
  }
}
