// e2e/lb-top100.spec.js — the TOP 100 board with descriptions (Andy oct28: "extend to top 100" + bios for the top
// accounts), held to the UI checklist (oct28): at 1366 / 1920 / 390, ZERO overlaps between the podium's name, bio,
// plate and numbers or between list rows, every row wears a face that stays in its row and off its name, the bios are
// readable (>= 16px), and the board really goes to #100.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { mockBoard } from './support/boardMock.js';
import { navControl } from './support/menu.js';

const SHOTS = process.env.LB_SHOTS || '';
const SECRET = 'b8'.repeat(24);
const FUTURE = Date.now() + 3_600_000;
// long names on purpose, up to the 16-character legal maximum (oct29 audit: FitText shrank WEPFKWPFPOKW to 6.5px)
// + the nov2 audit-2 names that broke mid-word (DANIE / L, MAKAYL / A, a CJK name one letter a line on a phone)
const NAMES = ['yaoguangzaiyaogu', 'NOVAKID', 'glyphqueen', 'YIPINGJT_唐一平', 'WEPFKWPFPOKWQXZ', 'sleepyfox', 'QWERTYGOD', 'ANDY_POCKETPUHHH', 'DANIEL', 'MAKAYLA'];
const BIOS = ['too good', 'grinding since day one', 'no keyboard no problem', 'chromebook warrior', 'i type with my elbows', 'gg ez', 'rebirth addict', 'top 10 or bust', 'spelling bee dropout', 'hi mom'];
const ROWS = Array.from({ length: 120 }, (_, i) => ({
  id: `p${i}`, username: i < 10 ? NAMES[i] : i === 58 ? 'XXLONGNAMENOSPAC' : i === 69 ? 'SUNDAESUNDAY' : `PLAYER${String(i).padStart(3, '0')}`,
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
    if (me.seenAt) localStorage.setItem('taw.s2.lbseen', JSON.stringify({ all: { me: me.seenAt } }));
  }, { secret: SECRET, me: meRow });
  await page.goto('/?portal=1&season2=1');
  await navControl(page, 'leaderboard').waitFor({ state: 'visible' });
  await navControl(page, 'leaderboard').click();
  const lb = page.locator('.lb2');
  await lb.waitFor({ state: 'visible' });
  await expect(lb.locator('.lb2-col--1')).toHaveAttribute('data-id', /.+/, { timeout: 10_000 });
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
    // how many lines a name's text is drawn on (distinct line tops of its text's client rects)
    const lineCount = (el) => { const rg = document.createRange(); rg.selectNodeContents(el); return new Set([...rg.getClientRects()].filter((q) => q.width > 0).map((q) => Math.round(q.top))).size; };
    // audit 2: a name breaks between letters ONLY when it is wider than its whole column at its size, and never leaves a
    // 1-2 letter orphan line. -> the reason it is broken badly, or null.
    const badBreak = (el, colW) => {
      if (lineCount(el) < 2) return null;
      const probe = document.createElement('span');
      const cs = getComputedStyle(el);
      Object.assign(probe.style, { position: 'absolute', visibility: 'hidden', whiteSpace: 'nowrap', font: cs.font, letterSpacing: cs.letterSpacing, textTransform: cs.textTransform });
      probe.textContent = el.textContent;
      document.body.appendChild(probe);
      const oneLine = probe.getBoundingClientRect().width;
      probe.remove();
      if (oneLine <= colW + 1) return `breaks though it fits (${Math.round(oneLine)}px in ${Math.round(colW)}px)`;
      const node = el.firstChild && el.firstChild.nodeType === 3 ? el.firstChild : null;
      if (node) {
        const tops = [];
        for (let i = 0; i < node.length; i++) { const rg = document.createRange(); rg.setStart(node, i); rg.setEnd(node, i + 1); const q = rg.getBoundingClientRect(); if (q.width > 0) tops.push(Math.round(q.top)); }
        const last = Math.max(...tops);
        const n = tops.filter((t) => Math.abs(t - last) <= 2).length;
        if (n <= 2) return `leaves a ${n}-letter orphan line`;
      }
      return null;
    };
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
        // nov2 TOP-3 ROWS: each name stays inside its own medal row, and #1's 16-letter name is ONE line on a desktop
        if (nb.left < cb.left - 2 || nb.right > cb.right + 2) out.push(`podium ${col.dataset.place}: name runs out of its row`);
        if (col.dataset.place === '1' && window.innerWidth >= 1280 && lineCount(pn) > 1) out.push(`podium 1: name breaks onto ${lineCount(pn)} lines`);
        // Andy oct21: a name is NEVER cut - no ellipsis, nothing clipped (it wraps instead)
        const pcs = getComputedStyle(pn);
        const plines = lineCount(pn);
        if (plines > 2) out.push(`podium ${col.dataset.place}: name stacks ${plines} lines`);
        const clipsP = pcs.overflow !== 'visible' && (pn.scrollWidth > pn.clientWidth + 1 || pn.scrollHeight > pn.clientHeight + 3);
        if (pcs.textOverflow === 'ellipsis' || clipsP) out.push(`podium ${col.dataset.place}: name is cut`);
      }
      const parts = ['.lb2-pod-seal', '.lb2-t3-face', '.lb2-pod-name-t', '.lb2-pod-plate', '.lb2-prize', '.lb2-pod-stats'].map((s) => [s, col.querySelector(s)]).filter(([, e]) => e);
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
        // a name reads as a WORD: at most two lines (nov2: a lost layout rule stacked names one letter per line and the rows
        // just grew - nothing overlapped, so only a line count catches it)
        const why = badBreak(nm, nm.closest('.lb2-who-text, .lb2-who-cell').getBoundingClientRect().width);
        if (why) out.push(`row #${r.dataset.rank} "${nm.textContent}": ${why}`);
        const lines = lineCount(nm);
        // two lines; a phone allows three for the worst case (16 letters, no gap, at the 16px floor in a ~100px column)
        if (lines > (narrow ? 3 : 2)) out.push(`row #${r.dataset.rank}: name stacks ${lines} lines`);
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
      const face = r.querySelector('.lb2-face');
      const faceShown = face && face.getClientRects().length > 0;
      // every row wears a face - except YOUR row on a phone, whose name column needs its width for the chase line
      if (!faceShown && !(narrow && r.classList.contains('is-me'))) out.push(`row #${r.dataset.rank}: no face`);
      else if (faceShown) {
        if (name && hit(box(face), box(name))) out.push(`row #${r.dataset.rank}: face x name`);
        const fb = box(face); const rb = box(r);
        if (fb.top < rb.top - 1 || fb.bottom > rb.bottom + 1) out.push(`row #${r.dataset.rank}: face spills out of its row`);
        if (fb.width < 26) out.push(`row #${r.dataset.rank}: face too small (${Math.round(fb.width)}px)`);
      }
      // the name (and its bio / chase line) stays INSIDE its row, beside the face - never pushed under it
      for (const t of r.querySelectorAll('.lb2-name-line, .lb2-bio, .lb2-chase')) {
        const tb = box(t); const rb = box(r);
        if (tb.top < rb.top - 1 || tb.bottom > rb.bottom + 1) out.push(`row #${r.dataset.rank}: ${t.className.split(' ')[0]} spills out of its row`);
        if (face && tb.left < box(face).right - 1) out.push(`row #${r.dataset.rank}: ${t.className.split(' ')[0]} sits under the face`);
      }
    }
    return out;
  });
}

