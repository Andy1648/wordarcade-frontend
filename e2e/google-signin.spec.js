// e2e/google-signin.spec.js — SIGN IN WITH GOOGLE (Andy nov4 "progress is never lost and purchases are secure"; 085,
// leaderboard/auth.js). Two browser contexts share one mocked database (boardMock's shared rows / secrets / cloud
// saves) and a mocked Supabase Auth (Google's consent screen is skipped: /auth/v1/authorize redirects straight back
// with a PKCE ?code=, as Supabase does after Google; /auth/v1/token?grant_type=pkce only trades it for the verifier
// that hashes to the challenge the sign-in sent — security review nov4):
//   1. device A (named, real save) signs in from SETTINGS → LINK GOOGLEKID? → LINK → its board row links (stamp);
//   2. device B (a fresh browser) signs in with the same account → no confirm (nothing of its own) → it gets its OWN
//      device secret on A's row, loads A's cloud save and reloads as A's name, level and wins;
//   3. a device with progress of its own is ASKED first (LOAD <NAME> / NOT NOW); NOT NOW changes nothing and signs out;
//   4. signing out keeps every bit of progress, the name and the secret.
import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { installBackendMock } from './support/backendMock.js';
import { mockBoard } from './support/boardMock.js';
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
  codes: new Map(), // PKCE: code -> the challenge it was minted for
});

/** The mocked Supabase Auth + 085 RPCs on one page, over the shared db. */
const s256 = (v) => createHash('sha256').update(v).digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
async function mockAuth(page, shared, calls, seen) {
  await page.route('**/auth/v1/authorize**', (route) => {
    const u = new URL(route.request().url());
    const q = Object.fromEntries(u.searchParams);
    seen.authorize.push(q);
    const back = new URL(q.redirect_to);
    const code = `code-${seen.authorize.length}-${Math.random().toString(36).slice(2)}`;
    shared.codes.set(code, q.code_challenge);
    back.searchParams.set('portal', '1');
    back.searchParams.set('season2', '1');
    back.searchParams.set('google', '1'); // the e2e build's flag (googleFlag.js), as the page that left had it
    back.searchParams.set('code', code);
    return route.fulfill({ status: 302, headers: { location: back.toString() } });
  });
  await page.route('**/auth/v1/token?grant_type=pkce', async (route) => {
    const b = JSON.parse(route.request().postData() || '{}');
    const want = shared.codes.get(b.auth_code);
    const ok = !!want && typeof b.code_verifier === 'string' && s256(b.code_verifier) === want;
    seen.tokenCalls.push({ ok });
    if (!ok) return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'invalid_grant' }) });
    shared.codes.delete(b.auth_code);
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

async function device(browser, shared, { save, own = false, google = true, viewport = { width: 1280, height: 720 } }) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const calls = [];
  const seen = { authorize: [], tokenCalls: [] };
  await installBackendMock(page);
  await page.addInitScript(() => { window.__TAW_NO_ACHIEVEMENT_GRANT = true; });
  await mockBoard(page, [], { caps: true, shared, econ: true, boardEcon: true, rebirth: { delayMs: 0 }, season2: true, season2Reset: true });
  await mockAuth(page, shared, calls, seen);
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
  await page.goto(`/?portal=1&season2=1${google ? '&google=1' : ''}`);
  await menuReady(page);
  return { ctx, page, calls, authorize: seen.authorize, tokenCalls: seen.tokenCalls };
}
const raw = (page, k) => page.evaluate((key) => localStorage[key] ?? null, k).catch(() => null);
async function signInFromSettings(page) {
  await page.locator('[data-nav="settings"]:visible').first().click();
  await page.locator('.sp-sheet').waitFor({ state: 'visible' });
  const btn = page.getByTestId('sp-account').getByTestId('google-signin');
  await expect(btn).toBeVisible();
  await btn.click();
}

test('device A links its board row; device B signs in, gets its own secret on that row and loads A\'s progress', async ({ browser }) => {
  test.setTimeout(120_000);
  const shared = sharedDb();
  const a = await device(browser, shared, { save: true });
  await expect.poll(() => shared.saves.size, { timeout: 15_000 }).toBe(1); // A's save is in the cloud
  await signInFromSettings(a.page);
  // nothing links without the player's OK (security review HIGH 2)
  const ask = a.page.getByTestId('auth-confirm-link');
  await expect(ask).toBeVisible({ timeout: 15_000 });
  await expect(ask).toContainText('GoogleKid');
  expect(shared.links.size).toBe(0);
  if (SHOTS) await a.page.screenshot({ path: `${SHOTS}/signin-link-confirm-1280.png` });
  await a.page.getByTestId('auth-link').click();
  await expect(a.page.getByTestId('auth-stamp')).toContainText('SAVED TO YOUR GOOGLE ACCOUNT', { timeout: 15_000 });
  expect(shared.links.get(UID)).toBe(ID);
  expect(await a.page.evaluate(() => location.search)).not.toContain('code='); // the code never stays in the address bar
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
  expect(JSON.parse(await raw(c.page, 'taw.lb.profile')).username).toBe('GoogleKid');
  await a.ctx.close();
  await c.ctx.close();
});

