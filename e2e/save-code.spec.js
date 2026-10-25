// e2e/save-code.spec.js — SETTINGS → SAVE PROGRESS (Andy oct22 "fix save code - its buggy (people complaining)").
// Two browsers (a desktop Chromebook-size screen and a phone), season 2:
//   * a HEAVY save's code (5,000 collected words) copies on one and restores on the other — the old paste box cut every
//     code past 200,000 characters and called it "corrupted";
//   * the paste is read first and confirmed against this device; a code BEHIND this device needs LOAD ANYWAY, and
//     UNDO LAST RESTORE puts the replaced save back;
//   * a mangled paste (smart quotes, spaces) still loads; a cut-off one says so; a season-1 code is refused untouched;
//   * COPY with the Clipboard API refused still leaves the code selectable; the sheet never scrolls, confirm open.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';

const DESK = { width: 1366, height: 768 };
const PHONE = { width: 390, height: 844 };

function heavySave() {
  const w = {};
  for (let i = 0; i < 5000; i += 1) w[`w${i.toString(36)}q${(i * 7919).toString(36)}`] = [i % 6, i % 4, 20380 + (i % 40), i];
  return {
    'taw.s2.xp': JSON.stringify({ lv: 44, f: 0.5, rc: 7, v: 10 }),
    'taw.s2.rebirths': '7',
    'taw.s2.wins': '987654321',
    'taw.main': 'riot',
    'taw.collection': JSON.stringify({ v: 2, seq: 8000, w, ms: [100, 500], ev: Array.from({ length: 3000 }, (_, i) => `gone${i}`) }),
  };
}
const small = (rb, lv) => ({ 'taw.s2.xp': JSON.stringify({ lv, f: 0, rc: rb, v: 10 }), 'taw.s2.rebirths': String(rb), 'taw.s2.wins': '55' });

async function boot(page, seed, vp) {
  await page.setViewportSize(vp);
  await installBackendMock(page);
  await page.addInitScript((seed) => {
    if (sessionStorage.getItem('sc.seeded')) return;
    sessionStorage.setItem('sc.seeded', '1');
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.econ', '13');
    for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
  }, seed);
  await page.goto('/?portal=1&season2=1');
  await menuReady(page);
}
async function openSettings(page) {
  // oct24 DAILY WHEEL: the cog is in the top-right cluster before the core reveal, the bottom-right one after
  await page.locator('[data-nav="settings"]:visible').first().click();
  await page.locator('.sp-sheet').waitFor({ state: 'visible' });
}
const rebirths = (page) => page.evaluate(() => localStorage.getItem('taw.s2.rebirths')).catch(() => null);
// SHOTS=dir saves a screenshot of each state for the PR / Andy
const shot = (page, name) => (process.env.SHOTS ? page.screenshot({ path: `${process.env.SHOTS}/${name}.png` }) : null);
const noScroll = async (page, vp) => {
  const m = await page.locator('.sp-sheet').evaluate((el) => ({ sh: el.scrollHeight, ch: el.clientHeight, b: el.getBoundingClientRect().bottom }));
  expect(m.sh, 'the settings sheet fits without scrolling').toBeLessThanOrEqual(m.ch + 1);
  expect(m.b).toBeLessThanOrEqual(vp.height);
};
async function newDevice(browser, vp, seed, opts = {}) {
  const ctx = await browser.newContext({ viewport: vp, ...opts });
  const page = await ctx.newPage();
  await boot(page, seed, vp);
  return { ctx, page };
}
async function copyCode(page) {
  await openSettings(page);
  await page.getByTestId('sp-save-copy').click();
  await expect(page.locator('.sp-msg')).toContainText('COPIED');
  return page.evaluate(() => navigator.clipboard.readText());
}

test('a HEAVY save: COPY on desktop → paste on a phone → confirm → it loads, the whole save', async ({ browser }) => {
  test.setTimeout(90_000);
  const a = await newDevice(browser, DESK, heavySave(), { permissions: ['clipboard-read', 'clipboard-write'] });
  const code = await copyCode(a.page);
  expect(code).toMatch(/^TAW2\.[A-Za-z0-9_-]+\.[0-9a-f]{8}$/);
  expect(code.length).toBeLessThan(110_000); // the plain code for this save was 281,368 characters
  await expect(a.page.getByTestId('sp-save-code')).toHaveValue(code);
  await noScroll(a.page, DESK);
  await shot(a.page, 'desktop-copied');

  const b = await newDevice(browser, PHONE, small(1, 3), { isMobile: true, hasTouch: true });
  await openSettings(b.page);
  await b.page.getByLabel('Paste a save code').fill(code);
  await b.page.getByRole('button', { name: 'RESTORE' }).click();
  const confirm = b.page.getByTestId('sp-load-confirm');
  await expect(b.page.getByTestId('sp-load-compare')).toHaveText('THIS CODE: R7 · LV 44 · THIS DEVICE: R1 · LV 3');
  await noScroll(b.page, PHONE);
  await shot(b.page, 'phone-confirm');
  await confirm.getByTestId('sp-load-yes').click();
  await expect.poll(() => rebirths(b.page), { timeout: 10_000 }).toBe('7');
  await menuReady(b.page);
  const words = await b.page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('taw.collection')).w).length);
  expect(words).toBe(5000);
  expect(await b.page.evaluate(() => localStorage.getItem('taw.s2.wins'))).toBe('987654321');
  await a.ctx.close();
  await b.ctx.close();
});

