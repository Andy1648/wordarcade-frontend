// e2e/run-craft.spec.js — THE RUN's craft gate.
//
// Three deliverables, gated per screen (draft / play / run-over) at four viewports:
//   1. THE WALL is ONE dominant vertical bar with a huge numeral that counts up in ticks.
//   2. A draft card RAISES with a ±3° lean and SLAMS on pick.
//   3. The modifier strip sits at mid value and only the FIRING chip is lit.
// plus the three per-screen constraints Andy set: exactly ONE accent element, no page
// scroll, and no overlap greater than 4px between any two visible content boxes.
//
// SELECTORS THAT MATCH NOTHING PASS SILENTLY, so every locator this file relies on is
// counted before it is measured (see assertPresent) — a renamed class fails loudly here
// instead of quietly gating nothing.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

const SHOTS = 'claude/run-craft-shots';
const OVERLAP_MAX = 4;

const VIEWPORTS = [
  { name: '1366x768', width: 1366, height: 768, wide: true },
  { name: '1280x720', width: 1280, height: 720, wide: true },
  { name: '390x844', width: 390, height: 844, wide: false },
  { name: '320x640', width: 320, height: 640, wide: false },
];

// Every content box THE RUN can put on screen, plus the two pieces of fixed app chrome it
// shares the viewport with. Ancestor/descendant pairs are skipped by the checker, so a
// container and its own children never count as an overlap — only true collisions do.
const ATOMS = [
  '.run-exit', '.audio-ctrl',
  '.run-wallcol', '.run-wall-head', '.run-wall-num', '.run-wall-bar',
  '.run-wall-foot', '.run-wall-target', '.run-wall-round',
  '.run-rail', '.run-kicker', '.run-title', '.run-plate', '.run-plate-inline',
  '.run-plate-name', '.run-plate-rule', '.run-clock', '.run-readout', '.run-cue',
  '.run-verdict', '.run-input-wrap', '.run-btn', '.run-strip', '.run-strip-empty',
  '.run-chip', '.run-card', '.run-card-art', '.run-card-name', '.run-fx-up', '.run-fx-down',
].join(',');

async function seed(page) {
  await page.addInitScript(() => {
    try { localStorage.setItem('taw.xp', JSON.stringify({ lv: 31, into: 0 })); } catch { /* ignore */ }
  });
}

async function enterRun(page, query = '') {
  await page.goto(`/?portal=1${query}`);
  await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
  await page.locator('.game-card-magnet[data-game="run"] .game-card').click({ force: true });
  // NB: wait for the PRE-ROUND stage, not `.run-stage` — the loading phase also renders a
  // `.run-stage`, and every wall assertion below would run against a screen with no wall.
  await expect(page.locator('.run-stage-wall')).toBeVisible({ timeout: 20000 });
}

// A locator that matches nothing is the single most common silent-pass bug in this suite.
async function assertPresent(page, selector, atLeast = 1) {
  const n = await page.locator(selector).count();
  expect(n, `selector "${selector}" matched ${n} elements — expected >= ${atLeast}`).toBeGreaterThanOrEqual(atLeast);
  return n;
}

