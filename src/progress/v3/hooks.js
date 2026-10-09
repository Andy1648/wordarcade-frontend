// v3/hooks.js — the SEASON-2 versions of the live modules' functions (PROGRESSION v3). LAZY: v3/install.js (loaded
// before the first render only with the SEASON2 flag) swaps them in through each live module's `__v3` setter, so the
// live game's eager chunk carries no v3 logic at all (payload ratchet, e2e/payload-budget.spec.js). The setters take
// one-letter keys (that is what keeps them small); each swap object below names what it replaces. Imports the live
// modules it extends — this chunk loads after them, so there is no cycle at evaluation time.
import { keyTierCost as keyTierCostV, doRebirth, getRebirths, getKeyTier, saveRebirths, saveKeyTier, saveProgress, rebirthThreshold, rebirthMult, roundWordXp, finiteCap } from '../xp.js';
import { MARK_TIERS } from '../marks.js';
import { POP_STYLES, SOUND_PACKS, getOwned, saveOwned, equip, itemById, isOwned } from '../shop.js';
import { getWins } from '../wins.js';
import { loadGemState, saveGemState, tellBalance, grantGems, PER_PLAYER_BEATEN as LIVE_PER_PLAYER } from '../gemsCore.js';
import { statOf, mainMultOf, loadRollState, wornMarkId, markBaseXp, TIER_MAIN, TIER_PCT, ROLL_MARKS, statBaseValue } from '../markRollsCore.js';
import {
  cosmeticGemPrice, canAscend, starsForAscend, xpPerLetter as xpPerLetterV3, WINS_BASE, WORD_REF, powerXpMult,
  rebirthMult as rebirthMultV3, rebirthGate, powerCostAt, rebirthGems, DROP_CHANCE, DROP_MIN, DROP_MAX, BOT_WIN,
  PER_PLAYER_BEATEN, ROLL_PRICE, STREAK_BONUS, modeMult, MARK_MULT,
} from './econ.js';
import { needV3, creditXpV3 } from './curve.js';
import { getStarsV3, saveStarsV3, mark2Id, saveMark2Id, bumpCounter, maxCounter, S2_PREFIX } from './store.js';
import { featureOpen } from './unlocks.js';
import { liveRankV3 } from './ranks.js';
import { stockXpMult } from './stock.js'; // the SHOP's STOCK timed effects (P3)
import { frenzyXpMult } from '../frenzy.js'; // FUSE FRENZY = ×5 XP per key for 5 min in season 2 (Andy oct8)

export const SERVER_FLAG_KEY = `${S2_PREFIX}server`; // the server hook's note (read at the NEXT boot)
const fin = (v, d) => (Number.isFinite(v) ? v : d);
const pos = (v, d) => (Number.isFinite(v) && v > 0 ? v : d);

// MARKS (PROGRESSION FINAL): the MAIN multiplier by tier — COMMON ×1.1 · RARE ×1.25 · EPIC ×1.5 · LEGENDARY ×2 ·
// MYTHIC ×3 · SECRET ×5. marks.js MARK_TIERS holds the part above ×1 (the live season's LEGENDARY ×3 / MYTHIC ×10 /
// SECRET ×25); this lazy chunk loads only with the SEASON2 flag, so the live numbers are untouched with it off.
// The roll stats read the same ladder as a percent (markRollsCore TIER_PCT: +10 / +25 / +50 / +100 / +200 / +400 %).
// NUMBERS AUDIT (Andy item 5): every ROLLED mark's stat (markRollsCore ROLL_MARKS[].stat) was sized from TIER_PCT
// when that module LOADED — before this chunk re-tiered it — so in season 2 a LEGENDARY +% WINS / XP mark still paid
// +200% (×3, FINAL ×2), a SECRET +2,400% (×25, FINAL ×5) and a MYTHIC +90 BASE (×10, FINAL ×3), on the card AND in the
// payout. The pool's stats are re-sized here from the FINAL percents (`pool`; the shown stat, statOf and the payout all
// read them).
export function applyFinalMarkTiers(tiers = MARK_TIERS, main = TIER_MAIN, pct = TIER_PCT, pool = ROLL_MARKS) {
  for (const [t, m] of Object.entries(MARK_MULT)) {
    if (tiers[t]) tiers[t].bonus = +(m - 1).toFixed(4);
    if (main) main[t] = m;
    if (pct) pct[t] = Math.round((m - 1) * 100);
  }
  if (pool && pct === TIER_PCT) {
    for (const mk of pool) {
      if (mk && mk.stat) mk.stat = Object.freeze({ kind: mk.stat.kind, value: statBaseValue(mk.stat.kind, mk.tier) });
    }
  }
  return tiers;
}
applyFinalMarkTiers();

