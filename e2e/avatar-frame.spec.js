// e2e/avatar-frame.spec.js — Andy oct26: "the worn frame goes round the hero portrait wherever it shows". The menu's
// profile plate face wears the round frame (AvatarFrame) when a frame is worn, stays the plain tile when none is, and
// swaps the moment you equip (kit.js writeKit → taw:kit-change). AVATAR_SHOTS=<dir> also writes one still per frame.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';

const SHOTS = process.env.AVATAR_SHOTS;
const FRAMES = ['frost', 'graffiti', 'flame', 'arcade', 'bomb', 'bolt', 'scholar', 'chain', 'defuser', 'jackpot'];

async function menuWith(page, frame, main = 'riot') {
  await installBackendMock(page);
  await page.addInitScript(([frame, main]) => {
    if (sessionStorage.getItem('avf.seeded')) return;
    sessionStorage.setItem('avf.seeded', '1');
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.main', main);
    if (frame) localStorage.setItem('taw.s2.kit', JSON.stringify({ own: [frame], frame, fx: null }));
  }, [frame, main]);
  await page.goto('/?portal=1&season2=1');
  await menuReady(page);
}

test('a worn frame goes round the menu profile face; the ring art loads', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await menuWith(page, 'frost');
  const avf = page.locator('[data-testid="profile-plate"] .avf[data-avf="frost"]');
  await expect(avf).toBeVisible();
  const ok = await avf.locator('.avf-ring').evaluate((img) => img.complete && img.naturalWidth > 0);
  expect(ok).toBe(true);
  const face = await avf.locator('.avf-face').evaluate((el) => getComputedStyle(el).borderRadius);
  expect(face).toBe('50%');
});

test('no frame worn: the plain tile face, no ring', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await menuWith(page, null);
  await expect(page.locator('[data-testid="profile-plate"] img.hp-profplate-face')).toBeVisible();
  await expect(page.locator('[data-testid="profile-plate"] .avf')).toHaveCount(0);
});

test('equipping a frame swaps the face without a reload', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await menuWith(page, null);
  await page.evaluate(() => {
    localStorage.setItem('taw.s2.kit', JSON.stringify({ own: ['flame'], frame: 'flame', fx: null }));
    window.dispatchEvent(new Event('taw:kit-change'));
  });
  await expect(page.locator('[data-testid="profile-plate"] .avf[data-avf="flame"]')).toBeVisible();
});

if (SHOTS) {
  test('shot customize', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await menuWith(page, 'flame', 'brawl');
    await page.waitForTimeout(2500);
    await page.locator('[data-testid="profile-plate"]').first().click();
    await page.locator('.pf-kit').first().click();
    await expect(page.locator('[data-testid="kit-picker"] .skp-avatar .avf-ring')).toBeVisible();
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${SHOTS}/customize.png` });
  });
  for (const [w, h] of [[1366, 768], [390, 844]]) {
    for (const id of FRAMES) {
      test(`shot ${id} ${w}`, async ({ page }) => {
        await page.setViewportSize({ width: w, height: h });
        await menuWith(page, id, ['riot', 'brawl', 'glitch', 'hype', 'hex'][FRAMES.indexOf(id) % 5]);
        const plate = page.locator('[data-testid="profile-plate"]').first();
        await expect(plate.locator('.avf-ring')).toBeVisible();
        await page.waitForFunction(() => [...document.querySelectorAll('.avf img')].every((i) => i.complete));
        await page.waitForTimeout(2500); // the intro's knife-split + wipe finish first
        const b = await plate.boundingBox();
        await page.screenshot({ path: `${SHOTS}/avf-${id}-${w}.png`, clip: { x: Math.max(0, b.x - 30), y: Math.max(0, b.y - 30), width: Math.min(w - Math.max(0, b.x - 30), b.width + 60), height: b.height + 60 } });
      });
    }
  }
}
