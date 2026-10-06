import { menuReady } from './menu.js';
// e2e/support/backendMock.js
//
// The app opens ONE hardcoded WebSocket to the live Render backend
// (src/config.js: wss://chain-reaction-backend-*.onrender.com) the instant it
// mounts. In E2E we must NOT talk to that server, so every test intercepts the
// socket with page.routeWebSocket and lets Playwright act as the server (we
// never call connectToServer, so no bytes ever reach production).
//
// The same intercept is our test boundary: `installBackendMock` returns a handle
// that records the connection attempt and every frame the app SENDS, so a test
// can drive a flow up to the WebSocket edge and assert the attempt was made
// (task requirement) without standing up a real game server.
//
// It also blocks all non-localhost HTTP (analytics, umami, Sentry,
// PostHog, Google Fonts, Vercel beacons) so runs are hermetic and deterministic
// and can never reach out to production infrastructure. The app fails open on
// all of these, so blocking them changes nothing the tests care about.

const BACKEND_WS_RE = /onrender\.com/;

/**
 * REDUCE MOTION MIRROR. The app no longer reads the OS `prefers-reduced-motion` setting — reduce
 * motion is an in-game toggle stored at localStorage `taw.reduceMotion` (src/lib/reduceMotion.js),
 * because managed school Chromebooks force the OS setting on. But this SUITE relies on calm motion:
 * playwright.config.js emulates `reducedMotion: 'reduce'`, and dozens of specs assume that stills
 * the decorative loops. So the harness mirrors the EMULATED media query into the toggle: while the
 * page matches `(prefers-reduced-motion: reduce)` and the key is absent, it seeds `'1'`; a spec that
 * opts into `no-preference` (test.use or page.emulateMedia) gets motion back, live. Every existing
 * spec therefore sees exactly the motion it saw when the app followed the OS.
 *
 * It only ever touches a value IT wrote (remembered in sessionStorage), so a spec that sets the key
 * itself, or a click on the in-game toggle, always wins. Idempotent per page.
 * `installBackendMock(page, { seedReduceMotion: false })` skips it (e2e/reduce-motion-toggle.spec.js).
 *
 * @param {import('@playwright/test').Page} page
 */
export async function mirrorReduceMotion(page) {
  if (page.__tawReduceMotionMirror) return;
  page.__tawReduceMotionMirror = true;
  await page.addInitScript(() => {
    const KEY = 'taw.reduceMotion';
    const OWN = 'taw.e2e.reduceMotionMirror'; // the value the mirror last wrote
    let mq;
    try {
      mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    } catch {
      return;
    }
    const sync = () => {
      try {
        const cur = localStorage.getItem(KEY);
        const mine = sessionStorage.getItem(OWN);
        if (cur !== null && cur !== mine) return false; // set by the spec / the toggle — leave it
        if (mq.matches) {
          if (cur === '1') return false;
          localStorage.setItem(KEY, '1');
          sessionStorage.setItem(OWN, '1');
          return true;
        }
        sessionStorage.removeItem(OWN);
        if (cur === null) return false;
        localStorage.removeItem(KEY);
        return true;
      } catch {
        return false;
      }
    };
    sync();
    // A spec's own init script may localStorage.clear() before seeding — re-seed after it.
    try {
      const clear = Storage.prototype.clear;
      Storage.prototype.clear = function clearKeepReduceMotionMirror() {
        clear.call(this);
        if (this === window.localStorage) {
          try {
            sessionStorage.removeItem(OWN);
          } catch {
            /* ignore */
          }
          sync();
        }
      };
    } catch {
      /* no Storage */
    }
    // page.emulateMedia mid-test: follow it live (the app listens for `storage`, like a second tab).
    const onChange = () => {
      if (!sync()) return;
      try {
        window.dispatchEvent(new StorageEvent('storage', { key: KEY, newValue: localStorage.getItem(KEY) }));
      } catch {
        /* ignore */
      }
    };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
  });
}

