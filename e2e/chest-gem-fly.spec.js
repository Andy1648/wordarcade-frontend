// e2e/chest-gem-fly.spec.js — DESIGN RESEARCH MOVE 10, the daily chest's gems FLY HOME: the drop pays inside its popup
// (the save gets the gems at once) but the shop's GEMS pill holds them while the popup covers it; closing the popup
// flies the painted gems (KitFlyLayer, pooled, the gems.webp icon) from the DAILY CHEST card into the pill, which
// counts each one in as it lands. Real motion.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { mockBoard } from './support/boardMock.js';
import { navControl } from './support/menu.js';

test.use({ timezoneId: 'UTC', reducedMotion: 'no-preference' });
test.describe.configure({ timeout: 60_000 });
const SHOTS = process.env.SHARD_SHOTS || '';
const SECRET = 'f'.repeat(48);
const NOON = Date.UTC(2026, 9, 9, 12, 0, 0);

for (const [w, h] of [[1366, 768], [390, 844]]) {
  test(`${w}x${h}: closing the chest popup flies the paid gems into the GEMS pill, which counts them in`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await page.clock.setFixedTime(NOON);
    await installBackendMock(page);
    await page.addInitScript(() => { window.__TAW_NO_ACHIEVEMENT_GRANT = true; Math.random = () => 0.1; }); // COMMON: +15
    const row = { id: 'me-fly', username: 'Flyer', level: 1, rebirths: 0, lifetime_words: 0, lifetime_letters: 0, wins_per_word: 0, econ: 12 };
    await mockBoard(page, [], { caps: true, shared: { rows: [row], secrets: new Map([[SECRET, row.id]]), saves: new Map() }, econ: true, boardEcon: true, rebirth: { delayMs: 0 }, season2: true });
    await page.addInitScript(({ secret, id }) => {
      if (sessionStorage.getItem('cf.seeded')) return;
      sessionStorage.setItem('cf.seeded', '1');
      localStorage.setItem('taw.seenMenu', '1');
      localStorage.setItem('taw.seenMenuSpotlight', '1');
      localStorage.setItem('taw.lb.profile', JSON.stringify({ id, username: 'Flyer' }));
      localStorage.setItem('taw.lb.secret', secret);
      localStorage.setItem('taw.econ', '12');
      localStorage.setItem('taw.s2.xp', JSON.stringify({ lv: 40, f: 0, rc: 0, v: 10 }));
      localStorage.setItem('taw.s2.gems', JSON.stringify({ bal: 100, mig: 1 }));
    }, { secret: SECRET, id: row.id });
    await page.goto('/?portal=1&season2=1');
    await navControl(page, 'shop').click();
    const shop = page.locator('.sp2');
    await shop.waitFor({ state: 'visible' });
    await shop.getByTestId('daily-chest-card').click();
    const dd = page.getByTestId('daily-drop');
    for (let i = 0; i < 4; i += 1) { await dd.locator('.dd-tap').click(); await page.waitForTimeout(350); }
    await expect(dd).toHaveAttribute('data-phase', 'claimed');
    const pill = shop.locator('.kp-tone-cyan');
    await expect(pill).toContainText('100'); // held while the popup covers it
    await page.waitForTimeout(700);
    await page.locator('.sp2-pop-x').click();
    // the painted gems are in flight: the fly layer's pooled icons are visible and moving
    await expect.poll(() => page.evaluate(() => [...document.querySelectorAll('.kfl-x, .kfl-y, .kfl-s')].filter((n) => n.getAnimations().some((a) => a.playState === 'running')).length), { timeout: 3000, intervals: [30] }).toBeGreaterThan(0);
    if (SHOTS) { await page.waitForTimeout(380); await page.screenshot({ path: `${SHOTS}/gemfly-${w}.png` }); }
    await expect(pill).toContainText('115', { timeout: 4000 }); // counted in as they landed
    expect(await page.evaluate(() => document.getAnimations().filter((a) => a.effect && a.effect.getTiming().iterations === Infinity && a.effect.target && a.effect.target.closest && a.effect.target.closest('.kfl')).length)).toBe(0);
  });
}
