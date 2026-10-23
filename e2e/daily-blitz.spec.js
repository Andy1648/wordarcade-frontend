// e2e/daily-blitz.spec.js — DAILY BLITZ (src/dailyBlitz/), the once-a-day rare-answer game.
//   1. the menu entry joins the DAILY cluster at every width (chip ≥1200, icon on a narrower desktop, a row on a
//      phone) and opens the game;
//   2. the share link /daily?s=share lands straight in the game (no splash) and the URL settles on /daily;
//   3. a full day: a wrong answer is refused in place, six answers score, the results show the crowd's %
//      from the (mocked) 062 RPC, the copied share text is spoiler-free and carries ?s=share;
//   4. ONE RUN A DAY: a reload mid-prompt counts that prompt as a miss, and a finished day reopens on its results;
//   5. NO SCROLL: cover, a prompt and the results fit a laptop, a Chromebook and phones.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';

const DATA = JSON.parse(readFileSync(new URL('../src/dailyBlitz/data.json', import.meta.url), 'utf8'));
const answerFor = (cat, i = 0) => DATA.cats[cat].a[i][1];

const TALLIES = (answers) => ({
  day: '2026-10-22',
  plays: 120,
  prompts: answers.map((a) => ({ mine: a ? 3 : null, top: a ? [[a, 40], ['zzzz-not-a-key', 30]] : [] })),
});

async function boot(page, { w = 1366, h = 768, path = '/?portal=1', seed = true } = {}) {
  await page.setViewportSize({ width: w, height: h });
  await installBackendMock(page);
  const submits = [];
  await page.route('https://lb.e2e.invalid/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/rpc/daily_blitz_submit') || url.pathname.endsWith('/rpc/daily_blitz_tallies')) {
      const body = route.request().postDataJSON();
      if (url.pathname.endsWith('submit')) submits.push(body);
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(TALLIES(body.p_answers)) });
    }
    return route.fallback();
  });
  if (seed) {
    await page.addInitScript(() => {
      if (sessionStorage.getItem('dbz.seeded')) return;
      sessionStorage.setItem('dbz.seeded', '1');
      localStorage.setItem('taw.seenMenu', '1');
      localStorage.setItem('taw.seenMenuSpotlight', '1');
    });
  }
  await page.goto(path);
  return submits;
}

async function noScroll(page, what) {
  const m = await page.evaluate(() => {
    const se = document.scrollingElement;
    const root = document.querySelector('[data-testid="daily-blitz"]');
    return { sh: se.scrollHeight, ih: window.innerHeight, sw: se.scrollWidth, iw: window.innerWidth, rsh: root.scrollHeight, rch: root.clientHeight };
  });
  expect(m.sh, `${what}: the page does not scroll`).toBeLessThanOrEqual(m.ih + 1);
  expect(m.sw, `${what}: nothing runs off sideways`).toBeLessThanOrEqual(m.iw + 1);
  expect(m.rsh, `${what}: the screen's own column does not overflow`).toBeLessThanOrEqual(m.rch + 1);
}

async function inView(page, sel, what) {
  const b = await page.locator(sel).first().boundingBox();
  const vp = page.viewportSize();
  expect(b, `${what} is rendered`).toBeTruthy();
  expect(b.y + b.height, `${what} is on screen`).toBeLessThanOrEqual(vp.height + 1);
  expect(b.x + b.width).toBeLessThanOrEqual(vp.width + 1);
}

// the control at its own centre is itself — no fixed corner widget (the sound cog) drawn over it
async function uncovered(page, sel, what) {
  const ok = await page.locator(sel).first().evaluate((el) => {
    const r = el.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width * 0.85, r.top + r.height * 0.8);
    return !!top && (top === el || el.contains(top));
  });
  expect(ok, `${what} is not covered`).toBe(true);
}

async function answerCurrent(page, i = 0) {
  const cat = (await page.getByTestId('daily-blitz-prompt').textContent()).trim();
  await page.getByTestId('daily-blitz-input').fill(answerFor(cat, i));
  await page.getByTestId('daily-blitz-input').press('Enter');
  return cat;
}

