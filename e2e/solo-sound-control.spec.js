// e2e/solo-sound-control.spec.js — the sound control is never an orphan on a solo screen.
//
// Batch 2 took the app-wide fixed 🔊 control off the Word Bomb board because a 44x44
// `position: fixed` button at right:16/bottom:16 sat 20px into SEND and SKIP — a decorative
// control on the buttons that cost you a life. The suppression was written as
// `view !== 'game'`, which is Word Bomb and Blitz. CHAIN, FUSE and SAT RUSH are their OWN
// views, so all three kept the orphan, at the corner where each of them puts its deck.
//
// This gate is the general form of that fix rather than another named-selector patch: on a
// solo screen the control must (a) exist — never zero, so a player can always reach the
// mute — (b) be exactly one, and (c) not be a viewport-fixed element with coordinates of
// its own. It joins the exit cluster.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

const VIEWPORTS = [
  { name: '1366x768', width: 1366, height: 768 },
  { name: '1280x720', width: 1280, height: 720 },
  { name: '390x844', width: 390, height: 844 },
  { name: '320x640', width: 320, height: 640 },
];

async function openSolo(page, route) {
  await installBackendMock(page);
  await page.goto(`${route}?portal=1`);
  // WAIT FOR THE SHELL, NOT THE ROOT. `SoloLoadState` — the screen shown while the lazy word
  // data is fetched — also renders `.solo-root`, so waiting on that raced the real shell and
  // the gate intermittently read a screen that has no cluster yet. Waiting on the cluster is
  // both correct and stricter: the load state has one now too.
  await page.locator('.solo-root').waitFor({ state: 'visible', timeout: 15000 });
  await page.locator('.solo-hud').waitFor({ state: 'visible', timeout: 20000 });
  await page.waitForTimeout(400);
}

for (const route of ['/chain', '/fuse']) {
  for (const vp of VIEWPORTS) {
    test(`${route} sound control joins the exit cluster — ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await openSolo(page, route);

      const r = await page.evaluate(() => {
        const all = [...document.querySelectorAll('.audio-ctrl')];
        const btns = [...document.querySelectorAll('.audio-btn')];
        const cluster = document.querySelector('.solo-corner');
        const exit = document.querySelector('.solo-exit');
        const g = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; };
        const btn = btns[0] || null;
        // every viewport-fixed element small enough to be a floating control
        const orphans = [...document.querySelectorAll('body *')].filter((e) => {
          const cs = getComputedStyle(e);
          if (cs.position !== 'fixed') return false;
          // The coach mark is fixed BY DESIGN and is not a control: it is pointer-events:none,
          // it is shown once, and it dismisses on the first key or tap. The rule this gate
          // enforces is about PERSISTENT controls — a thing you can press, that stays.
          if (e.closest('.spotlight-overlay')) return false;
          if (cs.pointerEvents === 'none') return false;
          if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
          const b = e.getBoundingClientRect();
          if (!b.width || !b.height) return false;
          return b.width * b.height < innerWidth * innerHeight * 0.4;
        }).map((e) => `${e.tagName.toLowerCase()}.${String(e.className).trim().split(/\s+/).slice(0, 2).join('.')}`);
        return {
          ctrls: all.length,
          btns: btns.length,
          inCluster: !!(cluster && btn && cluster.contains(btn)),
          fixedControl: !!(btn && btn.closest('.audio-ctrl') && getComputedStyle(btn.closest('.audio-ctrl')).position === 'fixed'),
          btnBox: g(btn),
          exitBox: g(exit),
          orphans,
          scroll: document.documentElement.scrollHeight > document.documentElement.clientHeight + 1,
        };
      });

      expect(r.btns, 'the solo screen has no sound control at all').toBe(1);
      expect(r.ctrls, 'two sound controls on one screen').toBe(1);
      expect(r.inCluster, 'the control is not in the exit cluster').toBe(true);
      expect(r.fixedControl, 'the control is still a viewport-fixed orphan').toBe(false);
      expect(r.orphans, `fixed floating elements left on ${route}: ${r.orphans.join(', ')}`).toEqual([]);

      // it does not cover EXIT — side by side on wide screens, stacked under it on narrow
      const sideBySide = Math.abs(r.btnBox.y - r.exitBox.y) < 12;
      if (sideBySide) {
        const ov = Math.min(r.btnBox.x + r.btnBox.w, r.exitBox.x + r.exitBox.w) - Math.max(r.btnBox.x, r.exitBox.x);
        expect(ov, `the control overlaps EXIT by ${Math.round(ov)}px`).toBeLessThanOrEqual(0);
      } else {
        const ovv = Math.min(r.btnBox.y + r.btnBox.h, r.exitBox.y + r.exitBox.h) - Math.max(r.btnBox.y, r.exitBox.y);
        expect(ovv, `stacked, the control overlaps EXIT by ${Math.round(ovv)}px`).toBeLessThanOrEqual(0);
      }

      // AND IT DOES NOT COVER THE HUD. This is the check the first cut of the gate did not
      // have, and the screenshot is what found what it missed: side by side the cluster is
      // 88px wide, the HUD reserves a 52px column for the ✕ alone, and at 320x640 the pair
      // sat 32x34 on `.solo-mult` — the score multiplier. Every other assertion was green.
      const hudHits = await page.evaluate(() => {
        const c = document.querySelector('.solo-corner');
        if (!c) return ['no cluster'];
        const cb = c.getBoundingClientRect();
        const out = [];
        for (const el of document.querySelectorAll('.solo-hud *')) {
          const b = el.getBoundingClientRect();
          if (b.width < 6 || b.height < 6) continue;
          const ov = Math.min(cb.right, b.right) - Math.max(cb.left, b.left);
          const oh = Math.min(cb.bottom, b.bottom) - Math.max(cb.top, b.top);
          if (ov > 4 && oh > 4) {
            out.push(`${String(el.className).slice(0, 22)}"${(el.textContent || '').trim().slice(0, 12)}" ${Math.round(ov)}x${Math.round(oh)}`);
          }
        }
        return [...new Set(out)];
      });
      expect(hudHits, `the corner cluster covers the HUD: ${hudHits.join(' | ')}`).toEqual([]);

      // 44px of HIT AREA, even though the layout box is sized to the 40px cluster
      const hit = await page.evaluate(() => {
        const b = document.querySelector('.audio-btn');
        const cs = getComputedStyle(b, '::after');
        return { minW: parseFloat(cs.minWidth) || 0, minH: parseFloat(cs.minHeight) || 0 };
      });
      expect(hit.minW, 'touch target under 44px wide').toBeGreaterThanOrEqual(44);
      expect(hit.minH, 'touch target under 44px tall').toBeGreaterThanOrEqual(44);

      expect(r.scroll, 'the solo screen scrolls').toBe(false);
      await page.screenshot({ path: `claude/solo-audio-shots/${route.slice(1)}-${vp.name}.png` });
    });
  }
}
