// e2e/google-signin.spec.js — SIGN IN WITH GOOGLE (Andy nov4 "progress is never lost and purchases are secure"; 085,
// leaderboard/auth.js) over Google Identity Services. Two browser contexts share one mocked database (boardMock's shared
// rows / secrets / cloud saves), a mocked GIS script (support/gsiMock.js) and a mocked Supabase Auth, whose
// /auth/v1/token?grant_type=id_token does what Supabase does with Skip Nonce Check OFF: refuse unless the SHA-256 (hex)
// of the raw nonce it is given equals the token's `nonce` claim.
//   1. device A (named, real save) signs in from SETTINGS → LINK GOOGLEKID? → LINK → its board row links (stamp);
//   2. device B (a fresh browser) signs in with the same account → no confirm (nothing of its own) → it gets its OWN
//      device secret on A's row, loads A's cloud save and reloads as A's name, level and wins;
//   3. a device with progress of its own is ASKED first (LOAD <NAME> / NOT NOW); NOT NOW changes nothing and signs out;
//   4. signing out keeps every bit of progress, the name and the secret;
//   5. nonce / audience / replay refusals, a blocked script, a popup that never answers, lazy loading, fit.
import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { installBackendMock } from './support/backendMock.js';
import { mockBoard } from './support/boardMock.js';
import { mockGsi, GSI_URL } from './support/gsiMock.js';
import { menuReady } from './support/menu.js';

const SECRET = 'd'.repeat(48);
const ID = 'me-google';
const HOUR = 3600 * 1000;
const UID = '9f9f9f9f-0000-4000-8000-000000000001';
const SHOTS = process.env.SHOTS;

// a JWT-shaped token whose payload carries the email (auth.js shows it on this device only)
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const TOKEN = `${b64({ alg: 'HS256' })}.${b64({ sub: UID, email: 'kid@example.com' })}.sig`;

const sharedDb = () => ({
  rows: [{ id: ID, username: 'GoogleKid', level: 40, rebirths: 3, lifetime_words: 0, lifetime_letters: 0, wins_per_word: 0, econ: 13, stars: 0, submitted_at: Date.now() - HOUR }],
  secrets: new Map([[SECRET, ID]]),
  saves: new Map(),
  grants: new Map(),
  links: new Map(), // 085 auth_links: uid -> profile id
});

const claimsOf = (jwt) => { try { return JSON.parse(Buffer.from(String(jwt).split('.')[1], 'base64url').toString()); } catch { return null; } };

/** The mocked Supabase Auth + 085 RPCs on one page, over the shared db. */
async function mockAuth(page, shared, calls, seen) {
  await page.route('**/auth/v1/authorize**', (route) => { seen.authorize += 1; return route.abort(); }); // the old redirect
  await page.route('**/auth/v1/token?grant_type=id_token', async (route) => {
    const b = JSON.parse(route.request().postData() || '{}');
    const c = claimsOf(b.id_token);
    const nonceOk = !!c && typeof b.nonce === 'string' && createHash('sha256').update(b.nonce).digest('hex') === c.nonce;
    seen.tokenCalls.push({ provider: b.provider, nonceOk, hashedRaw: c && b.nonce === c.nonce });
    if (seen.refuseNext) { seen.refuseNext = false; return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'invalid_grant' }) }); }
    if (!nonceOk || b.provider !== 'google') return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'invalid_grant', msg: 'Passed nonce and nonce in id_token should either both exist or not.' }) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: TOKEN, refresh_token: 'r1', expires_in: 3600, token_type: 'bearer' }) });
  });
  await page.route('**/auth/v1/logout', (route) => route.fulfill({ status: 204 }));
  const uidOf = (req) => ((req.headers().authorization || '') === `Bearer ${TOKEN}` ? UID : null);
  await page.route(/\/rest\/v1\/rpc\/lb_auth_(status|link|restore)$/, async (route) => {
    const req = route.request();
    const fn = new URL(req.url()).pathname.split('/').pop();
    const body = JSON.parse(req.postData() || '{}');
    calls.push(fn);
    const json = (b) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
    const uid = uidOf(req);
    if (!uid) return json({ ok: false, reason: 'sign_in' });
    if (fn === 'lb_auth_status') {
      const pid = shared.links.get(uid);
      if (!pid) return json({ ok: true, linked: false });
      const r = shared.rows.find((x) => x.id === pid);
      return json({ ok: true, linked: true, profile_id: pid, username: r.username, level: r.level, rebirths: r.rebirths });
    }
    if (fn === 'lb_auth_link') {
      const pid = shared.secrets.get(body.p_secret);
      if (!pid) return json({ ok: false, reason: 'no_profile' });
      if (shared.links.has(uid) && shared.links.get(uid) !== pid) return json({ ok: false, reason: 'account_taken' });
      shared.links.set(uid, pid);
      return json({ ok: true, again: false, profile_id: pid });
    }
    const pid = shared.links.get(uid); // lb_auth_restore: this device's NEW secret joins the linked row
    if (!pid) return json({ ok: false, reason: 'not_linked' });
    shared.secrets.set(body.p_new_secret, pid);
    return json({ ok: true, profile_id: pid, username: shared.rows.find((x) => x.id === pid).username });
  });
}

