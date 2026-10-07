// e2e/numbers-audit.spec.js — NUMBERS AUDIT (Andy item 5) behind ?season2=1: every number the menu, UPGRADES, REBIRTH
// and ROLL screens print for one seeded season-2 save, read off the screen and checked against PROGRESSION FINAL
// (claude/progression-FINAL.md) by hand-worked arithmetic. The save: LV120 (30% in), R3, POWER 2, ★0, 50,000 wins,
// 200 gems, no mark (so XP / LETTER = 10 × 2.5² × 2³ × (1 + 0) = 500).
//   MENU      LV 120 · need(120) = 400 × 1.06^119 · +500 XP / LETTER
//   UPGRADES  POWER 2 → 3 · 500 → 1,250 XP / LETTER (×2.5) · price 300 × 8² = 19,200 wins · wins 50K / gems 200
//   REBIRTH   COSTS 25 × (3+1) = 100 LEVELS · KEEP THE REST · YOU GET ×2 · ×8 → ×16 FOREVER · LV 120 → 20 · gate LV 101
//   ROLL      75 gems a roll · pity EPIC+ / LEGENDARY+ counters on FINAL's 50 / 500
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { mockBoard } from './support/boardMock.js';
import { navControl } from './support/menu.js';

const SECRET = 'a9'.repeat(24);

async function boot(page) {
  await installBackendMock(page);
  await page.addInitScript(() => { window.__TAW_NO_ACHIEVEMENT_GRANT = true; });
  const row = { id: 'me-na', username: 'Auditor', level: 120, rebirths: 3, stars: 0, lifetime_words: 0, lifetime_letters: 0, wins_per_word: 0, econ: 13 };
  const shared = { rows: [row], secrets: new Map([[SECRET, row.id]]), saves: new Map() };
  await mockBoard(page, [], { caps: true, shared, econ: true, boardEcon: true, rebirth: { delayMs: 0 }, season2: true });
  await page.addInitScript(({ secret, id }) => {
    if (sessionStorage.getItem('na.seeded')) return;
    sessionStorage.setItem('na.seeded', '1');
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.lb.profile', JSON.stringify({ id, username: 'Auditor' }));
    localStorage.setItem('taw.lb.secret', secret);
    localStorage.setItem('taw.econ', '12');
    localStorage.setItem('taw.reduceMotion', '1');
    localStorage.setItem('taw.s2.xp', JSON.stringify({ lv: 120, f: 0.3, rc: 3, v: 10 }));
    localStorage.setItem('taw.s2.rebirths', '3');
    localStorage.setItem('taw.s2.keytier', '2');
    localStorage.setItem('taw.s2.wins', '50000');
    localStorage.setItem('taw.s2.gems', JSON.stringify({ v: 1, bal: 200, peak: 120, streak: 0, mig: 1 }));
    localStorage.setItem('taw.marksRevealed', '1'); // the ROLL button (Homepage's markShown)
    localStorage.setItem('taw.rollsOn', '1');
    localStorage.setItem('taw.markRolls', JSON.stringify({ v: 2, starter: true, marks: {} })); // the free starter roll is spent
  }, { secret: SECRET, id: row.id });
  await page.goto('/?portal=1&season2=1');
  await navControl(page, 'stats').waitFor({ state: 'visible' });
}

const fmt = (n) => {
  // formatNum, restated: grouped below 10,000, three significant figures with a suffix from there
  if (n < 10000) return Math.round(n).toLocaleString('en-US');
  const s = ['', 'K', 'M', 'B', 'T'];
  let t = 0;
  while (n >= 1000) { n /= 1000; t += 1; }
  return `${n.toFixed(n < 10 ? 2 : n < 100 ? 1 : 0).replace(/\.?0+$/, '')}${s[t]}`;
};

test('SEASON2 numbers: menu bar + per-letter, UPGRADES, REBIRTH and ROLL print FINAL\'s formulas', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1366, height: 768 });
  await boot(page);

  // MENU: the level bar and XP / LETTER
  const need120 = 400 * 1.06 ** 119;
  const read = page.locator('.menu-xp-bar:visible .kx-read-n');
  await expect(read.nth(0)).toHaveText(fmt(0.3 * need120));
  await expect(read.nth(1)).toHaveText(fmt(need120));
  await expect(page.locator('.menu-xp-bar:visible .kx-lv-n').first()).toHaveText('120');
  await expect(page.locator('.hp-per:visible').first()).toHaveText('+500 XP / LETTER');

  // UPGRADES (POWER): 2 → 3, ×2.5 XP / LETTER, 300 × 8^2 wins
  await navControl(page, 'shop').click();
  const sp = page.locator('.sp2');
  await sp.waitFor({ state: 'visible' });
  await expect(sp.locator('[data-testid="sp2-power"]')).toHaveText('2');
  await expect(sp.locator('.sp2-pw-next')).toHaveText('3');
  await expect(sp.locator('.sp2-per-now')).toHaveText('500');
  await expect(sp.locator('.sp2-per-next')).toHaveText('1,250');
  await expect(sp.locator('.sp2-buy')).toContainText(fmt(300 * 8 ** 2));
  await page.keyboard.press('Escape');
  await expect(sp).toHaveCount(0);

  // REBIRTH: spends 25 × (R + 1), ×2 a rebirth, LV a → b
  await navControl(page, 'rebirth').click();
  const rb = page.locator('.rb2');
  await rb.waitFor({ state: 'visible' });
  await expect(rb.locator('[data-testid="rb2-cost"]')).toHaveText('COSTS 100 LEVELS · KEEP THE REST');
  await expect(rb.locator('.rb2-get')).toContainText('×2');
  await expect(rb.locator('.rb2-get-sub')).toHaveText('×8 → ×16 FOREVER');
  await expect(rb.locator('.rb2-get')).toContainText('−100');
  await expect(rb.locator('.rb2-hold')).toContainText('LV 120 → 20');
  await expect(rb.locator('.rb2-gate-txt')).toHaveText('GATE LV 101 — READY');
  await rb.locator('.rb2-back').click();
  await expect(rb).toHaveCount(0);

  // ROLL: 75 gems, the 50 / 500 pity ladder
  await navControl(page, 'roll').click();
  const price = page.locator('.rs-roll-price');
  await price.waitFor({ state: 'visible' });
  await expect(price).toHaveText('75');
  const pity = await page.getByTestId('roll-pity').innerText();
  const epic = Number(/EPIC\+ IN\s*([\d,]+)/.exec(pity)[1].replace(/,/g, ''));
  const leg = Number(/LEGENDARY\+ IN\s*([\d,]+)/.exec(pity)[1].replace(/,/g, ''));
  expect(epic).toBeGreaterThan(0);
  expect(epic).toBeLessThanOrEqual(50);
  expect(leg).toBe(500);
});
