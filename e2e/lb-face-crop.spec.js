// e2e/lb-face-crop.spec.js — Andy nov2: "the avatars shown on the leaderboard (for anyone below top 3) is a bit too
// cropped that sometimes even part of the face cannot be seen". Every hero in the cast wears a board row; at 1366 and 390
// each row's head frame shows that hero's WHOLE head box (cast/faceBox.js), mapped to screen pixels, inside the frame's
// inner edge — and every frame still shows a head, not a whole tiny body.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { mockBoard } from './support/boardMock.js';
import { navControl } from './support/menu.js';
import { ALL_HEROES } from '../src/cast/cast.js';
import { headBox } from '../src/cast/faceBox.js';

const SECRET = 'e5'.repeat(24);
const FUTURE = Date.now() + 3_600_000;
const HEROES = ALL_HEROES.map((c) => c.id);
const ROWS = Array.from({ length: 3 + HEROES.length }, (_, i) => ({
  id: `p${i}`, username: `PLAYER${String(i).padStart(2, '0')}`, level: 900 - i * 5, rebirths: 40, stars: 0,
  lifetime_words: 9000, lifetime_letters: 40000, wins_per_word: 10, econ: 13, submitted_at: FUTURE,
}));
const heroOf = (id) => { const i = Number(id.slice(1)); return i >= 3 ? HEROES[i - 3] : null; };

for (const vp of [{ width: 1366, height: 768 }, { width: 390, height: 844 }]) {
  test(`@${vp.width} every hero's whole head fits its row frame (${HEROES.length} heroes)`, async ({ page }) => {
    await page.setViewportSize(vp);
    await installBackendMock(page);
    await page.addInitScript(() => { window.__TAW_NO_ACHIEVEMENT_GRANT = true; });
    const me = { id: 'me', username: 'NOBUFF', level: 1, rebirths: 0, stars: 0, lifetime_words: 10, lifetime_letters: 50, wins_per_word: 1, econ: 13, submitted_at: FUTURE };
    await mockBoard(page, [], { caps: true, shared: { rows: [...ROWS, me], secrets: new Map([[SECRET, 'me']]), saves: new Map() }, econ: true, boardEcon: true, season2: true });
    await page.route('**/rest/v1/profile_showcase*', (route) => {
      const url = decodeURIComponent(route.request().url());
      const ids = ((url.match(/in\.\(([^)]*)\)/) || [])[1] || '').split(',').filter(Boolean);
      route.fulfill({ json: ids.map((id) => ({ profile_id: id, hero: heroOf(id) })) });
    });
    await page.addInitScript(({ secret }) => {
      if (sessionStorage.getItem('fc.seeded')) return;
      sessionStorage.setItem('fc.seeded', '1');
      localStorage.setItem('taw.seenMenu', '1');
      localStorage.setItem('taw.seenMenuSpotlight', '1');
      localStorage.setItem('taw.lb.profile', JSON.stringify({ id: 'me', username: 'NOBUFF' }));
      localStorage.setItem('taw.lb.secret', secret);
      localStorage.setItem('taw.econ', '12');
      localStorage.setItem('taw.s2.xp', JSON.stringify({ lv: 1, f: 0.1, rc: 0, v: 10 }));
      localStorage.setItem('taw.s2.rebirths', '0');
    }, { secret: SECRET });
    await page.goto('/?portal=1&season2=1');
    await navControl(page, 'leaderboard').click();
    const lb = page.locator('.lb2');
    await lb.waitFor({ state: 'visible' });
    // every hero has landed on its row (the showcase read)
    await expect(lb.locator('.lb2-row .lb2-face[data-hero="zip"]')).toHaveCount(1, { timeout: 15_000 });
    await page.waitForTimeout(2500);
    if (process.env.FACE_SHOTS) await page.screenshot({ path: `${process.env.FACE_SHOTS}/faces-${vp.width}.png` });

    const boxes = Object.fromEntries(HEROES.map((h) => [h, headBox(h)]));
    const bad = await page.evaluate((boxes) => {
      const out = [];
      for (const f of document.querySelectorAll('.lb2-row:not(.is-me) .lb2-face')) {
        const h = f.dataset.hero; const box = boxes[h]; if (!box) continue;
        const img = f.querySelector('img').getBoundingClientRect();
        const fr = f.getBoundingClientRect(); const bw = parseFloat(getComputedStyle(f).borderLeftWidth) || 0;
        const inner = { l: fr.left + bw, t: fr.top + bw, r: fr.right - bw, b: fr.bottom - bw };
        const [cx, cy, hs] = box;
        const head = { l: img.left + (cx - hs / 2) * img.width, r: img.left + (cx + hs / 2) * img.width, t: img.top + (cy - hs / 2) * img.height, b: img.top + (cy + hs / 2) * img.height };
        if (head.l < inner.l - 1.5 || head.r > inner.r + 1.5 || head.t < inner.t - 1.5 || head.b > inner.b + 1.5) out.push(`${h}: head ${JSON.stringify(head)} frame ${JSON.stringify(inner)}`);
        // ...and it is still a HEAD shot: the head box fills at least half the frame
        if ((head.r - head.l) < 0.5 * (inner.r - inner.l)) out.push(`${h}: head too small in its frame`);
      }
      return out;
    }, boxes);
    expect(bad).toEqual([]);
    expect(await lb.locator('.lb2-row:not(.is-me) .lb2-face').count()).toBeGreaterThanOrEqual(HEROES.length);
  });
}
