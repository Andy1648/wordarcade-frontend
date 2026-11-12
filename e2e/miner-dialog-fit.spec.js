// e2e/miner-dialog-fit.spec.js — the MINER mode dialog fits (oct29 overlap audit item 7 was its EXAMPLE card spilling the
// ore words; design audit nov2 #4 removed that card). Now: the painted art, the title, the hook and both buttons sit
// inside the dialog, the dialog inside the screen, and nothing in it overlaps or scrolls sideways.
import { test, expect } from '@playwright/test';
import { bootMenu } from './support/screens.js';
import { revealMode } from './support/menu.js';
import { layoutDefects } from './support/overlap.js';

const SHOTS = process.env.LB_SHOTS || '';

for (const [w, h] of [[390, 844], [360, 640], [1366, 768]]) {
  test(`MINER dialog @ ${w}x${h}: art, title, hook and buttons stay inside the dialog`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await bootMenu(page, 40);
    await (await revealMode(page, 'miner')).click({ force: true });
    const shell = page.locator('.mode-dialog-shell');
    await shell.waitFor({ state: 'visible' });
    await page.waitForTimeout(500);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/miner-dialog-${w}.png` });
    const spill = await shell.evaluate((card) => {
      const r = card.getBoundingClientRect();
      const out = [];
      for (const el of card.querySelectorAll('.mode-dialog-art, .mode-dialog-title, .mode-dialog-liner, .mode-dialog-btn')) {
        if (!el.getClientRects().length) continue;
        const b = el.getBoundingClientRect();
        if (b.left < r.left - 1 || b.right > r.right + 1 || b.top < r.top - 1 || b.bottom > r.bottom + 1) out.push(el.className.toString().split(' ')[0]);
      }
      if (r.top < 0 || r.bottom > innerHeight + 1 || r.left < 0 || r.right > innerWidth + 1) out.push('dialog off screen');
      return out;
    });
    expect(spill).toEqual([]);
    const d = await layoutDefects(page, { scope: '.mode-dialog-shell' });
    expect(d.overlaps).toEqual([]);
    expect(d.hscroll).toBe(false);
  });
}
