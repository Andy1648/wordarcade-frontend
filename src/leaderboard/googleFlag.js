// googleFlag.js — SIGN IN WITH GOOGLE's switch (default OFF), the same shape as payments/flag.js. EAGER and tiny: the
// boot's redirect pick-up (main.jsx), the menu's AuthLanding mount and every SIGN IN WITH GOOGLE button read it, so a
// build without the Google provider set up never shows a button that can't work.
//   ON in a build only with VITE_GOOGLE_ON=1 + VITE_GOOGLE_CLIENT_ID (Vercel env — the LAST step of claude/payments-setup.md
//   §1b, once the Google OAuth client + the Supabase provider + 085 are in). The e2e build (playwright.config.js VITE_GOOGLE_E2E=1) also
//   honours `?google=1`; a production build has no VITE_GOOGLE_E2E, so that branch is always false.
import { flagOn } from '../lib/featureFlags.js';

export const GOOGLE_ON =
  (import.meta.env && import.meta.env.VITE_GOOGLE_ON) === '1' ||
  ((import.meta.env && import.meta.env.VITE_GOOGLE_E2E) === '1' && flagOn('google'));
