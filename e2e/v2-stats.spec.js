// e2e/v2-stats.spec.js — THE v2 STATS SCREEN (P8; claude/mockups/v2/Stats.dc.html) behind ?season2=1. A season-2 save
// at R5 ★1 POWER 6 (no mark, no boost):
//   1. the TOTAL multiplier comes FIRST (Balatro-style): ×64 = 1,408 WINS / WORD, then the chain BASE 22 · REBIRTH ×32 ·
//      MARK ×1 · BOOST ×1 · ASCEND ×2 — the v3 numbers (2^R and (1 + ★) as separate chips); the XP tab is POWER-first;
//   2. REPLAY (tap the TOTAL) runs the chain again from ×1 and lands on the same total — and every animation it plays
//      is FINITE (nothing on the screen loops at rest);
//   3. REDUCE MOTION shows the finished chain at once and plays nothing;
//   4. the ALL TIME cell opens the full panel (records, backup …) — nothing of the live panel is lost;
//   5. at 1280×551, 1366×657, 1920×1080 and 390×844: no scrollbars, nothing off-screen, no text under 13px.
// With the flag OFF the live panel is untouched (every other stats spec runs flag-off).
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { mockBoard } from './support/boardMock.js';
import { navControl } from './support/menu.js';

const SECRET = 'c7'.repeat(24);

async function boot(page, { reduce = false } = {}) {
  await installBackendMock(page);
  await page.addInitScript(() => { window.__TAW_NO_ACHIEVEMENT_GRANT = true; });
  const row = { id: 'me-st', username: 'Statter', level: 420, rebirths: 5, stars: 1, lifetime_words: 0, lifetime_letters: 0, wins_per_word: 0, econ: 13 };
  const shared = { rows: [row], secrets: new Map([[SECRET, row.id]]), saves: new Map() };
  await mockBoard(page, [], { caps: true, shared, econ: true, boardEcon: true, rebirth: { delayMs: 0 }, season2: true });
  await page.addInitScript(({ secret, id, reduce }) => {
    if (sessionStorage.getItem('st.seeded')) return;
    sessionStorage.setItem('st.seeded', '1');
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.lb.profile', JSON.stringify({ id, username: 'Statter' }));
    localStorage.setItem('taw.lb.secret', secret);
    localStorage.setItem('taw.econ', '12');
    if (reduce) localStorage.setItem('taw.reduceMotion', '1');
    localStorage.setItem('taw.s2.xp', JSON.stringify({ lv: 420, f: 0.3, rc: 5, v: 10 }));
    localStorage.setItem('taw.s2.rebirths', '5');
    localStorage.setItem('taw.s2.keytier', '6');
    localStorage.setItem('taw.s2.stars', '1');
  }, { secret: SECRET, id: row.id, reduce });
  await page.goto('/?portal=1&season2=1');
  await navControl(page, 'stats').waitFor({ state: 'visible' });
  await navControl(page, 'stats').click();
  const st = page.locator('.st2');
  await st.waitFor({ state: 'visible' });
  return st;
}

const chipIds = (st) => st.locator('.st2-chip').evaluateAll((els) => els.map((e) => e.dataset.chip));
const chipVals = (st) => st.locator('.st2-chip-v').allTextContents();

test('the TOTAL first: ×64 = 1,408 WINS / WORD, then BASE · REBIRTH · MARK · BOOST · ASCEND; XP is POWER-first', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 657 });
  const st = await boot(page);
  const total = st.locator('[data-testid="st2-total"]');
  await expect(total).toHaveText('×64', { timeout: 8000 });
  await expect(st.locator('[data-testid="st2-result"]')).toHaveText('1,408');
  await expect(st.locator('.st2-unit')).toHaveText('WINS / WORD');
  await expect(st.locator('.st2-basex')).toHaveText('BASE 22 × 64');
  // the TOTAL is the first number on the screen (before the chain)
  const order = await st.evaluate((root) => {
    const t = root.querySelector('[data-testid="st2-total"]');
    const c = root.querySelector('.st2-chip');
    return !!(t.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  expect(order, 'TOTAL precedes the chain').toBe(true);
  expect(await chipIds(st)).toEqual(['base', 'rebirth', 'mark', 'boost', 'ascend']);
  expect(await chipVals(st)).toEqual(['22', '×32', '×1', '×1', '×2']);
  await expect(st.locator('[data-chip="ascend"] .st2-chip-tag')).toHaveText('1 STAR');
  await expect(st.locator('[data-chip="rebirth"] .st2-chip-tag')).toHaveText('R5');
  // the tabs carry their own totals
  await expect(st.locator('.st2-tab[data-tab="wins"] .st2-tab-total')).toHaveText('×64');
  // XP / LETTER: POWER 2.5^6 · REBIRTH 2^5 · MARK · BOOST · ASCEND (1 + ★)
  await st.locator('.st2-tab[data-tab="xp"]').click();
  await expect(st.locator('.st2-tab[data-tab="xp"]')).toHaveAttribute('aria-selected', 'true');
  expect(await chipIds(st)).toEqual(['base', 'power', 'rebirth', 'mark', 'boost', 'ascend']);
  await expect(st.locator('.st2-unit')).toHaveText('XP / LETTER');
  const xpTab = (await st.locator('.st2-tab[data-tab="xp"] .st2-tab-total').textContent()).trim();
  await expect(total).toHaveText(xpTab, { timeout: 8000 });
  await expect(st.locator('[data-chip="power"] .st2-chip-v')).toHaveText('×244');
  await expect(st.locator('[data-chip="power"] .st2-chip-tag')).toHaveText('LV 6');
});

test('REPLAY runs the chain again from ×1 to the same total — every animation finite', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 551 });
  const st = await boot(page);
  const total = st.locator('[data-testid="st2-total"]');
  await expect(total).toHaveText('×64', { timeout: 8000 });
  await st.locator('.st2-big').click();
  await expect(total).toHaveText('×1');
  // mid-chain: a running total between ×1 and ×64 (the REBIRTH chip counts up)
  await expect(total).not.toHaveText('×1', { timeout: 3000 });
  await expect(total).toHaveText('×64', { timeout: 8000 });
  await expect(st.locator('[data-testid="st2-result"]')).toHaveText('1,408');
  const loops = await page.evaluate(() => document.getAnimations()
    .filter((a) => a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('.st2'))
    .filter((a) => a.effect.getTiming().iterations === Infinity).length);
  expect(loops, 'no looping animation on the STATS screen').toBe(0);
});