test('a code BEHIND this device asks LOAD ANYWAY; CANCEL keeps everything; UNDO LAST RESTORE puts the save back', async ({ browser }) => {
  test.setTimeout(90_000);
  const a = await newDevice(browser, DESK, small(2, 10), { permissions: ['clipboard-read', 'clipboard-write'] });
  const code = await copyCode(a.page);
  const b = await newDevice(browser, PHONE, small(9, 50), { isMobile: true, hasTouch: true });
  await openSettings(b.page);
  await b.page.getByLabel('Paste a save code').fill(code);
  await b.page.getByRole('button', { name: 'RESTORE' }).click();
  const confirm = b.page.getByTestId('sp-load-confirm');
  await expect(confirm).toContainText('LOWERS YOUR PROGRESS');
  await expect(confirm.getByTestId('sp-load-yes')).toHaveText('LOAD ANYWAY');
  await noScroll(b.page, PHONE);
  await shot(b.page, 'phone-lower-warning');
  await confirm.getByRole('button', { name: 'CANCEL' }).click();
  await expect(confirm).toHaveCount(0);
  expect(await rebirths(b.page)).toBe('9');
  // load it on purpose …
  await b.page.getByRole('button', { name: 'RESTORE' }).click();
  await b.page.getByTestId('sp-load-yes').click();
  await expect.poll(() => rebirths(b.page), { timeout: 10_000 }).toBe('2');
  await menuReady(b.page);
  // … then take it back
  await openSettings(b.page);
  await b.page.getByTestId('sp-undo').click();
  await shot(b.page, 'phone-undo');
  await expect(b.page.getByTestId('sp-load-compare')).toHaveText('PUT BACK: R9 · LV 50 · THIS DEVICE: R2 · LV 10');
  await b.page.getByTestId('sp-load-yes').click();
  await expect.poll(() => rebirths(b.page), { timeout: 10_000 }).toBe('9');
  await a.ctx.close();
  await b.ctx.close();
});

test('mangled pastes: smart quotes + spaces still load; a cut-off code and a season-1 code are refused in plain English, nothing changed', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await boot(page, small(4, 20), DESK);
  const code = await copyCode(page);
  const box = page.getByLabel('Paste a save code');
  const restore = page.getByRole('button', { name: 'RESTORE' });
  const msg = page.locator('.sp-msg');
  await box.fill(code.slice(0, Math.floor(code.length / 2)));
  await restore.click();
  await expect(msg).toHaveText(/THIS CODE IS CUT OFF — THE END IS MISSING/);
  await shot(page, 'desktop-cut-off');
  // a season-1 code (econ 12): loading it used to stamp econ 12 and the season-2 boot wiped the whole save
  const s1 = await page.evaluate(() => btoa(JSON.stringify({ format: 'taw-save', v: 1, keys: { 'taw.econ': '12', 'taw.rebirths': '40', 'taw.xp': JSON.stringify({ lv: 200, into: 0 }) } })));
  await box.fill(s1);
  await restore.click();
  await expect(msg).toHaveText(/SEASON 1 CODE/);
  await shot(page, 'desktop-season1');
  expect(await page.evaluate(() => localStorage.getItem('taw.econ'))).toBe('13');
  expect(await rebirths(page)).toBe('4');
  // a code wrapped in smart quotes with spaces through it (a notes app / doc) loads
  await box.fill(`“${code.slice(0, 30)} ${code.slice(30, 90)}  ${code.slice(90)}”`);
  await restore.click();
  await expect(page.getByTestId('sp-load-compare')).toHaveText('THIS CODE: R4 · LV 20 · THIS DEVICE: R4 · LV 20');
});

test('COPY with the Clipboard API refused (in-app browser / school policy): the code is shown and one tap selects ALL of it', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('NotAllowedError')) }, configurable: true });
    document.execCommand = () => false;
  });
  await boot(page, small(3, 12), PHONE);
  await openSettings(page);
  await page.getByTestId('sp-save-copy').click();
  await expect(page.locator('.sp-msg')).toHaveText('TAP THE CODE BELOW TO SELECT IT ALL, THEN COPY');
  const ta = page.getByTestId('sp-save-code');
  await ta.click();
  const sel = await ta.evaluate((el) => ({ s: el.selectionStart, e: el.selectionEnd, n: el.value.length, head: el.value.slice(0, 5) }));
  expect(sel).toEqual({ s: 0, e: sel.n, n: sel.n, head: 'TAW2.' });
  await noScroll(page, PHONE);
});

for (const vp of [{ width: 1280, height: 551 }, { width: 360, height: 640 }]) {
  test(`@${vp.width}x${vp.height}: the load confirm fits — no scroll, LOAD on screen`, async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await boot(page, small(5, 30), vp);
    const code = await copyCode(page);
    await noScroll(page, vp);
    await shot(page, `copied-${vp.width}x${vp.height}`);
    await page.getByLabel('Paste a save code').fill(code);
    await page.getByRole('button', { name: 'RESTORE' }).click();
    const yes = page.getByTestId('sp-load-yes');
    await yes.waitFor({ state: 'visible' });
    await noScroll(page, vp);
    await shot(page, `confirm-${vp.width}x${vp.height}`);
    const b = await yes.evaluate((el) => el.getBoundingClientRect().bottom);
    expect(b).toBeLessThanOrEqual(vp.height);
  });
}
