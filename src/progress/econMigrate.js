// econMigrate.js — the one-time save migration, now to PROGRESSION v10 (claude/econ-oct2/v10-spec.md).
//
// HISTORY: v9 (STEP 19) capped the spendable wins balance at MIGRATE_WINS_TIERS KEY prices. v10 DROPS
// that cap for every save (adversarial review #7 / must-fix 6): it was a LOSS that missed its target, and
// under the power-scaled curve a big balance no longer runs levels away. NOBODY LOSES WINS.
//
// v10, ONCE per browser, at module boot (main.jsx), before any UI reads XP:
//   * taw.xp is converted to {lv, f, rc, v:10} — the level is KEPT exactly and the bar keeps its fill
//     (f = into / needV9(lv), clamped, never zeroed). xp.js does the conversion (detected by SHAPE).
//   * KEPT exactly: level, rebirths, KEY tier, wins (balance + lifetime), marks, stars, everything else.
//   * GRANDFATHERED REBIRTH GATE (must-fix 5): a save that existed at migration time gets ONE gate for
//     its NEXT rebirth: min(table gate, current level + 25), stored in taw.rbgate, spent by doRebirth.
//   * A one-time notice ("LEVELS NOW TAKE LONGER — YOU KEPT EVERY LEVEL") for a player who had progress.
// Safe to call on every boot: it runs again only when taw.xp is legacy-shaped AND the stamp is < 10
// (importSave removes the stamp when a restored blob has none, so a restored old save converts too).
import {
  XP_KEY,
  ECON_STAMP_KEY,
  REBIRTH_GATE_KEY,
  isV10Shape,
  loadProgress,
  getRebirths,
  tableRebirthThreshold,
} from './xp.js';

export const ECON_VERSION_KEY = ECON_STAMP_KEY;
export const ECON_VERSION = 10;
export const PV10_GATE_GRACE_LEVELS = 25;
export const PV10_NOTICE_KEY = 'taw.pv10notice';

function parse(raw) {
  if (raw == null) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

export function migrateEconomyV10() {
  try {
    const stamp = Number(localStorage.getItem(ECON_VERSION_KEY));
    const raw = localStorage.getItem(XP_KEY);
    const parsed = parse(raw);
    const legacy = raw != null && parsed !== undefined && !isV10Shape(parsed);
    if (stamp >= ECON_VERSION) {
      // Already v10. A legacy-shaped taw.xp here is a STALE write (an old bundle): loadProgress keeps the
      // v10 shadow and rewrites it. No gate, no notice — those were handed out the first time.
      if (legacy) loadProgress();
      return { migrated: false };
    }
    let gate = null;
    let level = 1;
    if (legacy) {
      level = loadProgress().level; // converts + rewrites {lv, f, rc, v:10}
      const rc = getRebirths();
      const table = tableRebirthThreshold(rc);
      const g = Math.min(table, level + PV10_GATE_GRACE_LEVELS);
      if (g < table) {
        gate = { rc, lv: g };
        localStorage.setItem(REBIRTH_GATE_KEY, JSON.stringify(gate));
      }
      if (level > 1 || rc > 0) localStorage.setItem(PV10_NOTICE_KEY, '1');
    }
    localStorage.setItem(ECON_VERSION_KEY, String(ECON_VERSION));
    return { migrated: true, converted: legacy, level, gate };
  } catch {
    return { migrated: false }; // storage blocked: nothing persisted to migrate
  }
}

/** The one-time v10 notice is pending (read by the tutorial host). */
export function pv10NoticePending() {
  try {
    return localStorage.getItem(PV10_NOTICE_KEY) === '1';
  } catch {
    return false;
  }
}