/**
 * Install the WebSocket intercept + external-network block. Call this BEFORE
 * page.goto so it is in place when the app opens its socket on mount.
 *
 * @param {import('@playwright/test').Page} page
 * @param {object} [opts]
 * @param {boolean} [opts.autoConnect=true] - send a `connected` frame on open so
 *   the app's wsStatus flips to 'open' (matching a real backend handshake), which
 *   is what unblocks the connect-gated CREATE / JOIN buttons on the menu.
 * @param {boolean} [opts.seedReduceMotion=true] - mirror the emulated prefers-reduced-motion into
 *   the in-game REDUCE MOTION toggle (see mirrorReduceMotion). false = the app's real default (motion ON).
 * @param {number} [opts.openDelayMs=0] - hold the socket in the 'connecting' state
 *   for this long before it opens (awaited inside the route handler, which delays
 *   the client's `onopen`). Simulates a cold Render backend so a test can observe
 *   the app's CONNECTING… / WAKING THE SERVER… copy before the queued action fires.
 * @returns {Promise<{
 *   connectionAttempts: () => number,
 *   sentFrames: () => Array<object|string>,
 *   sentTypes: () => string[],
 *   waitForSent: (type: string, timeoutMs?: number) => Promise<object>,
 *   pushToClient: (frame: object) => void,
 * }>}
 */
export async function installBackendMock(page, opts = {}) {
  const { autoConnect = true, openDelayMs = 0, newTutorials = false, seedReduceMotion = true } = opts;

  // Mirror the emulated prefers-reduced-motion into the in-game REDUCE MOTION toggle (see above).
  if (seedReduceMotion) await mirrorReduceMotion(page);

  // SPOTLIGHT TUTORIALS: the KEY TIER spotlight covers the SHOP the first time a KEY tier is affordable, and
  // the GEMS one covers the menu the first time the gem count shows — every shop / menu spec that seeds wins
  // would meet them. Mark both seen unless a spec asks for them (opts.newTutorials). (The old pv10 notice
  // tutorial is gone; its flag is still set so an old save in a spec reads exactly as before.)
  // A spec that wipes storage in its OWN init script (`localStorage.clear()` before seeding — menu-no-free-wins,
  // claims-via-stats, wins-live …) runs AFTER this one and used to wipe these flags too: the GEMS spotlight then
  // covered the menu and swallowed the spec's first click. So the flags are re-applied after every clear().
  if (!newTutorials) {
    await page.addInitScript(() => {
      const seen = () => {
        try {
          localStorage.setItem('taw.tut.pv10', '1');
          localStorage.setItem('taw.tut.keyTier', '1');
          localStorage.setItem('taw.tut.gems', '1');
        } catch {
          /* storage blocked */
        }
      };
      seen();
      try {
        const clear = Storage.prototype.clear;
        Storage.prototype.clear = function clearKeepTutorialsSeen() {
          clear.call(this);
          if (this === window.localStorage) seen();
        };
      } catch {
        /* no Storage */
      }
    });
  }

  const state = {
    attempts: 0,
    sent: [], // parsed frames the app sent to the "server"
    routes: [], // live WebSocketRoute handles, for pushing frames to the client
  };

  // Block every non-localhost request so a test can never touch production and
  // third-party scripts can't add nondeterministic timing. WS is handled by
  // routeWebSocket below, not here, so this only governs HTTP(S).
  await page.route('**/*', (route) => {
    let host = '';
    try {
      host = new URL(route.request().url()).hostname;
    } catch {
      host = '';
    }
    if (host === 'localhost' || host === '127.0.0.1' || host === '') {
      return route.continue();
    }
    // The screenshot CAMERA (e2e-shots/, SHOT_FONTS=1) lets Google Fonts through: Bungee and
    // Space Mono load from there, and a frame without them is every heading in the cursive
    // fallback — a picture of a font failure, not of the app. Gates never set it.
    if (process.env.SHOT_FONTS && (host === 'fonts.googleapis.com' || host === 'fonts.gstatic.com')) {
      return route.continue();
    }
    return route.abort();
  });

  await page.routeWebSocket(BACKEND_WS_RE, async (ws) => {
    // A connection was attempted to the backend URL. We deliberately do NOT call
    // ws.connectToServer(), so Playwright answers as the server and the real
    // Render backend is never contacted.
    state.attempts += 1;
    state.routes.push(ws);

    ws.onMessage((message) => {
      // Frames are JSON { type, payload }; keep the raw string if it isn't JSON.
      try {
        state.sent.push(JSON.parse(message));
      } catch {
        state.sent.push(message);
      }
    });

    // Cold-backend simulation: awaiting here holds the route handler open, which
    // delays the client's `onopen` (and thus the app's wsStatus flip to 'open').
    if (openDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, openDelayMs));
    }

    if (autoConnect) {
      // Mirror the real server's first frame (server.js `connected`) so the app
      // learns its id and wsStatus becomes 'open'.
      ws.send(JSON.stringify({ type: 'connected', payload: { id: 'e2e-player' } }));
    }
  });

  return {
    connectionAttempts: () => state.attempts,
    sentFrames: () => state.sent.slice(),
    sentTypes: () => state.sent.map((f) => (f && typeof f === 'object' ? f.type : f)),
    /**
     * Wait until the app has sent a frame of `type`. The captured queue lives in
     * this Node closure (not the page), so we poll it here rather than with the
     * page-side page.waitForFunction. Returns the matching frame; throws on
     * timeout with the list of frames actually seen.
     */
    waitForSent: async (type, timeoutMs = 8000) => {
      const deadline = Date.now() + timeoutMs;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const hit = state.sent.find((f) => f && typeof f === 'object' && f.type === type);
        if (hit) return hit;
        if (Date.now() > deadline) {
          throw new Error(
            `Timed out waiting for the app to send a "${type}" frame. ` +
              `Saw: [${state.sent.map((f) => (f && f.type) || '?').join(', ')}]`,
          );
        }
        await page.waitForTimeout(50);
      }
    },
    pushToClient: (frame) => {
      for (const ws of state.routes) ws.send(JSON.stringify(frame));
    },
    // Simulate a dropped socket (school-wifi blip): close the live route(s). A subsequent
    // app reconnect re-fires routeWebSocket (a fresh route) and, with autoConnect, re-sends
    // `connected`, so the whole drop -> reconnect flow is exercisable in a test.
    dropClient: () => {
      const live = state.routes.slice();
      state.routes = [];
      for (const ws of live) {
        try {
          ws.close();
        } catch {
          /* already closed */
        }
      }
    },
  };
}

