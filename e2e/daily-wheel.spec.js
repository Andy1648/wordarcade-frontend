// e2e/daily-wheel.spec.js — THE DAILY WHEEL (season 2; progress/wheel.js + components/wheel/DailyWheel.jsx +
// leaderboard/serverWheel.js against a mocked 067_daily_wheel.sql):
//   1. the menu: the WHEEL tile (with today's dot) sits in the top-right cluster; NEWS + SETTINGS moved to the
//      bottom-right one; the CREDITS link is gone from the menu and lives inside SETTINGS;
//   2. SPIN asks the server ONCE, lands on the server's slot, pays the save ONCE (gems), claims, clears the dot;
//      reopening shows today's result and never pays again;
//   3. a ticket prize pays nothing locally (the server owns it) and says where it waits; the ODDS sheet sums to 100;
//   4. the panel fits every target viewport with no scroll.
// SHOTS=1 also saves the seeded screenshots for the PR (claude/shots-wheel/).
import { test, expect } from '@playwright/test';
import { boot } from './support/wheelBoot.js';

const SHOTS = !!process.env.SHOTS;
const DIR = process.env.SHOTS_DIR || 'claude/shots-wheel';
// every prize icon's NET on-screen tilt (rotor x slice x icon), degrees — upright means ~0 for all 8
const iconTilts = (page) => page.evaluate(() => [...document.querySelectorAll('.dw-slice-ico')].map((ico) => {
  const m = [document.querySelector('.dw-rotor'), ico.parentElement, ico]
    .map((el) => new DOMMatrix(getComputedStyle(el).transform === 'none' ? undefined : getComputedStyle(el).transform))
    .reduce((acc, x) => acc.multiply(x));
  return Math.round(Math.atan2(m.b, m.a) * 180 / Math.PI);
}));
const artLoaded = (page) => page.waitForFunction(() => [...document.querySelectorAll('.dw img')].every((i) => i.complete && i.naturalWidth > 0));
const gemBal = (page) => page.evaluate(() => (JSON.parse(localStorage.getItem('taw.s2.gems') || '{}').bal) || 0);
const noScroll = (page) => page.evaluate(() => ({
  y: document.documentElement.scrollHeight - innerHeight, x: document.documentElement.scrollWidth - innerWidth,
}));

test('menu: the WHEEL takes the top-right slot; NEWS + SETTINGS sit bottom-right; CREDITS lives in SETTINGS', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await boot(page);
  const tile = page.locator('.hp-icons [data-nav="wheel"]');
  await expect(tile).toBeVisible();
  await expect(tile.locator('.kb-idot')).toBeVisible(); // today's free spin is waiting
  await expect(page.locator('.hp-icons [data-nav="news"], .hp-icons [data-nav="settings"]')).toHaveCount(0);
  await expect(page.locator('.hp-util [data-nav="news"]')).toBeVisible();
  await expect(page.locator('.hp-util [data-nav="settings"]')).toBeVisible();
  await expect(page.locator('.homepage-credits-link')).toHaveCount(0);
  if (SHOTS) await page.screenshot({ path: `${DIR}/menu-1366x768.png` });
  await page.locator('.hp-util [data-nav="settings"]').click();
  await page.locator('.sp-credits:visible').click();
  await expect(page.locator('.credits-wrap')).toBeVisible();
});