// ---- xp.js (__v3) ---------------------------------------------------------------------------------------------------
export const xpSwap = {
  a: needV3, // needAt: XP for the next level = 100 × 1.15^(level−1) (closed-form carry)
  b: powerXpMult, // keyXpMult: the KEY ladder ×1, 2, 5 … 1000, then ×2.15 a tier
  c: (rc) => rebirthMultV3(rc), // rebirthPow: 3^R — the receipt's REBIRTH row (and the shop's ×N → ×N)
  /** levelXpPerLetter: (10 + mark base) × KEY × 3^R × MARK (× OVERDRIVE through the callers' boostMult). */
  d(keyTier, rebirthCount, markMult = 1, baseAdd) {
    return xpPerLetterV3({
      power: fin(keyTier, getKeyTier()),
      rebirths: fin(rebirthCount, getRebirths()),
      mark: pos(markMult, 1),
      markBase: baseAdd === undefined ? markBaseXp() : pos(baseAdd, 0),
    }) * stockXpMult() * frenzyXpMult(); // the STOCK's +25% XP · 10 MIN, and a FRENZY's ×5 (×1 when none runs)
  },
  // modePower: the FINAL MODE table (WB / Blitz ×1 · RACE ×1.5 · CHAIN ×2 · SAT ×5 · FUSE ×1) — the receipt reads it
  j: (mode) => modeMult(mode),
  e: rebirthGate, // tableRebirthThreshold: LV ≥ 15 + 18·R (no grandfathering)
  f: () => (WINS_BASE * 10) / WORD_REF, // keyTierXp: 10 wins a 5-letter word = 20 a letter in the receipt's ×10 units
  g: powerCostAt, // keyTierCostAt: T → T+1 costs 150 × 5^T wins
  h: (state, gain) => creditXpV3(state, gain), // creditXp: O(1) carry
  /** xpPerInput (v4 "SIMPLE"): a MENU key pays the FULL rate — 1 × 2^T × 3^R × MARK (× BOOST / OVERDRIVE through the
   *  caller's markMult). No ×0.2 share, no rounding, no floor: T1 = 2 a key, T2 = 4. The ONLY source of XP. */
  k: ({ keyTier, rebirthCount, markMult = 1, baseAdd } = {}) => xpSwap.d(keyTier, rebirthCount, markMult, baseAdd),
  /** xpPerWord (×10 "XP" units): (10 + mark) × len/5 × MODE × 3^R × MARK × BOOST (× FRENZY on FUSE). */
  i({ mode = 'menu', rebirthCount, wordLength = 1, bonusMult = 1, baseWinsAdd = 0 } = {}) {
    const len = Math.floor(pos(wordLength, 1));
    // a worn +N BASE WINS mark scales the base by (10 + N) / 10, exactly as the live receipt shows it (wins.wordWinsBase)
    const base = ((WINS_BASE * 10) / WORD_REF) * ((10 + pos(baseWinsAdd, 0)) / 10);
    return roundWordXp(finiteCap(base * len * modeMult(mode) * rebirthMultV3(fin(rebirthCount, getRebirths())) * pos(bonusMult, 1)));
  },
};

// ---- stars.js (__v3): a rebirth pays gems, never ★; ★ only from ASCENSION ----------------------------------------------
export const starsSwap = {
  a: () => 0, // starsForRebirth
  b: (level, rc) => ({ stars: 0, nextIn: Math.max(0, rebirthThreshold(rc) - level), badTime: false }), // rebirthAdvice
  c: () => ({ ok: false, locked: true }), // buyPerk: no star perks — ★ multiply XP and wins instead
  /** rebirthWithStars: ONE rebirth — back to LV 1, R + 1 (×3 forever), KEY kept. No gems, no ★, no layer claim.
   *  (The server's lb_rebirth does the same on the stored row — 027.) */
  d() {
    const rc = doRebirth(); // R + 1 (and the run's peak into records); LV1
    bumpCounter('reb'); // ACHIEVEMENTS: REBIRTH (every climb)
    return { rc, stars: 0 };
  },
  e: () => ({ keys: 0, forges: 0 }), // runAutomation: no AUTO-KEY / AUTO-FORGE (R2 unlocks AUTO ROLL)
};

/**
 * ASCEND — HIDDEN in FINAL v2 (econ.canAscend is always false; lb_ascend refuses). Kept for later: R = 10 + 5 × ★ →
 * rebirths and POWER → 0, level → 1, ★ + 1. `target` = the server's new ★ total (local
 * lands exactly on it), null = local. Returns { ok, stars, added } — ok:false below the ascension gate.
 */
