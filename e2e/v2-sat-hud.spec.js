// e2e/v2-sat-hud.spec.js — P10 10d SAT RUSH (claude/mockups/v2/SatRush.dc.html, VERSION A; claude/SEASON2-QUEUE.md):
// "giant THIS WORD PAYS number + base × ante × SAT chips, CASE CLOSED stamped file. NO scrollbars."
//
//   * SEASON2 board: THIS WORD PAYS = the points a capture scores NOW (engine: base × ante [× silver × escaped]
//     [+ deep cut]) with its chips, the 5× / 3× / 1× ante tiles, and the word's WINS on their own line with the SAT ×3
//     chip; the number DROPS with the ante; the case card carries CASE #, part of speech, letters, tier, the sentence,
//     the locked reveals, the suspects and the slots;
//   * CASE CLOSED: the run-over is a stamped case file — captured, got away, the facts, WINS EARNED as its own line,
//     RUN IT BACK + MENU — and nothing scrolls;
//   * four sizes (board + file): no scrollbars, no text < 13 px, nothing loops;
//   * flag OFF: the live retro-print poster + results are untouched.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

async function sat(page, { season2 = true, vp = { width: 1366, height: 657 }, query = '' } = {}) {
  await page.setViewportSize(vp);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await installBackendMock(page);
  await page.addInitScript(() => {
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.reduceMotion', '0');
  });
  await page.goto(`/sat-rush/play?portal=1${season2 ? '&season2=1' : ''}${query}`);
  await page.locator('.sr-slots').waitFor({ state: 'visible', timeout: 20_000 });
}

const num = (s) => Number(String(s).replace(/[^\d.]/g, ''));

async function measure(page, scope) {
  return page.evaluate((scope) => {
    const de = document.documentElement;
    const vis = (el) => { const cs = getComputedStyle(el); const r = el.getBoundingClientRect(); return cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0 && r.width > 1 && r.height > 1; };
    const small = [...document.querySelectorAll(`${scope} *`)].filter((el) => vis(el) && [...el.childNodes].some((x) => x.nodeType === 3 && /[a-z0-9]/i.test(x.textContent)))
      .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 13).map((el) => `${el.className}`);
    const infinite = document.getAnimations().filter((a) => a.playState === 'running' && a.effect && a.effect.getComputedTiming().iterations === Infinity && a.effect.target && a.effect.target.closest && a.effect.target.closest(scope)).length;
    // NO SCROLLBARS: the page, and every box inside the scope that could scroll
    const scrollers = [...document.querySelectorAll(`${scope}, ${scope} *`)].filter((el) => {
      const cs = getComputedStyle(el);
      return /(auto|scroll)/.test(cs.overflowY + cs.overflowX) && (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1);
    }).map((el) => el.className);
    return { h: de.scrollWidth > de.clientWidth, v: de.scrollHeight > de.clientHeight, small, infinite, scrollers };
  }, scope);
}

test('SEASON2 SAT: THIS WORD PAYS = base × ante, chips, ante tiles, the wins line with SAT ×3, the case card', async ({ page }) => {
  test.setTimeout(60_000);
  await sat(page, { query: '&stage=4000' });
  await expect(page.locator('.sr-app')).toHaveAttribute('data-hud', 'v2');
  const pays = page.locator('.sat2-pays');
  await expect(pays.locator('.sat2-pays-h')).toContainText('THIS WORD PAYS');
  await expect(pays.locator('.sat2-pays-h b')).toHaveText('AT 5×');
  const base = num(await pays.locator('.sat2-chip--base b').innerText());
  await expect(pays.locator('.sat2-chip--ante b')).toHaveText('×5');
  expect(num(await pays.locator('.sat2-big-n').innerText())).toBe(base * 5);
  await expect(pays.locator('.sat2-ante')).toHaveText(['5×', '3×', '1×']);
  await expect(pays.locator('.sat2-ante.is-now')).toHaveText('5×');
  // the WINS line stands alone (the ante pays score, not wins) and names SAT ×3
  await expect(pays.locator('.sat2-wins-n')).toHaveText(/^\+\d/);
  await expect(pays.locator('.sat2-wchip--mode')).toHaveText('×3 SAT');
  // the case card
  const card = page.locator('.sat2-case');
  await expect(card.locator('.sat2-tag--case')).toHaveText('CASE #01');
  await expect(card.locator('.sat2-tag').nth(2)).toHaveText(/^\d+ LETTERS$/);
  await expect(card.locator('.sat2-tag--tier')).toHaveText(/^TIER \d$/);
  await expect(card.locator('.sat2-blank')).toBeVisible();
  await expect(card.locator('.sat2-lock').first()).toContainText(/AT 3×/);
  await expect(card.locator('.sr-suspect')).toHaveCount(6); // the deep link plays LINEUP
  await expect(card.locator('.sat2-typeit')).toHaveText('TYPE IT AT 5×');
  // big-left / card-right
  const pb = await pays.boundingBox();
  const cb = await card.boundingBox();
  expect(pb.x + pb.width).toBeLessThanOrEqual(cb.x);
  // the old poster is gone
  await expect(page.locator('.sr-poster')).toHaveCount(0);
});

