// e2e/card-fit.spec.js — fix/card-fit-height: THE CARD MAY NOT SHRINK BELOW ITS OWN CONTENT.
//
// The menu cards used to be sized from the available HEIGHT, locked 3:4, so a short laptop
// (1366x625) got a 170px card and the payout line "10 WINS / WORD (x2)" ran 85px past it — the
// card's overflow:hidden cut it off, so the one number the card exists to show was invisible.
// Andy's call: the text never shrinks or hides to fit; the LAYOUT changes instead.
//
// For every viewport x profile this FAILS on:
//   (a) any card text clipped by ANY clipping ancestor (overflow != visible, up to the viewport),
//       not just by its own box;
//   (b) any card text escaping its card's border box;
//   (c) any rendered text on the menu under 13px (--fs-label, the hard floor) — font-size times
//       the element's effective CSS zoom, so a zoomed-down cluster can't hide under the floor;
//   (d) any page scroll (documentElement / body scroll size > viewport);
//   (e) any payout / XP unit span hidden on an unlocked card ("/ WORD", "WINS", "(xN)") —
//       dropping words to fit is the thing this branch exists to stop;
//   (f) any card text COVERED by something else on the card (the corner ribbon, the lock
//       plaque): hit-tested at five points inside each text box. The test turns pointer-events
//       on inside the grid first — .game-card-fg is pointer-events:none, which would otherwise
//       make every hit-test fall through to the card and pass vacuously.
// Cards are selected by the exact class token (getElementsByClassName('game-card')), never a
// [class*=game-card] substring match, which would also catch -wrap/-magnet/-fg/-payout nodes.
// aria-hidden subtrees (the corner ribbon, deliberately cropped by the card corner) are skipped.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { installBackendMock } from './support/backendMock.js';

const VIEWPORTS = [
  [1366, 625], [1366, 768], [1280, 800], [1163, 501], [1440, 900],
  [1920, 1080], [2560, 1440], [3440, 1440], [1024, 768],
];

// FRESH: an empty profile — LV1, every gated card locked. HIGH: a long-run profile whose payout
// strings are the longest the card has to hold (big resolved rate + a multiplier tag).
const PROFILES = {
  fresh: null,
  high: {
    'taw.xp': JSON.stringify({ lv: 99, into: 0 }),
    'taw.rebirths': '9',
    'taw.momentum': '200',
    'taw.wins': '999999999',
  },
};

const FLOOR = 13;
const TOL = 0.5;

async function boot(page, w, h, seed) {
  await page.setViewportSize({ width: w, height: h });
  await installBackendMock(page);
  if (seed) {
    await page.addInitScript((kv) => {
      try { for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v); } catch { /* blocked */ }
    }, seed);
  }
  await page.goto('/?portal=1');
  await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400); // the fit-math's second rAF pass
}

