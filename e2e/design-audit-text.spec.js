// e2e/design-audit-text.spec.js — design audit nov2, PR B (#4, #5, #6, #13 + the WB results zero bar), at 1366x768 and
// 390x844. Every check is a layout assertion (overlaps / on screen / ≥ 44px targets / ≥ 16px phone text), taken on the
// state the player lands on AND after the action that matters (the dialog's buttons, a dead CHAIN run, a tap on the
// stats "?", a RETRY on the offline wheel).
//   #4  the 7 mode dialogs: title + ONE hook line + the mode's painted card art + the choice buttons — no tagline chip,
//       no EXAMPLE box, no stats list
//   #5  the CHAIN death card: no "+0 GEMS" pill, no repeated rule sentence, one balanced column when there is no score
//   #6  STATS: the formula sits behind a "?" tap; the ALL TIME window has no glow
//   #13 the wheel offline: a disabled kit SPIN with a short reason + a RETRY that re-asks the server
import { test, expect } from '@playwright/test';
import { bootMenu } from './support/screens.js';
import { revealMode, navControl, menuReady } from './support/menu.js';
import { installBackendMock } from './support/backendMock.js';
import { layoutDefects } from './support/overlap.js';
import { boot as bootWheel, openWheel } from './support/wheelBoot.js';
import { GAMES } from '../src/gameData.js';

const SHOTS = process.env.DA_SHOTS || '';
const MODES = ['word-bomb', 'category-blitz', 'sat-rush', 'miner', 'word-race', 'chain', 'fuse'];
// the modes with a painted card (gameData artLayers) — read from the data, so SAT RUSH / WORD RACE join when #603 lands
const PAINTED = new Set(GAMES.filter((g) => g.artLayers).map((g) => g.id));

/** Text under `scope` drawn smaller than `min` px (aria-hidden / sr-only skipped). */
function smallText(page, scope, min = 15.75) {
  return page.evaluate(({ scope, min }) => {
    const out = [];
    const root = document.querySelector(scope);
    if (!root) return ['no scope'];
    const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      const t = n.nodeValue.trim();
      if (!t) continue;
      const el = n.parentElement;
      if (!el.getClientRects().length || el.closest('[aria-hidden="true"]')) continue;
      const r = el.getBoundingClientRect();
      if (r.width <= 2 || r.height <= 2) continue;
      const px = parseFloat(getComputedStyle(el).fontSize);
      if (px < min) out.push(`${t.slice(0, 24)} ${px}px`);
    }
    return out;
  }, { scope, min });
}
/** Visible buttons under `scope` smaller than 44x44. */
function smallTargets(page, scope) {
  return page.evaluate((scope) => [...document.querySelectorAll(`${scope} button`)].filter((b) => b.getClientRects().length && getComputedStyle(b).visibility !== 'hidden')
    .map((b) => ({ t: (b.innerText || b.getAttribute('aria-label') || '').trim().slice(0, 20), r: b.getBoundingClientRect() }))
    .filter(({ r }) => r.width < 43.5 || r.height < 43.5).map(({ t, r }) => `${t} ${Math.round(r.width)}x${Math.round(r.height)}`), scope);
}
async function clean(page, scope, what) {
  const d = await layoutDefects(page, { scope });
  expect(d.overlaps, `${what}: overlaps`).toEqual([]);
  expect(d.offscreen, `${what}: off screen`).toEqual([]);
  expect(d.hscroll, `${what}: sideways scroll`).toBe(false);
}