async function device(browser, shared, { save, own = false, google = true, payments = false, blocked = false, viewport = { width: 1280, height: 720 } }) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const calls = [];
  const seen = { authorize: 0, tokenCalls: [], refuseNext: false };
  await installBackendMock(page);
  await page.addInitScript(() => { window.__TAW_NO_ACHIEVEMENT_GRANT = true; });
  await mockBoard(page, [], { caps: true, shared, econ: true, boardEcon: true, rebirth: { delayMs: 0 }, season2: true, season2Reset: true });
  await mockAuth(page, shared, calls, seen);
  const gsi = await mockGsi(page, { blocked });
  await page.addInitScript(({ secret, id, save: s, own: o }) => {
    if (sessionStorage.getItem('gs.seeded')) return;
    sessionStorage.setItem('gs.seeded', '1');
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.reduceMotion', '1');
    localStorage.setItem('taw.econ', '13');
    if (s) {
      localStorage.setItem('taw.lb.profile', JSON.stringify({ id, username: 'GoogleKid' }));
      localStorage.setItem('taw.lb.secret', secret);
      localStorage.setItem('taw.s2.xp', JSON.stringify({ lv: 40, f: 0.25, rc: 3, v: 10 }));
      localStorage.setItem('taw.s2.rebirths', '3');
      localStorage.setItem('taw.s2.wins', '777');
    }
    if (o) { // a guest with progress of its own (no name)
      localStorage.setItem('taw.s2.xp', JSON.stringify({ lv: 9, f: 0.5, rc: 0, v: 10 }));
      localStorage.setItem('taw.s2.wins', '12');
    }
  }, { secret: SECRET, id: ID, save, own });
  const checkouts = [];
  await page.route('**/api/checkout', async (route) => {
    checkouts.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ url: '/?season2=1&portal=1&payments=1&google=1' }) });
  });
  await page.route('**/rest/v1/rpc/pay_gems_pending', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ rows: [], spent_cents: 0, cap_cents: 2000, flagged: false, profile: true }) }));
  await page.goto(`/?portal=1&season2=1${google ? '&google=1' : ''}${payments ? '&payments=1' : ''}`);
  await menuReady(page);
  return { ctx, page, calls, seen, gsi, checkouts };
}
const raw = (page, k) => page.evaluate((key) => localStorage[key] ?? null, k).catch(() => null);
async function openSettings(page) {
  await page.locator('[data-nav="settings"]:visible').first().click();
  await page.locator('.sp-sheet').waitFor({ state: 'visible' });
}
const googleBtn = (page) => page.getByTestId('sp-account').getByTestId('gsi-official');
async function signInFromSettings(page) {
  await openSettings(page);
  await googleBtn(page).click();
}

