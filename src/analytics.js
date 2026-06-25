// analytics.js
// Thin, SAFE wrapper around PostHog product analytics. Two hard rules baked in:
//  1. It must NEVER block, delay, or throw into game code. init + every capture
//     is try/caught, and posthog-js's own send is non-blocking (queued/beacon).
//  2. No PII, no typed words, no message contents — autocapture/session-recording
//     are OFF, so the ONLY data sent is the named events + their explicit
//     enum/numeric props that App.jsx passes to track().
// If VITE_POSTHOG_KEY is undefined (e.g. local dev) init is a graceful no-op and
// track() silently does nothing, so the app behaves identically with or without it.
import posthog from 'posthog-js';

let ready = false;

export function initAnalytics() {
  try {
    const key = import.meta.env.VITE_POSTHOG_KEY;
    if (!key) return; // unset (local dev / preview without the key) -> no-op
    posthog.init(key, {
      api_host: 'https://us.i.posthog.com',
      autocapture: false, // never scrape DOM clicks / input text (no typed words)
      capture_pageview: true, // plain URL pageview only (no PII)
      capture_pageleave: false,
      disable_session_recording: true, // never record the screen
    });
    ready = true;
  } catch {
    // Analytics failing to init must never affect the app.
  }
}

// Fire-and-forget a named product event. Props are limited by the caller to
// enums/counts (see App.jsx) — never pass PII or word content here.
export function track(event, props) {
  try {
    if (!ready) return;
    posthog.capture(event, props || {});
  } catch {
    // A failed capture can never bubble into gameplay.
  }
}
