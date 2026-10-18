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
  if (n0(local.lifetimeWords) < n0(row.lifetime_words)) return true;
  if (row.lifetime_letters != null && n0(local.lifetimeLetters) < n0(row.lifetime_letters)) return true;
  return false;
}

/**
 * May this page load push? Reads my own season-2 row (`view` ?id=) and says no when the read fails or this browser is
 * behind it. ★ comes from the v3 store (0 before the install). Lazy-loaded by client.js submitStats; never throws.
 */
export async function pushAllowed({ base, headers, view, id, local }) {
  if (!id) return true; // no row to be behind
  try {
    const r = await fetch(`${base}/rest/v1/${view}?select=id,level,rebirths,lifetime_words,lifetime_letters,stars&id=eq.${encodeURIComponent(id)}`, { headers });
    if (!r.ok) return false;
    const row = (await r.json())[0] || null;
    let stars = 0;
    try { stars = (V3.store && V3.store.getStarsV3 && V3.store.getStarsV3()) || 0; } catch { stars = 0; }
    return !(row && behindBoard({ ...local, stars }, row));
  } catch {
    return false;
  }
}
