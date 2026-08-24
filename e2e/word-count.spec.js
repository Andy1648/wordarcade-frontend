// e2e/word-count.spec.js
//
// The lifetime "WORDS TYPED" total (wa_words). The on-menu odometer CHIP was removed
// (the XP bar took that space), but the underlying counter still runs: an accepted
// Category Blitz answer_result (delivered by the backend mock over the same intercepted
// socket the app already listens on) advances the persisted wa_words total via the real
// App.jsx 'answer_result' handler. This asserts that counting path, not any UI.
import { test, expect } from '@playwright/test';
import { installBackendMock, gotoMenu } from './support/backendMock.js';

const readTotal = (page) =>
  page.evaluate(() => {
    try {
      return JSON.parse(window.localStorage.getItem('wa_words')).total;
    } catch {
      return 0;
    }
  });

test.describe('words-typed counter', () => {
  test('an accepted answer_result advances the persisted total', async ({ page }) => {
    const mock = await installBackendMock(page);
    await gotoMenu(page);

    // Nothing counted yet on a fresh device.
    expect(await readTotal(page)).toBe(0);

    // The mock delivers an accepted Category Blitz answer over the live socket;
    // the real App.jsx handler counts it (accepted answers are always the local
    // player's own).
    mock.pushToClient({ type: 'answer_result', payload: { accepted: true, answer: 'CAT' } });

    await expect.poll(async () => readTotal(page), { timeout: 5000 }).toBe(1);

    // A rejected answer must NOT count.
    mock.pushToClient({ type: 'answer_result', payload: { accepted: false, answer: 'ZZZ', reason: 'not_in_category' } });
    // Give the frame time to be processed, then confirm the total held at 1.
    await page.waitForTimeout(200);
    expect(await readTotal(page)).toBe(1);
  });
});