for (const [w, h] of [[1366, 768], [390, 844]]) {
  const tag = `${w}x${h}`;
  const phone = w <= 480;

  test(`#4 every mode dialog is art + one line + choices @ ${tag}`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: w, height: h });
    await bootMenu(page, 100);
    for (const id of MODES) {
      const shell = page.locator('.mode-dialog-shell');
      // a tap that lands while the last dialog's scrim is still fading is eaten — tap again
      for (let t = 0; t < 3 && !(await shell.isVisible()); t += 1) {
        await (await revealMode(page, id)).click({ force: true });
        await shell.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
      }
      await expect(shell, `${id} dialog`).toBeVisible();
      await page.waitForTimeout(450);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/after-dialog-${id}-${tag}.png` });
      expect(await shell.locator('.mode-ex, .mode-dialog-chip').count(), `${id}: no EXAMPLE box / tagline chip`).toBe(0);
      // WHAT IT PAYS: one compact row — the gem rating + BASE wins / word, never a paragraph
      const pay = shell.getByTestId('mode-dialog-pay');
      await expect(pay, `${id}: pay row`).toBeVisible();
      await expect(pay.getByTestId('mode-dialog-wins')).toContainText('/ WORD');
      expect(await pay.locator('.mode-dialog-pay-gems .kit-icon, .mode-dialog-pay-gems svg, .mode-dialog-pay-gems img').count(), `${id}: three gem slots`).toBeGreaterThanOrEqual(3);
      const payRows = await pay.evaluate((el) => { const k = el.querySelector('.mode-dialog-pay-wins').getBoundingClientRect(); const g = el.querySelector('.mode-dialog-pay-gems'); const r = g && g.getBoundingClientRect(); return r && Math.abs(r.top + r.height / 2 - (k.top + k.height / 2)) > 6 ? 2 : 1; });
      expect(payRows, `${id}: pay is one row`).toBeLessThanOrEqual(1);
      await expect(shell.locator('.mode-dialog-title')).toBeVisible();
      // ONE hook line (a phone may wrap it once)
      const lines = id === 'category-blitz' ? 0 : await shell.locator('.mode-dialog-liner').evaluate((el) => { const c = getComputedStyle(el); const lh = parseFloat(c.lineHeight) || parseFloat(c.fontSize) * 1.5; return Math.round(el.getBoundingClientRect().height / lh); });
      expect(lines, `${id}: ONE hook line (wraps at most once)`).toBeLessThanOrEqual(2);
      // the painted card art is the hero (BLITZ gives its height to the pack picker below 860 tall)
      const art = shell.locator('.mode-dialog-art');
      if (PAINTED.has(id) && id !== 'category-blitz') {
        await expect(art, `${id}: painted art shown`).toBeVisible();
        const box = await art.boundingBox();
        expect(box.height, `${id}: the art is a hero, not a thumbnail`).toBeGreaterThanOrEqual(130);
      }
      const sb = await shell.boundingBox();
      expect(sb.y >= 0 && sb.y + sb.height <= h + 1 && sb.x >= 0 && sb.x + sb.width <= w + 1, `${id}: dialog on screen`).toBe(true);
      expect(await shell.evaluate((el) => { const c = el.querySelector('.mode-dialog-content'); return c.scrollHeight - c.clientHeight; }), `${id}: no inner scroll`).toBeLessThanOrEqual(1);
      await clean(page, '.mode-dialog-shell', id);
      expect(await smallTargets(page, '.mode-dialog-shell'), `${id}: ≥ 44px targets`).toEqual([]);
      // the dialog's own words (the Blitz pack picker is its own component, unchanged here)
      if (phone) for (const part of ['.mode-dialog-title', '.mode-dialog-liner', '.mode-dialog-payrow', '.mode-dialog-actions']) expect(await smallText(page, `.mode-dialog-shell ${part}`), `${id} ${part}: ≥ 16px text`).toEqual([]);
      // after-action: the lead button is pressable and on screen
      const lead = shell.locator('.mode-dialog-btn').first();
      const lb = await lead.boundingBox();
      expect(lb.y + lb.height <= h, `${id}: lead button on screen`).toBe(true);
      await page.keyboard.press('Escape');
      await expect(shell).toHaveCount(0);
      await page.waitForTimeout(500);
    }
  });

  test(`#5 the CHAIN death card: no zero pill, no repeated rule, balanced @ ${tag}`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: w, height: h });
    await bootMenu(page, 100, '?portal=1&soloms=1500');
    await (await revealMode(page, 'chain')).click({ force: true });
    await page.locator('.mode-dialog-btn-create').click();
    await page.locator('.solo-root:not(.is-loadstate)').waitFor({ state: 'visible', timeout: 15000 });
    const input = page.locator('.solo-root input').first();
    await input.click().catch(() => {});
    await page.keyboard.type('qq', { delay: 30 });
    const card = page.locator('.solo-deathcard');
    await card.waitFor({ state: 'visible', timeout: 60000 });
    await page.waitForTimeout(1500);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/after-chain-results-${tag}.png` });
    const zero = await page.evaluate(() => [...document.querySelectorAll('.solo-deathcard .gems-earned')].filter((g) => g.getClientRects().length && g.getAttribute('data-gems-total') === '0').length);
    expect(zero, 'no "+0 GEMS" pill').toBe(0);
    await expect(card).not.toContainText('EVERY WORD STARTS WITH THE LAST LETTER');
    await expect(card.locator('.solo-chain-example')).toBeVisible();
    // balanced: the restart button is centred under the story, not alone in an empty right half
    const cb = await card.boundingBox();
    const rb = await card.locator('.solo-restart').boundingBox();
    const mid = rb.x + rb.width / 2 - (cb.x + cb.width / 2);
    expect(Math.abs(mid), 'PLAY AGAIN centred in the card').toBeLessThanOrEqual(24);
    expect(rb.width, 'PLAY AGAIN spans the card').toBeGreaterThan(cb.width * 0.6);
    expect(cb.y + cb.height <= h + 1, 'card fits the screen').toBe(true);
    await clean(page, '.solo-deathcard', 'death card');
    expect(await smallTargets(page, '.solo-deathcard'), '≥ 44px targets').toEqual([]);
  });

  test(`#6 STATS: formula behind a tap, clean boosts, ALL TIME in the current style @ ${tag}`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: w, height: h });
    await bootMenu(page, 60, '?portal=1&season2=1');
    await navControl(page, 'stats').first().click();
    if (await page.locator('.claims-to-stats:visible').count()) await page.locator('.claims-to-stats').click();
    await expect(page.locator('.st2-total')).toBeVisible();
    await page.waitForTimeout(900);
    await expect(page.locator('.st2-basex')).toHaveCount(0);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/after-stats-${tag}.png` });
    await clean(page, '.st2-hero', 'stats hero');
    // after-action: the "?" opens the math, which stays inside the screen
    await page.getByTestId('st2-info').click();
    await expect(page.getByTestId('st2-basex')).toBeVisible();
    await page.waitForTimeout(700); // the press-juice squash (a finite one-shot) settles before anything is measured
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/after-stats-math-${tag}.png` });
    await clean(page, '.st2-hero', 'stats hero + math');
    expect(await smallTargets(page, '.st2-head, .st2-hero'), '≥ 44px targets').toEqual([]);
    // BOOSTS: clean (the where-from guide went in #685)
    await page.locator('.st2-tab[data-tab="boosts"]').click();
    await expect(page.getByTestId('st2-boosts')).toBeVisible();
    await page.waitForTimeout(300);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/after-stats-boosts-${tag}.png` });
    await clean(page, '.st2-boosts', 'boosts');
    // ALL TIME: no glow on the level numeral, thick cell outlines
    await page.locator('.st2-tab[data-tab="xp"]').click();
    await page.locator('.st2-life-k').click();
    await expect(page.locator('.stats-panel')).toBeVisible();
    await page.waitForTimeout(400);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/after-stats-alltime-${tag}.png` });
    const st = await page.evaluate(() => {
      const lv = document.querySelector('.pc-lv'); const cell = document.querySelector('.pc-cell');
      return { glow: lv ? getComputedStyle(lv).textShadow : '', cellB: cell ? parseFloat(getComputedStyle(cell).borderTopWidth) : 0 };
    });
    expect(st.glow, 'no blurred glow on the level').not.toMatch(/0px 0px [1-9]/);
    expect(st.cellB, 'thick cell outline').toBeGreaterThanOrEqual(4);
    await clean(page, '.stats-header', 'all-time header');
  });

  test(`#13 the wheel offline: a disabled kit SPIN + RETRY that recovers @ ${tag}`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: w, height: h });
    await bootWheel(page);
    let fail = true;
    await page.route('https://lb.e2e.invalid/**/rpc/lb_wheel_state', (route) => (fail
      ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: false }) })
      : route.fallback()));
    await openWheel(page); // the wheel lives in UPGRADES (Andy nov5)
    const wheel = page.getByTestId('daily-wheel');
    await expect(wheel.getByTestId('wheel-off')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(300);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/after-wheel-offline-${tag}.png` });
    const off = wheel.getByTestId('wheel-spin-off');
    await expect(off).toHaveAttribute('aria-disabled', 'true');
    await expect(off).toContainText('SPIN');
    await expect(off).toContainText('OFFLINE');
    await expect(wheel).not.toContainText('NEEDS A CONNECTION');
    await clean(page, '.dw-foot', 'wheel foot');
    expect(await smallTargets(page, '.dw-foot'), '≥ 44px targets').toEqual([]);
    if (phone) expect(await smallText(page, '.dw-foot'), '≥ 16px text').toEqual([]);
    // after-action: RETRY re-asks; the server answers now → the live SPIN
    fail = false;
    await wheel.getByTestId('wheel-retry').click();
    await expect(wheel.getByTestId('wheel-spin')).toBeVisible({ timeout: 10000 });
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/after-wheel-retry-${tag}.png` });
    await clean(page, '.dw-foot', 'wheel foot after retry');
  });

  test(`WB results: a zero WINS / GEMS bar is hidden and never covers RANK / WORDS @ ${tag}`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: w, height: h });
    const mock = await installBackendMock(page);
    await page.addInitScript(() => {
      if (sessionStorage.getItem('wbz.seeded')) return;
      sessionStorage.setItem('wbz.seeded', '1');
      for (const k of ['taw.seenMenu', 'taw.seenMenuSpotlight', 'taw.seenGameSpotlight']) localStorage.setItem(k, '1');
    });
    await page.goto('/?portal=1&season2=1');
    await menuReady(page);
    const ME = 'e2e-player';
    const players = [{ id: ME, name: 'YOU', lives: 3, isHost: true }, { id: 'p2', name: 'RIVAL', lives: 3 }, { id: 'p3', name: 'LEXI', lives: 3 }];
    mock.pushToClient({ type: 'room_update', payload: { code: 'ABCD', gameType: 'word-bomb', hostId: ME, difficultyKey: 'chill', players } });
    await page.waitForTimeout(80);
    mock.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } });
    await page.waitForTimeout(120);
    // nobody types a word: the seats go out and I win a round that paid nothing
    const dead = new Set();
    for (const id of ['p3', 'p2']) {
      dead.add(id);
      mock.pushToClient({ type: 'turn_update', payload: { currentPlayerId: ME, players: players.map((p) => ({ ...p, lives: dead.has(p.id) ? 0 : 3 })), combo: 'ing', timerSeconds: 22, usedWords: [] } });
      await page.waitForTimeout(120);
    }
    mock.pushToClient({ type: 'game_over', payload: { winnerId: ME } });
    const card = page.locator('.game-over-overlay .rs2');
    await card.waitFor();
    await page.waitForTimeout(2500); // the tally's reveal
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/after-wb-results-zero-${tag}.png` });
    const st = await page.evaluate(() => {
      const total = document.querySelector('.rs2 [data-wins-total]');
      const vis = (el) => !!el && el.getClientRects().length > 0 && getComputedStyle(el).display !== 'none';
      const head = document.querySelector('.rs2-players-h');
      const hb = head && vis(head) ? head.getBoundingClientRect() : null;
      // anything of the tally drawn over the RANK / WORDS header?
      const over = hb ? [...document.querySelectorAll('.rs2-tally *')].filter((el) => {
        if (!vis(el)) return false; const r = el.getBoundingClientRect();
        return r.width > 0 && r.bottom > hb.top + 1 && r.top < hb.bottom - 1 && r.right > hb.left && r.left < hb.right;
      }).map((el) => el.className.toString().slice(0, 30)) : [];
      return { amount: total ? Number(total.getAttribute('data-wins-total')) : null, totalShown: vis(total && total.closest('.rs2-total')), over };
    });
    if (st.amount === 0) expect(st.totalShown, 'a +0 WINS bar is hidden').toBe(false);
    expect(st.over, 'nothing covers RANK / WORDS').toEqual([]);
    const zeroGems = await page.evaluate(() => [...document.querySelectorAll('.rs2-gems')].filter((g) => g.getClientRects().length && g.querySelector('.gems-earned[data-gems-total="0"]')).length);
    expect(zeroGems, 'a +0 GEMS box is hidden').toBe(0);
    const d = await layoutDefects(page, { scope: '.rs2' });
    expect(d.overlaps, 'results overlaps').toEqual([]);
  });
}
