// e2e/word-count.spec.js
//
// The lifetime "WORDS TYPED" odometer chip on the menu, and one real increment:
// an accepted Category Blitz answer_result (delivered by the backend mock) must
// advance the persisted wa_words total. The message is pushed through the same
// intercepted socket the app already listens on, so the App.jsx 'answer_result'
// handler — the real accept path — is what does the counting.
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
  test('the menu shows the WORDS TYPED chip', async ({ page }) => {
    await installBackendMock(page);
    await gotoMenu(page);
    await expect(page.locator('.wc-chip')).toBeVisible();
    // A brand-new device starts from zero — the accessible label carries the value
    // (the odometer's digit strips all contain 0-9, so text can't assert it).
    await expect(page.locator('.wc-chip')).toHaveAttribute('aria-label', '0 words typed');
  });

  test('an accepted answer_result advances the persisted total', async ({ page }) => {
    const mock = await installBackendMock(page);
    await gotoMenu(page);
    await expect(page.locator('.wc-chip')).toBeVisible();

    // Nothing counted yet on a fresh device.
    expect(await readTotal(page)).toBe(0);

    // The mock delivers an accepted Category Blitz answer over the live socket;
    // the real App.jsx handler counts it (accepted answers are always the local
    // player's own).
    mock.pushToClient({ type: 'answer_result', payload: { accepted: true, answer: 'CAT' } });

    await expect
      .poll(async () => readTotal(page), { timeout: 5000 })
      .toBe(1);

    // A rejected answer must NOT count.
    mock.pushToClient({ type: 'answer_result', payload: { accepted: false, answer: 'ZZZ', reason: 'not_in_category' } });
    // Give the frame time to be processed, then confirm the total held at 1.
    await page.waitForTimeout(200);
    expect(await readTotal(page)).toBe(1);
  });
});
