// src/lib/analytics.js
// Isolated, fire-and-forget product analytics (PostHog) + error monitoring
// (Sentry) for the frontend. Hard guarantees:
//  - Nothing here can throw into render or gameplay: init + track are try/caught,
//    and posthog's send is non-blocking (never awaited).
//  - With no env key, every function is a silent no-op, so the app behaves
//    identically with or without analytics configured.
// Exports initAnalytics / initSentry / captureException / track.
// BOTH third parties load LAZILY (perf/first-load): posthog inside initAnalytics, and
// @sentry/react inside initSentry — neither chunk is on the boot path. main.jsx calls both from
// one idle callback after window 'load'. Error boundaries are a plain React class
// (components/ErrorBoundary.js) that forwards through captureException(), which QUEUES until
// Sentry is up and then flushes — so a render crash before init is still reported.

let posthog = null;
let posthogReady = false;

export async function initAnalytics() {
  try {
    const key = import.meta.env.VITE_POSTHOG_KEY;
    if (!key) return; // no key (local dev / unconfigured) -> silent no-op
    const mod = await import('posthog-js'); // dynamic: its chunk is off the first-paint path
    posthog = mod.default;
    // REGION: US assumed. If the PostHog project is EU cloud, change api_host to
    // 'https://eu.i.posthog.com'.
    posthog.init(key, {
      api_host: 'https://us.i.posthog.com',
      autocapture: true,
      capture_pageview: true,
    });
    posthogReady = true;
  } catch {
    // analytics init must never affect the app
  }
}

// ---- Sentry (lazy) ----
let sentry = null; // the loaded @sentry/react module once initSentry has run with a DSN
const pending = []; // errors captured before Sentry was up — flushed on init, bounded
const PENDING_MAX = 20;
let testLoader = null; // node unit tests inject a fake module loader here (see the seam below)

function envDsn() {
  try {
    return import.meta.env && import.meta.env.VITE_SENTRY_DSN;
  } catch {
    return undefined;
  }
}

/**
 * Load + init Sentry (idle-deferred by main.jsx). `opts.dsn` overrides the env DSN (tests).
 * Without a DSN Sentry stays dormant and the pending queue is dropped (there is nothing to
 * send it to). Resolves when Sentry is up (or immediately when dormant); never rejects.
 */
export async function initSentry(opts = {}) {
  try {
    const dsn = opts.dsn !== undefined ? opts.dsn : envDsn();
    if (!dsn) {
      pending.length = 0;
      return;
    }
    // Lazy-load through ./sentryLazy.js, a two-export bridge, so @sentry/react is tree-shaken to
    // init + captureException (~90 KB raw) rather than the whole namespace (~490 KB), and still
    // lands in its own lazy chunk off the boot path.
    const { init, captureException: cap } = await (testLoader ? testLoader() : import('./sentryLazy.js'));
    init({ dsn });
    sentry = { captureException: cap };
    for (const e of pending.splice(0)) {
      try {
        cap(e);
      } catch {
        /* a failed replay never throws */
      }
    }
  } catch {
    // monitoring init must never affect the app
  }
}

/**
 * Report an error to Sentry. Forwards immediately once Sentry is initialised; before that it
 * QUEUES (bounded) so a crash between boot and init is not lost. `context` is Sentry's
 * CaptureContext (e.g. { tags: { screen } }). Never throws.
 */
export function captureException(err, context) {
  try {
    const e = err instanceof Error ? err : new Error(String(err));
    if (sentry) sentry.captureException(e, context);
    else if (pending.length < PENDING_MAX) pending.push(e);
  } catch {
    /* never throw into render / gameplay */
  }
}

/** Whether Sentry is loaded + initialised (read-only; for tests + diagnostics). */
export function sentryReady() {
  return sentry !== null;
}

// TEST SEAM (node unit tests only): inject a fake @sentry/react loader and reset state.
export function __setSentryLoaderForTests(fn) {
  testLoader = fn || null;
  sentry = null;
  pending.length = 0;
}

// Fire-and-forget a named product event to BOTH sinks (PostHog + GA4/gtag). No-op until a sink is
// ready, never awaits, never throws. Callers pass enums/counts only — NEVER PII, never keystroke
// content (see src/lib/events.js for the canonical event catalog + payload shapes).
export function track(event, props = {}) {
  try {
    if (posthogReady && posthog) posthog.capture(event, props);
  } catch { /* a failed capture can never bubble into gameplay */ }
  try {
    // GA4 (gtag.js is injected by main.jsx after load; a stub queues calls before then). Guarded —
    // absent if the tag is blocked or the stub was never installed.
    if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
      window.gtag('event', event, props);
    }
  } catch { /* GA send never affects gameplay */ }
}

// Fire an event AT MOST ONCE ever (localStorage-gated) — for milestones like first_visit /
// first_wins_earned. The gate is best-effort: a blocked store just means it may fire again.
export function trackOnce(event, storageKey, props = {}) {
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem(storageKey) === '1') return false;
    if (typeof localStorage !== 'undefined') localStorage.setItem(storageKey, '1');
  } catch { /* storage blocked — fall through and fire anyway */ }
  track(event, props);
  return true;
}

// Attach durable SESSION PROPERTIES so every subsequent event segments by progression stage. Sent to
// PostHog as super-properties (registered on the client) and to GA4 as user/config params. Counts
// only — no PII. Safe to call repeatedly (e.g. after a level-up / rebirth / streak day).
export function setSessionProps(props = {}) {
  try {
    if (posthogReady && posthog && typeof posthog.register === 'function') posthog.register(props);
  } catch { /* ignore */ }
  try {
    if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
      window.gtag('set', 'user_properties', props);
    }
  } catch { /* ignore */ }
}
