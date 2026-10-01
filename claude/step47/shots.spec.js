import { test, expect } from '@playwright/test';
import { installBackendMock } from '../../e2e/support/backendMock.js';
import { menuReady } from '../../e2e/support/menu.js';
import { mockBoard } from '../../e2e/support/boardMock.js';

const SEED = [
  { id: 'seed-1', username: 'WordWizard', level: 152, rebirths: 6, lifetime_words: 48210, wins_per_word: 912.4 },
  { id: 'seed-2', username: 'BombSquad', level: 88, rebirths: 2, lifetime_words: 20111, wins_per_word: 301.0 },
  { id: 'seed-3', username: 'LexiLoop', level: 40, rebirths: 0, lifetime_words: 5300, wins_per_word: 44.5 },
];
const OPENER = { a: 'above', b: 'before', c: 'change', d: 'double', e: 'engine', f: 'future', g: 'generate', h: 'handle', i: 'include', l: 'large', m: 'manage', n: 'notice', o: 'office', p: 'people', r: 'remove', s: 'service', t: 'there', w: 'where' };
const EW = ['estate', 'elite', 'escape', 'expense'];
const VPS = [[390, 844], [1280, 551], [1920, 1080]];
const PROFILES = { fresh: { lv: 1, rb: 0 }, l150: { lv: 150, rb: 3 } };

for (const variant of (process.env.LBV || 'final').split(',')) for (const [w, h] of VPS) for (const [pname, pf] of Object.entries(PROFILES)) {
  test(`${variant} ${w}x${h} ${pname}`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: w, height: h });
    await installBackendMock(page);
    await page.addInitScript(({ lv, rb }) => {
      if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s', '1');
      localStorage.setItem('taw.chain.runs', '5'); localStorage.setItem('taw.seenMenuSpotlight', '1'); localStorage.setItem('taw.seenGameSpotlight', '1'); localStorage.setItem('taw.seenMenu', '1'); localStorage.setItem('wa_has_played', '1');
      localStorage.setItem('taw.xp', JSON.stringify({ lv, into: 0 })); if (rb) localStorage.setItem('taw.rebirths', String(rb));
    }, pf);
    await mockBoard(page, SEED);
    await page.goto(`/?chain=1&portal=1&lbv=${variant}`);
    await page.locator('.solo-input').waitFor({ state: 'visible', timeout: 20000 });
    const pool = [...EW];
    for (let i = 0; i < 4; i++) {
      const letter = (await page.locator('.solo-center').first().innerText()).trim().toLowerCase()[0];
      const input = page.locator('.solo-input');
      await input.fill(i === 0 ? OPENER[letter] : pool.shift()); await input.press('Enter');
      await expect(input).toHaveValue('', { timeout: 5000 });
    }
    await page.locator('.lb-cp').waitFor({ state: 'visible', timeout: 45000 });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `claude/step47/shots/${variant}-${w}x${h}-${pname}-offer.png` });
    if (pname === 'fresh') {
      await page.locator('.lb-cp-go').click();
      await page.locator('#lb-cp-input').fill('Typer_47');
      await page.waitForTimeout(700);
      await page.screenshot({ path: `claude/step47/shots/${variant}-${w}x${h}-${pname}-form.png` });
    }
  });
}

for (const [w, h] of VPS) {
  test(`menu rankup + board ${w}x${h}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await installBackendMock(page);
    await page.addInitScript(() => {
      localStorage.setItem('taw.seenMenuSpotlight', '1'); localStorage.setItem('taw.seenMenu', '1'); localStorage.setItem('wa_has_played', '1');
      localStorage.setItem('taw.xp', JSON.stringify({ lv: 45, into: 0 }));
      localStorage.setItem('taw.lb.secret', 'f'.repeat(48));
      localStorage.setItem('taw.lb.profile', JSON.stringify({ id: 'id-me', username: 'Typer_47' }));
      localStorage.setItem('taw.lb.lastRank', '12');
    });
    const b = await mockBoard(page, SEED);
    b.rows.push({ id: 'id-me', username: 'Typer_47', level: 45, rebirths: 0, lifetime_words: 40, wins_per_word: 10 });
    b.secrets.set('f'.repeat(48), 'id-me');
    await page.goto('/?portal=1');
    await menuReady(page);
    await page.locator('.lb-rankup').waitFor({ state: 'visible' });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `claude/step47/shots/rankup-${w}x${h}.png` });
    await page.waitForTimeout(1600);
    await page.getByRole('button', { name: /Open leaderboard/ }).click();
    await page.locator('.lb-slot').first().waitFor(); await page.waitForTimeout(900);
    await page.screenshot({ path: `claude/step47/shots/board-${w}x${h}.png` });
  });
}
