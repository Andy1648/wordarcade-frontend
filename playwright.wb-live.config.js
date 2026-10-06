// playwright.wb-live.config.js — the WORD BOMB live check (P9c PAUSE TO LEARN) against a REAL local backend.
// Separate from playwright.config.js on purpose: the main suite never opens a real socket. The build points the app
// at the local server with VITE_BACKEND_WS_URL (src/config.js). Own port (4181).
//   PORT=3101 node server.js   (in chain-reaction-backend)
//   WB_WS=ws://127.0.0.1:3101 WB_BACKEND_DIR=../chain-reaction-backend npx playwright test -c playwright.wb-live.config.js
import { defineConfig, devices } from '@playwright/test';

const PORT = 4181;

export default defineConfig({
  testDir: './e2e-live',
  testMatch: /word-bomb-.*-live\.spec\.js/,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  timeout: 180_000,
  use: { baseURL: `http://localhost:${PORT}`, ...devices['Desktop Chrome'] },
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    timeout: 180_000,
    reuseExistingServer: false,
    stdout: 'ignore',
    stderr: 'pipe',
    env: { VITE_BACKEND_WS_URL: process.env.WB_WS || 'ws://127.0.0.1:3101' },
  },
});
