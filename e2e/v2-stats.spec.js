// e2e/v2-stats.spec.js — THE v2 STATS SCREEN (P8; claude/mockups/v2/Stats.dc.html) behind ?season2=1. A season-2 save
// at R5 KEY 6 (no mark, no boost; a leftover ★1 that FINAL v2 ignores — ascension is hidden):
//   1. the TOTAL multiplier comes FIRST (Balatro-style): ×243 = 2,430 WINS / WORD, then the chain in FINAL v2's order
//      BASE 10 · MODE ×1 · REBIRTH ×243 (3^R) · MARK ×1 · BOOST ×1 — no STARS chip; the XP tab is KEY-first; the PRINTED
//      chips multiply out to the PRINTED total (numbers audit, Andy item 5);
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

async function boot(page, { reduce = false, extra = null } = {}) {
  await installBackendMock(page);
  await page.addInitScript(() => { window.__TAW_NO_ACHIEVEMENT_GRANT = true; });
  const row = { id: 'me-st', username: 'Statter', level: 420, rebirths: 5, stars: 1, lifetime_words: 0, lifetime_letters: 0, wins_per_word: 0, econ: 13 };
  const shared = { rows: [row], secrets: new Map([[SECRET, row.id]]), saves: new Map() };
  await mockBoard(page, [], { caps: true, shared, econ: true, boardEcon: true, rebirth: { delayMs: 0 }, season2: true });
  await page.addInitScript(({ secret, id, reduce, extra }) => {
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
    for (const [k, v] of Object.entries(extra || {})) localStorage.setItem(k, v);
  }, { secret: SECRET, id: row.id, reduce, extra });
  await page.goto('/?portal=1&season2=1');
  await navControl(page, 'stats').waitFor({ state: 'visible' });
  await navControl(page, 'stats').click();
  const st = page.locator('.st2');
  await st.waitFor({ state: 'visible' });
  return st;
}

const chipIds = (st) => st.locator('.st2-chip').evaluateAll((els) => els.map((e) => e.dataset.chip));
// a printed number back to a value: "×1,024" → 1024, "×15.63" → 15.63, "1.13K" → 1130
const SUF = { '': 1, K: 1e3, M: 1e6, B: 1e9, T: 1e12 };
const val = (t) => {
  const m = /^×?([\d,]*\.?\d+)([KMBT]?)$/.exec(String(t).trim());
  if (!m) throw new Error(`not a number: ${t}`);
  return Number(m[1].replace(/,/g, '')) * SUF[m[2]];
};
const chipVals = (st) => st.locator('.st2-chip-v').allTextContents();

