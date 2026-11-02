// playwright.miner-live.config.js — the opt-in MINER 3-device live check (e2e/miner-live.spec.js). No webServer: the
// backend + a build pointed at it are started by hand (see the spec header).
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: /miner-live\.spec\.js/,
  workers: 1,
  retries: 0,
  use: { browserName: 'chromium' },
});
