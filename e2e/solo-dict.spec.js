// e2e/solo-dict.spec.js — the acceptance extension loads LAZILY, AFTER a run, never on route
// mount: opening CHAIN fetches the base word data (wordsData) but NOT the big extension chunk
// (wordsAcceptExt), so the ~423KB-brotli list can't delay the first game.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

test('CHAIN mount loads the base word data but NOT the acceptance extension chunk', async ({ page }) => {
  const requested = [];
  page.on('request', (r) => requested.push(r.url()));

  await installBackendMock(page);
  await page.goto('/?chain=1&portal=1');

  // The CHAIN screen mounts (its root is the stable landmark).
  await page.locator('.solo-root').waitFor({ state: 'visible', timeout: 15000 });
  // Give the base word-data chunk time to arrive and the engine to build.
  await page.waitForTimeout(2500);

  const hitExt = requested.filter((u) => /wordsAcceptExt/.test(u));
  const hitBase = requested.filter((u) => /wordsData/.test(u));

  // The base data loads on mount (the game needs it); the extension does NOT.
  expect(hitBase.length, 'base wordsData chunk should load on mount').toBeGreaterThan(0);
  expect(hitExt, `extension chunk must NOT load on mount (got: ${hitExt.join(', ')})`).toHaveLength(0);
});