test('device A links its board row; device B signs in, gets its own secret on that row and loads A\'s progress', async ({ browser }) => {
  test.setTimeout(120_000);
  const shared = sharedDb();
  const a = await device(browser, shared, { save: true });
  await expect.poll(() => shared.saves.size, { timeout: 15_000 }).toBe(1); // A's save is in the cloud
  await signInFromSettings(a.page);
  // nothing links without the player's OK (security review HIGH 2), and the dialog opens over Settings
  const ask = a.page.getByTestId('auth-confirm-link');
  await expect(ask).toBeVisible({ timeout: 15_000 });
  await expect(ask).toContainText('GoogleKid');
  expect(shared.links.size).toBe(0);
  if (SHOTS) await a.page.screenshot({ path: `${SHOTS}/signin-link-confirm-1280.png` });
  await a.page.getByTestId('auth-link').click(); // a real click: fails if Settings is on top of it
  await expect(a.page.getByTestId('auth-stamp')).toContainText('SAVED TO YOUR GOOGLE ACCOUNT', { timeout: 15_000 });
  expect(shared.links.get(UID)).toBe(ID);
  expect(JSON.parse(await raw(a.page, 'taw.auth')).email).toBe('kid@example.com');
  if (SHOTS) await a.page.screenshot({ path: `${SHOTS}/signin-linked-1280.png` });

  const b = await device(browser, shared, { save: false });
  await signInFromSettings(b.page);
  // nothing of its own on B: no question — it restores and reloads into the account
  await expect.poll(async () => JSON.parse((await raw(b.page, 'taw.lb.profile')) || '{}').username, { timeout: 20_000 }).toBe('GoogleKid');
  await expect.poll(async () => JSON.parse((await raw(b.page, 'taw.s2.xp')) || '{}').lv, { timeout: 20_000 }).toBe(40);
  expect(await raw(b.page, 'taw.s2.wins')).toBe('777');
  const bSecret = await raw(b.page, 'taw.lb.secret');
  expect(bSecret).not.toBe(SECRET); // B's OWN device secret…
  expect(shared.secrets.get(bSecret)).toBe(ID); // …on A's row; A keeps its own
  expect(shared.secrets.get(SECRET)).toBe(ID);
  expect(b.calls).toContain('lb_auth_restore');
  await a.ctx.close();
  await b.ctx.close();
});

for (const vp of [{ width: 1366, height: 768 }, { width: 390, height: 844 }]) {
  test(`@${vp.width}: a device with progress of its own is ASKED first; NOT NOW keeps it and signs out`, async ({ browser }) => {
    test.setTimeout(120_000);
    const shared = sharedDb();
    shared.links.set(UID, ID); // the account already has a row (A linked it earlier)
    const c = await device(browser, shared, { save: false, own: true, viewport: vp });
    await signInFromSettings(c.page);
    const ask = c.page.getByTestId('auth-confirm');
    await expect(ask).toBeVisible({ timeout: 15_000 });
    await expect(ask).toContainText('GoogleKid');
    await expect(ask).toContainText('LV 40');
    // the dialog fits: inside the viewport, its buttons real tap targets, nothing overlapping
    const m = await ask.evaluate((el) => {
      const box = el.querySelector('.al-box').getBoundingClientRect();
      const btns = [...el.querySelectorAll('.al-btn')].map((b) => b.getBoundingClientRect());
      const hit = (p, q) => Math.min(p.right, q.right) - Math.max(p.left, q.left) > 1 && Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top) > 1;
      return { inside: box.left >= 0 && box.right <= innerWidth && box.bottom <= innerHeight, minH: Math.min(...btns.map((b) => b.height)), overlap: hit(btns[0], btns[1]) };
    });
    expect(m.inside).toBe(true);
    expect(m.minH).toBeGreaterThanOrEqual(44);
    expect(m.overlap).toBe(false);
    if (SHOTS) await c.page.screenshot({ path: `${SHOTS}/signin-confirm-${vp.width}.png` });
    await c.page.getByTestId('auth-not-now').click();
    await expect(ask).toHaveCount(0);
    expect(JSON.parse((await raw(c.page, 'taw.s2.xp')) || '{}').lv).toBe(9); // its own progress, untouched
    expect(await raw(c.page, 'taw.auth')).toBeNull(); // signed out of that account here
    expect(c.calls).not.toContain('lb_auth_restore');
    await c.ctx.close();
  });
}

test('a device with progress of its own: LOAD replaces it with the account\'s', async ({ browser }) => {
  test.setTimeout(120_000);
  const shared = sharedDb();
  const a = await device(browser, shared, { save: true });
  await expect.poll(() => shared.saves.size, { timeout: 15_000 }).toBe(1);
  shared.links.set(UID, ID);
  const c = await device(browser, shared, { save: false, own: true });
  await signInFromSettings(c.page);
  await c.page.getByTestId('auth-load').click();
  await expect.poll(async () => JSON.parse((await raw(c.page, 'taw.s2.xp')) || '{}').lv, { timeout: 20_000 }).toBe(40);
  // polled: LOAD reloads the page, and raw() reads null mid-navigation
  await expect.poll(async () => JSON.parse((await raw(c.page, 'taw.lb.profile')) || '{}').username, { timeout: 20_000 }).toBe('GoogleKid');
  await a.ctx.close();
  await c.ctx.close();
});