export function ascend(target = null) {
  const rb = getRebirths();
  const before = getStarsV3();
  if (target == null && !canAscend(rb, before)) return { ok: false, stars: before, added: 0 };
  const after = Number.isFinite(target) && target >= 0 ? Math.floor(target) : before + starsForAscend(rb, before);
  saveStarsV3(after);
  saveRebirths(0);
  saveKeyTier(0); // POWER resets on ascension (it is kept through rebirths)
  saveProgress({ level: 1, intoLevel: 0 });
  return { ok: true, stars: after, added: after - before };
}

// ---- gemsCore.js (__v3): the v3 gem table --------------------------------------------------------------------------
// e (dropGemsForWord) is filled by install: it wraps the live drop (its rng is private there) and counts TYPE WORDS.
export const gemsSwap = {
  /** rollGemDrop: 1 in 15 accepted words drops 3–12 gems. */
  a(rng = Math.random, chance = DROP_CHANCE) {
    if (!(rng() < chance)) return 0; // FINAL: exactly 1 in 15 — nothing scales gems (Andy oct6)
    const v = rng();
    return DROP_MIN + Math.floor((v >= 0 && v < 1 ? v : 0) * (DROP_MAX - DROP_MIN + 1));
  },
  b: () => 0, // noteLevelReached: levels pay no gems in v3 (LEVEL_UP 0 — they reach millions)
  c: ROLL_PRICE, // ROLL_PRICE_GEMS: 75
  // noteRebirth: FINAL — a rebirth pays no gems (games only)
  d: (rc) => (rebirthGems(rc) > 0 ? grantGems(rebirthGems(rc), 'rebirth', { detail: Number.isFinite(rc) ? `rb-${rc}` : null }) : 0),
};
/** gems.gameResultPayout in season 2: the live payout re-priced on the v3 table. */
export const flatStreak = (livePayout) => (o) => {
  const p = livePayout(o);
  // the v3 table: bot win +18, +15 per player beaten, a FLAT +4 streak (the live lines carry 3 / 3 per player / +1×)
  const v3 = { bot: () => BOT_WIN, placement: (l) => (l.amount / LIVE_PER_PLAYER) * PER_PLAYER_BEATEN, streak: () => STREAK_BONUS };
  const lines = p.lines.map((l) => (v3[l.reason] ? { ...l, amount: v3[l.reason](l) } : l));
  return { ...p, lines, total: lines.reduce((t, l) => t + l.amount, 0) };
};
/** gems.payGameResult in season 2: the live pay + the BEAT BOTS / WIN MULTIPLAYER counters on a win. */
export const countingResult = (livePay) => (o = {}) => {
  const p = livePay(o);
  const list = o.rivals || [];
  if (o.iWon && !p.repeat && list.length) {
    const self = new Set(o.selfIds || []);
    bumpCounter(list.some((r) => r && !r.isBot && !self.has(r.id)) ? 'mp' : 'bots');
  }
  return p;
};
/** bankWordWins in season 2: the live bank + the CHAIN achievement counter (the longest CHAIN run, in words). */
export const countingBank = (liveBank) => (o = {}) => {
  const n = liveBank(o);
  if (o.mode === 'chain') maxCounter('chain', o.nowWords);
  return n;
};
/** dropGemsForWord in season 2: the live drop (v3 table) + the TYPE WORDS counter (every accepted game word). */
export const countingDrop = (liveDrop) => (o = {}) => {
  const n = liveDrop(o);
  if (o.mode && o.mode !== 'menu') bumpCounter('words');
  return n;
};

