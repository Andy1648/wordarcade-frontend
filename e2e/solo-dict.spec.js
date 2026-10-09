// e2e/solo-dict.spec.js — the acceptance extension (Word Bomb parity, Andy oct8) loads DURING the
// first run but strictly AFTER the base word data: opening CHAIN fetches wordsData first, the game
// becomes playable on it, and only then is the big wordsAcceptExt chunk requested — so the ~437KB
// brotli list can never delay the first game, yet a fresh player's first run already accepts every
// word Word Bomb accepts (before, the extension waited for the first run to END).
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

test('CHAIN loads the base word data first, then the Word Bomb-parity extension during the first run', async ({ page }) => {
  const seen = []; // [kind, 'req' | 'done', t]
  const kind = (u) => (/wordsAcceptExt/.test(u) ? 'ext' : /wordsData/.test(u) ? 'base' : null);
  page.on('request', (r) => { const k = kind(r.url()); if (k) seen.push([k, 'req', Date.now()]); });
  page.on('requestfinished', (r) => { const k = kind(r.url()); if (k) seen.push([k, 'done', Date.now()]); });

  await installBackendMock(page);
  await page.goto('/?chain=1&portal=1');

  // The CHAIN screen mounts (its root is the stable landmark) and is playable on the base set.
  await page.locator('.solo-root:not(.is-loadstate)').waitFor({ state: 'visible', timeout: 15000 });
  await expect.poll(() => seen.some(([k, e]) => k === 'ext' && e === 'req'), { timeout: 15000 }).toBe(true);

  const baseDone = seen.find(([k, e]) => k === 'base' && e === 'done');
  const extReq = seen.find(([k, e]) => k === 'ext' && e === 'req');
  expect(baseDone, 'base wordsData chunk loads on mount').toBeTruthy();
  expect(extReq[2], 'the extension is requested only after the base data has arrived').toBeGreaterThanOrEqual(baseDone[2]);
});