test('SPIN: one server spin, lands, pays +60 gems once, claims, clears the dot; reopen never pays again', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  const db = await boot(page, { gems: 200, slot: 2 });
  await page.locator('[data-nav="wheel"]').click();
  const wheel = page.getByTestId('daily-wheel');
  await expect(wheel.getByTestId('wheel-spin')).toBeVisible();
  await artLoaded(page);
  if (SHOTS) await page.screenshot({ path: `${DIR}/wheel-ready-1366x768.png` });
  await wheel.getByTestId('wheel-spin').click();
  await expect(wheel.getByTestId('wheel-result')).toContainText('+60 GEMS', { timeout: 12000 });
  if (SHOTS) await page.screenshot({ path: `${DIR}/wheel-landed-1366x768.png` });
  expect(db.calls.spin).toBe(1);
  await expect.poll(() => db.calls.claim).toBe(1);
  expect(await gemBal(page)).toBe(260);
  // the rotor came to rest on the server's slot (slot 2 → the wheel turned ≈ -90°, inside the slice)
  const rot = await page.locator('.dw-rotor').evaluate((el) => el.style.transform);
  const deg = Number(/rotate\(([-\d.]+)deg\)/.exec(rot)[1]);
  const under = Math.floor((((-deg % 360) + 360 + 22.5) % 360) / 45);
  expect(under).toBe(2);
  await page.locator('.dw-close').click();
  await expect(page.locator('[data-nav="wheel"] .kb-idot')).toHaveCount(0);
  // reopen: today's result, no SPIN, no second payment
  await page.locator('[data-nav="wheel"]').click();
  await expect(wheel.getByTestId('wheel-result')).toContainText('+60 GEMS');
  await expect(wheel.getByTestId('wheel-spin')).toHaveCount(0);
  expect(await gemBal(page)).toBe(260);
  expect(db.calls.spin).toBe(1);
});

test('a LEGENDARY+ ticket pays nothing locally (the server owns it); the ODDS sheet prints 8 rows = 100%', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 600 });
  await boot(page, { gems: 200, slot: 5, streak: 3 });
  await page.locator('[data-nav="wheel"]').click();
  const wheel = page.getByTestId('daily-wheel');
  await wheel.getByTestId('wheel-spin').click();
  await expect(wheel.getByTestId('wheel-result')).toContainText('LEGENDARY+ ROLL', { timeout: 12000 });
  await expect(wheel.getByTestId('wheel-result')).toContainText('GEARS');
  expect(await gemBal(page)).toBe(200);
  expect(await noScroll(page)).toEqual({ x: 0, y: 0 });
  if (SHOTS) await page.screenshot({ path: `${DIR}/wheel-jackpot-1280x600.png` });
  await wheel.getByRole('button', { name: 'ODDS' }).click();
  const pcts = await wheel.locator('.dw-odds-p').allTextContents();
  expect(pcts).toHaveLength(8);
  expect(pcts.reduce((a, t) => a + Number(t.replace('%', '')), 0)).toBe(100);
  if (SHOTS) await page.screenshot({ path: `${DIR}/wheel-odds-1280x600.png` });
});

test('phone 390x844: SPIN lands and pays (+ the PR shots)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await boot(page, { gems: 200, slot: 2 });
  await page.locator('[data-nav="wheel"]').click();
  const wheel = page.getByTestId('daily-wheel');
  await expect(wheel.getByTestId('wheel-spin')).toBeVisible();
  await artLoaded(page);
  if (SHOTS) await page.screenshot({ path: `${DIR}/wheel-ready-390x844.png` });
  await wheel.getByTestId('wheel-spin').click();
  await expect(wheel.getByTestId('wheel-result')).toContainText('+60 GEMS', { timeout: 12000 });
  if (SHOTS) { await page.waitForTimeout(500); await page.screenshot({ path: `${DIR}/wheel-landed-390x844.png` }); }
  expect(await gemBal(page)).toBe(260);
  expect((await iconTilts(page)).every((t) => Math.abs(t) <= 1)).toBe(true); // still upright after the spin
});