// ---- shop.js (__v3): WINS BUY ONLY POWER — cosmetics cost GEMS --------------------------------------------------------
/** An item's price in GEMS — its rung among the PAID items of its own list (0 for a free one / unknown id). */
export function itemGemPrice(id) {
  const list = POP_STYLES.some((i) => i.id === id) ? POP_STYLES : SOUND_PACKS.some((i) => i.id === id) ? SOUND_PACKS : null;
  if (!list) return 0;
  const k = list.filter((i) => i.price > 0).findIndex((i) => i.id === id);
  return k < 0 ? 0 : cosmeticGemPrice(k + 1);
}
export const shopSwap = {
  /** buy: a cosmetic for GEMS (equips it). Returns { ok, reason?, wins, gems }. */
  a(id) {
    if (!itemById(id)) return { ok: false, reason: 'unknown', wins: getWins() };
    if (isOwned(id)) return { ok: false, reason: 'owned', wins: getWins() };
    const price = itemGemPrice(id);
    const g = loadGemState();
    if (g.bal < price) return { ok: false, reason: 'unaffordable', wins: getWins(), gems: g.bal };
    g.bal -= price;
    saveGemState(g);
    tellBalance(g.bal);
    saveOwned([...getOwned(), id]);
    equip(id);
    return { ok: true, wins: getWins(), gems: g.bal, equipped: true, spentGems: price };
  },
};
/** shop.canAffordAny in season 2: WINS BUY ONLY POWER (cosmetics cost gems, so wins never light the dot for them). */
export const powerAffordable = (wins = getWins()) => {
  const c = keyTierCostV(getKeyTier());
  return Number.isFinite(c) && wins >= c;
};
/** buyKeyPower in season 2: the live buy (POWER 100 × 4^P via the swapped xp prices) + the POWER LEVEL counter. */
export const countingPower = (liveBuy) => () => {
  const r = liveBuy();
  if (r.ok) maxCounter('power', r.tier);
  return r;
};

// ---- claims.js / achievements.js / rank.js (__v3): every claim lives in ACHIEVEMENTS; ranks by R then ★ ------------
const CUT = new Set(['achievement', 'rank', 'layer', 'collection', 'welcome']);
export const claimsSwap = {
  a: (kind) => (CUT.has(kind) ? 'cut' : 'instant'), // claimPolicy: no inbox in season 2 (codes / boosts / marks apply at once)
  // claimAmount: a per-level code scales with the rebirth multiplier (levels reach millions)
  b: (c) => (!c ? 0 : (pos(c.amount, 0)) * (c.meta && c.meta.perLevel ? rebirthMult(getRebirths()) : 1)),
};
export const achSwap = {
  a: () => [], // checkAchievements: the season's ACHIEVEMENTS are v3/achievements.js (gems, claimed on their screen)
  b: () => [], // checkRankClaims: no wins for ranking up
};
export const rankSwap = {
  a: () => liveRankV3().name, // rankTitle (the level is ignored)
  b: () => liveRankV3(), // rankFor
};

// ---- boost.js (__v3): the R3 unlock — a 2nd BOOST slot that runs alongside and multiplies ----------------------------
export const BOOST2_KEY = `${S2_PREFIX}boost2`;
function readSlot2() {
  try {
    const o = JSON.parse(localStorage.getItem(BOOST2_KEY) || 'null');
    return o && Number(o.until) > 0 && Number(o.mult) > 1 ? { until: Number(o.until), mult: Number(o.mult) } : null;
  } catch {
    return null;
  }
}
const slot2Mult = (now) => {
  const b = readSlot2();
  return b && b.until > now ? b.mult : 1;
};
/** boost.js codeBoostMult / startBoost in season 2, wrapping the live ones (slot 1 stays theirs). */
export const boostSwap = (liveMult, liveStart) => ({
  a: (now = Date.now()) => liveMult(now) * slot2Mult(now), // the 2nd slot multiplies
  /** while slot 1 runs and R3 opened the 2nd slot, a new boost runs there (extended like slot 1) */
  b(mult, minutes, now = Date.now()) {
    if (!(liveMult(now) > 1 && featureOpen('boost2'))) return liveStart(mult, minutes, now);
    const m = Number(mult) > 1 ? Math.floor(Number(mult)) : 3;
    const min = Number(minutes) > 0 ? Number(minutes) : 10;
    const cur = readSlot2();
    const live = cur && cur.until > now;
    const next = { until: (live ? cur.until : now) + min * 60000, mult: live ? Math.max(cur.mult, m) : m };
    try {
      localStorage.setItem(BOOST2_KEY, JSON.stringify(next));
    } catch {
      /* blocked */
    }
    return { mult: next.mult, remaining: next.until - now, slot: 2 };
  },
});

// ---- the R5 unlock: a 2nd MARK slot (+N% WINS / +N% XP only — minimal model) -----------------------------------
export function mark2Factor(kind, opts, s, wornId) {
  if (opts.markId !== undefined || !featureOpen('mark2')) return 1;
  const id2 = mark2Id();
  if (!id2 || id2 === wornId || !(s && s.marks && s.marks[id2])) return 1;
  const st2 = statOf(id2, s);
  const m = st2 ? (st2.kind === kind ? 1 + st2.value / 100 : 1) : mainMultOf(id2, s);
  return m > 0 ? m : 1;
}
/** CRIT (markRollsCore.critTotals reads it as V3.c2): the 2nd slot's gear id when it counts — the same door as
 *  mark2Factor (R5, an owned rolled gear that is not the worn MAIN) — else null. */
