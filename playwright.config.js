// playwright.config.js
// E2E config for TYPE A WORD. Tests run against a LOCAL PRODUCTION PREVIEW build
// (`vite build` -> `vite preview`), never typeaword.com or the live Render
// backend. The single hardcoded backend WebSocket (config.js) is intercepted
// per-test with page.routeWebSocket (see e2e/support/backendMock.js), so no test
// ever opens a socket to production — the mock both blocks that and doubles as
// the "assert the attempt was made" boundary.
import { defineConfig, devices } from '@playwright/test';

const PORT = 4173; // vite preview's default port
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  // Each spec file already isolates its own state (fresh context per test), so
  // running them in parallel is safe and keeps the suite fast.
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // The suite is required to pass consistently with NO retries — a green run
  // here is a genuinely stable run, not a flaky test masked by a re-attempt.
  retries: 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  // Generous per-test ceiling: the full-intro test deliberately sits through the
  // real ~2.5s boot animation + splash + fight-card intro. Everything is waited
  // on by locator assertions, never fixed sleeps, so this is just a safety cap.
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    video: 'off',
    // This app runs constant idle animations on nearly everything (bob, beat
    // pulse, magnetic tilt), which never "settle" — Playwright's actionability
    // stability check would stall on them. The app fully honors
    // prefers-reduced-motion (DESIGN.md §4: mandatory on all idle/looping
    // motion), so emulating it kills the decorative loops and makes elements
    // stable, WITHOUT any arbitrary sleeps or forced clicks. Functional state
    // (selection, navigation) is unaffected. The full-intro test opts back into
    // real motion (see intro.spec.js) to exercise the genuine boot animation.
    reducedMotion: 'reduce',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      // The music test needs autoplay allowed (see the autoplay project below);
      // keep it out of the default project so it only runs where that flag is on.
      testIgnore: /repeat-visitor-music\.spec\.js/,
    },
    {
      // Playwright launch args are per-PROJECT, not per-spec, so the one spec that
      // must observe real <audio> playback gets its own project with autoplay
      // unblocked. Everything else runs in the default `chromium` project above.
      name: 'chromium-autoplay',
      testMatch: /repeat-visitor-music\.spec\.js/,
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] },
      },
    },
  ],
  // Build a fresh production bundle and serve it via `vite preview`. Locally we
  // reuse an already-running preview (fast iteration); CI always starts clean.
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: BASE_URL,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
