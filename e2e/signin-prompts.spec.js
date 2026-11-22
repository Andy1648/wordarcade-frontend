// e2e/signin-prompts.spec.js — SAVE YOUR PROGRESS where it matters (nov21, Andy: "give more spaces to sign in with google
// … make things more user friendly"; account/SignInPrompt.jsx + signInNudge.js). At 390x844 and 1366x768:
//   * a GUEST with a board name sees SAVE YOUR RANK on the leaderboard and SAVE YOUR PROFILE on the profile — inside the
//     screen (no scroll, no overlap with the name), with Google's button and NOT NOW;
//   * NOT NOW hides it, and it stays hidden on the next visit (the week's snooze);
//   * SIGNED IN, Google OFF, or no name yet: no prompt anywhere.
// SIGNIN_SHOT_DIR=<folder> saves a screenshot per surface.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { navControl, menuReady } from './support/menu.js';
import { mockBoard } from './support/boardMock.js';
import { mockGsi } from './support/gsiMock.js';

const SHOTS = process.env.SIGNIN_SHOT_DIR;
const SECRET = 'e7'.repeat(24);
const FUTURE = Date.now() + 3_600_000;
const row = (id, username, o) => ({ id, username, level: 10, rebirths: 0, stars: 0, lifetime_words: 500, lifetime_letters: 2500, wins_per_word: 10, econ: 13, submitted_at: FUTURE, ...o });
const ABOVE = Array.from({ length: 10 }, (_, i) => row(`r${i}`, `RIVAL${i}`, { stars: 10 - i, rebirths: 5 }));
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const TOKEN = `${b64({ alg: 'HS256' })}.${b64({ sub: 'u-1', email: 'kid@example.com' })}.sig`;

async function boot(page, w, h, { named = true, signed = false, google = true, codes = false } = {}) {
  await page.setViewportSize({ width: w, height: h });
  await installBackendMock(page);
  const shared = { rows: [...ABOVE.map((x) => ({ ...x })), row('me', 'SAVEME', { rebirths: 3, level: 60 })], secrets: new Map([[SECRET, 'me']]), saves: new Map() };
  await mockBoard(page, [], { caps: true, shared, econ: true, boardEcon: true, weekly: true, rebirth: { delayMs: 0 }, season2: true });
  await mockGsi(page);
  if (codes) await page.route('**/rpc/lb_save_code_put', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, code: 'K7M2QX9PAH' }) }));
  await page.route('**/auth/v1/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: TOKEN, refresh_token: 'r', expires_in: 3600 }) }));
  await page.route(/\/rest\/v1\/rpc\/lb_auth_/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, linked: true, profile_id: 'me', username: 'SAVEME' }) }));
  await page.addInitScript(({ secret, named: n, signed: s, token }) => {
    if (sessionStorage.getItem('si.seeded')) return;
    sessionStorage.setItem('si.seeded', '1');
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.reduceMotion', '1');
    localStorage.setItem('taw.econ', '12');
    localStorage.setItem('taw.s2.xp', JSON.stringify({ lv: 60, f: 0.1, rc: 3, v: 10 }));
    localStorage.setItem('taw.s2.rebirths', '3');
    if (n) {
      localStorage.setItem('taw.lb.profile', JSON.stringify({ id: 'me', username: 'SAVEME' }));
      localStorage.setItem('taw.lb.secret', secret);
      localStorage.setItem('taw.lb.lastRank', '11');
    }
    localStorage.setItem('taw.seen.codeNudge', n ? '[]' : '["lv15","r1","lv50"]');
    if (s) localStorage.setItem('taw.auth', JSON.stringify({ access: token, refresh: 'r', exp: Date.now() + 3600_000, email: 'kid@example.com' }));
    window.__TAW_NO_ACHIEVEMENT_GRANT = true;
  }, { secret: SECRET, named, signed, token: TOKEN });
  await page.goto(`/?portal=1&season2=1${google ? '&google=1' : ''}`);
  await menuReady(page);
}

async function openBoard(page) {
  await navControl(page, 'leaderboard').click();
  await expect(page.locator('.lb2 .lb2-row.is-me, .lb2 .lb2-col.is-me').first()).toBeVisible({ timeout: 15_000 });
}
async function closeBoard(page) {
  await page.locator('.lb2-back').click();
  await expect(page.locator('.lb2')).toHaveCount(0);
}
async function openProfile(page) {
  await page.getByTestId('profile-plate').filter({ visible: true }).first().click();
  await expect(page.getByTestId('profile-popup')).toBeVisible();
  await page.waitForTimeout(400);
}
const overlap = (a, b) => a && b && Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 1 && Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 1;
const scrollers = (loc) => loc.evaluate((root) => [root, ...root.querySelectorAll('*')]
  .filter((el) => /(auto|scroll)/.test(getComputedStyle(el).overflowY) && el.scrollHeight > el.clientHeight + 1 && !el.closest('.lb2-scroll'))
  .map((el) => `${el.className} ${el.scrollHeight}>${el.clientHeight}`));

