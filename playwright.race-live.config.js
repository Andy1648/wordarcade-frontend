// playwright.race-live.config.js — the WORD RACE live check against a REAL local backend.
// Separate from playwright.config.js on purpose: the main suite never opens a real socket, and
// this one exists to. Own port (4180) so it can never reuse a stale :4173 preview.
import { defineConfig, devices } from '@playwright/test';

const PORT = 4180;

export default defineConfig({
  testDir: './e2e-live',
  retries: 0,
  workers: 1,
  reporter: [['list']],
  timeout: 120_000,
  use: { baseURL: `http://localhost:${PORT}`, ...devices['Desktop Chrome'] },
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    timeout: 180_000,
    reuseExistingServer: false,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