test('signing out keeps the progress, the name and the device secret; Settings shows the button again, and it still works', async ({ browser }) => {
  test.setTimeout(90_000);
  const shared = sharedDb();
  const a = await device(browser, shared, { save: true });
  await signInFromSettings(a.page);
  await a.page.getByTestId('auth-link').click();
  await expect(a.page.getByTestId('auth-stamp')).toBeVisible({ timeout: 15_000 });
  const acct = a.page.getByTestId('sp-account'); // Settings stayed open under the dialog: the popup never left the page
  await expect(acct.getByTestId('account-line')).toHaveAttribute('data-signed', 'yes');
  await expect(acct).toContainText('kid@example.com');
  if (SHOTS) await a.page.screenshot({ path: `${SHOTS}/settings-signed-in-1280.png` });
  await acct.getByTestId('google-signout').click();
  await expect(acct.getByTestId('account-line')).toHaveAttribute('data-signed', 'no');
  expect(await raw(a.page, 'taw.lb.secret')).toBe(SECRET);
  expect(JSON.parse(await raw(a.page, 'taw.lb.profile')).username).toBe('GoogleKid');
  expect(await raw(a.page, 'taw.s2.wins')).toBe('777');
  await googleBtn(a.page).click(); // a fresh nonce for the second sign-in
  await expect.poll(() => a.seen.tokenCalls.length).toBe(2);
  expect(a.seen.tokenCalls.every((c) => c.nonceOk)).toBe(true);
  await expect.poll(async () => !!(await raw(a.page, 'taw.auth'))).toBe(true);
  await a.ctx.close();
});

test('VITE_GOOGLE_ON off (no ?google=1 in the e2e build, as production ships until the provider is set up): no button, no Google script', async ({ browser }) => {
  test.setTimeout(60_000);
  const shared = sharedDb();
  const a = await device(browser, shared, { save: true, google: false });
  await openSettings(a.page);
  await expect(a.page.locator('.sp-group-title')).toHaveText(['SOUND', 'GAMEPLAY', 'REWARD CODE', 'SAVE CODE', 'DANGER ZONE']);
  await expect(a.page.getByTestId('sp-account')).toHaveCount(0);
  await expect(a.page.getByTestId('google-signin')).toHaveCount(0);
  expect(a.gsi.requests).toBe(0);
  expect(a.calls).toEqual([]);
  await a.ctx.close();
});

// ====================================================================== GIS: the token only ever comes from the callback
test('the nonce: Google gets the SHA-256, Supabase gets the raw value; a token for another nonce is refused and never sent', async ({ browser }) => {
  test.setTimeout(90_000);
  const shared = sharedDb();
  const a = await device(browser, shared, { save: true });
  await openSettings(a.page);
  await expect(googleBtn(a.page)).toBeVisible();
  const cfg = await a.page.evaluate(() => { const c = window.__gsiCfg; return { nonce: c.nonce, client: c.client_id, mode: c.ux_mode, auto: c.auto_select }; });
  expect(cfg.nonce).toMatch(/^[0-9a-f]{64}$/); // a SHA-256 in hex
  expect(cfg.client).toBe('e2e-client.apps.googleusercontent.com');
  expect(cfg.mode).toBe('popup');
  expect(cfg.auto).toBe(false);

  // a token minted for someone else's nonce (a replayed or injected credential)
  await a.page.evaluate(() => { window.__gsiNonce = 'f'.repeat(64); });
  await googleBtn(a.page).click();
  await expect(a.page.getByTestId('google-note')).toContainText('SAFETY CHECK');
  expect(a.seen.tokenCalls.length).toBe(0); // never sent to Supabase
  expect(await raw(a.page, 'taw.auth')).toBeNull();
  expect(a.calls).toEqual([]);

  // another app's token (the right nonce, the wrong audience)
  await a.page.evaluate(() => { window.__gsiNonce = null; window.__gsiAud = 'someone-else.apps.googleusercontent.com'; });
  await expect(googleBtn(a.page)).toBeVisible();
  await googleBtn(a.page).click();
  await expect.poll(() => a.page.evaluate(() => window.__gsiInits)).toBe(3); // re-armed again
  expect(a.seen.tokenCalls.length).toBe(0);

  // the button isn't dead: a clean attempt goes through, with the raw nonce (not the hash) to Supabase
  await a.page.evaluate(() => { window.__gsiAud = null; });
  await expect(googleBtn(a.page)).toBeVisible();
  await googleBtn(a.page).click();
  await expect(a.page.getByTestId('auth-confirm-link')).toBeVisible({ timeout: 15_000 });
  expect(a.seen.tokenCalls).toEqual([{ provider: 'google', nonceOk: true, hashedRaw: false }]);
  expect(a.seen.authorize).toBe(0); // no redirect flow at all
  await a.ctx.close();
});

