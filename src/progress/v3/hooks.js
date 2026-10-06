// v3/hooks.js — the SEASON-2 versions of the live modules' functions (PROGRESSION v3). LAZY: v3/install.js (loaded
// before the first render only with the SEASON2 flag) swaps them in through each live module's `__v3` setter, so the
// live game's eager chunk carries no v3 logic at all (payload ratchet, e2e/payload-budget.spec.js). The setters take
// one-letter keys (that is what keeps them small); each swap object below names what it replaces. Imports the live
// modules it extends — this chunk loads after them, so there is no cycle at evaluation time.
import { keyTierCost as keyTierCostV, doRebirth, getRebirths, getKeyTier, saveRebirths, saveKeyTier, saveProgress, rebirthThreshold, rebirthMult, modePower, roundWordXp, finiteCap } from '../xp.js';
import { POP_STYLES, SOUND_PACKS, getOwned, saveOwned, equip, itemById, isOwned } from '../shop.js';
import { getWins } from '../wins.js';
import { loadGemState, saveGemState, tellBalance, grantGems, PER_PLAYER_BEATEN as LIVE_PER_PLAYER } from '../gemsCore.js';
import { statOf, mainMultOf, loadRollState, wornMarkId, markBaseXp } from '../markRollsCore.js';
import {
  cosmeticGemPrice, canAscend, starsForAscend, xpPerLetter as xpPerLetterV3, WINS_BASE, WORD_REF, starMult, powerXpMult,
  rebirthMult as rebirthMultV3, rebirthGate, powerCostAt, rebirthGems, DROP_CHANCE, DROP_MIN, DROP_MAX, BOT_WIN,
  PER_PLAYER_BEATEN, ROLL_PRICE, STREAK_BONUS,
} from './econ.js';
import { needV3, creditXpV3 } from './curve.js';
import { getStarsV3, saveStarsV3, mark2Id, saveMark2Id, bumpCounter, maxCounter, S2_PREFIX } from './store.js';
import { featureOpen } from './unlocks.js';
import { liveRankV3 } from './ranks.js';
import { stockXpMult, stockGemMult } from './stock.js'; // the SHOP's STOCK timed effects (P3)

export const SERVER_FLAG_KEY = `${S2_PREFIX}server`; // the server hook's note (read at the NEXT boot)
const fin = (v, d) => (Number.isFinite(v) ? v : d);
const pos = (v, d) => (Number.isFinite(v) && v > 0 ? v : d);

// ---- xp.js (__v3) ---------------------------------------------------------------------------------------------------
export const xpSwap = {
  a: needV3, // needAt: XP for the next level = 40 × √level (closed form)
  b: powerXpMult, // keyXpMult: POWER 1.8^P
  // rebirthPow: 2^R × (1 + ★) — the receipt's REBIRTH row (and the shop's ×N → ×N) carries ★ in season 2
  c: (rc) => rebirthMultV3(rc) * starMult(getStarsV3()),
  /** levelXpPerLetter: (7 + mark base) × 1.8^POWER × 2^R × (1 + ★) × MARK. */
  d(keyTier, rebirthCount, markMult = 1, baseAdd) {
    return xpPerLetterV3({
      power: fin(keyTier, getKeyTier()),
      rebirths: fin(rebirthCount, getRebirths()),
      stars: getStarsV3(),
      mark: pos(markMult, 1),
      markBase: baseAdd === undefined ? markBaseXp() : pos(baseAdd, 0),
    }) * stockXpMult(); // the STOCK's +25% XP · 10 MIN (×1 when none is running)
  },
  e: rebirthGate, // tableRebirthThreshold: LV ⌈100 × 2.5^R⌉ (no grandfathering in season 2)
  f: () => (WINS_BASE * 10) / WORD_REF, // keyTierXp: 15 wins a 5-letter word = 30 a letter in the receipt's ×10 units
  g: powerCostAt, // keyTierCostAt: P → P+1 costs 100 × 4^P wins
  h: (state, gain) => creditXpV3(state, gain), // creditXp: O(1) carry — levels reach millions
  /** xpPerWord (×10 "XP" units): (15 + mark) × len/5 × MODE × 2^R × (1 + ★) × MARK × BOOST (× FRENZY on FUSE). */
  i({ mode = 'menu', rebirthCount, wordLength = 1, bonusMult = 1, baseWinsAdd = 0 } = {}) {
    const len = Math.floor(pos(wordLength, 1));
    // a worn +N BASE WINS mark scales the base by (10 + N) / 10, exactly as the live receipt shows it (wins.wordWinsBase)
    const base = ((WINS_BASE * 10) / WORD_REF) * ((10 + pos(baseWinsAdd, 0)) / 10);
    return roundWordXp(finiteCap(base * len * modePower(mode) * rebirthMultV3(fin(rebirthCount, getRebirths())) * starMult(getStarsV3()) * pos(bonusMult, 1)));
  },
};

