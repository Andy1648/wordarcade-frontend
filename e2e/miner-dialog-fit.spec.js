// e2e/miner-dialog-fit.spec.js — the MINER mode dialog's example card fits its box (oct29 overlap audit item 7: on a
// phone "THE RAREST PIZZA TOPPING" was cut at the right edge and TRUFFLE ran 11-23px out of .mode-ex).
import { test, expect } from '@playwright/test';
import { bootMenu } from './support/screens.js';
import { revealMode } from './support/menu.js';

const SHOTS = process.env.LB_SHOTS || '';

for (const [w, h] of [[390, 844], [360, 640], [1366, 768]]) {
  test(`MINER dialog example @ ${w}x${h}: the prompt and every ore word stay inside the example card`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await bootMenu(page, 40);
    await (await revealMode(page, 'miner')).click({ force: true });
    const ex = page.locator('.mode-ex').first();
    await ex.waitFor({ state: 'visible' });
    await page.waitForTimeout(500);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/miner-dialog-${w}.png` });
    const spill = await ex.evaluate((card) => {
      // the card's CONTENT box (inside its padding + border): text past it reads as cut off
      const r = card.getBoundingClientRect(); const cs = getComputedStyle(card);
      const cb = { left: r.left + parseFloat(cs.borderLeftWidth) + parseFloat(cs.paddingLeft), right: r.right - parseFloat(cs.borderRightWidth) - parseFloat(cs.paddingRight) };
      // only what is drawn: a short screen (< 700px tall) hides the example lines on purpose (ModeDialog.css)
      return [...card.querySelectorAll('.mode-ex-word, .mode-ex-ore-w')].filter((el) => el.getClientRects().length > 0).flatMap((el) => {
        const b = el.getBoundingClientRect();
        return b.left < cb.left - 1 || b.right > cb.right + 1 ? [`${el.className}: ${el.textContent} (${Math.round(b.right - cb.right)}px over)`] : [];
      });
    });
    expect(spill).toEqual([]);
  });
}
