// e2e/run-leave-confirm.spec.js (fix/run-leave-confirm) — the ✕ asks before forfeiting a bank.
//   1. wall before round 1 (bank 0): ✕ → the menu directly, no confirm.
//   2. draft after round 1 (bank > 0): ✕ → inline confirm naming the bank; KEEP PLAYING → still on
//      the draft, and the wall then shows the same bank (unchanged).
//   3. mid-round 2: ✕ → confirm, the round stays live (clock keeps ticking); Escape = keep playing;
//      ✕ again → LEAVE → the menu with 0 wins (a mid-run leave settles nothing).
// Seeded past the RUN level gate (as run-round-screen.spec.js). ?seed=1 rolls LONG for round 1.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

const URL = '/?portal=1&rs=12&seed=1';
const WORDS = [
  'planet', 'garden', 'window', 'silver', 'orange', 'bottle', 'candle', 'jacket',
  'pencil', 'rabbit', 'forest', 'island', 'castle', 'bridge', 'monkey', 'yellow',
];
// fix/visual-batch-1: "LEAVE? YOU FORFEIT 1,525" — one line at 390px.
const CONFIRM_RE = /^LEAVE\? YOU FORFEIT (\d[\d,]*)$/;

async function openWall(page) {
  await installBackendMock(page);
  await page.addInitScript(() => {
    try { localStorage.setItem('taw.xp', JSON.stringify({ lv: 31, into: 0 })); } catch { /* ignore */ }
    // Suppress the on-home ACHIEVEMENT grant (FIRST BLOOD / ASCENDANT would credit wins the moment
    // the menu mounts) so `taw.wins` isolates what the RUN itself paid — which must be 0 on a leave.
    window.__TAW_NO_ACHIEVEMENT_GRANT = true;
  });
  await page.goto(URL);
  await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
  await page.locator('.game-card-magnet[data-game="run"] .game-card').click({ force: true });
  await expect(page.locator('.run-wall')).toBeVisible({ timeout: 15000 });
}

test('✕ on the wall before round 1 leaves directly (no confirm)', async ({ page }) => {
  await openWall(page);
  await page.locator('.run-exit').click();
  await expect(page.locator('.run-leave-confirm')).toHaveCount(0);
  await expect(page.locator('.run-root')).toHaveCount(0);
  await expect(page.getByRole('img', { name: 'Type a Word' })).toBeVisible();
});

test('✕ mid-run asks first; KEEP PLAYING / Escape keep the bank; LEAVE forfeits it (menu, 0 wins)', async ({ page }) => {
  test.setTimeout(60_000);
  await openWall(page);

  // ROUND 1: clear wall 80 so something is BANKED.
  await page.locator('.run-btn-go').click();
  await expect(page.locator('.run-round')).toBeVisible();
  const input = page.locator('.run-input');
  const toast = page.locator('.run-toast');
  for (const w of WORDS) {
    await input.fill(w);
    await input.press('Enter');
    await expect(toast).toHaveText(new RegExp(`${w.toUpperCase()} \\+\\d+`));
  }
  await expect(page.locator('.run-draft')).toBeVisible({ timeout: 15000 });

  // DRAFT (bank > 0): ✕ → confirm naming the bank; KEEP PLAYING → still drafting.
  await page.locator('.run-exit').click();
  const confirm = page.locator('.run-leave-confirm');
  await expect(confirm).toBeVisible();
  const text = (await page.locator('.run-leave-text').textContent()).trim();
  const m = text.match(CONFIRM_RE);
  expect(m, `confirm copy: ${text}`).not.toBeNull();
  const bank = m[1];
  expect(parseInt(bank.replace(/,/g, ''), 10)).toBeGreaterThan(0);
  await page.locator('.run-leave-keep').click();
  await expect(confirm).toHaveCount(0);
  await expect(page.locator('.run-draft')).toBeVisible();

  // Bank unchanged: pick a card, the wall shows the same BANKED number.
  await page.locator('.run-offers .run-card').first().click();
  await expect(page.locator('.run-wall')).toBeVisible();
  await expect(page.locator('.run-banked b')).toHaveText(bank);

  // WALL between rounds (bank > 0) is guarded too (fix/visual-batch-1): ✕ → the same confirm;
  // KEEP PLAYING → still on the wall. And the copy fits ONE line at 390px.
  await page.locator('.run-exit').click();
  await expect(confirm).toBeVisible();
  await expect(page.locator('.run-leave-text')).toHaveText(CONFIRM_RE);
  await page.setViewportSize({ width: 390, height: 844 });
  const line = await page.locator('.run-leave-text').evaluate((el) => {
    const cs = getComputedStyle(el);
    return { h: el.getBoundingClientRect().height, lh: parseFloat(cs.lineHeight), sw: el.scrollWidth, cw: el.clientWidth };
  });
  expect(line.h).toBeLessThan(line.lh * 1.5); // one line
  expect(line.sw).toBeLessThanOrEqual(line.cw); // and nothing clipped
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.locator('.run-leave-keep').click();
  await expect(confirm).toHaveCount(0);
  await expect(page.locator('.run-wall')).toBeVisible();

  // ROUND 2 (mid-round): ✕ → confirm; the round is still live and the clock keeps running.
  await page.locator('.run-btn-go').click();
  await expect(page.locator('.run-round')).toBeVisible();
  await page.locator('.run-exit').click();
  await expect(confirm).toBeVisible();
  await expect(page.locator('.run-round')).toBeVisible();
  const clock = page.locator('.run-clock');
  const t1 = await clock.textContent();
  await expect(clock).not.toHaveText(t1, { timeout: 3000 }); // nothing paused
  // Escape = keep playing.
  await page.keyboard.press('Escape');
  await expect(confirm).toHaveCount(0);
  await expect(page.locator('.run-round')).toBeVisible();
  // ✕ again → LEAVE → the menu; nothing was settled, so 0 wins.
  await page.locator('.run-exit').click();
  await expect(confirm).toBeVisible();
  await page.locator('.run-leave-go').click();
  await expect(page.locator('.run-root')).toHaveCount(0);
  await expect(page.getByRole('img', { name: 'Type a Word' })).toBeVisible();
  const wins = await page.evaluate(() => Number(localStorage.getItem('taw.wins') || 0));
  expect(wins).toBe(0);
  const chip = page.locator('.menu-wins-chip');
  if (await chip.count()) await expect(chip).toHaveAttribute('aria-label', /^0 wins/);
});