for (const [w, h] of [[390, 844], [1366, 768]]) {
  test(`@${w}: a named guest is asked on the board + the profile; NOT NOW sticks`, async ({ page }) => {
    await boot(page, w, h);
    await openBoard(page);
    const ask = page.getByTestId('signin-board');
    await expect(ask).toBeVisible();
    await expect(ask).toContainText('SAVE YOUR RANK');
    await expect(ask).toContainText('SAVEME');
    await expect(ask.getByTestId('gsi-official')).toBeVisible(); // Google's own button, drawn
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/board-guest-${w}.png` });
    const box = await ask.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(w + 1);
    expect(box.y + box.height).toBeLessThanOrEqual(h + 1);
    const climb = (await page.locator('.lb2-climb').count()) ? await page.locator('.lb2-climb').boundingBox() : null; // desktop: inside YOUR CLIMB
    if (climb) expect(box.y + box.height, 'the ask spills out of YOUR CLIMB').toBeLessThanOrEqual(climb.y + climb.height + 1);
    const no = await ask.getByTestId('signin-board-no').boundingBox();
    expect(no.height).toBeGreaterThanOrEqual(44);
    await ask.getByTestId('signin-board-no').click();
    await expect(ask).toHaveCount(0);
    await closeBoard(page);
    await openBoard(page);
    await expect(page.getByTestId('signin-board')).toHaveCount(0); // the week's snooze
    await closeBoard(page);

    await openProfile(page);
    const pf = page.getByTestId('profile-popup');
    const pask = pf.getByTestId('signin-profile');
    await expect(pask).toBeVisible();
    await expect(pask).toContainText('SAVE YOUR PROFILE');
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/profile-guest-${w}.png` });
    expect(await scrollers(pf), `profile scrolls at ${w}`).toEqual([]);
    const [name, pb, card] = await Promise.all([pf.locator('.pf-name').boundingBox(), pask.boundingBox(), pf.boundingBox()]);
    expect(overlap(name, pb), 'prompt overlaps the name').toBeFalsy();
    expect(pb.y + pb.height).toBeLessThanOrEqual(card.y + card.height + 1);
  });

  test(`@${w}: signed in → no prompt on the board or the profile`, async ({ page }) => {
    await boot(page, w, h, { signed: true });
    await openBoard(page);
    await page.waitForTimeout(500);
    await expect(page.getByTestId('signin-board')).toHaveCount(0);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/board-signed-${w}.png` });
    await closeBoard(page);
    await openProfile(page);
    await expect(page.getByTestId('signin-profile')).toHaveCount(0);
  });

  test(`@${w}: Google off, or no name yet → no prompt`, async ({ page }) => {
    await boot(page, w, h, { google: false });
    await openBoard(page);
    await page.waitForTimeout(500);
    await expect(page.getByTestId('signin-board')).toHaveCount(0);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/board-before-${w}.png` }); // = today's screen: no ask anywhere
    await closeBoard(page);
    await openProfile(page);
    await expect(page.getByTestId('signin-profile')).toHaveCount(0);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/profile-before-${w}.png` });
  });

  test(`@${w}: a guest with no name is not asked (claiming a name comes first)`, async ({ page }) => {
    await boot(page, w, h, { named: false });
    await openProfile(page);
    await expect(page.getByTestId('signin-profile')).toHaveCount(0);
  });
}

for (const [w, h] of [[390, 844], [1366, 768]]) {
  test(`@${w}: the WRITE DOWN YOUR CODE card offers Google; the sheet opens, NOT NOW closes it`, async ({ page }) => {
    await boot(page, w, h, { codes: true });
    const card = page.getByTestId('save-code-nudge');
    await expect(card).toBeVisible({ timeout: 15_000 });
    const g = card.getByTestId('save-code-nudge-google');
    await expect(g).toBeVisible();
    expect((await g.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await page.waitForTimeout(600);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/code-card-${w}.png` });
    await g.click();
    const sheet = page.getByTestId('signin-sheet');
    await expect(sheet).toBeVisible();
    await expect(sheet.getByTestId('gsi-official')).toBeVisible();
    const sb = await sheet.boundingBox();
    expect(sb.x).toBeGreaterThanOrEqual(0);
    expect(sb.x + sb.width).toBeLessThanOrEqual(w + 1);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/code-sheet-${w}.png` });
    await sheet.getByTestId('signin-sheet-no').click();
    await expect(sheet).toHaveCount(0);
    const seen = JSON.parse(await page.evaluate(() => localStorage.getItem('taw.seen.signin')));
    expect(seen.code.no).toBe(1); // a week's rest for this place
  });
}
