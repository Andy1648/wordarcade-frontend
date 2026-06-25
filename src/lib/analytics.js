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
import posthog from 'posthog-js';
import * as Sentry from '@sentry/react';

export { Sentry };

let posthogReady = false;

export function initAnalytics() {
  try {
    const key = import.meta.env.VITE_POSTHOG_KEY;
    if (!key) return; // no key (local dev / unconfigured) -> silent no-op
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
