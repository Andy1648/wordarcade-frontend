// e2e/_shots.spec.js — EVERY SCREEN, EVERY SHOT VIEWPORT, INTO ONE LABELLED DIRECTORY.
//
// Not part of the gate. This is the before/after camera the run's rails ask for: it drives the
// SAME screen map the layout gate uses (e2e/support/screens.js), so a screen cannot be styled,
// gated and photographed against three different ideas of how to reach it.
//
// Usage:  SHOTS=claude/shots/before npx playwright test e2e/_shots.spec.js --workers=2
//
// It also PRINTS a per-frame census — element count, hot colours, type sizes, moving things —
// which is what Batch C measures. Taking the numbers from the same page-load as the picture
// means the picture and the census can never disagree.
import { test } from '@playwright/test';
import { SCREENS, SHOT_VIEWPORTS } from './support/screens.js';

const OUT = process.env.SHOTS || 'claude/shots/current';

// The census, run in the page. Deliberately counts what a PLAYER perceives, not what the DOM
// contains: only rendered, non-transparent, reasonably sized boxes, and only text that is
// actually painted.
async function census(page) {
  return page.evaluate(() => {
    const vw = window.innerWidth, vh = window.innerHeight;
    const vis = (el) => {
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) return false;
      if (r.right < 0 || r.bottom < 0 || r.left > vw || r.top > vh) return false;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') return false;
      if (parseFloat(cs.opacity) < 0.05) return false;
      return true;
    };
    const els = [...document.querySelectorAll('body *')].filter(vis);

    // ELEMENTS: a leaf-ish count. A wrapper whose only job is to position one child is not a
    // thing the player sees as separate, so count elements that paint their own ink: text with
    // no element children, or a box with a background/border/shadow of its own.
    const paints = els.filter((el) => {
      const cs = getComputedStyle(el);
      const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (ownText) return true;
      const bg = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent';
      const bd = parseFloat(cs.borderTopWidth) > 0 || parseFloat(cs.borderLeftWidth) > 0;
      const sh = cs.boxShadow && cs.boxShadow !== 'none';
      const img = el.tagName === 'IMG' || el.tagName === 'SVG' || cs.backgroundImage !== 'none';
      return bg || bd || sh || img;
    });

    // HOT COLOURS: distinct hues above 40% saturation, from painted fills and text.
    const hot = new Set();
    const toHsl = (str) => {
      const m = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
      if (!m) return null;
      const a = m[4] === undefined ? 1 : parseFloat(m[4]);
      if (a < 0.25) return null;
      const r = +m[1] / 255, g = +m[2] / 255, b = +m[3] / 255;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
      if (mx === mn) return { h: 0, s: 0, l };
      const d = mx - mn;
      const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      let h;
      if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      else if (mx === g) h = ((b - r) / d + 2) / 6;
      else h = ((r - g) / d + 4) / 6;
      return { h: h * 360, s, l };
    };
    for (const el of paints) {
      const cs = getComputedStyle(el);
      for (const c of [cs.backgroundColor, cs.color]) {
        const p = toHsl(c);
        // Ignore near-black/near-white: they are structure (outlines, paper), not hue.
        if (p && p.s > 0.4 && p.l > 0.12 && p.l < 0.95) hot.add(Math.round(p.h / 30) * 30);
      }
    }

    // TYPE SIZES: distinct rendered font-sizes on elements that actually show text.
    const sizes = new Set();
    for (const el of els) {
      const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (ownText) sizes.add(Math.round(parseFloat(getComputedStyle(el).fontSize)));
    }

    // MOVING THINGS: running animations + transitions, plus anything with a non-none animation
    // name that is not paused. Infinite ones are called out separately — those are the ones that
    // never stop being a distraction.
    const running = document.getAnimations().filter((a) => a.playState === 'running');
    const infinite = running.filter((a) => {
      try { return a.effect.getComputedTiming().iterations === Infinity; } catch { return false; }
    });

    return {
      elements: paints.length,
      hotColours: hot.size,
      typeSizes: sizes.size,
      moving: running.length,
      infinite: infinite.length,
      sizeList: [...sizes].sort((a, b) => a - b),
    };
  });
}

for (const vp of SHOT_VIEWPORTS) {
  test.describe(`@ ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });
    for (const screen of SCREENS) {
      test(`${screen.name}`, async ({ page }) => {
        test.setTimeout(60000);
        await screen.nav(page);
        await page.waitForTimeout(350);
        const c = await census(page);
        await page.screenshot({ path: `${OUT}/${screen.name}-${vp.name}.png` });
        // eslint-disable-next-line no-console
        console.log(
          `CENSUS | ${vp.name.padEnd(9)} | ${screen.name.padEnd(24)} | `
          + `el ${String(c.elements).padStart(3)} | hot ${c.hotColours} | type ${c.typeSizes} | `
          + `moving ${c.moving} (inf ${c.infinite}) | sizes ${c.sizeList.join(',')}`,
        );
      });
    }
  });
}