/**
 * Collapse all CSS animation/transition durations to ~0 so elements settle
 * instantly for Playwright's actionability (stability) checks. This app runs
 * perpetual idle bob/beat loops (e.g. the pack pills) that never come to rest;
 * even with prefers-reduced-motion emulation some ancestors keep nudging the
 * box sub-pixel. We use a near-zero duration (not `animation: none`) on purpose:
 * animations still COMPLETE and fire `animationend`, which PackPicker relies on
 * to clear its transient pop/squish classes. Injected only in test setup — the
 * app source is untouched — and never used by the full-intro test, which must
 * see the real boot animation.
 *
 * TRANSITIONS GO TO 0s, NOT 1ms. A `transition-duration` on `*` applies to every element's
 * `transition-property` — which defaults to `all`. So a 1ms duration did not shorten the app's
 * transitions, it INVENTED one on every property of every element, `zoom` included. The form
 * screens fit themselves with zoom (hooks/useFitZoom.js): the view wrapper's app-scale zoom flipping
 * to 1 and the box's own zoom writes became 1ms transitions, so the fit measured a mid-transition
 * box and walked 1.80 → 1.63 → … → 1.25 over ~10 frames instead of landing once (a real browser
 * lands on 1.25 in the first frame). Playwright's two-equal-frames "stable" check passed between
 * steps, the CONTINUE press and release straddled a step, and no click fired — the intermittent
 * websocket-boundary.spec.js:34 "no create_room frame" failure. 0s = no transition at all (the app
 * listens for no transitionend), which is what "frozen" means.
 *
 * @param {import('@playwright/test').Page} page
 */
export async function freezeAnimations(page) {
  await page.addStyleTag({
    content: `*, *::before, *::after {
      animation-duration: 1ms !important;
      animation-delay: 0ms !important;
      transition-duration: 0s !important;
      transition-delay: 0s !important;
    }`,
  });
}

/**
 * Navigate to the menu, skipping the intro chain via the app's OWN built-in
 * skip mechanism (?portal=1 — the same flag portal/iframe embeds use; see
 * App.jsx PORTAL_SKIP_INTRO). This is not a test-only hook: it is a shipped
 * code path, so using it keeps tests fast without adding any app affordance.
 * Idle animations are then frozen so the menu's live elements are clickable.
 *
 * @param {import('@playwright/test').Page} page
 */
export async function gotoMenu(page) {
  await mirrorReduceMotion(page); // no-op if installBackendMock already installed it
  await page.goto('/?portal=1');
  // The homepage wordmark is the menu's stable landmark.
  await menuReady(page);
  await freezeAnimations(page);
}
