// e2e/menu-no-free-wins.spec.js — fix/menu-free-wins: sitting on the menu pays nothing.
//
// A friend "got wins on the main menu without playing". The source, found by wrapping every
// taw.wins / taw.winsLifetime write with a stack logger: the TOUCH TYPIST achievement ("Hit 40
// WPM in a measured mode") read the best WPM across ALL modes, including the menu's free-typing
// self-test — which counts any 2+ letter buffer as a word, no dictionary. Typing "the quick brown
// fox" on the menu set a 40+ WPM best, and the next return to the menu (closing the SHOP) paid
// +1000. The speed achievements now read the PLAYED modes only (wpm.js bestWpmPlayed).
//
// THE RULE this spec holds: on the menu, WINS move only as an EXPLICITLY SHOWN reward — every
// change must coincide with a visible reward toast (.wct-row) of exactly that amount. XP does move
// (TYPE ANYWHERE is the menu's XP mechanic), and only ever with its "+N" pop on screen.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady, navControl } from './support/menu.js';

async function session(page, seed) {
  await page.clock.install();
  await installBackendMock(page);
  await page.addInitScript((seed) => {
    if (sessionStorage.getItem('mnfw.seeded')) return;
    sessionStorage.setItem('mnfw.seeded', '1');
    localStorage.clear();
    for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
  }, seed);
  // Every wins write, with what reward toasts were on screen when it landed (after one frame, so
  // a toast rendered by the same grant counts), and every XP write with whether a "+N" pop showed.
  await page.addInitScript(() => {
    window.__WLOG = [];
    const toasts = new Set();
    new MutationObserver(() => {
      for (const n of document.querySelectorAll('.wct-row')) toasts.add(n.textContent);
    }).observe(document, { subtree: true, childList: true, characterData: true });
    window.__TOASTS = toasts;
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (k === 'taw.wins') {
        const prev = Number(this.getItem(k)) || 0;
        if (prev !== Number(v)) window.__WLOG.push({ delta: Number(v) - prev });
      }
      return orig.call(this, k, v);
    };
  });
  await page.goto('/?portal=1');
  await menuReady(page);
  for (let i = 0; i < 20; i++) await page.clock.fastForward(30_000); // 10 idle minutes
  for (let b = 0; b < 20; b++) {
    // TYPE ANYWHERE, fast: 25 letters in real words per burst — the 40+ WPM a menu self-test reads
    await page.keyboard.type('the quick brown fox jumps', { delay: 5 });
    await page.clock.fastForward(2000);
  }
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.fastForward(60_000);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  for (let i = 0; i < 2; i++) {
    await navControl(page, 'shop').click();
    await page.locator('.shop-panel').waitFor({ state: 'visible' });
    await page.clock.fastForward(1000);
    await page.keyboard.press('Escape');
    await menuReady(page);
    await page.clock.fastForward(500);
  }
  return page.evaluate(() => ({
    writes: window.__WLOG,
    toasts: [...window.__TOASTS],
    wins: Number(localStorage.getItem('taw.wins')) || 0,
    xp: JSON.parse(localStorage.getItem('taw.xp') || 'null'),
    achievements: JSON.parse(localStorage.getItem('taw.achievements') || '[]'),
    claims: JSON.parse(localStorage.getItem('taw.claims') || '[]'),
  }));
}

test('a fresh player who only sits, types, tabs away and opens the SHOP earns zero wins', async ({ page }) => {
  test.setTimeout(120_000);
  const r = await session(page, {});
  test.info().annotations.push({ type: 'session', description: JSON.stringify(r) });
  expect(r.achievements, 'no achievement is earned from the menu alone').toEqual([]);
  expect(r.writes, 'no wins write at all').toEqual([]);
  expect(r.wins).toBe(0);
  expect(r.xp && r.xp.lv, 'TYPE ANYWHERE still levels you up (it is the menu XP mechanic)').toBeGreaterThan(1);
});

test('a real reward on the menu (a level achievement) is CLAIMED — nothing pays until the player clicks', async ({ page }) => {
  test.setTimeout(120_000);
  const r = await session(page, { 'taw.xp': JSON.stringify({ lv: 14, into: 0 }) });
  test.info().annotations.push({ type: 'session', description: JSON.stringify(r) });
  expect(r.achievements).toEqual(['lv-15']); // reached by menu XP — and NOT the menu-typing WPM one
  // Andy oct2: earning it QUEUES a claim; the balance has not moved.
  expect(r.writes, 'no wins write before the claim').toEqual([]);
  const queued = r.claims.find((c) => c.id === 'ach-lv-15');
  expect(queued, `the ASCENDANT claim is pending (claims: ${JSON.stringify(r.claims)})`).toBeTruthy();
  // The REWARDS control carries the count, and claiming pays exactly the claim, with its toast.
  const rewards = page.locator('.homepage-nav-btn.is-stats, .hp-m-navbtn.is-stats').first(); // claims ride STATS (A4)
  await expect(rewards).toBeVisible();
  await rewards.click();
  await page.locator('.claims-panel').waitFor({ state: 'visible' });
  const row = page.locator('.claims-row', { hasText: 'ASCENDANT' });
  await row.locator('.claims-btn').click();
  await page.clock.fastForward(100);
  const after = await page.evaluate(() => ({ writes: window.__WLOG, toasts: [...window.__TOASTS] }));
  expect(after.writes.length).toBe(1);
  expect(after.writes[0].delta).toBe(queued.amount);
  const shown = after.toasts.find((t) => /ASCENDANT/.test(t));
  expect(shown, `a visible ASCENDANT toast (seen: ${JSON.stringify(after.toasts)})`).toBeTruthy();
  expect(Number(shown.replace(/[^0-9]/g, '')), 'the toast names exactly what was paid').toBe(after.writes[0].delta);
});