for (const vp of [{ width: 1366, height: 768 }, { width: 1920, height: 1080 }, { width: 390, height: 844 }]) {
  test(`TOP 100 @ ${vp.width}: no overlaps, no bios on the board, the list dominates, the board reaches #100`, async ({ page }) => {
    // YOU at #7: the list opens on the TOP 10 rows
    const lb = await boot(page, vp, { level: 860, rebirths: 38 });
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/lb-top-${vp.width}.png` });
    expect(await overlapsIn(page)).toEqual([]);
    // nov2 SIMPLIFY (Andy: "no need for paragraph descriptions"): a bio lives in the profile card, never on the board
    await expect(lb.locator('.lb2-bio, .lb2-pod-bio')).toHaveCount(0);
    // ...and the ladder, not the trophy wall, owns the screen (Andy nov2 "they dont give so much space to first - third
    // place"): the top 3 are medal ROWS taking at most 15% of the board (16% on a phone: three 44px tap rows), with a real
    // gap under the header
    const t3 = await page.evaluate(() => {
      const st = document.querySelector('.lb2-stage').getBoundingClientRect(); const t = document.querySelector('.lb2-top3').getBoundingClientRect();
      const head = document.querySelector('.lb2-head').getBoundingClientRect();
      return { share: (t.width * t.height) / (st.width * st.height), gap: t.top - head.bottom };
    });
    expect(t3.share, `the top 3 take ${(t3.share * 100).toFixed(1)}% of the board`).toBeLessThanOrEqual(vp.width > 1000 ? 0.15 : 0.17);
    expect(t3.gap, 'the top 3 sit clear of the header').toBeGreaterThanOrEqual(8);
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
    // CLIMB 1 (nov2): the gap in the stat that decides the order (#60 is one rebirth ahead) + its fill bar
    await expect(lb.locator('.lb2-row.is-me .lb2-chase')).toContainText('+1 R');
    // ALL TIME the chase names the next RANK LEAGUE, in the dividers' language (#61 -> TITAN ends at #50)
    await expect(lb.locator('.lb2-row.is-me .lb2-chase')).toContainText('11 TO TITAN');
    if (vp.width > 1000) await expect(lb.locator('.lb2-climb-band')).toHaveText('11 TO TITAN');
    await expect(lb.locator('.lb2-row.is-me .lb2-gap')).toHaveCount(1);
    // the list opens on whole rows: the first thing under its top edge starts AT the edge (no sliver of a cut row)
    const sliver = await page.evaluate(() => { const sc = document.querySelector('.lb2-scroll'); const first = [...sc.children].find((el) => el.offsetTop + el.offsetHeight > sc.scrollTop + 1); return first ? Math.round(sc.scrollTop - first.offsetTop) : 0; });
    expect(sliver, 'px of a cut row above the list top').toBeLessThanOrEqual(1);
    // YOUR CLIMB (desktop): the player to pass + the gap, beside your hero
    if (vp.width > 1000) {
      await expect(lb.locator('.lb2-climb')).toContainText('+1 R');
      // YOUR CLIMB fills its panel (nov2: "bottom half is empty, text small"): every line 16px+, and the content reaches
      // the panel's lower third
      const fill = await page.evaluate(() => {
        const p = document.querySelector('.lb2-climb'); const pb = p.getBoundingClientRect();
        const kids = [...p.querySelectorAll('p, .lb2-climb-k, .lb2-climb-pct, .lb2-climb-gap')];
        const small = kids.filter((e) => e.textContent.trim() && parseFloat(getComputedStyle(e).fontSize) < 15.99).map((e) => `${e.className}:${getComputedStyle(e).fontSize}`);
        const low = Math.max(...[...p.children].map((e) => e.getBoundingClientRect().bottom));
        return { small, reach: (low - pb.top) / pb.height };
      });
      expect(fill.small, 'YOUR CLIMB text under 16px').toEqual([]);
      expect(fill.reach, 'YOUR CLIMB content reaches the panel bottom third').toBeGreaterThan(0.66);
    }
    // CLIMB 2: scrolled to the top of the list, YOUR row is still on screen inside the list (sticky, the same row)
    await lb.locator('.lb2-scroll').evaluate((el) => { el.scrollTop = 0; });
    await page.waitForTimeout(200);
    const pin = await page.evaluate(() => { const s = document.querySelector('.lb2-scroll').getBoundingClientRect(); const m = document.querySelector('.lb2-row.is-me').getBoundingClientRect(); return { inside: m.top >= s.top - 1 && m.bottom <= s.bottom + 1, rows: document.querySelectorAll('.lb2-row.is-me').length }; });
    expect(pin).toEqual({ inside: true, rows: 1 });
    // a row wears its league's badge, its place on the plate (MASTER, 51-100). The cut lines are SLIM FLAT dividers (Andy nov2: the
    // painted ribbons "look horrendous"): no ribbon art, a readable name, no taller than a third of a row
    await expect(lb.locator('.lb2-row[data-rank="75"] .lb2-seal')).toHaveAttribute('data-league', 'master');
    const seps = await lb.locator('.lb2-sep').evaluateAll((els) => els.map((e) => {
      const name = e.querySelector('.lb2-sep-name, .lg-badge-name'); const row = document.querySelector('.lb2-row:not(.is-me)');
      const art = [e, ...e.querySelectorAll('*')].some((x) => ['', '::before', '::after'].some((p) => /url\(/.test(getComputedStyle(x, p || null).backgroundImage) || /url\(/.test(getComputedStyle(x, p || null).maskImage || '')));
      return { art, px: name ? parseFloat(getComputedStyle(name).fontSize) : 0, h: e.getBoundingClientRect().height, rowH: row.getBoundingClientRect().height, text: name ? name.textContent : '' };
    }));
    expect(seps.length, 'the league cut lines are on the board').toBeGreaterThanOrEqual(2);
    // ALL TIME: the cut lines are the RANK LEAGUE boundaries (leagues.js) - each sits right above the league's first row
    const lines = await lb.locator('.lb2-sep.is-league').evaluateAll((els) => els.map((e) => ({ league: e.dataset.league, next: e.nextElementSibling && e.nextElementSibling.dataset.rank })));
    expect(lines).toEqual([{ league: 'champion', next: '4' }, { league: 'titan', next: '11' }, { league: 'master', next: '51' }]);
    for (const sp of seps) {
      expect(sp.art, `${sp.text}: a cut line wears no ribbon art`).toBe(false);
      expect(sp.px, `${sp.text}: name size`).toBeGreaterThanOrEqual(16);
      expect(sp.h, `${sp.text}: slim (${Math.round(sp.h)}px vs a ${Math.round(sp.rowH)}px row)`).toBeLessThanOrEqual(sp.rowH * 0.75);
    }
    if (SHOTS) {
      await lb.locator('.lb2-sep[data-league="master"]').scrollIntoViewIfNeeded();
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
    // THIS WEEK keeps its TOP-N wording (the week board has no leagues)
    await expect(lb.locator('.lb2-row.is-me .lb2-chase')).toContainText('TO TOP 25');
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/lb-week-${vp.width}.png` });
    // YOUR CLIMB's THIS WEEK gem ladder stays inside its panel
    if (vp.width > 1000) {
      const spill = await page.evaluate(() => { const p = document.querySelector('.lb2-climb'); const b = p.getBoundingClientRect(); return Math.max(...[...p.querySelectorAll('*')].map((e) => e.getBoundingClientRect().bottom)) - (b.bottom - 4); });
      expect(spill, 'px the YOUR CLIMB content runs past its panel').toBeLessThanOrEqual(0);
    }
    if (process.env.LB_MEASURE) console.log(JSON.stringify(await page.evaluate(() => { const r = document.querySelector('.lb2-row.is-rival'); const q = (s) => { const e = r.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); const cs = getComputedStyle(e); return [s, Math.round(b.width), cs.display, cs.flex, cs.minWidth, cs.fontSize, cs.containerType]; }; return ['.lb2-who-cell', '.lb2-name-line', '.lb2-name', '.lb2-rival'].map(q); })));
    expect(await overlapsIn(page)).toEqual([]);
  });
}

