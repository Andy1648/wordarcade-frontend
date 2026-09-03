// e2e/fixed-overlap.spec.js — the class viewport-integrity was BLIND to (JOB C).
// viewport-integrity deliberately SKIPS position:fixed/absolute elements in its clip check (they
// are positioned against the viewport, not their DOM ancestor), so a fixed corner control sitting
// ON TOP of page content — e.g. the SHOP button occluding the "TYPE A WORD" wordmark at 390px
// (JOB 9) — sailed straight through. This guard catches it: a SMALL fixed/absolute interactive
// control must not visually overlap PRIMARY TEXT (the wordmark or a heading). Full-screen overlays
// (scrims/dialogs, which are SUPPOSED to cover content) are excluded by the area test.
import { test, expect } from '@playwright/test';
import { installBackendMock, freezeAnimations } from './support/backendMock.js';

const VIEWPORTS = [
  { w: 320, h: 568 }, { w: 360, h: 640 }, { w: 390, h: 844 }, { w: 430, h: 932 },
  { w: 768, h: 1024 }, { w: 1280, h: 720 }, { w: 1920, h: 1080 },
  // LANDSCAPE phones (fix/landscape-nav) — the short-height orientation this gate did not test.
  { w: 640, h: 360 }, { w: 844, h: 390 }, { w: 915, h: 412 },
];

test.describe('fixed control vs primary text (menu)', () => {
  for (const { w, h } of VIEWPORTS) {
    test(`${w}x${h}: no fixed/absolute control occludes the wordmark or a heading`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await installBackendMock(page);
      await page.addInitScript(() => { try { localStorage.setItem('taw.xp', JSON.stringify({ lv: 40, into: 0 })); localStorage.setItem('taw.wins', '9999'); localStorage.setItem('taw.winsLifetime', '9999'); } catch { /* */ } });
      await page.goto('/?portal=1');
      await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
      await freezeAnimations(page);
      await page.waitForTimeout(200);
      const hits = await page.evaluate(() => {
        const vw = window.innerWidth, vh = window.innerHeight, vArea = vw * vh;
        const rectOf = (el) => el.getBoundingClientRect();
        const overlaps = (a, b) => a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
        // PRIMARY TEXT that must never be covered: the wordmark + any real heading.
        const primary = [...document.querySelectorAll('.homepage-logo, h1, h2, [role="img"][aria-label]')]
          .filter((e) => e.offsetParent !== null && rectOf(e).width > 1);
        // SMALL fixed/absolute interactive controls (not full-screen overlays).
        const controls = [...document.querySelectorAll('button, a[href], [role="button"]')].filter((e) => {
          const cs = getComputedStyle(e);
          if (cs.position !== 'fixed' && cs.position !== 'absolute') return false;
          if (e.offsetParent === null && cs.position !== 'fixed') return false;
          const r = rectOf(e);
          if (r.width < 1 || r.height < 1) return false;
          if (r.width * r.height > vArea * 0.4) return false; // exclude big overlays/scrims
          return true;
        });
        const out = [];
        for (const c of controls) {
          const cr = rectOf(c);
          for (const p of primary) {
            if (c.contains(p) || p.contains(c)) continue;
            if (overlaps(cr, rectOf(p))) {
              const cl = (c.getAttribute('aria-label') || c.textContent || c.className).trim().slice(0, 24);
              const pl = (p.getAttribute('aria-label') || p.textContent || p.className).trim().slice(0, 24);
              out.push(`"${cl}" covers "${pl}"`);
            }
          }
        }
        return out;
      });
      // eslint-disable-next-line no-console
      console.log(`FIXED-OVERLAP ${w}x${h}: ${hits.length ? hits.join(' ;; ') : 'clean'}`);
      expect(hits, `fixed control occludes primary text at ${w}x${h}`).toEqual([]);
    });
  }
});