test('Supabase refusing the token says so; the old token can\'t be replayed; the next attempt works on a new nonce', async ({ browser }) => {
  test.setTimeout(90_000);
  const shared = sharedDb();
  const a = await device(browser, shared, { save: true });
  await openSettings(a.page);
  a.seen.refuseNext = true;
  await googleBtn(a.page).click();
  await expect(a.page.getByTestId('google-note')).toContainText('DIDN’T FINISH');
  expect(await raw(a.page, 'taw.auth')).toBeNull();
  await expect(googleBtn(a.page)).toBeVisible();
  // the spent token, handed to the callback again: its nonce is gone, so it never reaches Supabase
  const sent = a.seen.tokenCalls.length;
  await a.page.evaluate(() => window.__gsiCfg.callback({ credential: window.__gsiLast }));
  await a.page.waitForTimeout(300);
  expect(a.seen.tokenCalls.length).toBe(sent);
  expect(await raw(a.page, 'taw.auth')).toBeNull();
  await expect(googleBtn(a.page)).toBeVisible();
  await googleBtn(a.page).click();
  await expect(a.page.getByTestId('auth-confirm-link')).toBeVisible({ timeout: 15_000 });
  expect(a.seen.tokenCalls.at(-1).nonceOk).toBe(true);
  await a.ctx.close();
});

test('stray tokens and codes in the URL do nothing: there is no landing to forge', async ({ browser }) => {
  test.setTimeout(60_000);
  const shared = sharedDb();
  const a = await device(browser, shared, { save: true });
  await a.page.goto(`/?portal=1&season2=1&google=1&signin=1&code=attacker#access_token=${TOKEN}&refresh_token=r1&expires_in=3600&token_type=bearer`);
  await menuReady(a.page);
  await a.page.waitForTimeout(1200);
  expect(await raw(a.page, 'taw.auth')).toBeNull();
  await expect(a.page.getByTestId('auth-stamp')).toHaveCount(0);
  await expect(a.page.getByTestId('auth-confirm-link')).toHaveCount(0);
  expect(a.seen.tokenCalls.length).toBe(0);
  expect(a.calls).toEqual([]); // no lb_auth_* call at all
  expect(shared.links.size).toBe(0);
  await a.ctx.close();
});

test('the popup stays on this page: no navigation, no redirect, and the token never appears in the URL', async ({ browser }) => {
  test.setTimeout(60_000);
  const shared = sharedDb();
  const a = await device(browser, shared, { save: true });
  await openSettings(a.page);
  const urlBefore = a.page.url();
  let navs = 0;
  a.page.on('framenavigated', (f) => { if (f === a.page.mainFrame()) navs += 1; });
  await googleBtn(a.page).click();
  await expect(a.page.getByTestId('auth-confirm-link')).toBeVisible({ timeout: 15_000 });
  expect(navs).toBe(0);
  expect(a.page.url()).toBe(urlBefore);
  expect(a.seen.authorize).toBe(0);
  await a.ctx.close();
});

test('lazy: the menu never asks for Google\'s script; the first sign-in button does, once', async ({ browser }) => {
  test.setTimeout(60_000);
  const shared = sharedDb();
  const a = await device(browser, shared, { save: true });
  await a.page.waitForTimeout(800);
  expect(a.gsi.requests).toBe(0);
  await openSettings(a.page);
  await expect(googleBtn(a.page)).toBeVisible();
  expect(a.gsi.requests).toBe(1);
  expect(await a.page.locator(`script[src="${GSI_URL}"]`).count()).toBe(1);
  await a.ctx.close();
});

