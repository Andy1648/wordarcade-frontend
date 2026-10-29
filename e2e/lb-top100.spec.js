// e2e/lb-top100.spec.js — the TOP 100 board with descriptions (Andy oct28: "extend to top 100" + bios for the top
// accounts), held to the UI checklist (oct28): at 1366 / 1920 / 390, ZERO overlaps between the podium's name, bio,
// plate and numbers or between list rows, the bios are readable (>= 16px), and the board really goes to #100.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { mockBoard } from './support/boardMock.js';
import { navControl } from './support/menu.js';

const SHOTS = process.env.LB_SHOTS || '';
const SECRET = 'b8'.repeat(24);
const FUTURE = Date.now() + 3_600_000;
// long names on purpose (oct29 audit: FitText shrank WEPFKWPFPOKW to 6.5px, ANDY_POCKETPUH too)
const NAMES = ['yaoguangzaiyaoguang', 'NOVAKID', 'glyphqueen', 'TURBOTYPER', 'WEPFKWPFPOKWQXZ', 'sleepyfox', 'QWERTYGOD', 'ANDY_POCKETPUHHH', 'DRIFTKING', 'lexi'];
const BIOS = ['too good', 'grinding since day one', 'no keyboard no problem', 'chromebook warrior', 'i type with my elbows', 'gg ez', 'rebirth addict', 'top 10 or bust', 'spelling bee dropout', 'hi mom'];
const ROWS = Array.from({ length: 120 }, (_, i) => ({
  id: `p${i}`, username: i < 10 ? NAMES[i] : i === 58 ? 'XXLONGNAMEWITHNOSPACES' : `PLAYER${String(i).padStart(3, '0')}`,
  week_levels: i < 40 ? 80 - i : 0, week_rebirths: 0, week_stars: 0, level: 900 - i * 7, rebirths: Math.max(0, 40 - Math.floor(i / 3)),
  stars: i < 5 ? 5 - i : 0, lifetime_words: 9000 - i * 50, lifetime_letters: 40000, wins_per_word: 10, econ: 13, submitted_at: FUTURE,
}));

async function boot(page, vp, me) {
  await page.setViewportSize(vp);
  await installBackendMock(page);
  await page.addInitScript(() => { window.__TAW_NO_ACHIEVEMENT_GRANT = true; });
  const meRow = { id: 'me', username: 'NOBUFF', stars: 0, lifetime_words: 6000, lifetime_letters: 30000, wins_per_word: 10, econ: 13, submitted_at: FUTURE, ...me };
  await mockBoard(page, [], { caps: true, shared: { rows: [...ROWS, meRow], secrets: new Map([[SECRET, 'me']]), saves: new Map() }, econ: true, boardEcon: true, weekly: true, s2Weekly: true, rebirth: { delayMs: 0 }, season2: true });
  await page.route('**/rest/v1/profile_showcase*', (route) => {
    const url = decodeURIComponent(route.request().url());
    const ids = ((url.match(/in\.\(([^)]*)\)/) || [])[1] || (url.match(/profile_id=eq\.([^&]+)/) || [])[1] || '').split(',').filter(Boolean);
    route.fulfill({ json: ids.map((id) => ({ profile_id: id, hero: null, bio: BIOS[Number(id.slice(1))] || null })) });
  });
  await page.addInitScript(({ secret, me }) => {
    if (sessionStorage.getItem('lb2.seeded')) return;
    sessionStorage.setItem('lb2.seeded', '1');
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.lb.profile', JSON.stringify({ id: 'me', username: 'NOBUFF' }));
    localStorage.setItem('taw.lb.secret', secret);
    localStorage.setItem('taw.econ', '12');
    localStorage.setItem('taw.s2.xp', JSON.stringify({ lv: me.level, f: 0.1, rc: me.rebirths, v: 10 }));
    localStorage.setItem('taw.s2.rebirths', String(me.rebirths));
  }, { secret: SECRET, me: meRow });
  await page.goto('/?portal=1&season2=1');
  await navControl(page, 'leaderboard').waitFor({ state: 'visible' });
  await navControl(page, 'leaderboard').click();
  const lb = page.locator('.lb2');
  await lb.waitFor({ state: 'visible' });
  await expect(lb.locator('.lb2-pod-bio')).toHaveCount(3, { timeout: 10_000 });
  await page.waitForTimeout(3000); // the finite arrival (podium rise, row pulses, the climb) has settled
  return lb;
}