for (const [w, h] of [[1536, 864], [1366, 768], [1280, 600], [390, 844], [360, 640]]) {
  test(`fits ${w}x${h}: menu + open wheel, no scroll, the panel inside the viewport`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await boot(page);
    expect(await noScroll(page)).toEqual({ x: 0, y: 0 });
    if (SHOTS) { await page.waitForTimeout(1500); await page.screenshot({ path: `${DIR}/menu-${w}x${h}.png` }); }
    await page.locator('[data-nav="wheel"]').click();
    const panel = page.locator('.dw');
    await expect(page.getByTestId('wheel-spin')).toBeVisible();
    const b = await panel.boundingBox();
    expect(b.y).toBeGreaterThanOrEqual(0);
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.y + b.height).toBeLessThanOrEqual(h + 0.5);
    expect(b.x + b.width).toBeLessThanOrEqual(w + 0.5);
    expect(await noScroll(page)).toEqual({ x: 0, y: 0 });
    expect((await iconTilts(page)).every((t) => Math.abs(t) <= 1)).toBe(true);
    // nothing in the panel is clipped by its bottom edge (the ODDS button was, at 1280x600)
    const ob = await page.getByRole('button', { name: 'ODDS' }).boundingBox();
    expect(ob.y + ob.height).toBeLessThanOrEqual(b.y + b.height - 4 + 0.5);
    await artLoaded(page);
    if (SHOTS) await page.screenshot({ path: `${DIR}/wheel-${w}x${h}.png` });
    // the ODDS sheet: all 8 rows + BACK inside the sheet and the viewport, nothing clipped or scrolled
    await page.getByRole('button', { name: 'ODDS' }).click();
    const sheet = page.locator('.dw-odds');
    await expect(sheet.locator('li')).toHaveCount(8);
    expect(await sheet.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(0);
    const back = await sheet.getByRole('button', { name: 'BACK' }).boundingBox();
    const sb = await sheet.boundingBox();
    expect(back.y + back.height).toBeLessThanOrEqual(Math.min(sb.y + sb.height, h) + 0.5);
    const last = await sheet.locator('li').last().boundingBox();
    expect(last.y + last.height).toBeLessThanOrEqual(back.y);
    if (SHOTS) await page.screenshot({ path: `${DIR}/odds-${w}x${h}.png` });
  });
}

// the wheel-only cosmetics: the painted piece shows on the result card, lands in the save, and wears where its slot is worn
for (const [id, name, tab, slotKey] of [['jackpot', 'JACKPOT', 'FRAME', 'frame'], ['confetti', 'PRIZE SHOWER', 'WIN FX', 'fx']]) {
  for (const [vn, vp] of [['1366x768', { width: 1366, height: 768 }], ['390x844', { width: 390, height: 844 }]]) {
    test(`cosmetic ${id} ${vn}: the result card shows its art, it is owned, WEAR equips it`, async ({ page }) => {
      await page.setViewportSize(vp);
      await boot(page, { slot: 7, cosmetic: id });
      await page.locator('[data-nav="wheel"]').click();
      const wheel = page.getByTestId('daily-wheel');
      await wheel.getByTestId('wheel-spin').click();
      const res = wheel.getByTestId('wheel-result');
      await expect(res).toContainText(name, { timeout: 12000 });
      await expect(res.locator('img')).toHaveAttribute('src', id === 'jackpot' ? '/cards/frame-jackpot.webp' : '/fx/win/confetti.webp');
      expect(await page.evaluate(() => JSON.parse(localStorage.getItem('taw.s2.kit')).own)).toContain(id);
      if (SHOTS) { await page.waitForTimeout(500); await page.screenshot({ path: `${DIR}/cosmetic-${id}-result-${vn}.png` }); }
      await wheel.getByRole('button', { name: 'Close the daily wheel' }).click();
      await page.locator('[data-nav="profile"]:visible').first().click();
      await page.getByTestId('profile-kit').click();
      const pk = page.getByTestId('kit-picker');
      await pk.getByRole('tab', { name: tab }).click();
      await pk.getByRole('radio', { name: new RegExp(name) }).click();
      await pk.getByRole('button', { name: `WEAR ${name}` }).click();
      await expect(pk.getByRole('button', { name: 'TAKE OFF' })).toBeVisible();
      expect(await page.evaluate((k) => JSON.parse(localStorage.getItem('taw.s2.kit'))[k], slotKey)).toBe(id);
      if (SHOTS) { await page.waitForTimeout(700); await page.screenshot({ path: `${DIR}/cosmetic-${id}-worn-${vn}.png` }); }
    });
  }
}

// LUCKY (a sidekick) left the wheel in 068 (the SIDEKICK slot is gone): a server still on 067 that names it pays the slot as
// 120 GEMS on the gift box — never a broken image, never a piece you can't wear
test('a retired LUCKY from an old server: +120 GEMS on the gift box, nothing owned in the kit', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await boot(page, { gems: 200, slot: 7, cosmetic: 'lucky' });
  await page.locator('[data-nav="wheel"]').click();
  const wheel = page.getByTestId('daily-wheel');
  await wheel.getByTestId('wheel-spin').click();
  const res = wheel.getByTestId('wheel-result');
  await expect(res).toContainText('+120 GEMS', { timeout: 12000 });
  await expect(res.locator('img')).toHaveAttribute('src', '/wheel/prize-cosmetic.webp');
  await expect.poll(() => gemBal(page)).toBe(320);
  expect(await page.evaluate(() => localStorage.getItem('taw.s2.kit'))).toBeNull();
});

