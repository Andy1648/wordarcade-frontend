// flag.js — PAID GEMS' switch (default OFF). EAGER and tiny on purpose (payload ratchet): the menu reads it to decide
// whether to load the lazy pick-up (payReturn.js) at all, and a gem pill whether its "+" exists (GemsPlus).
//   ON in a build only with VITE_PAYMENTS_ON=1 (Vercel env; claude/payments-setup.md).
//   The e2e build (playwright.config.js sets VITE_PAYMENTS_E2E=1) also honours `?payments=1`, so one bundle can test the
//   panel both hidden and shown. A production build has no VITE_PAYMENTS_E2E, so that branch is always false.
import { flagOn } from '../lib/featureFlags.js';

export const PAYMENTS_ON =
  (import.meta.env && import.meta.env.VITE_PAYMENTS_ON) === '1' ||
  ((import.meta.env && import.meta.env.VITE_PAYMENTS_E2E) === '1' && flagOn('payments'));
