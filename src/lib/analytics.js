// src/lib/analytics.js
// Isolated, fire-and-forget product analytics (PostHog) + error monitoring
// (Sentry) for the frontend. Hard guarantees:
//  - Nothing here can throw into render or gameplay: init + track are try/caught,
//    and posthog's send is non-blocking (never awaited).
//  - With no env key, every function is a silent no-op, so the app behaves
//    identically with or without analytics configured.
// Exports initAnalytics / initSentry / track, plus the Sentry namespace so the
// app root can wrap itself in Sentry.ErrorBoundary (the boundary helper in the
// installed @sentry/react v10 API).
// posthog is loaded LAZILY inside initAnalytics (deferred to idle after first paint by
// main.jsx) so its ~207KB chunk never blocks interactivity. Sentry stays EAGER — its
// ErrorBoundary must be present at mount to catch a render crash — and is exported below.
import * as Sentry from '@sentry/react';

export { Sentry };

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

export function initSentry() {
  try {
    const dsn = import.meta.env.VITE_SENTRY_DSN;
    if (!dsn) return; // no DSN -> dormant; ErrorBoundary still renders its fallback
    Sentry.init({ dsn });
  } catch {
    // monitoring init must never affect the app
  }
}

// Report an otherwise-SWALLOWED degradation (a storage-quota failure, an audio-context
// failure, a terminal WS give-up) to Sentry — the paths that are try/caught for graceful
// degradation and would otherwise be invisible. Guarantees:
//  - PII-SAFE: never sends the original error message (it can carry user text / typed words);
//    only a static `swallowed:<tag>` label + the error CLASS/code as tags.
//  - Deduped once per tag per session so a repeating failure can't flood Sentry.
//  - No-op when Sentry is dormant (no DSN) and never throws into the app.
const _reportedTags = new Set();
export function reportError(tag, err) {
  try {
    if (_reportedTags.has(tag)) return;
    _reportedTags.add(tag);
    Sentry.captureMessage(`swallowed:${tag}`, {
      level: 'warning',
      tags: {
        swallowed: tag,
        errName: (err && err.name) || 'Error',
        errCode: String((err && (err.code ?? err.name)) || '').slice(0, 40),
      },
    });
  } catch {
    // reporting a swallowed error must itself never affect the app
  }
}

// Fire-and-forget a named product event. No-op until posthog is initialized,
// never awaits, never throws. Callers pass enums/counts only (no PII).
export function track(event, props = {}) {
  try {
    if (!posthogReady) return;
    posthog.capture(event, props);
  } catch {
    // a failed capture can never bubble into gameplay
  }
}