test('signing out keeps the progress, the name and the device secret; Settings shows the button again', async ({ browser }) => {
  test.setTimeout(90_000);
  const shared = sharedDb();
  const a = await device(browser, shared, { save: true });
  await signInFromSettings(a.page);
  await a.page.getByTestId('auth-link').click();
  await expect(a.page.getByTestId('auth-stamp')).toBeVisible({ timeout: 15_000 });
  await a.page.locator('[data-nav="settings"]:visible').first().click();
  const acct = a.page.getByTestId('sp-account');
  await expect(acct.getByTestId('account-line')).toHaveAttribute('data-signed', 'yes');
  await expect(acct).toContainText('kid@example.com');
  if (SHOTS) await a.page.screenshot({ path: `${SHOTS}/settings-signed-in-1280.png` });
  await acct.getByTestId('google-signout').click();
  await expect(acct.getByTestId('account-line')).toHaveAttribute('data-signed', 'no');
  expect(await raw(a.page, 'taw.lb.secret')).toBe(SECRET);
  expect(JSON.parse(await raw(a.page, 'taw.lb.profile')).username).toBe('GoogleKid');
  expect(await raw(a.page, 'taw.s2.wins')).toBe('777');
  await a.ctx.close();
});

test('VITE_GOOGLE_ON off (no ?google=1 in the e2e build, as production ships until the provider is set up): no button anywhere, no landing', async ({ browser }) => {
  test.setTimeout(60_000);
  const shared = sharedDb();
  const a = await device(browser, shared, { save: true, google: false });
  await a.page.locator('[data-nav="settings"]:visible').first().click();
  await a.page.locator('.sp-sheet').waitFor({ state: 'visible' });
  await expect(a.page.locator('.sp-group-title')).toHaveText(['SOUND', 'GAMEPLAY', 'SAVE CODE', 'DANGER ZONE']);
  await expect(a.page.getByTestId('sp-account')).toHaveCount(0);
  await expect(a.page.getByTestId('google-signin')).toHaveCount(0);
  // a stray token / code in the URL is not picked up either
  await a.page.goto('/?portal=1&season2=1&signin=1&code=zz#access_token=x.y.z&expires_in=3600');
  await menuReady(a.page);
  await a.page.waitForTimeout(800);
  expect(await raw(a.page, 'taw.auth')).toBeNull();
  await expect(a.page.getByTestId('auth-stamp')).toHaveCount(0);
  expect(a.calls).toEqual([]);
  await a.ctx.close();
});

// ===================================================================== the security review's two HIGH exploits (nov4)
test('HIGH 2: a #access_token someone else made is NEVER used — wiped from the bar, nothing stored, nothing linked', async ({ browser }) => {
  test.setTimeout(60_000);
  const shared = sharedDb();
  const a = await device(browser, shared, { save: true });
  // an attacker's link: their own Google session in the fragment (the old implicit-flow landing)
  await a.page.goto(`/?portal=1&season2=1&google=1&signin=1#access_token=${TOKEN}&refresh_token=r1&expires_in=3600&token_type=bearer`);
  await menuReady(a.page);
  await a.page.waitForTimeout(1200);
  expect(await a.page.evaluate(() => location.hash)).toBe('');
  expect(await raw(a.page, 'taw.auth')).toBeNull();
  await expect(a.page.getByTestId('auth-stamp')).toHaveCount(0);
  await expect(a.page.getByTestId('auth-confirm-link')).toHaveCount(0);
  expect(a.calls).toEqual([]); // no lb_auth_* call at all
  expect(shared.links.size).toBe(0);
  await a.ctx.close();
});

test('HIGH 2: a ?code= landing this tab did not start (no PKCE verifier here) is dropped — no token trade, nothing stored', async ({ browser }) => {
  test.setTimeout(60_000);
  const shared = sharedDb();
  const a = await device(browser, shared, { save: true });
  // a code minted for the attacker's own sign-in (they hold its verifier), sent to the victim
  shared.codes.set('attacker-code', 'attacker-challenge');
  await a.page.goto('/?portal=1&season2=1&google=1&signin=1&code=attacker-code');
  await menuReady(a.page);
  await a.page.waitForTimeout(1200);
  expect(await a.page.evaluate(() => location.search)).not.toContain('code='); // index.html lifted it out at once
  expect(a.tokenCalls.length).toBe(0); // never traded: there is no verifier in this tab
  expect(await raw(a.page, 'taw.auth')).toBeNull();
  expect(a.calls).toEqual([]);
  expect(shared.links.size).toBe(0);
  await a.ctx.close();
});

test('HIGH 1: sign-in only ever asks to come back to THIS origin, with a PKCE S256 challenge (no implicit tokens)', async ({ browser }) => {
  test.setTimeout(60_000);
  const shared = sharedDb();
  const a = await device(browser, shared, { save: true });
  await signInFromSettings(a.page);
  await expect(a.page.getByTestId('auth-confirm-link')).toBeVisible({ timeout: 15_000 });
  const asked = a.authorize[0];
  const origin = new URL(a.page.url()).origin;
  expect(new URL(asked.redirect_to).origin).toBe(origin);
  expect(asked.code_challenge_method).toBe('s256');
  expect(asked.code_challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
  // and the trade used the verifier that hashes to that challenge (the mock refuses anything else)
  expect(a.tokenCalls.length).toBe(1);
  expect(a.tokenCalls[0].ok).toBe(true);
  await a.ctx.close();
});
