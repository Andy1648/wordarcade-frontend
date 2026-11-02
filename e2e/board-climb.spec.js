// e2e/board-climb.spec.js — the end screen's board climb (design research nov2, move 5): a CLAIMED player whose rank
// went up since they last looked sees their row slide past the players they overtook, then a ▲N chip. One real CHAIN
// round on the season-2 board: last seen at #5, the board now has them at #3 -> "#3 YOU" over #4 / #5, ▲2, nothing
// overlapping, every line 16px+. And a player who did NOT move up sees nothing.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { mockBoard } from './support/boardMock.js';

const SECRET = 'd4'.repeat(24);
const FUTURE = Date.now() + 3_600_000;
const row = (id, username, rebirths, level) => ({ id, username, rebirths, level, stars: 0, lifetime_words: 4000, lifetime_letters: 20000, wins_per_word: 10, econ: 13, submitted_at: FUTURE });
const ROWS = [row('a', 'ZENITH', 30, 500), row('b', 'NOVAKID', 30, 400), row('c', 'YAOGUANGZAIYAOGU', 10, 500), row('d', 'SLEEPYFOX', 10, 400), row('e', 'QWERTYGOD', 5, 300)];
const ME = row('me', 'NOBUFF', 20, 500); // between the 30s and the 10s: #3

const OPENER_WORD = {
  a: 'above', b: 'before', c: 'change', d: 'double', e: 'engine', f: 'future', g: 'generate', h: 'handle', i: 'include',
  l: 'large', m: 'manage', n: 'notice', o: 'office', p: 'people', r: 'remove', s: 'service', t: 'there', w: 'where',
};

async function playChain(page) {
  await page.locator('.solo-input').waitFor({ state: 'visible', timeout: 20000 });
  const pool = ['estate', 'elite', 'escape'];
  for (let i = 0; i < 3; i += 1) {
    const letter = ((await page.locator('.solo-center').first().innerText()).trim()).toLowerCase().slice(0, 1);
    const input = page.locator('.solo-input');
    await input.fill(i === 0 ? OPENER_WORD[letter] : pool.shift());
    await input.press('Enter');
    await expect(input).toHaveValue('', { timeout: 5000 });
  }
  await page.locator('.solo-over').waitFor({ state: 'visible', timeout: 45000 });
}

async function boot(page, vp, lastRank) {
  await page.setViewportSize(vp);
  await installBackendMock(page);
  await mockBoard(page, [], { caps: true, shared: { rows: [...ROWS, { ...ME }], secrets: new Map([[SECRET, 'me']]), saves: new Map() }, econ: true, boardEcon: true, season2: true });
  await page.route('**/rest/v1/profile_showcase*', (route) => route.fulfill({ json: [] }));
  await page.addInitScript(({ secret, lastRank }) => {
    if (sessionStorage.getItem('bc.seeded')) return;
    sessionStorage.setItem('bc.seeded', '1');
    localStorage.setItem('taw.chain.runs', '5');
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.seenGameSpotlight', '1');
    localStorage.setItem('wa_has_played', '1');
    localStorage.setItem('taw.lb.profile', JSON.stringify({ id: 'me', username: 'NOBUFF' }));
    localStorage.setItem('taw.lb.secret', secret);
    localStorage.setItem('taw.econ', '12');
    localStorage.setItem('taw.s2.xp', JSON.stringify({ lv: 500, f: 0.1, rc: 20, v: 10 }));
    localStorage.setItem('taw.s2.rebirths', '20');
    localStorage.setItem('taw.lb.lastRank', String(lastRank));
  }, { secret: SECRET, lastRank });
  await page.goto('/?chain=1&portal=1&season2=1');
}

for (const vp of [{ width: 1366, height: 768 }, { width: 390, height: 844 }]) {
  test(`@${vp.width} a CHAIN run that climbed #5 -> #3: YOU slide past #4 / #5, then ▲2`, async ({ page }) => {
    test.setTimeout(120_000);
    await boot(page, vp, 5);
    await playChain(page);
    const strip = page.getByTestId('board-climb');
    await expect(strip).toBeVisible({ timeout: 15000 });
    await expect(strip.locator('.bc-row.is-me')).toContainText('#3');
    await expect(strip.locator('.bc-row:not(.is-me)')).toHaveText([/#4\s*YAOGUANGZAIYAOGU/, /#5\s*SLEEPYFOX/]);
    await expect(strip.locator('.bc-up')).toHaveText('2');
    await strip.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1200); // the slide + the stamp have landed
    if (process.env.BC_SHOTS) await strip.screenshot({ path: `${process.env.BC_SHOTS}/board-climb-${vp.width}.png` });
    const m = await strip.evaluate((el) => {
      const b = (s) => [...el.querySelectorAll(s)].map((e) => e.getBoundingClientRect());
      const hit = (a, c) => Math.min(a.right, c.right) - Math.max(a.left, c.left) > 1 && Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top) > 1;
      const rows = b('.bc-row'); const chip = b('.bc-up')[0]; const out = [];
      // the chip sits ON your row (row 0): never on another row, never on your name, and inside the strip
      for (let i = 0; i < rows.length; i++) { if (i > 0 && hit(rows[i], chip)) out.push(`row ${i} x chip`); for (let j = i + 1; j < rows.length; j++) if (hit(rows[i], rows[j])) out.push(`rows ${i} x ${j}`); }
      if (hit(b('.bc-row.is-me .bc-name')[0], chip)) out.push('your name x chip');
      // names are whole: one line, never broken mid-word (Andy oct21: never cut either)
      for (const n of el.querySelectorAll('.bc-name')) { const rg = document.createRange(); rg.selectNodeContents(n); const tops = new Set([...rg.getClientRects()].map((q) => Math.round(q.top))); if (tops.size > 1) out.push(`${n.textContent} on ${tops.size} lines`); if (n.scrollWidth > n.clientWidth + 1) out.push(`${n.textContent} overflows`); }
      const small = [...el.querySelectorAll('.bc-row, .bc-row b, .bc-name, .bc-up')].filter((e) => parseFloat(getComputedStyle(e).fontSize) < 15.99).map((e) => e.className);
      const box = el.getBoundingClientRect();
      return { out, small, inside: box.left >= 0 && box.right <= window.innerWidth };
    });
    expect(m).toEqual({ out: [], small: [], inside: true });
  });
}

test('a run that did NOT climb shows no board strip', async ({ page }) => {
  test.setTimeout(120_000);
  await boot(page, { width: 1366, height: 768 }, 3);
  await playChain(page);
  await page.waitForTimeout(3000);
  await expect(page.getByTestId('board-climb')).toHaveCount(0);
});
