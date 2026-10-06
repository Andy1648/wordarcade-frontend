// v3/season2Boot.js — THE SEASON 2 RESET, CLIENT HALF (PROGRESSION v3 phase 4; 023_season2_reset.sql,
// claude/mockups/v2/Season2.dc.html). LAZY: v3/installUi.jsx starts it (SEASON2 only, after the v3 install, without
// blocking the first render) and parks the promise on V3.boot — client.js submitStats waits for it, so no board push
// ever carries a pre-wipe save. With the flag OFF this module is never loaded, and bootSeason2 returns at once anyway.
//
// ONCE lb_caps says season2_reset (the server reset ran):
//   1. WIPE: a browser whose save is not season 2 yet (raw taw.econ < 13 — season 1, or none at all) loses every taw.*
//      key — the season-1 ones AND any taw.s2.* (pre-launch testing) — EXCEPT the board identity (taw.lb.secret,
//      taw.lb.profile) and the settings (sound / music / volume / clack, REDUCE MOTION, theme, feature flags, the
//      tutorial "seen" marks). The wipe uses the RAW storage methods (v3 maps taw.xp → taw.s2.xp at the storage layer;
//      the season-1 key must really go). Then taw.econ = 13 and the welcome is PENDING. A browser that held a save
//      reloads once, so every module re-reads zeros.
//   2. WELCOME (once): with a board name, the server holds the gift — lb_season2_grant (peek) gives the gems and the old
//      R; already claimed (another device, a reload) → no welcome. COLLECT calls lb_season2_claim and credits the gems
//      (gemsCore grantGems) ONLY on ok. With NO board name (or a name made after the reset: no grant row) the gift is
//      the base 300, once, keyed by the local flag (+ a cookie mirror, so RESET ALL PROGRESS does not re-arm it).
import { SEASON2, V3 } from '../season.js';
import { LEADERBOARD_ENABLED, boardCaps, rpc as boardRpc, peekSecret, getMyProfile } from '../../leaderboard/client.js';
import { wipeProgressKeys } from '../../save/cloudSave.js';
import { grantGems, getGems } from '../gemsCore.js';
import { season2Gems, SEASON2_ECON } from '../../leaderboard/season2Rules.js';
import { rawStorage } from './hooks.js';

export const ECON_KEY = 'taw.econ';
export const WELCOME_KEY = 'taw.s2.welcome'; // { st: 'pending' | 'done', r, req }
export const WELCOME_COOKIE = 'taw_s2w';
/** Exact keys a season-2 wipe keeps: the board identity + the settings. */
export const KEEP_KEYS = [
  'taw.lb.secret', 'taw.lb.profile', // the claimed name + device secret
  'taw.reduceMotion', 'taw.theme', 'taw.themesRetired', // REDUCE MOTION, the equipped theme (and its one-time retire)
  'taw.audioVolume', 'taw.musicMuted', 'taw.sfxEvents', 'taw.clack', // sound
  'taw.chunkReload', // the stale-chunk reload guard (operational)
];
/** Key prefixes a wipe keeps: feature flags + the tutorial / "seen" marks (UI state, not progress). */
export const KEEP_PREFIXES = ['taw.flag.', 'taw.tut.', 'taw.seen'];
export const keepKey = (k) => KEEP_KEYS.includes(k) || KEEP_PREFIXES.some((p) => k.startsWith(p));

const int0 = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};

/** A save that is not season 2 yet (raw taw.econ < 13, or unstamped) is wiped once the server reset ran. */
export function needsSeason2Wipe(rawEcon) {
  const n = Number(rawEcon);
  return !(rawEcon != null && Number.isFinite(n) && n >= SEASON2_ECON);
}

/**
 * Wipe a pre-season-2 save. `raw` = rawStorage(localStorage) (unmapped methods). Returns
 * { removed, oldRebirths, hadSave } — hadSave = it held real progress (a reload is needed so modules re-read zeros).
 */
export function wipeForSeason2(raw, { newId = defaultId } = {}) {
  const oldRebirths = int0(raw.getItem('taw.rebirths')); // the season-1 count (unmapped), for the no-name welcome
  const econ = raw.getItem(ECON_KEY);
  let hadSave = econ != null;
  const keep = [];
  try {
    for (let i = 0; i < raw.length; i += 1) {
      const k = raw.key(i);
      if (!k || !k.startsWith('taw.')) continue;
      if (keepKey(k)) keep.push(k);
      else if (k.startsWith('taw.s2.') && k !== 'taw.s2.gems') hadSave = true; // pre-launch season-2 progress
    }
  } catch {
    /* blocked */
  }
  const removed = wipeProgressKeys(raw, keep);
  try {
    raw.setItem(ECON_KEY, String(SEASON2_ECON));
    raw.setItem(WELCOME_KEY, JSON.stringify({ st: 'pending', r: oldRebirths, req: newId() }));
  } catch {
    /* blocked */
  }
  return { removed, oldRebirths, hadSave };
}

function defaultId() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  const h = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0');
  return `${h()}${h()}-${h()}-4${h().slice(1)}-8${h().slice(1)}-${h()}${h()}${h()}`;
}

function cookieDone() {
  try {
    return new RegExp(`(?:^|;\\s*)${WELCOME_COOKIE}=1`).test(document.cookie);
  } catch {
    return false;
  }
}
function setCookieDone() {
  try {
    document.cookie = `${WELCOME_COOKIE}=1; max-age=${400 * 24 * 3600}; path=/; samesite=lax; secure`;
  } catch {
    /* no cookies */
  }
}

