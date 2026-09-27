// e2e/join-screens-fit.spec.js — fix/join-screens-scale: every CONTROL on the name-entry, join-by-code
// and room-lobby screens sits fully inside the viewport, at every window size we know players use.
//
// Measured on the preview at 1280x551 (a 1366 laptop at 125% scaling — Andy's real window): the
// name screen's CONTINUE ended at 558px on a 551px viewport, 7px clipped with nothing to scroll,
// because hooks/useFitZoom.js floored the zoom at 1 instead of bounding the box by the viewport.
// The same class of bug hid START GAME ~200px below a 390x844 phone's fold in an 8-player room.
//
// For every viewport x screen: each visible <button> and <input> has top >= 0 and
// bottom <= innerHeight. The real fonts are allowed through (the mock blocks every other host):
// Bungee is wider than the fallback, and a fit measured in the fallback proves nothing.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

const VIEWPORTS = [
  [1366, 625], [1920, 1080], [2560, 1440], [390, 844],
  [1280, 551], [1163, 501], [1280, 600],
];

async function boot(page, w, h) {
  await page.setViewportSize({ width: w, height: h });
  const mock = await installBackendMock(page);
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.continue());
  await page.addInitScript(() => {
    try {
      localStorage.setItem('taw.seenMenu', '1');
      localStorage.setItem('taw.seenMenuSpotlight', '1');
      localStorage.setItem('taw.seenGameSpotlight', '1');
      localStorage.setItem('taw.xp', JSON.stringify({ lv: 40, into: 0 }));
    } catch { /* storage blocked */ }
  });
  await page.goto('/?portal=1');
  const entry = w <= 480 ? '.hp-m-row--word-bomb' : '.game-card-magnet[data-game="word-bomb"] .game-card';
  await page.locator(entry).first().click();
  await page.locator('.mode-dialog-content').waitFor({ state: 'visible' });
  return mock;
}

async function settle(page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600); // useFitZoom's rAF-coalesced fit
}

/** Every visible control under `root` whose box leaves the viewport vertically. */
function controlsOutside(page, root) {
  return page.evaluate((root) => {
    const R = document.querySelector(root);
    if (!R) return [`missing ${root}`];
    const out = [];
    for (const el of R.querySelectorAll('button, input')) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const b = el.getBoundingClientRect();
      if (!b.width || !b.height) continue;
      if (b.top < 0 || b.bottom > window.innerHeight) {
        out.push(`${String(el.className).split(' ')[0] || el.tagName} top=${Math.round(b.top)} bottom=${Math.round(b.bottom)} vh=${window.innerHeight}`);
      }
    }
    return out;
  }, root);
}

const roster = (n) => Array.from({ length: n }, (_, i) => ({
  id: i ? `p${i}` : 'e2e-player',
  name: i ? `FRIEND${i}` : 'WordWizard99',
  lives: 3,
}));

for (const [w, h] of VIEWPORTS) {
  test(`name, room (2 + 8 players): every control inside ${w}x${h}`, async ({ page }) => {
    const mock = await boot(page, w, h);
    await page.locator('.mode-dialog-btn-create').click();
    await page.locator('.lobby-box').waitFor({ state: 'visible' });
    await settle(page);
    expect(await controlsOutside(page, '.lobby-wrap'), 'name screen').toEqual([]);

    await page.locator('#player-name-input').fill('WordWizard99');
    await page.locator('.lobby-continue-btn').click();
    await mock.waitForSent('create_room');
    for (const n of [2, 8]) {
      mock.pushToClient({
        type: 'room_update',
        payload: { code: 'ABCDE', gameType: 'word-bomb', hostId: 'e2e-player', difficultyKey: 'chill', players: roster(n) },
      });
      await page.locator('.room-box').waitFor({ state: 'visible' });
      await settle(page);
      expect(await controlsOutside(page, '.room-wrap'), `room, ${n} players`).toEqual([]);
    }
  });

  test(`join by code: every control inside ${w}x${h}`, async ({ page }) => {
    await boot(page, w, h);
    await page.locator('.mode-dialog-btn-join').click();
    await page.locator('.browser-box').waitFor({ state: 'visible' });
    await settle(page);
    expect(await controlsOutside(page, '.browser-wrap'), 'join screen').toEqual([]);
  });
}
