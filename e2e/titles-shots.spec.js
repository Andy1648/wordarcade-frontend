// e2e/titles-shots.spec.js — screenshot harness for the TITLE surfaces (profile title row, ALL TITLES picker, the board's
// name plates). Runs only with TITLE_SHOT_DIR set; it asserts nothing the real specs do not.
import { test } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { mockBoard } from './support/boardMock.js';
import { menuReady } from './support/menu.js';

const DIR = process.env.TITLE_SHOT_DIR || '';
test.skip(!DIR, 'screenshot harness: set TITLE_SHOT_DIR');

const ROWS = [
  ['snapplemelon', 195, 10, 20], ['Xavi', 168, 9, 5], ['Kiwi', 150, 9, 1], ['elol', 156, 8], ['NoBuffCookies', 147, 7], ['Daan', 144, 6],
  ['Tangie', 126, 5], ['maSON_im_cRYAN', 119, 4], ['creator', 118, 3], ['wordgoblin', 40, 2], ['qwertyuiop', 31, 1],
].map(([username, level, rebirths, stars = 0], i) => ({ id: `r${i}`, username, level, rebirths, stars, econ: 13, lifetime_words: 500 - i, wins_per_word: 10 }));

async function seed(page) {
  await installBackendMock(page);
  const shared = {
    rows: [...ROWS.map((r) => ({ ...r })), { id: 'me', username: 'BETTERTHANANDY', level: 60, rebirths: 6, econ: 13, lifetime_words: 300, wins_per_word: 5 }],
    secrets: new Map([['s'.repeat(48), 'me']]),
    saves: new Map(),
  };
  await mockBoard(page, [], { caps: true, shared, weekly: true, season2: true });
  await page.addInitScript(() => {
    if (sessionStorage.getItem('ts.seeded')) return;
    sessionStorage.setItem('ts.seeded', '1');
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.tut.markRolls', '1');
    localStorage.setItem('taw.marksRevealed', '1');
    localStorage.setItem('taw.econ', '12');
    localStorage.setItem('taw.xp', JSON.stringify({ lv: 60, into: 0 }));
    localStorage.setItem('taw.s2.xp', JSON.stringify({ lv: 60, f: 0.1, rc: 6, v: 10 }));
    localStorage.setItem('taw.s2.rebirths', '6');
    localStorage.setItem('taw.lb.secret', 's'.repeat(48));
    localStorage.setItem('taw.lb.profile', JSON.stringify({ id: 'me', username: 'BETTERTHANANDY' }));
    window.__TAW_NO_ACHIEVEMENT_GRANT = true;
  });
}

for (const [w, h, tag] of [[1366, 657, 'desktop'], [1920, 1080, 'wide'], [390, 844, 'phone']]) {
  test(`title surfaces @${tag}`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: w, height: h });
    await seed(page);
    await page.goto('/?portal=1&season2=1');
    await menuReady(page);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${DIR}/${tag}-0-menu.png` });
    await page.getByTestId('profile-plate').click();
    const pf = page.getByTestId('profile-popup');
    await pf.waitFor();
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${DIR}/${tag}-1-profile.png` });
    await pf.getByTestId('profile-title').click();
    await page.getByTestId('rank-ladder').waitFor();
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${DIR}/${tag}-2-titles.png` });
    await page.screenshot({ path: `${DIR}/${tag}-2-titles-full.png`, fullPage: true });
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await page.goto('/?portal=1&season2=1');
    await menuReady(page);
    await page.getByRole('button', { name: /Open leaderboard/ }).click();
    await page.locator('.lb2-row').first().waitFor();
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${DIR}/${tag}-3-board.png` });
  });
}