// ============================================================== school / Chromebook: never a dead button
test('a school filter blocks Google\'s script: a clear line + RETRY, the save code still there; RETRY works once it loads', async ({ browser }) => {
  test.setTimeout(60_000);
  const shared = sharedDb();
  const a = await device(browser, shared, { save: true, blocked: true });
  await openSettings(a.page);
  const blocked = a.page.getByTestId('google-blocked');
  await expect(blocked).toContainText('BLOCKED');
  await expect(blocked).toContainText('SAVE CODE');
  await expect(googleBtn(a.page)).toHaveCount(0);
  const retry = a.page.getByTestId('google-retry');
  expect((await retry.boundingBox()).height).toBeGreaterThanOrEqual(44);
  await expect(a.page.locator('.sp-sheet')).toContainText('SAVE CODE');
  if (SHOTS) await a.page.screenshot({ path: `${SHOTS}/signin-blocked-1280.png` });
  await retry.click(); // still blocked: back to the same line, no crash
  await expect(blocked).toBeVisible();
  a.gsi.blocked = false;
  await retry.click();
  await expect(googleBtn(a.page)).toBeVisible();
  await expect(blocked).toHaveCount(0);
  await a.ctx.close();
});

test('a click Google never answers (a school admin block, a closed popup): after a wait, what to try; the button still works', async ({ browser }) => {
  test.setTimeout(60_000);
  const shared = sharedDb();
  const a = await device(browser, shared, { save: true });
  await openSettings(a.page);
  await a.page.evaluate(() => { window.__gsiSilent = true; });
  await googleBtn(a.page).click();
  await expect(a.page.getByTestId('google-note')).toContainText('PERSONAL', { timeout: 14_000 });
  if (SHOTS) await a.page.screenshot({ path: `${SHOTS}/signin-no-answer-1280.png` });
  await a.page.evaluate(() => { window.__gsiSilent = false; });
  await googleBtn(a.page).click();
  await expect(a.page.getByTestId('auth-confirm-link')).toBeVisible({ timeout: 15_000 });
  await a.ctx.close();
});

// ============================================================== UI checklist: the iframe's slot fits every Settings size
for (const vp of [{ width: 1366, height: 768 }, { width: 1920, height: 1080 }, { width: 390, height: 844 }, { width: 360, height: 640 }]) {
  test(`@${vp.width}x${vp.height}: Google's button fits Settings, with its failure states, and nothing scrolls`, async ({ browser }) => {
    test.setTimeout(60_000);
    const shared = sharedDb();
    const a = await device(browser, shared, { save: true, viewport: vp });
    await openSettings(a.page);
    await expect(googleBtn(a.page)).toBeVisible();
    const fit = () => a.page.evaluate(() => {
      const sheet = document.querySelector('.sp-sheet');
      const box = (el) => el.getBoundingClientRect();
      const slot = document.querySelector('[data-testid="sp-account"] [data-testid="google-signin"]');
      const line = box(document.querySelector('[data-testid="sp-account"]'));
      const r = box(slot);
      const btn = slot.querySelector('[data-testid="gsi-official"], [data-testid="google-retry"]');
      const inner = [sheet, sheet.querySelector('.sp')].filter(Boolean);
      return {
        slotH: r.height,
        btnH: btn ? box(btn).height : 0,
        inSheet: box(btn).left >= box(sheet).left && box(btn).right <= box(sheet).right && r.right <= line.right + 1,
        scrolls: inner.some((el) => el.scrollHeight > el.clientHeight + 1),
        pageScroll: document.documentElement.scrollWidth > innerWidth,
        bottom: box(sheet).bottom <= innerHeight + 1,
      };
    });
    const ready = await fit();
    expect(ready).toMatchObject({ inSheet: true, scrolls: false, pageScroll: false, bottom: true });
    expect(ready.slotH).toBeGreaterThanOrEqual(vp.height < 700 ? 40 : 44); // the slot holds 44 px; Google's own button inside is ~40
    expect(ready.btnH).toBeGreaterThanOrEqual(40);
    if (SHOTS) await a.page.screenshot({ path: `${SHOTS}/signin-settings-${vp.width}.png` });
    // the longest failure line, in the same spot
    await a.page.evaluate(() => { window.__gsiNonce = 'f'.repeat(64); });
    await googleBtn(a.page).click();
    await expect(a.page.getByTestId('google-note')).toBeVisible();
    const failed = await fit();
    expect(failed).toMatchObject({ inSheet: true, scrolls: false, pageScroll: false, bottom: true });
    if (SHOTS) await a.page.screenshot({ path: `${SHOTS}/signin-settings-failed-${vp.width}.png` });
    await a.ctx.close();
  });

  test(`@${vp.width}x${vp.height}: the blocked line + RETRY fit Settings too`, async ({ browser }) => {
    test.setTimeout(60_000);
    const a = await device(browser, sharedDb(), { save: true, blocked: true, viewport: vp });
    await openSettings(a.page);
    const retry = a.page.getByTestId('google-retry');
    await expect(retry).toBeVisible();
    await expect(a.page.getByText('REDUCE MOTION')).toBeVisible(); // a filtered network is every visit: GAMEPLAY stays reachable
    const m = await a.page.evaluate(() => {
      const sheet = document.querySelector('.sp-sheet');
      const s = sheet.getBoundingClientRect();
      const r = document.querySelector('[data-testid="google-retry"]').getBoundingClientRect();
      return { scrolls: sheet.scrollHeight > sheet.clientHeight + 1, inside: r.left >= s.left && r.right <= s.right && r.bottom <= s.bottom, h: r.height };
    });
    expect(m).toMatchObject({ scrolls: false, inside: true });
    expect(m.h).toBeGreaterThanOrEqual(44);
    if (SHOTS) await a.page.screenshot({ path: `${SHOTS}/signin-settings-blocked-${vp.width}.png` });
    await a.ctx.close();
  });
}

