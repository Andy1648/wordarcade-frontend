// e2e/landscape-nav.spec.js (fix/landscape-nav) — the corner-nav-over-card collision the
// portrait-only fixed-overlap gate was blind to. In LANDSCAPE the five cards pack into one row and
// the rightmost (FUSE, LV25-gated) slid UNDER the absolute .homepage-corner-nav — elementFromPoint
// at FUSE's centre returned .is-stats, so a tap opened STATS and the mode was unlaunchable. This
// gate hit-tests EVERY card's centre in landscape and asserts it resolves to that card, never to a
// corner-nav button. (Portrait text-occlusion stays covered by fixed-overlap.spec.js.)
import { test, expect } from '@playwright/test';
import { installBackendMock, freezeAnimations } from './support/backendMock.js';

// Landscape phone sizes (both-orientation audit set, rotated): 360x640, 390x844, 412x915 → wide.
const LANDSCAPE = [
  { w: 640, h: 360 }, { w: 844, h: 390 }, { w: 915, h: 412 }, { w: 932, h: 430 },
];

test.describe('no game card sits under the corner nav (landscape)', () => {
  for (const { w, h } of LANDSCAPE) {
    test(`${w}x${h}: every card centre hit-tests to the card, not the corner nav`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await installBackendMock(page);
      // LV40 → FUSE (LV25) fully unlocked/launchable, the exact reported scenario.
      await page.addInitScript(() => {
        try {
          localStorage.setItem('taw.xp', JSON.stringify({ lv: 40, into: 0 }));
          localStorage.setItem('taw.wins', '9999');
          localStorage.setItem('taw.winsLifetime', '9999');
        } catch { /* */ }
      });
      await page.goto('/?portal=1');
      await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
      await freezeAnimations(page);
      await page.waitForTimeout(200);
      const hits = await page.evaluate(() => {
        const nav = document.querySelector('.homepage-corner-nav');
        const cards = [...document.querySelectorAll('.game-card-magnet')];
        const out = [];
        for (const card of cards) {
          const r = card.getBoundingClientRect();
          if (r.width < 1 || r.height < 1) continue;
          const cx = Math.round(r.left + r.width / 2);
          const cy = Math.round(r.top + r.height / 2);
          const el = document.elementFromPoint(cx, cy);
          const id = card.getAttribute('data-game');
          if (!el) { out.push(`${id}: centre hit nothing`); continue; }
          // The centre must resolve to THIS card (or a descendant), never the corner nav.
          if (nav && (nav === el || nav.contains(el))) {
            const navBtn = (el.getAttribute('aria-label') || el.className || 'corner-nav').trim().slice(0, 24);
            out.push(`${id} centre is under corner-nav "${navBtn}"`);
          } else if (!card.contains(el) && el !== card) {
            out.push(`${id} centre resolves to "${(el.className || el.tagName).toString().slice(0, 24)}" (not the card)`);
          }
        }
        return out;
      });
      // eslint-disable-next-line no-console
      console.log(`LANDSCAPE-NAV ${w}x${h}: ${hits.length ? hits.join(' ;; ') : 'clean'}`);
      expect(hits, `a card is occluded by the corner nav at ${w}x${h}`).toEqual([]);
    });
  }
});
