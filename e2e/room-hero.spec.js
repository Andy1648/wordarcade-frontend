// e2e/room-hero.spec.js — change your hero from the multiplayer room (oct18, Andy: "be able to change hero avatar while
// inside a multiplayer room … just the hero as a clickable icon"). YOUR seat shows your hero's face as a button (the
// other seats keep their colour dot); tapping opens the hero picker; picking equips it and the face updates. No room
// message is sent for it (local only).
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';

const ME = 'e2e-player';
const PLAYERS = [{ id: ME, name: 'ANDY', isHost: true }, { id: 'p2', name: 'KEYSMASH' }];
const OUT = 'claude/shots/room-hero';
const shot = async (page, n) => { if (process.env.SHOTS) { fs.mkdirSync(OUT, { recursive: true }); await page.screenshot({ path: `${OUT}/${n}.png` }); } };

for (const [vn, vp] of [['cb', { width: 1366, height: 768 }], ['phone', { width: 390, height: 844 }]]) {
  test(`room hero ${vn}: your seat's hero face opens the picker; picking equips it`, async ({ page }) => {
    await page.setViewportSize(vp);
    const mock = await installBackendMock(page);
    await page.addInitScript(() => {
      if (sessionStorage.getItem('rh.seeded')) return;
      sessionStorage.setItem('rh.seeded', '1');
      for (const [k, v] of Object.entries({ 'taw.seenMenu': '1', 'taw.seenMenuSpotlight': '1', 'taw.seen.patch': '2026-10-13', 'taw.main': 'riot', 'taw.s2.heroes.gf': '1' })) localStorage.setItem(k, v);
    });
    await page.goto('/?portal=1&season2=1');
    await menuReady(page);
    const sent = [];
    page.on('websocket', (ws) => ws.on('framesent', (f) => sent.push(String(f.payload))));
    mock.pushToClient({ type: 'room_update', payload: { code: 'KZRTB', gameType: 'word-bomb', hostId: ME, difficultyKey: 'chill', players: PLAYERS } });
    await page.locator('.room-wrap').waitFor({ state: 'visible' });
    const btn = page.getByTestId('room-hero');
    await expect(btn).toHaveCount(1); // only YOUR seat
    await expect(btn.locator('img')).toHaveAttribute('src', '/cast/riot-hero.webp');
    await shot(page, `${vn}-1-lobby`);
    const before = sent.length;
    await btn.click();
    await expect(page.locator('.hp2-coll')).toBeVisible();
    await page.waitForTimeout(500);
    await shot(page, `${vn}-2-picker`);
    await page.locator('.hc[data-hero="hype"]').click();
    await page.getByTestId('hero-preview').getByRole('button', { name: 'EQUIP HYPE' }).click();
    await expect(page.locator('.rh-pop')).toHaveCount(0);
    await expect(btn.locator('img')).toHaveAttribute('src', '/cast/hype-hero.webp');
    expect(await page.evaluate(() => localStorage.getItem('taw.main'))).toBe('hype');
    expect(sent.slice(before).filter((p) => /hero/i.test(p)).length, 'no room message for a hero change').toBe(0);
    await shot(page, `${vn}-3-equipped`);
  });
}
