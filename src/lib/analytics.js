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

// Fire-and-forget a named product event to BOTH sinks (PostHog + GA4/gtag). No-op until a sink is
// ready, never awaits, never throws. Callers pass enums/counts only — NEVER PII, never keystroke
// content (see src/lib/events.js for the canonical event catalog + payload shapes).
export function track(event, props = {}) {
  try {
    if (posthogReady && posthog) posthog.capture(event, props);
  } catch { /* a failed capture can never bubble into gameplay */ }
  try {
    // GA4 (gtag.js is loaded in index.html). Guarded — absent on local/dev or if the tag is blocked.
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