async function playAll(page) {
  await page.getByTestId('daily-blitz-start').click();
  for (let n = 0; n < 6; n++) {
    await expect(page.locator('[data-testid="daily-blitz"]')).toHaveAttribute('data-phase', 'play');
    await expect(page.getByTestId('daily-blitz-input')).toBeEnabled();
    await answerCurrent(page);
    await expect(page.locator('.dbz-stamp')).toBeVisible();
  }
  await expect(page.locator('[data-testid="daily-blitz"]')).toHaveAttribute('data-phase', 'results', { timeout: 5000 });
}

for (const [w, h, face] of [[1366, 768, 'chip'], [1024, 700, 'icon'], [390, 844, 'row']]) {
  test(`the menu's DAILY BLITZ entry (${face}) at ${w}x${h} opens the game`, async ({ page }) => {
    await boot(page, { w, h });
    await menuReady(page);
    const entry = page.locator('[data-nav="daily-blitz"]:visible');
    await expect(entry).toHaveCount(1);
    await expect(entry).toHaveAttribute('aria-label', /Daily Blitz #\d+/);
    await entry.click();
    await expect(page.locator('[data-testid="daily-blitz"]')).toHaveAttribute('data-phase', 'cover');
    // (?portal=1 is a sticky embed query — the app leaves that URL alone; the /daily path is checked below)
  });
}

test('the share link lands in the game with no splash, and the URL settles on /daily', async ({ page }) => {
  await boot(page, { path: '/daily?s=share', seed: false });
  await expect(page.locator('[data-testid="daily-blitz"]')).toHaveAttribute('data-phase', 'cover', { timeout: 15000 });
  await expect(page.locator('.splash-logo')).toHaveCount(0);
  await expect(page).toHaveURL(/\/daily$/);
});

test('a full day: refuse off-list answers, score six, show the crowd, copy a spoiler-free share', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const submits = await boot(page, { path: '/daily' });
  await page.getByTestId('daily-blitz-start').click();
  // an answer that is on no list is refused in place: same prompt, a message, the box cleared
  const first = (await page.getByTestId('daily-blitz-prompt').textContent()).trim();
  await page.getByTestId('daily-blitz-input').fill('qqqzzzx');
  await page.getByTestId('daily-blitz-input').press('Enter');
  await expect(page.locator('.dbz-msg')).toContainText("ISN'T ON THE LIST");
  await expect(page.getByTestId('daily-blitz-prompt')).toHaveText(first);
  await expect(page.getByTestId('daily-blitz-input')).toHaveValue('');
  const cats = [];
  for (let n = 0; n < 6; n++) {
    await expect(page.getByTestId('daily-blitz-input')).toBeEnabled();
    cats.push(await answerCurrent(page));
    await expect(page.locator('.dbz-stamp')).toBeVisible();
  }
  await expect(page.locator('[data-testid="daily-blitz"]')).toHaveAttribute('data-phase', 'results', { timeout: 5000 });
  expect(new Set(cats).size, 'six different prompts').toBe(6);
  // the one submit carries six canonical keys
  await expect.poll(() => submits.length).toBe(1);
  expect(submits[0].p_answers).toHaveLength(6);
  expect(submits[0].p_answers.every((k) => /^[a-z0-9]+$/.test(k))).toBe(true);
  expect(submits[0].p_secret).toMatch(/^[0-9a-f]{32,64}$/);
  // crowd: 3 of 120 said it -> "3% SAID IT", the most-said answer listed, junk keys filtered out
  await expect(page.locator('.dbz-row-pct').first()).toContainText('3% SAID IT');
  await expect(page.locator('.dbz-row-top').first()).toContainText('MOST SAID:');
  await expect(page.locator('.dbz-row-top').first()).not.toContainText('zzzz');
  await expect(page.locator('.dbz-rows > li')).toHaveCount(6);
  const total = Number(await page.getByTestId('daily-blitz-total').textContent());
  expect(total).toBeGreaterThan(0);
  await expect(page.locator('.dbz-rarest')).toContainText('RAREST');
  await page.getByTestId('daily-blitz-copy').click();
  const txt = (await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n'); // Windows clipboard
  expect(txt).toMatch(/^TYPE A WORD · DAILY BLITZ #\d+\n[⬛⬜🟦🟪🟨]{6} \d+\/600/u);
  expect(txt).toContain('/daily?s=share');
  for (const c of cats) expect(txt, 'no category name in the share').not.toContain(c);
  // the day is done: a fresh visit opens on the results, never a replay
  await page.goto('/daily');
  await expect(page.locator('[data-testid="daily-blitz"]')).toHaveAttribute('data-phase', 'results');
  await expect(page.getByTestId('daily-blitz-total')).toHaveText(String(total));
});

test('ONE RUN A DAY: a reload mid-prompt counts that prompt as a miss', async ({ page }) => {
  await boot(page, { path: '/daily' });
  await page.getByTestId('daily-blitz-start').click();
  await answerCurrent(page);
  await expect(page.getByTestId('daily-blitz-input')).toBeEnabled(); // prompt 2 is up
  await page.reload();
  await expect(page.getByTestId('daily-blitz-start')).toHaveText('CONTINUE (2/6)');
  await page.getByTestId('daily-blitz-start').click();
  await expect(page.locator('.dbz-tier')).toContainText('3/6');
  await expect(page.locator('.dbz-prog i.is-miss')).toHaveCount(1);
});

for (const [w, h] of [[1366, 768], [1280, 720], [1280, 551], [1024, 600], [390, 844], [360, 640], [320, 568]]) {
  test(`NO SCROLL at ${w}x${h}: cover, a prompt, the results`, async ({ page }) => {
    await boot(page, { w, h, path: '/daily' });
    await expect(page.locator('[data-testid="daily-blitz"]')).toHaveAttribute('data-phase', 'cover');
    await expect(page.getByTestId('daily-blitz-start')).toBeEnabled();
    await noScroll(page, 'cover');
    await inView(page, '[data-testid="daily-blitz-start"]', 'START');
    await page.getByTestId('daily-blitz-start').click();
    await expect(page.getByTestId('daily-blitz-input')).toBeEnabled();
    await noScroll(page, 'prompt');
    await inView(page, '.dbz-send', 'GO');
    await uncovered(page, '.dbz-send', 'GO');
    await expect(page.locator('.audio-ctrl'), 'one sound control, in the top bar').toHaveCount(1);
    for (let n = 0; n < 5; n++) {
      await answerCurrent(page);
      await expect(page.getByTestId('daily-blitz-input')).toBeEnabled({ timeout: 4000 });
    }
    await answerCurrent(page);
    await expect(page.locator('[data-testid="daily-blitz"]')).toHaveAttribute('data-phase', 'results', { timeout: 5000 });
    await expect(page.locator('.dbz-row-pct').first()).toContainText('SAID IT');
    await noScroll(page, 'results');
    await inView(page, '[data-testid="daily-blitz-share"]', 'SHARE');
    await inView(page, '.dbz-foot', 'the footer');
    await uncovered(page, '[data-testid="daily-blitz-share"]', 'SHARE');
    await uncovered(page, '[data-testid="daily-blitz-copy"]', 'COPY');
    const rows = await page.locator('.dbz-row').evaluateAll((els) => els.map((e) => ({ sh: e.scrollHeight, ch: e.clientHeight, h: e.getBoundingClientRect().height })));
    for (const r of rows) {
      expect(r.h, 'each result row keeps a readable height').toBeGreaterThanOrEqual(34);
      expect(r.sh, 'no row clips its text vertically').toBeLessThanOrEqual(r.ch + 2);
    }
  });
}

test('playAll helper sanity (results reachable in one go)', async ({ page }) => {
  await boot(page, { path: '/daily' });
  await playAll(page);
  await expect(page.getByTestId('daily-blitz-share')).toBeVisible();
});