test('the TOTAL first: ×243 = 2,430 WINS / WORD, then BASE · MODE · REBIRTH · MARK · BOOST; XP is KEY-first', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 657 });
  const st = await boot(page);
  const total = st.locator('[data-testid="st2-total"]');
  await expect(total).toHaveText('×243', { timeout: 8000 });
  await expect(st.locator('[data-testid="st2-result"]')).toHaveText('2,430');
  await expect(st.locator('.st2-unit')).toHaveText('WINS / WORD');
  await expect(st.locator('.st2-basex')).toHaveText('BASE 10 × 243');
  // the TOTAL is the first number on the screen (before the chain)
  const order = await st.evaluate((root) => {
    const t = root.querySelector('[data-testid="st2-total"]');
    const c = root.querySelector('.st2-chip');
    return !!(t.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  expect(order, 'TOTAL precedes the chain').toBe(true);
  expect(await chipIds(st)).toEqual(['base', 'mode', 'rebirth', 'mark', 'boost']);
  expect(await chipVals(st)).toEqual(['10', '×1', '×243', '×1', '×1']);
  await expect(st.locator('[data-chip="mode"] .st2-chip-tag')).toHaveText('WORD BOMB');
  await expect(st.locator('[data-chip="rebirth"] .st2-chip-tag')).toHaveText('R5');
  // the tabs carry their own totals
  await expect(st.locator('.st2-tab[data-tab="wins"] .st2-tab-total')).toHaveText('×243');
  // XP / LETTER: KEY 2^6 (×64) · REBIRTH 3^5 · MARK · BOOST
  await st.locator('.st2-tab[data-tab="xp"]').click();
  await expect(st.locator('.st2-tab[data-tab="xp"]')).toHaveAttribute('aria-selected', 'true');
  expect(await chipIds(st)).toEqual(['base', 'power', 'rebirth', 'mark', 'boost']);
  await expect(st.locator('.st2-unit')).toHaveText('XP / KEY'); // season 2: XP is paid per menu KEY (R2 oct8 #4)
  const xpTab = (await st.locator('.st2-tab[data-tab="xp"] .st2-tab-total').textContent()).trim();
  await expect(total).toHaveText(xpTab, { timeout: 8000 });
  await expect(st.locator('[data-chip="power"] .st2-chip-v')).toHaveText('×64'); // KEY 2^6
  await expect(st.locator('[data-chip="power"] .st2-chip-tag')).toHaveText('TIER 6');
});

// NUMBERS AUDIT (Andy item 5): "BASE × each multiplier = TOTAL and the math must multiply out". A deeper save — KEY 3
// (×8, 2^3), R3 (×27) and a worn LEGENDARY +% WINS mark (FINAL ×2, plus the INDEX it brings) — on both tabs: the PRINTED
// chips multiply to the PRINTED TOTAL multiplier and BASE × TOTAL to the result.
for (const vp of [{ width: 1366, height: 657 }, { width: 390, height: 844 }]) {
  test(`@${vp.width}: the printed chips multiply out to the printed TOTAL on both tabs (KEY 3, R3, LEGENDARY mark)`, async ({ page }) => {
    await page.setViewportSize(vp);
    const extra = {
      'taw.s2.keytier': '3',
      'taw.s2.rebirths': '3',
      'taw.s2.xp': JSON.stringify({ lv: 120, f: 0.3, rc: 3, v: 10 }),
      'taw.markRolls': JSON.stringify({ v: 2, starter: true, marks: { 'mk-eclipse': { n: 1 } } }),
      'taw.mark': 'mk-eclipse',
    };
    const st = await boot(page, { reduce: true, extra });
    for (const tab of ['wins', 'xp']) {
      await st.locator(`.st2-tab[data-tab="${tab}"]`).click();
      await expect(st.locator(`.st2-tab[data-tab="${tab}"]`)).toHaveAttribute('aria-selected', 'true');
      const vals = (await st.locator('.st2-chip-v').allTextContents()).map(val);
      const ids = await chipIds(st);
      const total = val(await st.locator('[data-testid="st2-total"]').textContent());
      const result = val(await st.locator('[data-testid="st2-result"]').textContent());
      const [base, ...mults] = vals;
      const product = mults.reduce((p, m) => p * m, 1);
      expect(Math.abs(product - total) / total, `${tab}: ${ids.join(' × ')} = ${product} vs TOTAL ×${total}`).toBeLessThan(0.003);
      expect(Math.abs(base * total - result) / result, `${tab}: BASE ${base} × ${total} vs ${result}`).toBeLessThan(0.006);
      if (tab === 'wins') {
        expect(ids).toEqual(['base', 'mode', 'rebirth', 'mark', 'index', 'boost']);
        expect(vals.slice(0, 4)).toEqual([10, 1, 27, 2]); // BASE 10 · MODE 1 · 3^3 · LEGENDARY ×2 (FINAL)
      } else {
        expect(ids).toEqual(['base', 'power', 'rebirth', 'mark', 'index', 'boost']);
        expect(vals.slice(0, 3)).toEqual([1, 8, 27]); // BASE 1 · KEY 2^3 · 3^3 (FINAL v3)
      }
      // every chip on screen (seven of them on a phone too)
      const off = await st.locator('.st2-chip').evaluateAll((els) => els.filter((e) => {
        const r = e.getBoundingClientRect();
        return r.left < 0 || r.right > window.innerWidth + 0.5 || r.top < 0 || r.bottom > window.innerHeight + 0.5;
      }).map((e) => { const r = e.getBoundingClientRect(); return `${e.dataset.chip} ${Math.round(r.left)},${Math.round(r.top)} → ${Math.round(r.right)},${Math.round(r.bottom)}`; }));
      expect(off, `${tab}: chips off-screen`).toEqual([]);
    }
  });
}

test('REPLAY runs the chain again from ×1 to the same total — every animation finite', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 551 });
  const st = await boot(page);
  const total = st.locator('[data-testid="st2-total"]');
  await expect(total).toHaveText('×243', { timeout: 8000 });
  await st.locator('.st2-big').click();
  await expect(total).toHaveText('×1');
  // mid-chain: a running total between ×1 and ×64 (the REBIRTH chip counts up)
  await expect(total).not.toHaveText('×1', { timeout: 3000 });
  await expect(total).toHaveText('×243', { timeout: 8000 });
  await expect(st.locator('[data-testid="st2-result"]')).toHaveText('2,430');
  const loops = await page.evaluate(() => document.getAnimations()
    .filter((a) => a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('.st2'))
    .filter((a) => a.effect.getTiming().iterations === Infinity).length);
  expect(loops, 'no looping animation on the STATS screen').toBe(0);
});

test('REDUCE MOTION: the finished chain at once, nothing plays', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 657 });
  const st = await boot(page, { reduce: true });
  await expect(st.locator('[data-testid="st2-total"]')).toHaveText('×243', { timeout: 1500 });
  await st.locator('.st2-big').click();
  await expect(st.locator('[data-testid="st2-total"]')).toHaveText('×243');
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
    await expect(st.locator('[data-testid="st2-total"]')).toHaveText('×243', { timeout: 8000 });
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