test('REDUCE MOTION: the finished chain at once, nothing plays', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 657 });
  const st = await boot(page, { reduce: true });
  await expect(st.locator('[data-testid="st2-total"]')).toHaveText('×64', { timeout: 1500 });
  await st.locator('.st2-big').click();
  await expect(st.locator('[data-testid="st2-total"]')).toHaveText('×64');
  const running = await page.evaluate(() => document.getAnimations()
    .filter((a) => a.playState === 'running' && a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('.st2'))
    .map((a) => `${a.constructor.name}:${a.transitionProperty || a.animationName || ''}:${a.effect.target.className}`));
  expect(running).toEqual([]);
});

test('ALL TIME opens the full panel (records, backup) — then ✕ back to the menu', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 657 });
  const st = await boot(page);
  await expect(st.locator('.st2-life-cell')).toHaveCount(5);
  await expect(st.locator('.st2-life-cell').nth(3)).toContainText('REBIRTHS');
  await st.locator('.st2-life-k').click();
  await expect(st).toHaveCount(0);
  const panel = page.locator('.stats-panel');
  await panel.waitFor({ state: 'visible' });
  await expect(panel.locator('.stats-backup-copy')).toBeVisible();
  await page.locator('.stats-close').click();
  await expect(panel).toHaveCount(0);
  await navControl(page, 'stats').waitFor({ state: 'visible' });
});

for (const vp of [{ width: 1280, height: 551 }, { width: 1366, height: 657 }, { width: 1920, height: 1080 }, { width: 390, height: 844 }]) {
  test(`@${vp.width}×${vp.height}: no scrollbars, nothing off-screen, no text under 13px; ← MENU closes`, async ({ page }) => {
    await page.setViewportSize(vp);
    const st = await boot(page);
    await expect(st.locator('[data-testid="st2-total"]')).toHaveText('×64', { timeout: 8000 });
    const m = await page.evaluate(() => {
      const root = document.querySelector('.st2');
      const W = window.innerWidth;
      const H = window.innerHeight;
      const small = [];
      const off = [];
      for (const el of root.querySelectorAll('*')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (el.closest('svg') && el.tagName.toLowerCase() !== 'svg') continue;
        if (r.left < -1 || r.top < -1 || r.right > W + 1 || r.bottom > H + 1) off.push(el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className);
        const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
        if (hasText && parseFloat(getComputedStyle(el).fontSize) < 12.99) small.push(`${el.className}:${getComputedStyle(el).fontSize}`);
      }
      return {
        scrollX: root.scrollWidth - root.clientWidth,
        scrollY: root.scrollHeight - root.clientHeight,
        docX: document.documentElement.scrollWidth - W,
        small,
        off: off.filter((c) => !/st2-stripes|st2-tick/.test(String(c))),
      };
    });
    expect(m.scrollX).toBeLessThanOrEqual(0);
    expect(m.scrollY).toBeLessThanOrEqual(0);
    expect(m.docX).toBeLessThanOrEqual(0);
    expect(m.small, 'no text under 13px').toEqual([]);
    expect(m.off, 'nothing off-screen').toEqual([]);
    // touch targets ≥ 44px
    for (const sel of ['.st2-back', '.st2-tab[data-tab="wins"]', '.st2-tab[data-tab="xp"]', '.st2-life-k']) {
      const b = await st.locator(sel).boundingBox();
      expect(Math.min(b.width, b.height), `${sel} ≥ 44px`).toBeGreaterThanOrEqual(44);
    }
    await st.locator('.st2-back').click();
    await expect(st).toHaveCount(0);
  });
}
