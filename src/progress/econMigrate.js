// econMigrate.js — the one-time save migration, now to PROGRESSION v11 (claude/econ-oct2/v11-spec.md).
//
// v11 (stamp 11): ONE fixed level curve (no KEY/rebirth power term) + modest level XP. The STORAGE SHAPE
// is unchanged ({lv, f, rc, v:10} + the taw.xpv10 shadow), so a v10 save needs NO rewrite: it keeps its
// level AND its fraction f — the bar sits at the same % under the new need(). Nobody loses a level; the
// board stays level-only. A pre-v10 (legacy-shaped) save is converted exactly as v10 did (below), gate
// and notice included. The stamp just moves 10 → 11 so a later migration can tell v11 browsers apart.
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
//   * A one-time notice ("ONE LEVEL CURVE FOR EVERYONE — YOU KEPT EVERY LEVEL", v11 copy) for a player who had progress.
// Safe to call on every boot: it runs again only when taw.xp is legacy-shaped AND the stamp is < 10
// (importSave removes the stamp when a restored blob has none, so a restored old save converts too).
import {
  saveProgress,
  saveRebirths,
  clearGrandfatheredGate,
  REBIRTH_GATE_BASE,
  REBIRTH_GATE_STEP,
  XP_KEY,
  ECON_STAMP_KEY,
  REBIRTH_GATE_KEY,
  isV10Shape,
  loadProgress,
  getRebirths,
  tableRebirthThreshold,
} from './xp.js';

export const ECON_VERSION_KEY = ECON_STAMP_KEY;
export const ECON_VERSION = 12; // REBIRTH RUSH (PROGRESSION FINAL) — see rebirthRushConvert below
export const ECON_VERSION_V10 = 10; // the stamp v10 wrote — the legacy conversion is skipped at/above it
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

// ---- REBIRTH RUSH (Andy oct3 20:08, PROGRESSION-FINAL.md "EXISTING PLAYERS") -----------------------------
// ONE-TIME, the same rule for everyone: a save at L ≥ 15 + 18R (its gate under the new rule) turns its levels into
// rebirths — +floor((L − gate) / 18) + 1 rebirths and back to LV1 (nobody loses progress: the new rebirths are
// worth ×5 each, forever). A save below its gate keeps its level and bar. The KEY tier NUMBER is kept (it reads on
// the new ladder) and resets at the next rebirth like everyone's. The run's peak level goes into taw.records first
// (mode unlocks read the peak), the old v10 one-time gate is dropped (one rule for everyone), and
// taw.rrnotice = N queues the "YOUR LEVELS BECAME +N REBIRTHS" moment.
export const RR_NOTICE_KEY = 'taw.rrnotice';
/** PURE: the conversion for a level / rebirth count → { rebirths, level, added }. */
export function rebirthRushConvert(level, rebirths) {
  const L = Number.isFinite(level) && level >= 1 ? Math.floor(level) : 1;
  const R = Number.isFinite(rebirths) && rebirths > 0 ? Math.floor(rebirths) : 0;
  const gate = REBIRTH_GATE_BASE + REBIRTH_GATE_STEP * R;
  if (L < gate) return { rebirths: R, level: L, added: 0 };
  const added = Math.floor((L - gate) / REBIRTH_GATE_STEP) + 1;
  return { rebirths: R + added, level: 1, added };
}
function applyRebirthRush() {
  const p = loadProgress();
  const rc = getRebirths();
  const c = rebirthRushConvert(p.level, rc);
  try {
    localStorage.removeItem(REBIRTH_GATE_KEY);
  } catch {
    /* blocked */
  }
  clearGrandfatheredGate();
  if (!c.added) return { added: 0 };
  try {
    const rec = JSON.parse(localStorage.getItem('taw.records') || 'null') || {};
    if (!(Number.isFinite(rec.maxLevel) && rec.maxLevel >= p.level)) {
      rec.maxLevel = p.level;
      localStorage.setItem('taw.records', JSON.stringify(rec));
    }
  } catch {
    /* corrupt records — the conversion still happens */
  }
  saveRebirths(c.rebirths);
  saveProgress({ level: 1, intoLevel: 0 });
  try {
    localStorage.setItem(RR_NOTICE_KEY, String(c.added));
    // The old v10 "you kept every level" notice is now untrue (the levels just became rebirths) — drop it so the
    // RR notice is the only moment this save gets.
    localStorage.removeItem(PV10_NOTICE_KEY);
  } catch {
    /* blocked */
  }
  return { added: c.added, from: { level: p.level, rebirths: rc }, to: { level: 1, rebirths: c.rebirths } };
}

/** The pending "YOUR LEVELS BECAME +N REBIRTHS" count (0 when none). */
export function rebirthRushNotice() {
  try {
    const n = Number(localStorage.getItem(RR_NOTICE_KEY));
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}
export function clearRebirthRushNotice() {
  try {
    localStorage.removeItem(RR_NOTICE_KEY);
  } catch {
    /* blocked */
  }
}

export function migrateEconomyV11() {
  // Rebirth Rush runs once per SAVE: keyed on the save's own taw.econ stamp (< 12), read BEFORE the shape step
  // bumps it — so a restored cloud blob from before Rebirth Rush (it carries its old stamp) converts too.
  let before = 0;
  try {
    before = Number(localStorage.getItem(ECON_VERSION_KEY)) || 0;
  } catch {
    /* blocked */
  }
  const v11 = migrateEconomyV11Shape();
  if (before >= ECON_VERSION) return v11;
  try {
    const hasSave = localStorage.getItem(XP_KEY) != null || getRebirths() > 0;
    const rr = hasSave ? applyRebirthRush() : { added: 0 };
    localStorage.setItem(ECON_VERSION_KEY, String(ECON_VERSION));
    return { ...v11, migrated: true, rebirthRush: rr };
  } catch {
    return v11; // storage blocked: nothing to convert
  }
}

function migrateEconomyV11Shape() {
  try {
    const stamp = Number(localStorage.getItem(ECON_VERSION_KEY));
    const raw = localStorage.getItem(XP_KEY);
    const parsed = parse(raw);
    const legacy = raw != null && parsed !== undefined && !isV10Shape(parsed);
    if (stamp >= ECON_VERSION_V10) {
      // Already v10 or v11: the shape is current. A legacy-shaped taw.xp here is a STALE write (an old
      // bundle): loadProgress keeps the shadow and rewrites it. No gate, no notice — handed out once.
      if (legacy) loadProgress();
      if (stamp < ECON_VERSION) localStorage.setItem(ECON_VERSION_KEY, String(ECON_VERSION));
      return { migrated: stamp < ECON_VERSION, converted: false };
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
/** @deprecated the v10 entry point — now runs the v11 migration (same conversion, stamp 11). */
export const migrateEconomyV10 = migrateEconomyV11;

/** The one-time v10 notice is pending (read by the tutorial host). */
export function pv10NoticePending() {
  try {
    return localStorage.getItem(PV10_NOTICE_KEY) === '1';
  } catch {
    return false;
  }
}