// ---- the three per-screen constraints, measured in the page ----
async function measure(page, atoms) {
  // PARK THE POINTER FIRST. Playwright keeps the mouse where the last click left it, so
  // after the phase swaps a card can be sitting under the cursor — every "at rest" box is
  // then measured on a RAISED card. (That is how the first run of this gate reported 32px
  // card-on-card overlaps at 1366: real geometry, wrong state.)
  await page.mouse.move(2, 2);
  // ...and then WAIT FOR THE UNHOVER TRANSITION TO FINISH. A fixed sleep is not enough: on a
  // busy frame (three card SVGs mounting) the hover recalc lands late and the very next
  // getComputedStyle still reads the raised 1.3x matrix, so "at rest" is measured on a
  // raised card. Settle on the animation list instead of the clock.
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'),
    null, { timeout: 4000, polling: 16 }).catch(() => {});
  await page.waitForTimeout(120);
  return page.evaluate((sel) => {
    const root = document.querySelector('.run-root');
    const vis = (el) => {
      const s = getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity) < 0.05) return false;
      const r = el.getBoundingClientRect();
      return r.width > 1 && r.height > 1;
    };

    // (1) exactly ONE accent-filled element. Illustration inside an <svg> is art, not chrome.
    const accents = [];
    // Scoped to the STAGE + the fixed chrome it shares the screen with. PlayBackdrop (the
    // shared house graffiti wall, aria-hidden, behind every mode's play screen) is art, not
    // RUN chrome, and is not part of this mode's accent budget.
    for (const el of document.querySelectorAll('.run-stage *, .run-exit, .audio-ctrl *')) {
      if (el.closest('svg')) continue;
      if (!vis(el)) continue;
      const s = getComputedStyle(el);
      if (s.backgroundColor === 'rgb(154, 26, 255)' || s.color === 'rgb(154, 26, 255)') {
        accents.push(el.className && el.className.baseVal !== undefined ? el.className.baseVal : String(el.className));
      }
    }

    // (2) no scroll — neither the page nor THE RUN's own fixed root.
    const scroll = {
      docW: document.documentElement.scrollWidth,
      docH: document.documentElement.scrollHeight,
      winW: window.innerWidth,
      winH: window.innerHeight,
      rootScrollH: root ? root.scrollHeight : 0,
      rootClientH: root ? root.clientHeight : 0,
      rootScrollW: root ? root.scrollWidth : 0,
      rootClientW: root ? root.clientWidth : 0,
    };

    // (3) no overlap > 4px between any two content boxes that are not nested.
    const nodes = [...document.querySelectorAll(sel)].filter(vis);
    const boxes = nodes.map((el) => ({
      el,
      name: (el.getAttribute('class') || el.tagName).split(' ').slice(0, 2).join('.'),
      r: el.getBoundingClientRect(),
    }));
    const overlaps = [];
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        const a = boxes[i]; const b = boxes[j];
        if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
        const ox = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
        const oy = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
        if (ox > 4 && oy > 4) overlaps.push({ a: a.name, b: b.name, ox: Math.round(ox), oy: Math.round(oy) });
      }
    }

    // (4) THE WALL: one bar, taller than wide, the tallest single box on the screen.
    const bars = document.querySelectorAll('.run-wall-bar');
    const bar = bars[0] ? bars[0].getBoundingClientRect() : null;
    // ...against every box that is not one of its OWN ancestors (.run-wallcol wraps it).
    const tallest = boxes.reduce((m, b) => (bars[0] && b.el.contains(bars[0]) ? m : Math.max(m, b.r.height)), 0);
    const num = document.querySelector('.run-wall-num');
    const numBox = num ? num.getBoundingClientRect() : null;
    const numSize = num ? parseFloat(getComputedStyle(num).fontSize) : 0;
    // the biggest type anywhere else on the screen — the numeral must beat it
    // SVG font-size is in VIEWBOX UNITS, not CSS px — the card art's "fontSize 34" letter
    // tiles render at ~22 real pixels inside a 78px slot. Comparing them to a CSS px size is
    // meaningless, so illustration text is excluded (it made this gate fail on a numeral
    // that was in fact the largest thing on the screen).
    let otherType = 0;
    for (const el of document.querySelectorAll('.run-panel *')) {
      if (el.closest('svg')) continue;
      if (!vis(el) || !el.textContent.trim()) continue;
      otherType = Math.max(otherType, parseFloat(getComputedStyle(el).fontSize) || 0);
    }

    return {
      accents, scroll, overlaps,
      wall: bar ? { count: bars.length, w: Math.round(bar.width), h: Math.round(bar.height), tallest: Math.round(tallest) } : null,
      numeral: numBox ? { text: num.textContent, size: Math.round(numSize), w: Math.round(numBox.width), otherType: Math.round(otherType) } : null,
      hovered: [...document.querySelectorAll(':hover')].map((e) => e.getAttribute('class') || e.tagName).slice(-3),
      active: (document.activeElement && (document.activeElement.getAttribute('class') || document.activeElement.tagName)) || 'none',
      fv: [...document.querySelectorAll('.run-card')].map((e) => e.matches(':focus-visible')),
      cardPoses: [...document.querySelectorAll('.run-card')].map((e) => getComputedStyle(e).transform),
      lit: document.querySelectorAll('.run-chip.lit').length,
      chips: document.querySelectorAll('.run-chip').length,
    };
  }, atoms);
}

