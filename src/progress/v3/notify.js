// v3/notify.js — P7 POPUP PURGE (SEASON2 only): WHAT the season tells the player, and through which EDGE.
//
// Andy (SEASON2-QUEUE P7): "remove every centre-screen popup and every menu claim notification (incl. 'claimed wins'
// toasts). Rank-ups pay nothing (status only, shown via the KitLevelUp top-edge banner). Unlocks = edge toasts.
// Gains = motion on the bar/counters. Achievements page is the only claim place."
//
//   rank-up  (v3 rank KEYMASH … ENDGAME, by rebirths then ★) → the top-edge RANK-UP banner. Pays nothing.
//   unlock   (a rebirth unlock, a new frame, a mark rank, an automation buy, a bought item, a first-time tip)
//            → a RIGHT-edge toast.
//   gain     (wins / gems / XP) → no announcement here: the menu's pills count up (MenuXpBar useCountUp + "+N").
//   claim    → only on the ACHIEVEMENTS screen. Nothing here pays or asks to be claimed.
//
// The PURE half (rankNews / unlockNews / checkNews with an injected store) is unit-tested; the menu's S2Notify reads
// checkNews() once per menu visit. Lives in the v3 chunk — the live game never downloads it.
import { RANKS_V3, rankIndexV3 } from './ranks.js';
import { UNLOCKS, unlocked } from './unlocks.js';
import { S2_PREFIX, s2Rebirths, getStarsV3, bestRankIndex } from './store.js';

export const RANK_SHOWN_KEY = `${S2_PREFIX}rankShown`; // the rank index the player has SEEN announced
export const UNLOCKS_SHOWN_KEY = `${S2_PREFIX}unlocksShown`; // the unlock ids already toasted

// Toast look per rebirth unlock (KitLevelUp UNLOCKS: tile colour; icon from the kit's 21).
export const UNLOCK_TOAST = {
  rollScreen: { tile: '#FFC23D', icon: 'roll' },
  autoRoll: { tile: '#2EFFE0', icon: 'roll' },
  autoRebirth: { tile: '#FF3D7F', icon: 'rebirth' },
  mark2: { tile: '#B04BFF', icon: 'index', badge: '2' },
  luck: { tile: '#12A99A', icon: 'luck' },
  ascend: { tile: '#FFE94A', icon: 'ascend' },
};

/** PURE: the banner payload when the rank rose from index `seen` to `now` (null otherwise — ranks never drop). */
export function rankNews(seen, now) {
  if (!Number.isFinite(seen) || !Number.isFinite(now) || now <= seen) return null;
  const a = RANKS_V3[Math.max(0, Math.min(RANKS_V3.length - 1, seen))];
  const b = RANKS_V3[Math.max(0, Math.min(RANKS_V3.length - 1, now))];
  return { from: { name: a.name, req: a.req }, to: { name: b.name, req: b.req } };
}

/** PURE: the toasts for unlocks open in `state` that are not in `shown` (in ladder order). */
export function unlockNews(shown, state) {
  const seen = new Set(shown || []);
  // a start feature (at 0 — ROLL + INDEX) is never news
  return UNLOCKS.filter((u) => u.at > 0 && !seen.has(u.id) && unlocked(u.id, state)).map((u) => ({
    id: u.id,
    code: `R${u.at}`,
    label: u.label,
    ...(UNLOCK_TOAST[u.id] || {}),
  }));
}

const memStore = () => (typeof localStorage !== 'undefined' ? localStorage : null);
function readJson(st, k, fb) {
  try {
    const v = st && st.getItem(k);
    return v == null ? fb : JSON.parse(v);
  } catch {
    return fb;
  }
}
function write(st, k, v) {
  try {
    if (st) st.setItem(k, JSON.stringify(v));
  } catch {
    /* blocked storage: the news simply shows again next visit */
  }
}

/**
 * What the menu should say on this visit: { rank: banner|null, unlocks: toast[] }, and mark it said. The FIRST
 * run on a season save notes the current state silently (a save never "unlocks" what it already had).
 * @param {{ state?: { rebirths:number, stars:number }, best?: number, store?: Storage }} [o]
 */
export function checkNews(o = {}) {
  const st = o.store !== undefined ? o.store : memStore();
  const state = o.state || { rebirths: s2Rebirths(), stars: getStarsV3() };
  const now = Math.max(rankIndexV3(state), Number.isFinite(o.best) ? o.best : bestRankIndex());
  const seen = readJson(st, RANK_SHOWN_KEY, null);
  const shown = readJson(st, UNLOCKS_SHOWN_KEY, null);
  const first = seen == null && shown == null;
  const rank = first ? null : rankNews(Number(seen) || 0, now);
  const fresh = unlockNews(Array.isArray(shown) ? shown : [], state);
  write(st, RANK_SHOWN_KEY, Math.max(now, Number(seen) || 0));
  write(st, UNLOCKS_SHOWN_KEY, [...(Array.isArray(shown) ? shown : []), ...fresh.map((u) => u.id)]);
  return { rank, unlocks: first ? [] : fresh };
}

// ---- the menu fx (MenuXpFx) in season 2 ----------------------------------------------------------------------------
// MenuXpFx's imperative handle goes through V3.fx(api) with the flag on. Every CENTRE card it can play is replaced:
//   celebrate (LEVEL N card)        → nothing in the middle: the bar wraps and its LV ticks (the gain IS the bar)
//   tierUp (NEW FRAME card)         → a right-edge toast
//   announce (mark rank / AUTOMATION) → a right-edge toast
//   rebirthCelebration / rebirthRush → nothing (the REBIRTH screen already slammed; the rank banner says the status)
//   winsStamp ("+N WINS" stamp)      → nothing: the wins pill counts up with its own "+N" (MenuXpBar)
//   winsHint (first-wins explainer)  → nothing (season 2's wins only buy POWER; the SHOP says so)
// Letter pops, tap pops and edge pulses (the per-keystroke gain motion) are untouched.
/** @param {object} api MenuXpFx's handle  @param {(t:object)=>void} toast */
export function wrapFx(api, toast) {
  const none = () => {};
  return {
    ...api,
    celebrate: none,
    rebirthCelebration: none,
    rebirthRush: none,
    winsStamp: none,
    winsHint: none,
    milestoneBusyMs: () => 0,
    tierUp: (name) => toast({ code: 'FRAME', label: `${name} FRAME`, tile: '#FFE94A', icon: 'levels' }),
    announce: (title, sub = '') => toast({ head: sub || 'UNLOCKED', label: title, tile: '#B04BFF', icon: /AUTOMATION/.test(title) ? 'power' : 'index' }),
  };
}