/** Every pair of boxes in `groups` (each a list of rects) that overlaps by more than `tol` px. */
function overlapsIn(page) {
  return page.evaluate(() => {
    const out = [];
    const box = (el) => el.getBoundingClientRect();
    const hit = (a, b, tol = 1) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > tol && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > tol;
    const narrowStage = !!document.querySelector('.lb2--narrow');
    // the size the text is DRAWN at: font-size times any transform scale on it or inside it (FitText scales an inner span)
    const drawnPx = (el) => {
      let k = 1;
      for (const e of [el, ...el.querySelectorAll('*')]) {
        const t = getComputedStyle(e).transform;
        if (t && t !== 'none') { const m = t.match(/matrix\(([-\d.e]+)/); if (m) k = Math.min(k, Math.abs(parseFloat(m[1]))); }
      }
      return parseFloat(getComputedStyle(el).fontSize) * k;
    };
    // the podium: name / bio / plate / numbers inside each column never touch; the name keeps the floor and its column
    for (const col of document.querySelectorAll('.lb2-col')) {
      const pn = col.querySelector('.lb2-pod-name-t');
      if (pn) {
        const px = drawnPx(pn);
        if (px < (narrowStage ? 16 : 13) - 0.5) out.push(`podium ${col.dataset.place}: name at ${px.toFixed(1)}px`);
        const nb = pn.getBoundingClientRect(); const cb = col.getBoundingClientRect();
        if (nb.left < cb.left - 2 || nb.right > cb.right + 2) out.push(`podium ${col.dataset.place}: name runs out of its column`);
        // Andy oct21: a name is NEVER cut - no ellipsis, nothing clipped (it wraps instead)
        const pcs = getComputedStyle(pn);
        const clipsP = pcs.overflow !== 'visible' && (pn.scrollWidth > pn.clientWidth + 1 || pn.scrollHeight > pn.clientHeight + 3);
        if (pcs.textOverflow === 'ellipsis' || clipsP) out.push(`podium ${col.dataset.place}: name is cut`);
      }
      const parts = ['.lb2-pod-name', '.lb2-pod-bio', '.lb2-pod-plate', '.lb2-pod-stats'].map((s) => [s, col.querySelector(s)]).filter(([, e]) => e);
      for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) {
        if (hit(box(parts[i][1]), box(parts[j][1]))) out.push(`podium ${col.dataset.place}: ${parts[i][0]} x ${parts[j][0]}`);
      }
    }
    // the list: the rows in view never overlap one another, and a bio never runs into its name
    const sc = document.querySelector('.lb2-scroll').getBoundingClientRect();
    const rows = [...document.querySelectorAll('.lb2-row')].filter((r) => { const b = box(r); return b.bottom > sc.top && b.top < sc.bottom; });
    for (let i = 1; i < rows.length; i++) {
      if (hit(box(rows[i - 1]), box(rows[i]), 2)) out.push(`rows #${rows[i - 1].dataset.rank} x #${rows[i].dataset.rank}`);
    }
    const narrow = !!document.querySelector('.lb2--narrow');
    for (const r of rows) {
      const rb = box(r);
      // the oct29 audit: a name is never shrunk under the floor (13px desktop, 16px phone) and nothing spills out of its row
      const nm = r.querySelector('.lb2-name');
      if (nm) {
        const px = drawnPx(nm);
        if (px < (narrow ? 16 : 13) - 0.5) out.push(`row #${r.dataset.rank}: name at ${px.toFixed(1)}px`);
        const ncs = getComputedStyle(nm);
        const clipsN = ncs.overflow !== 'visible' && nm.scrollWidth > nm.clientWidth + 1;
        if (ncs.textOverflow === 'ellipsis' || ncs.webkitLineClamp !== 'none' || clipsN) out.push(`row #${r.dataset.rank}: name is cut`);
      }
      for (const t of r.querySelectorAll('.lb2-name-line, .lb2-bio, .lb2-chase')) {
        const tb = box(t);
        if (tb.top < rb.top - 1 || tb.bottom > rb.bottom + 1) out.push(`row #${r.dataset.rank}: ${t.className.split(' ')[0]} spills out of its row`);
      }
      if (narrow && r.offsetHeight < 44) out.push(`row #${r.dataset.rank}: ${r.offsetHeight}px tall (under 44)`);
      const name = r.querySelector('.lb2-name-line');
      const bio = r.querySelector('.lb2-bio');
      if (name && bio && hit(box(name), box(bio))) out.push(`row #${r.dataset.rank}: name x bio`);
    }
    return out;
  });
}

