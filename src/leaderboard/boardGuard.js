// boardGuard.js — SECOND DEVICE (Andy oct17: "when you log into a new device with the same account it resets account …
// leaderboard is as if it reset"). A board name is a device SECRET that every device holding it shares, while the save is
// per browser. A device whose save is BEHIND the shared row (a fresh device, a wiped browser with no cloud copy yet) must
// not push: 029/039's season-2 write took a lower push as a RESET, so the account looked wiped on every device.
// 054_no_lower_board_writes.sql refuses such a write on the server too; this keeps a current client from sending it.
// behindBoard is pure; pushAllowed (its row read) is what client.js submitStats lazy-loads once a page load.
import { V3 } from '../progress/season.js';

const n0 = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};

/**
 * True when this browser's numbers sit below its own board row in any way the server would read as a reset:
 * ★ → rebirths → level (the board's order), or fewer lifetime words / letters. `local` = myStats() + { stars };
 * `row` = the leaderboard_s2 row ({ stars, rebirths, level, lifetime_words, lifetime_letters }).
 */
export function behindBoard(local, row) {
  if (!local || !row) return false;
  const ls = n0(local.stars);
  const rs = n0(row.stars);
  if (ls !== rs) return ls < rs;
  const lr = n0(local.rebirths);
  const rr = n0(row.rebirths);
  if (lr !== rr) return lr < rr;
  if (Math.max(1, n0(local.level)) < Math.max(1, n0(row.level))) return true;
  // 057: fewer lifetime words / letters is NOT behind any more — the server merges those (the row keeps its higher
  // count). Blocking on them froze a restored device's pushes, and with them its rebirths (the B3 deadlock).
  return false;
}

/**
 * B3 (oct21 audit): the row's rebirths when it is AHEAD of this browser at the same ★ — a rebirth the server granted
 * (on another device, or one whose answer never applied here) is real, so the save adopts it instead of sitting behind
 * its own row forever (every push refused → the row's level stuck at the LV 1 its last rebirth left → lb_rebirth's
 * gate never met). Mirror of rebirthFlow.grantTarget: the save only ever goes UP. null = nothing to adopt.
 */
export function adoptRebirths(local, row) {
  if (!local || !row) return null;
  if (n0(local.stars) !== n0(row.stars)) return null;
  const rr = n0(row.rebirths);
  return rr > n0(local.rebirths) ? rr : null;
}

/**
 * May this page load push? Reads my own season-2 row (`view` ?id=) and says no when the read fails or this browser is
 * behind it. ★ comes from the v3 store (0 before the install). Lazy-loaded by client.js submitStats; never throws.
 */
export async function pushAllowed({ base, headers, view, id, local, adopt }) {
  if (!id) return true; // no row to be behind
  try {
    const r = await fetch(`${base}/rest/v1/${view}?select=id,level,rebirths,lifetime_words,lifetime_letters,stars&id=eq.${encodeURIComponent(id)}`, { headers });
    if (!r.ok) return false;
    const row = (await r.json())[0] || null;
    let stars = 0;
    try { stars = (V3.store && V3.store.getStarsV3 && V3.store.getStarsV3()) || 0; } catch { stars = 0; }
    const me = { ...local, stars };
    const rr = adoptRebirths(me, row);
    if (rr != null && typeof adopt === 'function') {
      try { adopt(rr); me.rebirths = rr; } catch { /* storage blocked: stay behind, push nothing */ }
    }
    return !(row && behindBoard(me, row));
  } catch {
    return false;
  }
}