// ---- stars.js (__v3): a rebirth pays gems, never ★; ★ only from ASCENSION ----------------------------------------------
export const starsSwap = {
  a: () => 0, // starsForRebirth
  b: (level, rc) => ({ stars: 0, nextIn: Math.max(0, rebirthThreshold(rc) - level), badTime: false }), // rebirthAdvice
  c: () => ({ ok: false, locked: true }), // buyPerk: no star perks — ★ multiply XP and wins instead
  /** rebirthWithStars: ONE rebirth — level → 1, R + 1, POWER kept, +7 × R gems. No ★, no layer claim. */
  d() {
    const rc = doRebirth();
    gemsSwap.d(rc);
    bumpCounter('reb'); // ACHIEVEMENTS: REBIRTH (every climb)
    return { rc, stars: 0 };
  },
  e: () => ({ keys: 0, forges: 0 }), // runAutomation: no AUTO-KEY / AUTO-FORGE (R2 unlocks AUTO ROLL)
};

/**
 * ASCEND (R10): rebirths, levels and POWER reset; ★ += R − 9. `target` = the server's new ★ total (local lands
 * exactly on it), null = local. Returns { ok, stars, added } — ok:false below R10.
 */
export function ascend(target = null) {
  const rb = getRebirths();
  const before = getStarsV3();
  if (target == null && !canAscend(rb)) return { ok: false, stars: before, added: 0 };
  const after = Number.isFinite(target) && target >= 0 ? Math.floor(target) : before + starsForAscend(rb);
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
    if (!(rng() < chance * stockGemMult())) return 0; // the STOCK's ×2 GEM DROPS · 10 MIN
    const v = rng();
    return DROP_MIN + Math.floor((v >= 0 && v < 1 ? v : 0) * (DROP_MAX - DROP_MIN + 1));
  },
  b: () => 0, // noteLevelReached: levels pay no gems in v3 (LEVEL_UP 0 — they reach millions)
  c: ROLL_PRICE, // ROLL_PRICE_GEMS: 75
  d: (rc) => grantGems(rebirthGems(rc), 'rebirth', { detail: Number.isFinite(rc) ? `rb-${rc}` : null }), // noteRebirth: +7 × R
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
export const S2_KEYS = ['taw.xp', 'taw.xpv10', 'taw.rebirths', 'taw.keytier', 'taw.wins', 'taw.winsLifetime', 'taw.winsCarry', 'taw.gems', 'taw.records', 'taw.rbgate', 'taw.claims'];
const KEYSET = new Set(S2_KEYS);
export const s2MapKey = (k) => (KEYSET.has(k) ? S2_PREFIX + String(k).slice(4) : k);
/** Map the season-2 keys on `target` (default: Storage.prototype; the node shims pass their localStorage object). */
export function patchStorage(target) {
  const P = target || (typeof Storage !== 'undefined' ? Storage.prototype : null);
  if (!P || P.__s2) return false;
  for (const m of ['getItem', 'setItem', 'removeItem']) {
    const f = P[m];
    P[m] = function s2(k, ...rest) {
      return f.call(this, s2MapKey(k), ...rest);
    };
  }
  Object.defineProperty(P, '__s2', { value: true });
  return true;
}
