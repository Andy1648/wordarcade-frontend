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
// It also blocks all non-localhost HTTP (analytics, gtag, umami, Sentry,
// PostHog, Google Fonts, Vercel beacons) so runs are hermetic and deterministic
// and can never reach out to production infrastructure. The app fails open on
// all of these, so blocking them changes nothing the tests care about.

const BACKEND_WS_RE = /onrender\.com/;

/**
 * Install the WebSocket intercept + external-network block. Call this BEFORE
 * page.goto so it is in place when the app opens its socket on mount.
 *
 * @param {import('@playwright/test').Page} page
 * @param {object} [opts]
 * @param {boolean} [opts.autoConnect=true] - send a `connected` frame on open so
 *   the app's wsStatus flips to 'open' (matching a real backend handshake), which
 *   is what unblocks the connect-gated CREATE / JOIN buttons on the menu.
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
  const { autoConnect = true, openDelayMs = 0 } = opts;

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
 * @param {import('@playwright/test').Page} page
 */
export async function freezeAnimations(page) {
  await page.addStyleTag({
    content: `*, *::before, *::after {
      animation-duration: 1ms !important;
      animation-delay: 0ms !important;
      transition-duration: 1ms !important;
      transition-delay: 0ms !important;
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
  await page.goto('/?portal=1');
  // The homepage wordmark is the menu's stable landmark.
  await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
  await freezeAnimations(page);
}