export function mark2For(s, wornId) {
  if (!featureOpen('mark2')) return null;
  const id2 = mark2Id();
  return id2 && id2 !== wornId && s && s.marks && s.marks[id2] ? id2 : null;
}
/** Wear `id` in the 2nd MARK slot (R5+, an owned rolled mark, not the worn one; null empties it). */
export function equipMark2(id) {
  if (!featureOpen('mark2')) return false;
  if (id == null) return saveMark2Id(null);
  const s = loadRollState();
  return !!(s && s.marks && s.marks[id]) && id !== wornMarkId() && saveMark2Id(id);
}

// ---- the SERVER-FLAG hook (for later) ---------------------------------------------------------------------------
/** lb_caps may one day carry { season: 2 }: noted for the NEXT boot (season.js would read it once the hook goes live). */
export function noteServerSeason(caps) {
  try {
    if (caps && Number(caps.season) === 2) localStorage.setItem(SERVER_FLAG_KEY, '1');
    else if (caps && caps.season != null) localStorage.removeItem(SERVER_FLAG_KEY);
    else return false;
    return true;
  } catch {
    return false;
  }
}

// ---- SEASON 2 KEEPS ITS OWN SAVE: the storage-layer key map ----------------------------------------------------------
// The progression keys whose MEANING v3 changes are read and written under taw.s2.* while the flag is on — mapped HERE,
// at the storage layer, so the live modules carry no key logic (and the season-1 save is never touched). Patched once,
// by install, before anything reads them (main.jsx renders after install). Named-property access (localStorage['k'])
// and Object.keys see the raw keys (the e2e reads the season-1 save that way).
export const S2_KEYS = ['taw.xp', 'taw.xpv10', 'taw.rebirths', 'taw.keytier', 'taw.wins', 'taw.winsLifetime', 'taw.winsCarry', 'taw.gems', 'taw.records', 'taw.rbgate', 'taw.claims', 'taw.overdrive'];
const KEYSET = new Set(S2_KEYS);
export const s2MapKey = (k) => (KEYSET.has(k) ? S2_PREFIX + String(k).slice(4) : k);
/** Map the season-2 keys on `target` (default: Storage.prototype; the node shims pass their localStorage object). */
export function patchStorage(target) {
  const P = target || (typeof Storage !== 'undefined' ? Storage.prototype : null);
  if (!P || P.__s2) return false;
  const raw = {};
  for (const m of ['getItem', 'setItem', 'removeItem']) {
    const f = P[m];
    raw[m] = f;
    P[m] = function s2(k, ...rest) {
      return f.call(this, s2MapKey(k), ...rest);
    };
  }
  Object.defineProperty(P, '__s2', { value: true });
  Object.defineProperty(P, '__s2raw', { value: raw }); // the unmapped methods (the season-2 reset's wipe, season2Boot.js)
  return true;
}
/** `storage` with the RAW (unmapped) key methods — `taw.xp` means the season-1 key, not taw.s2.xp. */
export function rawStorage(storage = globalThis.localStorage) {
  const P = storage && (storage.__s2raw ? storage : Object.getPrototypeOf(storage));
  const raw = (P && P.__s2raw) || null;
  const call = (m, ...a) => (raw ? raw[m].call(storage, ...a) : storage[m](...a));
  return {
    getItem: (k) => call('getItem', k),
    setItem: (k, v) => call('setItem', k, v),
    removeItem: (k) => call('removeItem', k),
    key: (i) => storage.key(i),
    get length() { return storage.length; },
  };
}

// ---- AUTO REBIRTH (PROGRESSION FINAL — the R2 unlock): a toggle on the REBIRTH screen; Homepage runs it ------------------
export const AUTO_REBIRTH_KEY = `${S2_PREFIX}autoRebirth`;
/** Is AUTO REBIRTH on (and unlocked — R2)? */
export function autoRebirthOn() {
  try {
    return featureOpen('autoRebirth') && localStorage.getItem(AUTO_REBIRTH_KEY) === '1';
  } catch {
    return false;
  }
}
/** Turn AUTO REBIRTH on / off (refused below R2). Returns the new state. */
export function setAutoRebirth(on) {
  if (!featureOpen('autoRebirth')) return false;
  try {
    if (on) localStorage.setItem(AUTO_REBIRTH_KEY, '1');
    else localStorage.removeItem(AUTO_REBIRTH_KEY);
  } catch {
    /* blocked */
  }
  return autoRebirthOn();
}