for (const vp of [{ width: 1366, height: 768 }, { width: 1920, height: 1080 }, { width: 390, height: 844 }]) {
  test(`TOP 100 + bios @ ${vp.width}: no overlaps, readable bios, the board reaches #100`, async ({ page }) => {
    // YOU at #7: the list opens on the TOP 10 rows (4-10 carry their bios)
    const lb = await boot(page, vp, { level: 860, rebirths: 38 });
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/lb-top-${vp.width}.png` });
    expect(await overlapsIn(page)).toEqual([]);
    const bios = lb.locator('.lb2-bio');
    expect(await bios.count(), 'rows 4-10 (minus your own) carry a bio').toBeGreaterThanOrEqual(5);
    for (const sel of ['.lb2-bio', '.lb2-pod-bio']) {
      const px = await lb.locator(sel).first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
      expect(px, `${sel} is readable`).toBeGreaterThanOrEqual(16);
    }
    // the header (YOU / CHANGE) is clickable - the #1 podium column never sits over it (oct29 audit, 1024-1366)
    const covered = await page.locator('.lb2-me-btn').evaluate((el) => { const b = el.getBoundingClientRect(); const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return !(hit && el.contains(hit)); });
    expect(covered, 'the YOU / CHANGE button is on top').toBe(false);
    // the board is a TOP 100: the last list row is #100
    expect(await lb.locator('.lb2-row').last().getAttribute('data-rank')).toBe('100');
  });

  test(`TOP 100 @ ${vp.width}: a #61 player chases the player above (not just "TO TOP 50"), no overlaps`, async ({ page }) => {
    const lb = await boot(page, vp, { level: 500, rebirths: 20 });
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/lb-61-${vp.width}.png` });
    expect(await overlapsIn(page)).toEqual([]);
    await expect(lb.locator('.lb2-row.is-me')).toHaveAttribute('data-rank', '61');
    await expect(lb.locator('.lb2-row.is-me .lb2-chase')).toContainText('PASS');
    await expect(lb.locator('.lb2-row.is-rival')).toHaveAttribute('data-rank', '60');
    // the TOP 100 tier wears its painted stone seal (51-100), and every painted cut line keeps the ribbon's own shape
    await expect(lb.locator('.lb2-row[data-rank="75"] .lb2-seal')).toHaveAttribute('data-tier', 'stone');
    const ribs = await lb.locator('.lb2-sep-rib').evaluateAll((els) => els.map((e) => { const b = e.getBoundingClientRect(); return b.width / b.height; }));
    expect(ribs.length, 'the TOP 50 / TOP 100 cut lines are on the board').toBeGreaterThanOrEqual(2);
    for (const r of ribs) expect(Math.abs(r - 1200 / 182), `a ribbon at ${r.toFixed(2)}:1 is stretched`).toBeLessThan(0.15);
    if (SHOTS) {
      await lb.locator('.lb2-sep[data-band="stone"]').scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${SHOTS}/lb-cutline-${vp.width}.png` });
    }
  });
}

for (const vp of [{ width: 1280, height: 551 }, { width: 1366, height: 768 }, { width: 390, height: 844 }]) {
  test(`THIS WEEK @ ${vp.width}x${vp.height}: bios and names stay inside their rows, no overlaps (oct29 audit)`, async ({ page }) => {
    const lb = await boot(page, vp, { level: 860, rebirths: 38, week_levels: 50 });
    await lb.locator('.lb2-tab[data-tab="week"]').click();
    await expect(lb.locator('.lb2-tab[data-tab="week"]')).toHaveAttribute('aria-selected', 'true');
    await expect(lb.locator('.lb2-row').first()).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(2500);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/lb-week-${vp.width}.png` });
    if (process.env.LB_MEASURE) console.log(JSON.stringify(await page.evaluate(() => { const r = document.querySelector('.lb2-row.is-rival'); const q = (s) => { const e = r.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); const cs = getComputedStyle(e); return [s, Math.round(b.width), cs.display, cs.flex, cs.minWidth, cs.fontSize, cs.containerType]; }; return ['.lb2-who-cell', '.lb2-name-line', '.lb2-name', '.lb2-rival'].map(q); })));
    expect(await overlapsIn(page)).toEqual([]);
  });
}