function assertScreen(m, label, opts = {}) {
  expect(m.accents, `${label}: expected EXACTLY ONE accent element, got ${JSON.stringify(m.accents)}`).toHaveLength(1);
  expect(m.overlaps, `${label}: overlaps > ${OVERLAP_MAX}px: ${JSON.stringify(m.overlaps)} hovered=${JSON.stringify(m.hovered)} active=${m.active} focusVisible=${JSON.stringify(m.fv)} poses=${JSON.stringify(m.cardPoses)}`).toEqual([]);
  expect(m.scroll.docW, `${label}: horizontal page scroll`).toBeLessThanOrEqual(m.scroll.winW + 1);
  expect(m.scroll.docH, `${label}: vertical page scroll`).toBeLessThanOrEqual(m.scroll.winH + 1);
  expect(m.scroll.rootScrollH, `${label}: THE RUN's own root scrolls vertically`).toBeLessThanOrEqual(m.scroll.rootClientH + 1);
  expect(m.scroll.rootScrollW, `${label}: THE RUN's own root scrolls horizontally`).toBeLessThanOrEqual(m.scroll.rootClientW + 1);
  // ONE dominant VERTICAL bar — not a cluster of meters.
  expect(m.wall, `${label}: no .run-wall-bar`).not.toBeNull();
  expect(m.wall.count, `${label}: more than one wall bar`).toBe(1);
  expect(m.wall.h, `${label}: the wall must be taller than it is wide (${m.wall.w}x${m.wall.h})`).toBeGreaterThan(m.wall.w * 1.6);
  expect(m.wall.h, `${label}: the wall must be the tallest box on the screen`).toBeGreaterThanOrEqual(m.wall.tallest - 2);
  // A HUGE numeral: bigger than any other type on the screen.
  expect(m.numeral, `${label}: no .run-wall-num`).not.toBeNull();
  expect(m.numeral.size, `${label}: numeral ${m.numeral.size}px is not bigger than the panel's ${m.numeral.otherType}px type`)
    .toBeGreaterThan(m.numeral.otherType);
  if (opts.chips) {
    expect(m.chips, `${label}: expected a populated modifier strip`).toBeGreaterThanOrEqual(opts.chips);
    expect(m.lit, `${label}: at most ONE modifier may be lit at a time, ${m.lit} were`).toBeLessThanOrEqual(1);
  }
}

// scale + rotation out of a computed transform matrix
async function poseOf(locator) {
  return locator.evaluate((el) => {
    const t = getComputedStyle(el).transform;
    if (!t || t === 'none') return { scale: 1, deg: 0 };
    const n = t.slice(t.indexOf('(') + 1, -1).split(',').map(Number);
    const [a, b] = n;
    return { scale: Math.hypot(a, b), deg: (Math.atan2(b, a) * 180) / Math.PI };
  });
}