function measure(page) {
  return page.evaluate(({ FLOOR }) => {
    const pe = document.createElement('style');
    pe.textContent = '.homepage-cards-grid * { pointer-events: auto !important; }';
    document.head.appendChild(pe);
    const rendered = (el) => {
      for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
        if (e.getAttribute && e.getAttribute('aria-hidden') === 'true') return false;
        const s = getComputedStyle(e);
        if (s.display === 'none' || s.visibility === 'hidden') return false;
      }
      return true;
    };
    const textRects = (root) => {
      const out = [];
      const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let n = tw.nextNode(); n; n = tw.nextNode()) {
        if (!n.textContent.trim() || !rendered(n.parentElement)) continue;
        const r = document.createRange();
        r.selectNodeContents(n);
        for (const rect of r.getClientRects()) if (rect.width > 0 && rect.height > 0) out.push({ el: n.parentElement, rect, text: n.textContent.trim() });
      }
      return out;
    };
    // Overhang of `rect` past every clipping ancestor of `el` (padding box), and the viewport.
    const clipOf = (el, rect) => {
      let worst = 0;
      let by = '';
      for (let a = el; a; a = a.parentElement) {
        const s = getComputedStyle(a);
        const cx = s.overflowX !== 'visible';
        const cy = s.overflowY !== 'visible';
        if (!cx && !cy) continue;
        const b = a.getBoundingClientRect();
        const z = a.currentCSSZoom || 1;
        const L = b.left + a.clientLeft * z;
        const T = b.top + a.clientTop * z;
        const R = L + a.clientWidth * z;
        const B = T + a.clientHeight * z;
        const o = Math.max(
          cx ? Math.max(L - rect.left, rect.right - R) : 0,
          cy ? Math.max(T - rect.top, rect.bottom - B) : 0,
          0,
        );
        if (o > worst) { worst = o; by = `${a.tagName.toLowerCase()}.${String(a.className).split(' ')[0]}`; }
      }
      const vo = Math.max(0 - rect.left, rect.right - innerWidth, 0 - rect.top, rect.bottom - innerHeight, 0);
      if (vo > worst) { worst = vo; by = 'viewport'; }
      return { worst, by };
    };
    const effPx = (el) => parseFloat(getComputedStyle(el).fontSize) * (el.currentCSSZoom || 1);

    const cards = [...document.getElementsByClassName('game-card')];
    const perCard = cards.map((card) => {
      const game = card.closest('[data-game]')?.getAttribute('data-game') || '?';
      const cr = card.getBoundingClientRect();
      const res = { game, w: cr.width, h: cr.height, clip: 0, clipBy: '', clipText: '', escape: 0, escText: '', payoutClip: 0, xpClip: 0, hidden: [], covered: [] };
      for (const t of textRects(card)) {
        const c = clipOf(t.el, t.rect);
        const esc = Math.max(cr.left - t.rect.left, t.rect.right - cr.right, cr.top - t.rect.top, t.rect.bottom - cr.bottom, 0);
        if (c.worst > res.clip) { res.clip = c.worst; res.clipBy = c.by; res.clipText = t.text; }
        if (esc > res.escape) { res.escape = esc; res.escText = t.text; }
        // (f) five points inset 20% from each edge of the text box; the topmost element there must
        // be this text's own element (or inside it). Points outside the viewport are skipped.
        {
          const { left, top, width, height } = t.rect;
          for (const [fx, fy] of [[0.5, 0.5], [0.2, 0.3], [0.8, 0.3], [0.2, 0.7], [0.8, 0.7]]) {
            const x = left + width * fx;
            const y = top + height * fy;
            if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) continue;
            const hit = document.elementFromPoint(x, y);
            if (hit && hit !== t.el && !t.el.contains(hit)) {
              res.covered.push(`"${t.text}" under ${hit.tagName.toLowerCase()}.${String(hit.getAttribute('class') || '').split(' ')[0]}`);
              break;
            }
          }
        }
        const line = t.el.closest('.game-card-payout, .game-card-xp');
        if (line) {
          const o = Math.max(c.worst, esc);
          if (line.classList.contains('game-card-payout')) res.payoutClip = Math.max(res.payoutClip, o);
          else res.xpClip = Math.max(res.xpClip, o);
        }
      }
      for (const sel of ['.game-card-payout-unit', '.game-card-payout-per', '.game-card-payout-mult']) {
        for (const s of card.querySelectorAll(sel)) if (!rendered(s) || s.getClientRects().length === 0) res.hidden.push(`${sel}:"${s.textContent.trim()}"`);
      }
      // A payout/XP line that is itself display:none is a hidden line, not a clean one.
      if (!card.classList.contains('locked') && !card.classList.contains('disabled')) {
        for (const sel of ['.game-card-payout', '.game-card-xp']) {
          const el = card.querySelector(sel);
          if (el && !rendered(el)) res.hidden.push(`${sel} (whole line)`);
        }
      }
      return res;
    });

    let small = { px: Infinity, text: '' };
    const root = document.getElementById('root') || document.body;
    for (const t of textRects(root)) {
      const px = effPx(t.el);
      if (px < small.px) small = { px, text: t.text.slice(0, 40) };
    }
    const de = document.documentElement;
    const scroll = {
      x: Math.max(de.scrollWidth, document.body.scrollWidth) - innerWidth,
      y: Math.max(de.scrollHeight, document.body.scrollHeight) - innerHeight,
    };
    const logo = document.querySelector('.homepage-logo');
    pe.remove();
    return {
      cards: perCard,
      smallest: small,
      scroll,
      titlePx: logo ? effPx(logo) : 0,
      floor: FLOOR,
    };
  }, { FLOOR });
}

const OUT = process.env.CARD_FIT_OUT;

for (const [profile, seed] of Object.entries(PROFILES)) {
  for (const [w, h] of VIEWPORTS) {
    test(`${profile} ${w}x${h}: card text fits, >=13px, no scroll`, async ({ page }) => {
      await boot(page, w, h, seed);
      const m = await measure(page);
      const row = {
        profile, vp: `${w}x${h}`,
        payoutClip: Math.max(0, ...m.cards.map((c) => c.payoutClip)),
        xpClip: Math.max(0, ...m.cards.map((c) => c.xpClip)),
        clip: Math.max(0, ...m.cards.map((c) => c.clip)),
        escape: Math.max(0, ...m.cards.map((c) => c.escape)),
        minCardW: Math.min(...m.cards.map((c) => c.w)),
        smallest: m.smallest,
        scroll: m.scroll,
        titlePx: m.titlePx,
        hidden: m.cards.flatMap((c) => c.hidden.map((x) => `${c.game} ${x}`)),
        covered: m.cards.flatMap((c) => c.covered.map((x) => `${c.game} ${x}`)),
      };
      if (OUT) fs.appendFileSync(OUT, `${JSON.stringify(row)}\n`);
      expect(m.cards.length, 'five mode cards (exact .game-card class)').toBe(5);
      for (const c of m.cards) {
        expect(c.clip, `${c.game}: text "${c.clipText}" clipped by ${c.clipBy}`).toBeLessThanOrEqual(TOL);
        expect(c.escape, `${c.game}: text "${c.escText}" escapes its card`).toBeLessThanOrEqual(TOL);
        expect(c.hidden, `${c.game}: payout/XP text hidden to fit`).toEqual([]);
        expect(c.covered, `${c.game}: card text covered by another element`).toEqual([]);
      }
      expect(m.smallest.px, `smallest rendered text ("${m.smallest.text}")`).toBeGreaterThanOrEqual(FLOOR);
      expect(m.scroll.x, 'page scrolls horizontally').toBeLessThanOrEqual(0);
      expect(m.scroll.y, 'page scrolls vertically').toBeLessThanOrEqual(0);
    });
  }
}

test('3440x1440: the wordmark scales past the old 96px --fs-hero cap', async ({ page }) => {
  await boot(page, 3440, 1440, null);
  const m = await measure(page);
  expect(m.titlePx).toBeGreaterThan(96);
});
