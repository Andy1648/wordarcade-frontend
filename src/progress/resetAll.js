// resetAll.js — RESET ALL PROGRESS, shared by SETTINGS (Andy oct11 "settings needs a reset function (for account)") and
// the season-1 Stats panel. Wipes every taw.* key (xp, level, wins, purchases, rebirths, gears, gems, lifetime stats)
// and hard-reloads so every screen re-reads zeros. With a claimed name it also resets the BOARD ROW and the CLOUD SAVE
// (client.selfReset → 014 lb_self_reset, the admin reset path) and keeps the name. Never throws; the reload fires unless the reset was aborted.
import { selfReset } from '../leaderboard/client';
import { keepKey } from './keepKeys.js'; // NOT v3/season2Boot.js — that lazy module re-prices the economy on import

// SETTINGS SURVIVE a reset (sound, music, REDUCE MOTION, theme, feature flags, tutorial / "seen" marks — season2Boot's
// keep list): the reset is for PROGRESS. The name + device secret stay selfReset's call (it drops them on purpose when
// the server can't reset the row, so the next boot can't restore the old cloud save).
const IDENTITY = new Set(['taw.lb.secret', 'taw.lb.profile']);
function snapshotSettings() {
  const out = [];
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k && keepKey(k) && !IDENTITY.has(k)) out.push([k, localStorage.getItem(k)]);
    }
  } catch { /* storage blocked */ }
  return out;
}
function restoreSettings(list) {
  try { for (const [k, v] of list) if (v != null) localStorage.setItem(k, v); } catch { /* storage blocked */ }
}

/** Resolves { aborted: true } — NOTHING wiped, no reload — when the player has a name and the server reset can't happen
 *  (offline): wiping anyway used to cost them the account (daan oct27). Otherwise wipes and reloads. Never throws. */
export async function resetAllProgress() {
  const settings = snapshotSettings();
  try {
    const r = await selfReset();
    if (r && r.aborted) return { aborted: true };
  } catch {
    try {
      const doomed = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const k = localStorage.key(i);
        if (k && k.startsWith('taw.') && !IDENTITY.has(k)) doomed.push(k);
      }
      doomed.forEach((k) => localStorage.removeItem(k));
    } catch {
      /* storage blocked — nothing to clear */
    }
  }
  restoreSettings(settings);
  try {
    window.location.reload();
  } catch {
    /* non-browser env — no-op */
  }
  return { aborted: false };
}