// audit 2 (LOW-MED): the #1 podium column's tap area never covers YOU / CHANGE at 1024
test('@1024x768 the header (YOU / CHANGE) is clickable over the smaller podium', async ({ page }) => {
  await boot(page, { width: 1024, height: 768 }, { level: 860, rebirths: 38 });
  const covered = await page.locator('.lb2-me-btn').evaluate((el) => { const b = el.getBoundingClientRect(); const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return !(hit && el.contains(hit)); });
  expect(covered).toBe(false);
  expect(await overlapsIn(page)).toEqual([]);
});

// YOUR NEIGHBOURHOOD (Andy nov2): past the TOP 100 the list ends on the 2 players above you, you, and the 2 below - plain
// rows in the same list under your league's line, with the player right above you as the RIVAL to PASS
for (const vp of [{ width: 1366, height: 768 }, { width: 390, height: 844 }]) {
  test(`@${vp.width} past #100: your neighbourhood (2 above, you, the players below) under your league line`, async ({ page }) => {
    // R1 LV70 sits between the R1 LV74 (#119) and R1 LV67 (#121) rows -> #120
    const lb = await boot(page, vp, { level: 70, rebirths: 1 });
    await expect(lb.locator('.lb2-row.is-me')).toHaveAttribute('data-rank', '120');
    const tail = await lb.locator('.lb2-row').evaluateAll((els) => els.slice(-4).map((e) => e.dataset.rank));
    expect(tail, 'the list ends on #118, #119, YOU, #121').toEqual(['118', '119', '120', '121']);
    // YOUR league's line (CRYSTAL, #101-300) sits right over the neighbourhood
    await expect(lb.locator('.lb2-sep.is-league').last()).toHaveAttribute('data-league', 'crystal');
    expect(await lb.locator('.lb2-sep.is-league').last().evaluate((e) => e.nextElementSibling.dataset.rank)).toBe('118');
    await expect(lb.locator('.lb2-row[data-rank="119"]')).toHaveClass(/is-rival/);
    await expect(lb.locator('.lb2-row.is-me .lb2-chase')).toContainText('PASS');
    await expect(lb.locator('.lb2-row.is-me .lb2-chase')).toContainText('+4 LV');
    await expect(lb.locator('.lb2-row.is-near')).toHaveCount(3);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/lb-near-${vp.width}.png` });
    expect(await overlapsIn(page)).toEqual([]);
  });

  test(`@${vp.width} past #100 at the very bottom: 2 above you, nobody below`, async ({ page }) => {
    const lb = await boot(page, vp, { level: 10, rebirths: 0 });
    await expect(lb.locator('.lb2-row.is-me')).toHaveAttribute('data-rank', '121');
    const tail = await lb.locator('.lb2-row').evaluateAll((els) => els.slice(-3).map((e) => e.dataset.rank));
    expect(tail).toEqual(['119', '120', '121']);
    await expect(lb.locator('.lb2-row[data-rank="120"]')).toHaveClass(/is-rival/);
    await expect(lb.locator('.lb2-row.is-me .lb2-chase')).toContainText('+1 R');
    expect(await overlapsIn(page)).toEqual([]);
  });
}

// POST-ACTION (anti-slop checklist): you just climbed from #12 (TITAN) INTO the top 3 (CHAMPION) - your own medal row wears YOU
// + the NEW league news (nov9: the news is a LEAGUE crossed; #5 -> #2 stays in CHAMPION), the panel follows you, and nothing overlaps mid-climb or after
for (const vp of [{ width: 1366, height: 768 }, { width: 390, height: 844 }]) {
  test(`@${vp.width} climbing into the top 3: your medal row + the tier news, no overlaps`, async ({ page }) => {
    const lb = await boot(page, vp, { level: 895, rebirths: 40, stars: 4, seenAt: 12 });
    const mine = lb.locator('.lb2-top3 .lb2-col.is-me');
    await expect(mine).toHaveAttribute('data-place', '2');
    await expect(mine.locator('.lb2-you')).toBeVisible();
    if (vp.width > 1000) await expect(mine.locator('.lb2-new-tier')).toContainText('NEW');
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/lb-into-top3-${vp.width}.png` });
    expect(await overlapsIn(page)).toEqual([]);
  });
}
