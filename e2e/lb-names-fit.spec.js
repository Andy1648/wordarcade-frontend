// e2e/lb-names-fit.spec.js — NAMES ARE NEVER CUT (Andy oct21: "you have to let them shrink the name … find room"). On the
// season-2 LEADERBOARD every name — YOUR pill in the header, the podium, the rows — is drawn WHOLE: scaled down to its
// slot, never an ellipsis, never past its slot, and YOUR pill never reaches the centred LEADERBOARD title. The names here
// are the 16-character maximum (the widest letters too), at the Chromebook sizes and on phones.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { mockBoard } from './support/boardMock.js';
import { navControl } from './support/menu.js';

const SECRET = 'd5'.repeat(24);
const FUTURE = Date.now() + 3_600_000;
const row = (id, username, o) => ({ id, username, level: 10, rebirths: 0, stars: 0, lifetime_words: 500, lifetime_letters: 2500, wins_per_word: 10, econ: 13, submitted_at: FUTURE, ...o });
const ME = 'WWMMWWMMWWMMWWMM'; // 16 — the longest legal name, in the widest letters

for (const [w, h] of [[1280, 720], [1366, 768], [1280, 551], [1920, 1080], [390, 844], [360, 640]]) {
  test(`every leaderboard name is whole at ${w}x${h}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await installBackendMock(page);
    await page.addInitScript(() => { window.__TAW_NO_ACHIEVEMENT_GRANT = true; });
    const rows = [
      row('a', 'MMMMWWWWMMMMWWWW', { stars: 1, level: 5 }),
      row('b', 'CHARLIEHORSES123', { rebirths: 9, level: 900 }),
      row('c', 'WIDESTWHALEEVER1', { rebirths: 9, level: 100 }),
      row('d', 'DELTAFORCEXXWWMM', { rebirths: 2, level: 9999 }),
      row('e', 'ECHO', { rebirths: 1, level: 50 }),
      row('me', ME, { level: 60, rebirths: 1 }),
    ];
    await mockBoard(page, [], { caps: true, shared: { rows, secrets: new Map([[SECRET, 'me']]), saves: new Map() }, econ: true, boardEcon: true, weekly: true, season2: true });
    await page.addInitScript(({ secret, me }) => {
      if (sessionStorage.getItem('lbn.seeded')) return;
      sessionStorage.setItem('lbn.seeded', '1');
      localStorage.setItem('taw.seenMenu', '1');
      localStorage.setItem('taw.seenMenuSpotlight', '1');
      localStorage.setItem('taw.lb.profile', JSON.stringify({ id: 'me', username: me }));
      localStorage.setItem('taw.lb.secret', secret);
      localStorage.setItem('taw.econ', '12');
      localStorage.setItem('taw.s2.xp', JSON.stringify({ lv: 60, f: 0.1, rc: 1, v: 10 }));
      localStorage.setItem('taw.s2.rebirths', '1');
    }, { secret: SECRET, me: ME });
    await page.goto('/?portal=1&season2=1');
    await navControl(page, 'leaderboard').click();
    const lb = page.locator('.lb2');
    await lb.waitFor({ state: 'visible' });
    await expect(lb.locator('.lb2-col--1')).toHaveAttribute('data-id', /.+/, { timeout: 10_000 });
    await page.waitForTimeout(1200); // the podium rise / list slide land; FitText re-measures once the font is in
    const r = await page.evaluate(() => {
      const bad = [];
      const names = [...document.querySelectorAll('.lb2 .lb2-me-v, .lb2 .lb2-pod-name-t, .lb2 .lb2-name')];
      for (const el of names) {
        const b = el.getBoundingClientRect();
        if (b.width === 0) continue;
        const cs = getComputedStyle(el);
        const inner = el.querySelector('.fit-in');
        if (!inner) { bad.push(`${el.textContent}: not a FitText`); continue; }
        const v = inner.getBoundingClientRect();
        if (cs.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1) bad.push(`${el.textContent}: ellipsis`);
        if (v.left < b.left - 1.5 || v.right > b.right + 1.5) bad.push(`${el.textContent}: drawn past its slot (${Math.round(v.left)}..${Math.round(v.right)} in ${Math.round(b.left)}..${Math.round(b.right)})`);
      }
      const me = document.querySelector('.lb2-me-btn');
      const title = document.querySelector('.lb2-title');
      let hit = false;
      if (me && title) {
        const a = me.getBoundingClientRect();
        const rg = document.createRange(); rg.selectNodeContents(title);
        const t = rg.getBoundingClientRect(); // the title's LETTERS — its box spans the whole header
        hit = Math.min(a.right, t.right) - Math.max(a.left, t.left) > 2 && Math.min(a.bottom, t.bottom) - Math.max(a.top, t.top) > 2;
      }
      return { bad, hit, n: names.length, me: me ? me.textContent : '' };
    });
    expect(r.n).toBeGreaterThan(3);
    expect(r.me).toContain(ME);
    expect(r.bad, 'every name whole, inside its slot').toEqual([]);
    expect(r.hit, 'YOUR pill never reaches the LEADERBOARD title').toBe(false);
  });
}
