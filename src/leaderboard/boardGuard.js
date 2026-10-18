// boardGuard.js — SECOND DEVICE (Andy oct17: "when you log into a new device with the same account it resets account …
// leaderboard is as if it reset"). A board name is a device SECRET that every device holding it shares, while the save is
// per browser. A device whose save is BEHIND the shared row (a fresh device, a wiped browser with no cloud copy yet) must
// not push: 029/039's season-2 write took a lower push as a RESET, so the account looked wiped on every device.
// 054_no_lower_board_writes.sql refuses such a write on the server too; this keeps a current client from sending it.
// Pure (no DOM, no fetch): client.js submitStats asks it once a page load.

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