for (const vp of VIEWPORTS) {
  test.describe(`the run — craft @ ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, reducedMotion: 'no-preference' });
    test.beforeEach(async ({ page }) => { await installBackendMock(page); await seed(page); });

    test('pre-round + play: the wall dominates, counts up, and only the firing mod is lit', async ({ page }) => {
      // DOUBLE VOWELS is word-level (it fires per word); DEEP POCKETS is round-level
      // (it never fires per word) — so the strip has something to light and something
      // that must stay dark.
      await enterRun(page, '&seed=3&rs=40&stack=double-vowels,deep-pockets');
      await assertPresent(page, '.run-wall-bar');
      await assertPresent(page, '.run-wall-num');
      await assertPresent(page, '.run-chip', 2);

      // The numeral lands on the wall target.
      const num = page.locator('.run-wall-num');
      await expect(num).toHaveText('225', { timeout: 4000 });

      assertScreen(await measure(page, ATOMS), `${vp.name} pre-round`, { chips: 2 });
      await page.screenshot({ path: `${SHOTS}/${vp.name}-1-preround.png` });

      // ---- PLAY ----
      await page.locator('.run-btn').click();
      await expect(page.locator('.run-stage-round')).toBeVisible();
      await page.waitForTimeout(300);
      assertScreen(await measure(page, ATOMS), `${vp.name} play (early)`, { chips: 2 });
      await page.screenshot({ path: `${SHOTS}/${vp.name}-2-play-early.png` });

      // THE COUNT-UP, sampled through a MutationObserver installed BEFORE the word lands:
      // accepting a word must walk the numeral up in discrete steps, not snap to the total.
      // A 3-vowel word also makes DOUBLE VOWELS fire, while round-level DEEP POCKETS must not.
      const input = page.locator('.run-input');
      await input.fill('orange');
      await page.evaluate(() => {
        window.__runNum = [];
        const el = document.querySelector('.run-wall-num');
        window.__runObs = new MutationObserver(() => window.__runNum.push(el.textContent));
        window.__runObs.observe(el, { characterData: true, childList: true, subtree: true });
      });
      await input.press('Enter');
      await page.waitForTimeout(900);
      const steps = await page.evaluate(() => {
        window.__runObs.disconnect();
        return [...new Set(window.__runNum)];
      });
      expect(steps.length, `the numeral must TICK up, not snap — saw ${JSON.stringify(steps)}`).toBeGreaterThanOrEqual(3);
      expect(Number(steps[steps.length - 1].replace(/,/g, '')), 'the numeral must end above 0').toBeGreaterThan(0);
      await expect(page.locator('.run-chip.lit')).toHaveCount(1);
      await expect(page.locator('.run-chip.lit')).toHaveText('DOUBLE VOWELS');
      const mFire = await measure(page, ATOMS);
      assertScreen(mFire, `${vp.name} play (modifier firing)`, { chips: 2 });
      await page.screenshot({ path: `${SHOTS}/${vp.name}-3-mod-firing.png` });

      // ---- the wall near its target ----
      for (const w of ['eagle', 'equine', 'eerie', 'eyelid', 'douse', 'euphoria', 'aurea', 'audio']) {
        await input.fill(w); await input.press('Enter');
      }
      await page.waitForTimeout(500);
      const fill = await page.locator('.run-wall-fill').evaluate((el) => {
        const t = getComputedStyle(el).transform;
        if (t === 'none') return 0;
        return Number(t.slice(t.indexOf('(') + 1, -1).split(',')[3]);
      });
      expect(fill, 'the wall fill must have climbed off the floor').toBeGreaterThan(0.05);
      assertScreen(await measure(page, ATOMS), `${vp.name} play (wall climbing)`, { chips: 2 });
      await page.screenshot({ path: `${SHOTS}/${vp.name}-4-wall-climbing.png` });
    });

    test('draft: a card raises with a lean and slams on pick', async ({ page }) => {
      // (p + 150) * 1.5 >= 225 for any p, so the draft is reached deterministically.
      await enterRun(page, '&seed=3&rs=3&stack=deep-pockets,short-fuse');
      await page.locator('.run-btn').click();
      await expect(page.locator('.run-stage-draft')).toBeVisible({ timeout: 12000 });
      await assertPresent(page, '.run-card', 3);
      await expect(page.locator('.run-card')).toHaveCount(3);

      await page.waitForTimeout(250);
      assertScreen(await measure(page, ATOMS), `${vp.name} draft (at rest)`, { chips: 2 });
      await page.screenshot({ path: `${SHOTS}/${vp.name}-5-draft.png` });

      // THE RAISE. 1.3x on a pointer at desktop width; clamped where a 30% lift has
      // nowhere to go (documented in RunMode.css), but the ±3° lean is unconditional.
      const card = page.locator('.run-card').nth(1);
      const rest = await poseOf(card);
      expect(Math.abs(rest.scale - 1), 'a card must sit flat at rest').toBeLessThan(0.02);
      await card.hover();
      await page.waitForTimeout(260);
      const raised = await poseOf(card);
      if (vp.wide) {
        expect(raised.scale, `${vp.name}: the hovered card must raise to 1.3x`).toBeGreaterThanOrEqual(1.28);
        expect(Math.abs(raised.deg), `${vp.name}: the raise must lean ~3deg, got ${raised.deg}`).toBeGreaterThan(2.4);
        expect(Math.abs(raised.deg)).toBeLessThan(3.6);
      } else {
        // A full-bleed row card at 320-390 cannot grow 30% — the headroom between the wall
        // column and the right edge is 0px, measured. Phones have no hover to raise INTO
        // either, so the hover raise is off below 721px and the press lift carries the
        // affordance instead. Gated so it can never come back and silently overflow.
        expect(raised.scale, `${vp.name}: there must be no hover raise at phone width`).toBeLessThan(1.02);
        const bb = await card.boundingBox();
        await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
        await page.mouse.down();
        // settle on the transition, not the clock — under load the :active recalc can land
        // hundreds of ms late and a fixed sleep then reads the card mid-rise.
        await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'),
          null, { timeout: 4000, polling: 16 }).catch(() => {});
        await page.waitForTimeout(150);
        const pressed = await poseOf(card);
        expect(pressed.scale, `${vp.name}: the press lift must still read`).toBeGreaterThan(1.02);
        expect(Math.abs(pressed.deg), `${vp.name}: the press must lean ~3deg`).toBeGreaterThan(2.4);
        // release OFF the card: a down+up on it would count as a click and pick it, and the
        // slam assertion below would then be measuring an already-finished animation.
        await page.mouse.move(2, 2);
        await page.mouse.up();
        await page.waitForTimeout(260);
      }
      // whatever pose it took, the card must stay on screen
      const box = await card.boundingBox();
      expect(box.x, `${vp.name}: raised card off the left edge`).toBeGreaterThan(-1);
      expect(box.x + box.width, `${vp.name}: raised card off the right edge`).toBeLessThanOrEqual(vp.width + 1);
      await page.screenshot({ path: `${SHOTS}/${vp.name}-6-card-raised.png` });

      // THE SLAM. Watched from inside the page rather than sampled at a fixed delay: a
      // hover-raised card changes size mid-click, so Playwright's actionability retry can
      // eat most of the 430ms window and a fixed sleep catches an empty animation list.
      const clicking = card.click();
      await page.waitForFunction(
        () => [...document.getAnimations()].some((a) => (a.animationName || '') === 'run-slam'),
        null,
        { timeout: 3000, polling: 16 }
      );
      await page.screenshot({ path: `${SHOTS}/${vp.name}-7-card-slam.png` });
      await clicking;
    });

    test('run over: the wall is frozen where it stopped', async ({ page }) => {
      await enterRun(page, '&seed=3&rs=3');
      await page.locator('.run-btn').click();
      await expect(page.locator('.run-stage-over')).toBeVisible({ timeout: 12000 });
      await page.waitForTimeout(800);
      await assertPresent(page, '.run-stamp');
      assertScreen(await measure(page, ATOMS), `${vp.name} run-over`);
      await page.screenshot({ path: `${SHOTS}/${vp.name}-8-over.png` });
    });
  });
}