test('SEASON2 SAT: the pays number drops with the ante', async ({ page }) => {
  test.setTimeout(60_000);
  await sat(page, { query: '&stage=1500' });
  const pays = page.locator('.sat2-pays');
  const base = num(await pays.locator('.sat2-chip--base b').innerText());
  await expect(pays.locator('.sat2-ante.is-now')).toHaveText('3×', { timeout: 6000 });
  await expect(pays.locator('.sat2-chip--ante b')).toHaveText('×3');
  expect(num(await pays.locator('.sat2-big-n').innerText())).toBe(base * 3);
  await expect(page.locator('.sat2-typeit')).toHaveText('TYPE IT AT 3×');
});

test('SEASON2 SAT CASE CLOSED: a stamped case file, every credit its own line, no scrollbar', async ({ page }) => {
  test.setTimeout(90_000);
  await sat(page, { query: '&stage=200' });
  const file = page.locator('.sat2-file');
  // three words get away at a 200 ms ante (a key dismisses each re-encode beat)
  for (let i = 0; i < 120 && !(await file.count()); i += 1) {
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
  }
  await expect(file).toBeVisible();
  await expect(file.locator('.sat2-closed')).toHaveText('CASE CLOSED');
  await expect(file.locator('.sat2-capt-k')).toHaveText('CAPTURED');
  await expect(file.locator('.sat2-away')).toHaveText(/^\d+ GOT AWAY$/);
  await expect(file.locator('[data-wins-line="WINS EARNED"]')).toBeVisible();
  await expect(file.getByRole('button', { name: 'RUN IT BACK' })).toBeVisible();
  await expect(file.getByRole('button', { name: 'MENU' })).toBeVisible();
  await expect(page.locator('.sr-results')).toHaveCount(0);
  await page.waitForTimeout(1200);
  const m = await measure(page, '.sat2-over');
  expect(m.h).toBe(false);
  expect(m.v).toBe(false);
  expect(m.scrollers).toEqual([]);
  expect(m.small).toEqual([]);
  expect(m.infinite).toBe(0);
  await file.getByRole('button', { name: 'RUN IT BACK' }).click();
  await expect(page.locator('.sat2-file')).toHaveCount(0);
});

for (const vp of [{ width: 1280, height: 551 }, { width: 1366, height: 657 }, { width: 1920, height: 1080 }, { width: 390, height: 844 }]) {
  test(`SEASON2 SAT @${vp.width}x${vp.height}: board — no scrollbars, no text < 13 px, nothing loops, slots on screen`, async ({ page }) => {
    test.setTimeout(60_000);
    await sat(page, { vp, query: '&stage=6000' });
    await page.waitForTimeout(600);
    const m = await measure(page, '.sat2');
    expect(m.h).toBe(false);
    expect(m.v).toBe(false);
    expect(m.scrollers).toEqual([]);
    expect(m.small).toEqual([]);
    expect(m.infinite).toBe(0);
    // every slot and the pays number are fully inside the window
    const out = await page.evaluate(() => [...document.querySelectorAll('.sat2 .sr-slot, .sat2-big-n, .sat2-typeit, .sr-suspect')].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.bottom > innerHeight + 1 || r.right > innerWidth + 1 || r.top < -1 || r.left < -1;
    }).length);
    expect(out).toBe(0);
  });
}

test('flag OFF: the live poster + results are untouched', async ({ page }) => {
  test.setTimeout(60_000);
  await sat(page, { season2: false });
  await expect(page.locator('.sr-app')).not.toHaveAttribute('data-hud', /.+/);
  await expect(page.locator('.sat2')).toHaveCount(0);
  await expect(page.locator('.sr-poster')).toBeVisible();
  await expect(page.locator('.sr-mult')).toBeVisible();
});
