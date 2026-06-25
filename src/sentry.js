// sentry.js
// Frontend error monitoring. Re-exports the Sentry namespace (so main.jsx can use
// Sentry.ErrorBoundary) and a graceful init: if VITE_SENTRY_DSN is undefined (local
// dev / preview without the DSN) init is a no-op and the SDK simply stays dormant —
// it never throws and never affects the app. Error-only config: no perf tracing or
// session replay overhead, and sendDefaultPii is off so no PII is attached.
import * as Sentry from '@sentry/react';

export { Sentry };

export function initSentry() {
  try {
    const dsn = import.meta.env.VITE_SENTRY_DSN;
    if (!dsn) return; // unset -> dormant, ErrorBoundary still renders its fallback
    Sentry.init({
      dsn,
      tracesSampleRate: 0, // errors only, no performance tracing
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0,
      sendDefaultPii: false,
    });
  } catch {
    // Monitoring failing to init must never affect the app.
  }
}
