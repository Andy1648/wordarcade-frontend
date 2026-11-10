// e2e/avatar-frame.spec.js — Andy oct26: "the worn frame goes round the hero portrait wherever it shows". The menu's
// profile plate face wears the square frame (AvatarFrame) when a frame is worn, stays the plain tile when none is, and
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

test('a worn frame goes round the menu profile face; its painted parts load', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await menuWith(page, 'frost');
  const avf = page.locator('[data-testid="profile-plate"] .avf[data-avf="frost"]');
  await expect(avf).toBeVisible();
  // nov9 frame kit: four bars + four corner caps + the frame's own props, every one a painted part that loads
  await expect(avf.locator('.avf-kit .avf-corner')).toHaveCount(4);
  await expect(avf.locator('.avf-kit .avf-bar')).toHaveCount(4);
  await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="profile-plate"] .avf-kit img')].every((i) => i.complete && i.naturalWidth > 0));
  // the clamp-on / prop acts are finite one-shots: nothing on the kit loops
  const looping = await avf.evaluate((el) => el.getAnimations({ subtree: true }).filter((a) => a.effect.getTiming().iterations === Infinity).length);
  expect(looping).toBe(0);
  const face = await avf.locator('.avf-face').evaluate((el) => getComputedStyle(el).borderRadius);
  expect(face).toBe('22%');
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
  for (const [w, h] of [[390, 844], [1366, 768], [1920, 1080]]) test(`shot customize ${w}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await menuWith(page, 'flame', 'brawl');
    await page.waitForTimeout(2500);
    await page.locator('[data-testid="profile-plate"]').first().click();
    await page.locator('.pf-kit').first().click();
    await page.locator('.cz-tab[data-cz="frame"]').click();
    await expect(page.locator('[data-testid="kit-plate-preview"] .avf-ring')).toBeVisible();
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${SHOTS}/customize-${w}.png` });
  });
  for (const [w, h] of [[1366, 768], [390, 844], [1920, 1080]]) {
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

test.describe('JACKPOT pays out', () => {
  test.use({ reducedMotion: 'no-preference' });
  test('three coins fly once on load and again on hover, finite, gone at rest; other frames have none', async ({ page }) => {
    await menuWith(page, 'jackpot');
    const coins = page.locator('.avf .avf-coin');
    await expect(coins).toHaveCount(3);
    const state = () => coins.evaluateAll((els) => ({
      inf: els.some((e) => e.getAnimations().some((a) => a.effect.getTiming().iterations === Infinity)),
      visible: els.filter((e) => Number(getComputedStyle(e).opacity) > 0.01).length,
    }));
    await expect.poll(async () => (await state()).visible, { timeout: 4000 }).toBe(0);
    expect((await state()).inf).toBe(false);
    await page.locator('.avf').first().hover();
    await expect.poll(async () => (await state()).visible, { timeout: 3000, intervals: [20] }).toBeGreaterThan(0);
    await expect.poll(async () => (await state()).visible, { timeout: 4000 }).toBe(0);
  });
  test('another frame carries no coins', async ({ page }) => {
    await menuWith(page, 'frost');
    await expect(page.locator('.avf')).toHaveCount(1);
    await expect(page.locator('.avf-coin')).toHaveCount(0);
  });
});

// AVATAR_ZOOM=<dir>: the 2x check (Andy nov9 "i can see the crop") — every frame's painted kit at deviceScaleFactor 2 on the
// menu plate and on the CUSTOMIZE try-on, cropped tight so a crop line or a seam would show.
const ZOOM = process.env.AVATAR_ZOOM;
if (ZOOM) {
  test.describe('zoom', () => {
    test.use({ deviceScaleFactor: 2 });
    for (const id of FRAMES) {
      test(`zoom ${id}`, async ({ page }) => {
        await page.setViewportSize({ width: 1366, height: 768 });
        await menuWith(page, id, ['riot', 'brawl', 'glitch', 'hype', 'hex'][FRAMES.indexOf(id) % 5]);
        const plate = page.locator('[data-testid="profile-plate"]').first();
        await page.waitForFunction(() => [...document.querySelectorAll('.avf img')].every((i) => i.complete));
        await page.waitForTimeout(2500);
        const b = await plate.boundingBox();
        await page.screenshot({ path: `${ZOOM}/plate-${id}.png`, clip: { x: Math.max(0, b.x - 24), y: Math.max(0, b.y - 24), width: Math.min(300, b.width + 48), height: b.height + 48 } });
        await plate.click();
        await page.locator('.pf-kit').first().click();
        await page.locator('.cz-tab[data-cz="frame"]').click();
        const prev = page.locator('[data-testid="kit-plate-preview"]').first();
        await expect(prev.locator('.avf-ring')).toBeVisible();
        await page.waitForTimeout(1000);
        const p = await prev.boundingBox();
        await page.screenshot({ path: `${ZOOM}/tryon-${id}.png`, clip: { x: Math.max(0, p.x - 24), y: Math.max(0, p.y - 24), width: p.width + 48, height: p.height + 48 } });
      });
    }
  });
}
