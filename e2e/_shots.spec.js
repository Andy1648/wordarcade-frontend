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

    // TYPE SIZES, SPLIT INTO UI AND DECORATION — because the raw number is not actionable.
    // The menu reports ~21 distinct sizes, but most of them are the wall-scene graffiti: SVG
    // <text> at a dozen inline sizes, sitting at 0.12-0.28 opacity behind everything. That is
    // texture, and collapsing it onto the type scale would change nothing a player reads.
    // The number worth acting on is the sizes the UI itself uses, so count those separately:
    // anything inside an aria-hidden subtree is decoration.
    const decorative = (el) => !!el.closest('[aria-hidden="true"]');
    const uiSizes = new Set();
    const decoSizes = new Set();
    for (const el of els) {
      const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (!ownText) continue;
      const px = Math.round(parseFloat(getComputedStyle(el).fontSize));
      (decorative(el) ? decoSizes : uiSizes).add(px);
    }
    const sizes = uiSizes;

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
      decoTypeSizes: decoSizes.size,
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
        // STEADY STATE BY DEFAULT, FIRST-RUN ON REQUEST.
        // Without this every frame is the ONBOARDING state: the first-run Spotlight dims the
        // whole page, rings one element and floats a caption over the wordmark. That is a real
        // screen, but it is not the screen a player spends their time in — and photographing the
        // app through a 60% scrim makes every other judgement in this pass worthless.
        // (It is also how the layout gate has always run: bootMenu never seeds these keys, so
        // all 840 viewport-integrity cells measure the dimmed first-run state and the steady
        // state has never been gated. Noted in claude/RUN-N.md.)
        if (!process.env.SHOTS_FIRSTRUN) {
          await page.addInitScript(() => {
            try {
              localStorage.setItem('taw.seenMenuSpotlight', '1');
              localStorage.setItem('taw.seenGameSpotlight', '1');
            } catch { /* storage blocked — the frame just shows onboarding */ }
          });
        }
        await screen.nav(page);
        // WAIT OUT THE 3-2-1-GO COUNTDOWN on the in-game screens. It dims the whole stage while
        // it runs, so a frame taken at nav+350ms photographs the app through a scrim and every
        // colour/contrast judgement made from it is wrong. Wait for the overlay to leave rather
        // than guessing a duration.
        const cd = page.locator('.countdown-overlay, [class*="countdown-overlay"]').first();
        if (await cd.count()) {
          await cd.waitFor({ state: 'detached', timeout: 12000 }).catch(() => {});
        }
        await page.waitForTimeout(350);
        const c = await census(page);
        await page.screenshot({ path: `${OUT}/${screen.name}-${vp.name}.png` });
        // eslint-disable-next-line no-console
        console.log(
          `CENSUS | ${vp.name.padEnd(9)} | ${screen.name.padEnd(24)} | `
          + `el ${String(c.elements).padStart(3)} | hot ${c.hotColours} | type ${c.typeSizes} | `
          + `moving ${c.moving} (inf ${c.infinite}) | ui-sizes ${c.sizeList.join(',')} `
          + `| deco-sizes ${c.decoTypeSizes}`,
        );
      });
    }
  });
}
