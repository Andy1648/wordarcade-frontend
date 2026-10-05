// rr-ready.spec.js — REBIRTH READY → ×5 FOREVER (Andy oct3: "never let a player miss that they can rebirth").
//   1. MENU: a save AT the gate (LV15 R0) shows the big CTA (desktop: under the level bar; phone: under the
//      LV strip) and lights the REBIRTH nav control; ONE tap rebirths (taw.rebirths 0 → 1, level → 1) and
//      plays the ceremony — no confirm step. CONTINUE lands on the menu with the REBIRTH 1 card.
//   2. MENU: a save one level under the gate (LV14) shows no CTA.
//   3. ROUND END: a CHAIN run ended at the gate shows the button FIRST on the death card; one tap leaves
//      through the card's own exit and goes straight into the ceremony.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';

const COPY = 'REBIRTH READY → ×5 FOREVER';

/** Seed ONCE per test (addInitScript re-runs on every navigation). */
async function seed(page, lv) {
  await page.addInitScript((level) => {
    try {
      if (sessionStorage.getItem('rr-ready.seeded')) return;
      sessionStorage.setItem('rr-ready.seeded', '1');
      localStorage.setItem('taw.seenMenu', '1');
      localStorage.setItem('taw.seenMenuSpotlight', '1');
      localStorage.setItem('taw.seenGameSpotlight', '1');
      localStorage.setItem('taw.chain.runs', '5');
      localStorage.setItem('taw.econ', '12'); // already on Rebirth Rush — no level→rebirth conversion
      localStorage.setItem('taw.xp', JSON.stringify({ lv: level, f: 0, rc: 0, v: 10 }));
    } catch { /* storage blocked — the assertions fail loudly */ }
  }, lv);
}

const savedLevel = (page) => page.evaluate(() => {
  try { return JSON.parse(localStorage.getItem('taw.xp') || '{}').lv; } catch { return null; }
});
const savedRebirths = (page) => page.evaluate(() => localStorage.getItem('taw.rebirths'));

for (const vp of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
  test(`menu: LV15 R0 shows the CTA and ONE tap rebirths into the ceremony @ ${vp.width}`, async ({ page }) => {
    await page.setViewportSize(vp);
    await installBackendMock(page);
    await seed(page, 15);
    await page.goto('/?portal=1');
    await menuReady(page);

    const cta = page.locator('[data-rr-ready]:visible');
    await expect(cta).toHaveCount(1);
    await expect(cta).toHaveText(COPY);
    // the existing REBIRTH nav control lights up too
    await expect(page.locator('.homepage-nav-btn.is-rebirth.is-ready, .hp-m-navbtn.is-rebirth.is-ready')).toHaveCount(1);

    await cta.click();
    // straight into the moment: the ceremony, no confirm step in between
    await expect(page.locator('.rbc-layer')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.shop-confirm-actions')).toHaveCount(0);
    await expect.poll(() => savedRebirths(page)).toBe('1');
    await expect.poll(() => savedLevel(page)).toBe(1);

    await page.locator('.rbc-continue').click();
    await menuReady(page);
    // R1 gate is LV33: the CTA is gone once the rebirth is done
    await expect(page.locator('[data-rr-ready]')).toHaveCount(0);
  });

  test(`menu: LV14 (one under the gate) shows no CTA @ ${vp.width}`, async ({ page }) => {
    await page.setViewportSize(vp);
    await installBackendMock(page);
    await seed(page, 14);
    await page.goto('/?portal=1');
    await menuReady(page);
    await page.waitForTimeout(600);
    await expect(page.locator('[data-rr-ready]')).toHaveCount(0);
    await expect(page.locator('.homepage-nav-btn.is-rebirth.is-ready, .hp-m-navbtn.is-rebirth.is-ready')).toHaveCount(0);
  });
}

test('CHAIN round end at the gate: the button is FIRST on the death card and goes straight into the rebirth', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await installBackendMock(page);
  await seed(page, 15);
  // soloms: the dev clock cap that ends the run in well under a second once armed (solo-exit.spec.js);
  // portal=1 keeps the query through App's URL canonicalisation.
  await page.goto('/?chain=1&soloms=350&portal=1');
  await page.locator('.solo-root:not(.is-loadstate)').waitFor({ state: 'visible', timeout: 20000 });
  const input = page.locator('.solo-root input').first();
  await input.waitFor({ state: 'visible' });
  await input.fill('a'); // arm the clock; the capped clock ends the run
  await page.locator('.solo-deathcard').waitFor({ state: 'visible', timeout: 10000 });

  const btn = page.locator('.solo-deathcard [data-rr-ready]');
  await expect(btn).toBeVisible();
  await expect(btn).toHaveText(COPY);
  // FIRST in the button group: it sits above RESTART
  const rr = await btn.boundingBox();
  const restart = await page.locator('.solo-deathcard .solo-restart').boundingBox();
  expect(rr && restart && rr.y < restart.y, 'REBIRTH READY sits above RESTART').toBe(true);

  await btn.click();
  await expect(page.locator('.rbc-layer')).toBeVisible({ timeout: 15000 });
  await expect.poll(() => savedRebirths(page)).toBe('1');
  await expect.poll(() => savedLevel(page)).toBe(1);
  await page.locator('.rbc-continue').click();
  await menuReady(page);
});
