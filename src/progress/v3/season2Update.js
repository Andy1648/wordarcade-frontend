// v3/season2Update.js — THE SEASON 2 CONVERSION, SERVER HALF + THE UPDATE CARD (Andy oct6: no reset; 025_season2_convert.sql,
// claude/mockups/v2/Season2.dc.html restyled as "UPDATE"). LAZY: v3/installUi.jsx starts it (SEASON2 only, after the
// v3 install — whose convertLocal already converted this browser's save — without blocking the first render) and
// parks the promise on V3.boot: client.js submitStats waits for it, so the first season-2 board write carries the
// server-authoritative numbers.
//
//   1. SERVER (board players, once): when lb_caps says season2_convert (025 ran), lb_season2_conv gives MY row's
//      converted rebirths + ★ — authoritative. If the local conversion landed elsewhere (a stale local save, another
//      device) and this season-2 save is still exactly as converted (no play since), the local numbers move onto the
//      server's (POWER re-capped for the server's rebirths, the wallet re-capped) and the page reloads ONCE so every
//      module re-reads them. A save that has already moved on is left alone (022's first season-2 write then keeps the
//      server's rebirths at most). Offline / 025 not run → tried again next boot.
//   2. THE UPDATE CARD, once: a converted season-1 save whose card is pending (and not already shown on another device
//      — the server's seen flag — or on this browser before a RESET ALL PROGRESS — the cookie). Shows what's new and
//      the converted ★ / POWER. It is marked shown the moment it mounts (local flag + cookie + lb_season2_seen), so a
//      reload never shows it twice; PLAY closes it.
//   NOTHING here removes a key or a save. No gems, no gift.
import { SEASON2, V3 } from '../season.js';
import { LEADERBOARD_ENABLED, boardCaps, rpc as boardRpc, peekSecret, getMyProfile } from '../../leaderboard/client.js';
import { readConv, writeConv, writeS2Level, STARS_KEY_S2 } from './convertLocal.js';
import { powerFromKey, powerPrice } from './convert.js';
import { rawStorage, s2MapKey } from './hooks.js';

export const CARD_COOKIE = 'taw_s2u';

const int0 = (v) => {
  const n = Number(v);
  return v != null && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};

function cookieShown() {
  try {
    return new RegExp(`(?:^|;\\s*)${CARD_COOKIE}=1`).test(document.cookie);
  } catch {
    return false;
  }
}
function setCookieShown() {
  try {
    document.cookie = `${CARD_COOKIE}=1; max-age=${400 * 24 * 3600}; path=/; samesite=lax; secure`;
  } catch {
    /* no cookies */
  }
}

/**
 * Apply the server's converted { rebirths, stars } to a save that is still exactly as converted. PURE over `raw`.
 * Returns { conv, changed } — `conv` is the updated marker (srv: 1, server numbers recorded).
 */
export function applyServer(raw, conv, srv) {
  const out = { ...conv, srv: 1, server: { before: int0(srv.rebirths_before), rebirths: int0(srv.rebirths), stars: int0(srv.stars) } };
  if (srv.seen && out.st === 'pending') out.st = 'shown';
  const to = conv.to || {};
  const localR = int0(raw.getItem(s2MapKey('taw.rebirths')));
  const localS = int0(raw.getItem(STARS_KEY_S2));
  const localP = int0(raw.getItem(s2MapKey('taw.keytier')));
  const untouched = localR === int0(to.rebirths) && localS === int0(to.stars) && localP === int0(to.power);
  const R = int0(srv.rebirths);
  const S = int0(srv.stars);
  if (!untouched || (R === localR && S === localS)) return { conv: out, changed: false };
  const P = powerFromKey(conv.from ? conv.from.keyTier : 0, R);
  const wallet = int0(raw.getItem(s2MapKey('taw.wins')));
  const W = Math.min(wallet, powerPrice(P));
  raw.setItem(s2MapKey('taw.rebirths'), String(R));
  raw.setItem(STARS_KEY_S2, String(S));
  raw.setItem(s2MapKey('taw.keytier'), String(P));
  raw.setItem(s2MapKey('taw.wins'), String(W));
  try {
    const xp = JSON.parse(raw.getItem(s2MapKey('taw.xp')) || 'null');
    if (xp && typeof xp === 'object') writeS2Level(raw, xp.lv, xp.f, R);
  } catch {
    /* keep the level as it is */
  }
  out.to = { ...to, rebirths: R, stars: S, power: P, wins: W };
  return { conv: out, changed: true };
}