export function readWelcome(storage = globalThis.localStorage) {
  try {
    const o = JSON.parse(storage.getItem(WELCOME_KEY) || 'null');
    return o && typeof o === 'object' ? o : null;
  } catch {
    return null;
  }
}
export function markWelcomeDone(storage = globalThis.localStorage) {
  try {
    storage.setItem(WELCOME_KEY, JSON.stringify({ st: 'done' }));
  } catch {
    /* blocked */
  }
  setCookieDone();
}

/**
 * What the welcome shows, or null for none. Server-held gift (a name with a grant row): its gems + old R; claimed →
 * null (and the local flag is set). Local gift (no name / no grant row): the base 300, once (the cookie mirror too).
 * Throws when the server can't be asked (the welcome stays pending for the next boot).
 */
export async function planWelcome({ rpc = boardRpc, secret, hasProfile, storage = globalThis.localStorage, cookie = cookieDone } = {}) {
  const w = readWelcome(storage);
  if (!w || w.st !== 'pending') return null;
  if (hasProfile && secret) {
    const g = await rpc('lb_season2_grant', { p_secret: secret });
    if (g && g.found) {
      if (g.claimed) {
        markWelcomeDone(storage);
        return null;
      }
      return { server: true, gems: int0(g.gems), oldR: int0(g.rebirths), req: w.req || defaultId() };
    }
  }
  if (cookie()) {
    markWelcomeDone(storage);
    return null;
  }
  return { server: false, gems: season2Gems(0), oldR: int0(w.r), req: w.req || defaultId() };
}

/**
 * COLLECT. Server gift → lb_season2_claim (same request id on a retry); credits ONLY on ok (a replay of THIS request is
 * ok — its first answer was lost). Local gift → the base 300. The credit and the done flag land in the same tick.
 * Returns { ok, gems, reason? } — ok:false with reason 'claimed' credits nothing; a thrown call = { ok:false, retry:true }.
 */
export async function collectWelcome(plan, { rpc = boardRpc, secret, storage = globalThis.localStorage, grant = grantGems } = {}) {
  if (!plan) return { ok: false, reason: 'none', gems: 0 };
  const w = readWelcome(storage);
  if (w && w.st === 'done') return { ok: false, reason: 'claimed', gems: 0 };
  if (!plan.server) {
    grant(plan.gems, 'start', { detail: 'season2' });
    markWelcomeDone(storage);
    return { ok: true, gems: plan.gems };
  }
  let r;
  try {
    r = await rpc('lb_season2_claim', { p_secret: secret, p_request_id: plan.req });
  } catch {
    return { ok: false, retry: true, gems: 0 };
  }
  if (r && r.ok) {
    const g = int0(r.gems);
    grant(g, 'start', { detail: 'season2' });
    markWelcomeDone(storage);
    return { ok: true, gems: g };
  }
  if (r && (r.reason === 'claimed' || r.reason === 'no_grant')) {
    markWelcomeDone(storage);
    return { ok: false, reason: r.reason, gems: 0 };
  }
  return { ok: false, retry: true, gems: 0 };
}

/**
 * THE BOOT CHECK. Resolves true when the menu may carry on (board pushes allowed), false when it is reloading into the
 * wiped save. Never throws. `show(plan)` mounts the welcome (lazy — default: ../../components/Season2Welcome.jsx).
 */
export async function bootSeason2({
  season2 = SEASON2, enabled = LEADERBOARD_ENABLED, caps = boardCaps, storage = globalThis.localStorage,
  raw = null, reload = () => window.location.reload(), show = showWelcome, rpc = boardRpc,
} = {}) {
  if (!season2 || !enabled) return true;
  try {
    const c = await caps();
    if (!c || !c.season2Reset) return true; // the server reset has not run: phase-3 behaviour, nothing to do
    const r = raw || rawStorage(storage);
    if (needsSeason2Wipe(r.getItem(ECON_KEY))) {
      const out = wipeForSeason2(r);
      // blocked storage can't keep the stamp → never reload (that would loop)
      if (out.hadSave && r.getItem(ECON_KEY) === String(SEASON2_ECON)) {
        reload();
        return false;
      }
    }
    const secret = peekSecret();
    const plan = await planWelcome({ rpc, secret, hasProfile: !!getMyProfile(), storage });
    if (plan) show(plan, { rpc, secret, storage });
  } catch {
    /* offline / RPC missing: the welcome stays pending for the next boot */
  }
  return true;
}

let mounted = false;
/** Mount the welcome in its own root (a full-screen moment over the app; unmounts itself on PLAY). */
export function showWelcome(plan, ctx) {
  if (mounted || typeof document === 'undefined') return;
  mounted = true;
  Promise.all([import('react-dom/client'), import('react'), import('../../components/Season2Welcome.jsx')])
    .then(([RD, React, M]) => {
      const host = document.createElement('div');
      host.id = 's2-welcome-root';
      document.body.appendChild(host);
      const root = RD.createRoot(host);
      const close = () => {
        root.unmount();
        host.remove();
        mounted = false;
      };
      root.render(React.createElement(M.default, {
        plan,
        startWallet: getGems(),
        collect: () => collectWelcome(plan, ctx),
        onClose: close,
      }));
    })
    .catch(() => {
      mounted = false;
    });
}

// the boot handle client.js waits on (set by installUi.jsx)
export function startSeason2Boot() {
  if (!V3.boot) V3.boot = bootSeason2();
  return V3.boot;
}