// Andy oct25: "idk why u didnt add click outside of spin wheel to exit (that's a default)". Tap outside / Escape / ✕
// close it — but never mid-spin: the result lands (pays + claims) before anything can close the panel.
test('CLOSE: tap outside + Escape + ✕ close the wheel; mid-spin all three are ignored until the result lands', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  const db = await boot(page, { gems: 200, slot: 2 });
  const wheel = page.getByTestId('daily-wheel');
  // tap outside (the scrim, not the panel)
  await page.locator('[data-nav="wheel"]').click();
  await expect(wheel.getByTestId('wheel-spin')).toBeVisible();
  await page.mouse.click(12, 12);
  await expect(wheel).toHaveCount(0);
  // Escape
  await page.locator('[data-nav="wheel"]').click();
  await expect(wheel.getByTestId('wheel-spin')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(wheel).toHaveCount(0);
  // mid-spin: a slow server keeps the wheel in its spin; outside / Escape / ✕ do nothing
  await page.route('https://lb.e2e.invalid/**/rpc/lb_wheel_spin', async (route) => { await new Promise((r) => setTimeout(r, 1500)); return route.fallback(); });
  await page.locator('[data-nav="wheel"]').click();
  await wheel.getByTestId('wheel-spin').click();
  await page.mouse.click(12, 12);
  await page.keyboard.press('Escape');
  await expect(wheel.getByTestId('wheel-close')).toBeDisabled();
  await expect(wheel).toBeVisible();
  await expect(wheel.getByTestId('wheel-result')).toContainText('+60 GEMS', { timeout: 15000 });
  expect(await gemBal(page)).toBe(260);
  await expect.poll(() => db.calls.claim).toBe(1);
  await page.mouse.click(12, 12);
  await expect(wheel).toHaveCount(0);
});

// GIF=1: films a spin → landing (CDP screencast frames + timestamps → claude/shots-wheel/gif/<name>/) for Andy
test.describe('films', () => {
  test.use({ reducedMotion: 'no-preference' });
  for (const [name, slot] of [['gems', 2], ['legend', 5]]) {
    test(`GIF: spin and land on ${name}`, async ({ page }) => {
      test.skip(!process.env.GIF, 'films only');
      test.setTimeout(90000);
      const fs = await import('node:fs');
      await page.setViewportSize({ width: 1366, height: 768 });
      await page.addInitScript(() => localStorage.setItem('taw.reduceMotion', '0'));
      await boot(page, { gems: 200, slot });
      await page.locator('[data-nav="wheel"]').click();
      const wheel = page.getByTestId('daily-wheel');
      await expect(wheel.getByTestId('wheel-spin')).toBeVisible();
      await artLoaded(page);
      await page.waitForTimeout(500);
      const dir = `claude/shots-wheel/gif/${name}`;
      fs.rmSync(dir, { recursive: true, force: true });
      fs.mkdirSync(dir, { recursive: true });
      const cdp = await page.context().newCDPSession(page);
      const stamps = [];
      let n = 0;
      cdp.on('Page.screencastFrame', async (f) => {
        const id = String(n++).padStart(4, '0');
        fs.writeFileSync(`${dir}/${id}.jpg`, Buffer.from(f.data, 'base64'));
        stamps.push([id, f.metadata.timestamp]);
        try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch { /* closed */ }
      });
      await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 85 });
      await page.waitForTimeout(400);
      await wheel.getByTestId('wheel-spin').click();
      await expect(wheel.getByTestId('wheel-result')).toBeVisible({ timeout: 12000 });
      await page.waitForTimeout(2200);
      await cdp.send('Page.stopScreencast');
      fs.writeFileSync(`${dir}/stamps.json`, JSON.stringify(stamps));
    });
  }
});