/** What the UPDATE card shows (null = no card). */
export function planCard(conv) {
  if (!conv || !conv.had || conv.st !== 'pending' || !conv.to) return null;
  const from = conv.from || {};
  const before = conv.server ? conv.server.before : int0(from.rebirths);
  return {
    before: { rebirths: before, keyTier: int0(from.keyTier) },
    after: { rebirths: int0(conv.to.rebirths), stars: int0(conv.to.stars), power: int0(conv.to.power), level: Math.max(1, int0(conv.to.level)) },
    starsAdded: Math.max(0, int0(conv.to.stars)),
  };
}

/** The card was shown: local flag + cookie + the server's seen flag (best effort). */
export function markShown(raw, { rpc = boardRpc, secret = null } = {}) {
  const conv = readConv(raw);
  if (conv) writeConv(raw, { ...conv, st: 'shown' });
  setCookieShown();
  if (secret) Promise.resolve().then(() => rpc('lb_season2_seen', { p_secret: secret })).catch(() => {});
}

/**
 * THE BOOT. Resolves true when board pushes may go ahead, false when it is reloading onto the server's numbers.
 * Never throws. `show(plan, ctx)` mounts the card (default: the lazy Season2Update.jsx).
 */
export async function bootSeason2Update({
  season2 = SEASON2, enabled = LEADERBOARD_ENABLED, caps = boardCaps, storage = globalThis.localStorage,
  rpc = boardRpc, reload = () => window.location.reload(), show = showUpdate, secret = null, hasProfile = null,
  cookie = cookieShown,
} = {}) {
  if (!season2) return true;
  try {
    const raw = rawStorage(storage);
    let conv = readConv(raw);
    if (!conv) return true;
    const sec = secret ?? peekSecret();
    const named = hasProfile ?? !!getMyProfile();
    if (conv.had && !conv.srv && enabled && named && sec) {
      try {
        const c = await caps();
        if (c && c.season2Convert) {
          const r = await rpc('lb_season2_conv', { p_secret: sec });
          if (r && r.found) {
            const out = applyServer(raw, conv, r);
            conv = out.conv;
            writeConv(raw, conv);
            if (out.changed) {
              reload();
              return false;
            }
          } else if (r && r.ran) {
            conv = { ...conv, srv: 1 }; // a season-2 row: nothing on the server to adopt
            writeConv(raw, conv);
          }
        }
      } catch {
        /* offline / RPC missing: the local numbers stand; asked again next boot */
      }
    }
    if (cookie() && conv.st === 'pending') {
      conv = { ...conv, st: 'shown' };
      writeConv(raw, conv);
    }
    const plan = planCard(conv);
    if (plan) show(plan, { raw, rpc, secret: named ? sec : null });
  } catch {
    /* blocked storage: no card */
  }
  return true;
}

let mounted = false;
/** Mount the UPDATE card in its own root (a full-screen moment over the menu; PLAY unmounts it). */
export function showUpdate(plan, ctx) {
  if (mounted || typeof document === 'undefined') return;
  mounted = true;
  Promise.all([import('react-dom/client'), import('react'), import('../../components/Season2Update.jsx')])
    .then(([RD, React, M]) => {
      const host = document.createElement('div');
      host.id = 's2-update-root';
      document.body.appendChild(host);
      const root = RD.createRoot(host);
      const close = () => {
        root.unmount();
        host.remove();
        mounted = false;
      };
      root.render(React.createElement(M.default, { plan, onClose: close }));
      markShown(ctx.raw, { rpc: ctx.rpc, secret: ctx.secret }); // SHOWN ONCE: marked the moment it is on screen
    })
    .catch(() => {
      mounted = false;
    });
}

// the boot handle client.js waits on (set by installUi.jsx)
export function startSeason2Update() {
  if (!V3.boot) V3.boot = bootSeason2Update();
  return V3.boot;
}