// ============================================================== a pack tapped signed out: Google first, then that purchase
async function tapPackSignedOut(page) {
  await page.locator('[data-testid="gems-plus"]:visible').first().click();
  await page.getByTestId('buy-gems').locator('.pg-pack[data-pack="pile"]').click();
  await page.getByTestId('pay-signin').getByTestId('gsi-official').click();
}
test('signed out, an account already linked to this name: a pack → Google → straight on to checkout for that pack', async ({ browser }) => {
  test.setTimeout(60_000);
  const shared = sharedDb();
  shared.links.set(UID, ID);
  const a = await device(browser, shared, { save: true, payments: true });
  await tapPackSignedOut(a.page);
  await expect.poll(() => a.checkouts.length, { timeout: 15_000 }).toBe(1);
  expect(a.checkouts[0].pack).toBe('pile');
  expect(a.checkouts[0].access).toBe(TOKEN);
  await a.ctx.close();
});

test('signed out, not linked yet: a pack → Google → LINK → checkout; NOT NOW buys nothing and stays on the sign-in step', async ({ browser }) => {
  test.setTimeout(60_000);
  const shared = sharedDb();
  const a = await device(browser, shared, { save: true, payments: true });
  await tapPackSignedOut(a.page);
  await a.page.getByTestId('auth-link-not-now').click();
  await expect(a.page.getByTestId('auth-confirm-link')).toHaveCount(0);
  expect(a.checkouts.length).toBe(0);
  await expect(a.page.getByTestId('pay-signin')).toBeVisible();
  await a.page.getByTestId('pay-signin').getByTestId('gsi-official').click();
  await a.page.getByTestId('auth-link').click(); // a real click: the dialog sits above the panel
  await expect.poll(() => a.checkouts.length, { timeout: 15_000 }).toBe(1);
  expect(a.checkouts[0].pack).toBe('pile');
  expect(shared.links.get(UID)).toBe(ID);
  await a.ctx.close();
});

test('signed out on a fresh browser: a pack → Google → the account restores (a reload) → the purchase carries on, once', async ({ browser }) => {
  test.setTimeout(90_000);
  const shared = sharedDb();
  const first = await device(browser, shared, { save: true });
  await expect.poll(() => shared.saves.size, { timeout: 15_000 }).toBe(1);
  shared.links.set(UID, ID);
  const b = await device(browser, shared, { save: false, payments: true });
  await tapPackSignedOut(b.page);
  await expect.poll(() => b.checkouts.length, { timeout: 25_000 }).toBe(1);
  expect(b.checkouts[0].pack).toBe('pile');
  expect(JSON.parse(await raw(b.page, 'taw.lb.profile')).username).toBe('GoogleKid');
  await b.page.waitForTimeout(1500);
  expect(b.checkouts.length).toBe(1);
  expect(await b.page.evaluate(() => sessionStorage.getItem('taw.pay.resume'))).toBeNull();
  await first.ctx.close();
  await b.ctx.close();
});
