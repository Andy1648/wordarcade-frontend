// e2e/fuse-craft.spec.js — THE GATE for FUSE's three pieces of craft, at four viewports and
// four states. Andy's spec, verbatim: "FUSE (fragment slab + burning cord, matched fragment
// highlighted inside the accepted word)".
//
//   1. THE SLAB     the fragment is a hero element with a real frame, not a caption. Before
//                   this it was bare Bungee text under a clock ring.
//   2. THE CORD     the timer is a rope on a charge, eaten by an ember that crawls toward it.
//                   Real SVG art, burnt with stroke-dashoffset off the clock. Before this it
//                   was the shared ring, identical to CHAIN's in a different colour.
//   3. THE MATCH    an accepted word carries the fragment it matched, picked out of it. Before
//                   this the word appeared for 1.5s as a rarity chip and left no trace.
//
// PLUS the three per-screen constraints: exactly ONE accent element, no page scroll, and no
// overlap over 4px between any two visible elements — at 1366x768, 1280x720, 390x844, 320x640.
//
// TWO THINGS THIS FILE IS CAREFUL ABOUT, both of which have bitten this repo:
//   * A SELECTOR THAT MATCHES NOTHING PASSES SILENTLY. Every box the overlap check names is
//     asserted to have MATCHED first (`missing` must be empty), so a renamed class fails loudly
//     instead of quietly reducing the check to nothing.
//   * getBoundingClientRect ON AN ANCESTOR DOES NOT COVER AN OUT-OF-FLOW DESCENDANT. The rarity
//     reaction is absolutely positioned out of `.solo-inputwrap`, and its stamp is absolutely
//     positioned out of the chip — so `.solo-react .wl`, `.wl-chip` and `.wl-stamp` are each
//     named DIRECTLY. (That is what caught the stamp printing 23px into the slab at 320x640.)
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { installBackendMock } from './support/backendMock.js';

const SHOTS = 'claude/fuse-craft-shots';
fs.mkdirSync(SHOTS, { recursive: true });

const VIEWPORTS = [
  { name: '1366x768', width: 1366, height: 768 },
  { name: '1280x720', width: 1280, height: 720 },
  { name: '390x844', width: 390, height: 844 },
  { name: '320x640', width: 320, height: 640 },
];

// FUSE's accent, from FuseGame.jsx ACCENT. It is spent on the FRAGMENT and on nothing else.
const ACCENT_RGB = 'rgb(255, 107, 61)';
// The three places the fragment is allowed to appear: its slab, its glyph, and the same
// letters found again inside a word you defused. All one object.
const ACCENT_OK = '.fs-slab, .fs-frag, .fd-frag';

// Boxes that must exist on every FUSE play screen at every viewport.
const MUST = [
  '.solo-exit',
  '.solo-hud .solo-stat',
  '.solo-lives.fuse-lives',
  '.fcord-bar',
  '.fcord-secs',
  '.fs-slab',
  '.fs-frag',
  '.solo-inputwrap',
  '.solo-input',
  '.solo-deck',
  '.fuse-trail',
  '.solo-strip-big',
  '.solo-deck-hint',
];
// Scanned for overlap when present, not required (the wins pill and the DEFUSED label are
// dropped at the smallest sizes; the reaction only exists for ~1.5s after a word lands).
const OPTIONAL = [
  '.wins-hud',
  '.solo-deck-label',
  '.solo-react .wl',
  '.solo-react .wl-chip',
  '.solo-react .wl-stamp',
  '.solo-react .wl-wins',
  '.fd-chip',
  '.fd-frag',
  '.fd-rest',
];

const accept = fs.readFileSync('src/solo/words.accept.txt', 'utf8').split(/\s+/);

async function enterFuse(page, extraQuery = '') {
  await installBackendMock(page);
  await page.addInitScript(() => {
    try {
      localStorage.setItem('taw.fuse.runs', '5');
      localStorage.setItem('taw.seenMenuSpotlight', '1');
      localStorage.setItem('taw.seenGameSpotlight', '1');
      localStorage.setItem('taw.xp', JSON.stringify({ lv: 40, into: 0 }));
    } catch { /* storage blocked */ }
  });
  await page.goto(`/?fuse=1&portal=1&rarityempty=1${extraQuery}`);
  await page.locator('.solo-input').waitFor({ state: 'visible', timeout: 25000 });
  await page.locator('.fs-frag').waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForTimeout(250);
}

/** Geometry + paint readout for the live FUSE screen. */
async function survey(page, must, optional, accentRgb, accentOk) {
  return page.evaluate(({ must, optional, accentRgb, accentOk }) => {
    const root = document.querySelector('.solo-root');
    const de = document.documentElement;
    const vis = (el) => {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity || '1') < 0.05) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0.5 && r.height > 0.5;
    };
    const boxes = [];
    const missing = [];
    for (const sel of must.concat(optional)) {
      const nodes = [...document.querySelectorAll(sel)].filter(vis);
      if (!nodes.length) {
        if (must.includes(sel)) missing.push(sel);
        continue;
      }
      nodes.forEach((n, i) => boxes.push({ sel: sel + (nodes.length > 1 ? `[${i}]` : ''), el: n, r: n.getBoundingClientRect() }));
    }

    // --- overlap, over every pair of named boxes that are not nested in one another ---
    const overlaps = [];
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const A = boxes[i];
        const B = boxes[j];
        if (A.el.contains(B.el) || B.el.contains(A.el)) continue;
        // the shared rarity transient composes its own stamp and payout ONTO its own chip by
        // design; that is one component's internal layout, not two elements colliding.
        const wa = A.el.closest('.wl');
        if (wa && wa === B.el.closest('.wl')) continue;
        const ox = Math.min(A.r.right, B.r.right) - Math.max(A.r.left, B.r.left);
        const oy = Math.min(A.r.bottom, B.r.bottom) - Math.max(A.r.top, B.r.top);
        if (ox > 4 && oy > 4) overlaps.push(`${A.sel} x ${B.sel} = ${Math.round(Math.min(ox, oy))}px`);
      }
    }

    // --- the accent, wherever it is painted ---
    const okSet = new Set(document.querySelectorAll(accentOk));
    const accentUsers = [];
    for (const el of root.querySelectorAll('*')) {
      if (!vis(el)) continue;
      // The shared app chrome is not FUSE's to spend: the wins pill is the same yellow in
      // every mode, and the rarity ladder owns its own tier colours app-wide (`.wl--rare`
      // is literally #FF6B3D). Both are shared components, and both are excluded here so
      // this assertion is about the FUSE screen's OWN paint.
      if (el.closest('.wins-hud, .wl')) continue;
      const cs = getComputedStyle(el);
      const hit = [cs.color, cs.backgroundColor, cs.borderTopColor, cs.borderBottomColor, cs.fill, cs.stroke]
        .some((v, k) => v === accentRgb && (k !== 2 || parseFloat(cs.borderTopWidth) > 0) && (k !== 3 || parseFloat(cs.borderBottomWidth) > 0));
      if (!hit) continue;
      if (okSet.has(el)) continue;
      accentUsers.push(el.tagName.toLowerCase() + '.' + ((typeof el.className === 'string' ? el.className : el.getAttribute('class')) || '').trim().split(/\s+/).join('.'));
    }

    // --- the loudest thing on the screen ---
    // Measured on COMPUTED FONT-SIZE, not on the bounding box. The box was tried first and is
    // wrong twice over: a tilted chip's rect is inflated by its own rotation (the rarity chip
    // sits at -4deg and measured 52px against a 42px fragment while being visibly smaller),
    // and a chip caught mid-entrance is inflated again by its scale keyframe.
    // Font-size is only honest for DOM text — inside an SVG it is viewBox units, not px — so
    // `svgText` below asserts this screen has no SVG text at all. FUSE draws its seconds as a
    // DOM node over the charge precisely so that stays true.
    const textBoxes = [];
    for (const el of root.querySelectorAll('*')) {
      if (!vis(el)) continue;
      if (el.closest('.wins-hud')) continue;
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (!own) continue;
      const cls = typeof el.className === 'string' ? el.className : el.getAttribute('class') || '';
      textBoxes.push({ sel: cls ? '.' + cls.trim().split(/\s+/).join('.') : el.tagName, h: Math.round(parseFloat(getComputedStyle(el).fontSize)) });
    }
    textBoxes.sort((a, b) => b.h - a.h);
    const svgText = root.querySelectorAll('svg text, svg tspan').length;

    const frag = document.querySelector('.fs-frag');
    const slab = document.querySelector('.fs-slab');
    const scs = slab ? getComputedStyle(slab) : null;
    const rope = document.querySelector('.fcord-rope');
    const ember = document.querySelector('.fcord-ember');

    return {
      missing,
      overlaps,
      accentUsers,
      loudest: textBoxes.slice(0, 4),
      svgText,
      fragBox: frag ? Math.round(frag.getBoundingClientRect().height) : 0,
      fragText: frag ? frag.textContent.trim() : '',
      slabWidth: slab ? Math.round(slab.getBoundingClientRect().width) : 0,
      slabBorder: scs ? parseFloat(scs.borderTopWidth) : 0,
      slabBorderColor: scs ? scs.borderTopColor : '',
      dashoffset: rope ? parseFloat(getComputedStyle(rope).strokeDashoffset) : NaN,
      emberX: ember ? parseFloat((ember.getAttribute('transform') || '').replace(/[^-\d. ]/g, '').trim().split(/\s+/)[0]) : NaN,
      isRed: !!document.querySelector('.fcord-bar.is-red'),
      vScroll: Math.max(de.scrollHeight, document.body.scrollHeight) - de.clientHeight,
      hScroll: Math.max(de.scrollWidth, document.body.scrollWidth) - de.clientWidth,
    };
  }, { must, optional, accentRgb, accentOk });
}

function assertScreen(s, where) {
  expect(s.missing, `${where}: a gated selector matched NOTHING (renamed? moved?)`).toEqual([]);
  expect(s.overlaps, `${where}: elements overlap by more than 4px`).toEqual([]);
  expect(s.vScroll, `${where}: the page scrolls vertically`).toBeLessThanOrEqual(1);
  expect(s.hScroll, `${where}: the page scrolls horizontally`).toBeLessThanOrEqual(1);
  // ONE ACCENT. Everything painting FUSE's orange is the fragment, its slab, or the same
  // letters found inside a defused word.
  expect(s.accentUsers, `${where}: something other than the fragment took FUSE's accent`).toEqual([]);
  // ...and the fragment is the loudest thing on the screen. (No SVG text anywhere, so a
  // computed font-size on this screen is a real pixel size and not viewBox units.)
  expect(s.svgText, `${where}: SVG text on the screen makes the size comparison a lie`).toBe(0);
  expect(s.loudest[0].sel, `${where}: the loudest text is ${JSON.stringify(s.loudest)}`).toContain('fs-frag');
  expect(s.loudest[0].h, `${where}: the fragment is not clearly the loudest — ${JSON.stringify(s.loudest)}`)
    .toBeGreaterThan(s.loudest[1].h * 1.4);
}

for (const vp of VIEWPORTS) {
  test(`FUSE craft @ ${vp.name}: slab, cord, match, one accent, no scroll, no overlap`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: vp.width, height: vp.height });
    // A LONG fuse for the idle / mid / accepted states. A short one was tried first and is
    // flaky under parallel workers: the sampling itself costs a few hundred ms, so a 6s fuse
    // could expire between two samples and re-serve a FULL cord, which reads as "the cord
    // stopped burning". The red zone gets its own short-fuse page load at the end.
    await enterFuse(page, '&soloms=20000');

    // ---------- STATE 1: IDLE (clock not armed, cord full) ----------
    await page.screenshot({ path: `${SHOTS}/idle-${vp.name}.png` });
    let s = await survey(page, MUST, OPTIONAL, ACCENT_RGB, ACCENT_OK);
    assertScreen(s, `${vp.name} idle`);
    expect(s.dashoffset, `${vp.name} idle: the cord should be whole before the clock arms`).toBeLessThan(1);
    expect(s.isRed, `${vp.name} idle: the cord is already in the red zone`).toBe(false);
    // THE SLAB IS A HERO ELEMENT, not a caption: a real frame, a real width, real type.
    expect(s.slabBorder, `${vp.name}: the slab has no frame`).toBeGreaterThanOrEqual(4);
    expect(s.slabBorderColor, `${vp.name}: the slab frame is not the accent`).toBe(ACCENT_RGB);
    expect(s.slabWidth, `${vp.name}: the slab is too small to be the hero`).toBeGreaterThanOrEqual(140);
    expect(s.fragBox, `${vp.name}: the fragment renders too small to be the hero`).toBeGreaterThanOrEqual(30);
    const fragment = s.fragText;

    // ---------- STATE 2: MID-CORD (armed, ~halfway) ----------
    await page.locator('.solo-input').press('a'); // arms the clock without submitting
    await page.waitForTimeout(5500);
    // SHOOT FIRST. `survey` walks the whole tree twice and costs a couple of seconds, and a
    // shot taken after it is a shot of a LATER cord — the first "mid-cord" frames were of a
    // cord at 10%, captioned mid.
    await page.screenshot({ path: `${SHOTS}/mid-cord-${vp.name}.png` });
    const mid = await survey(page, MUST, OPTIONAL, ACCENT_RGB, ACCENT_OK);
    assertScreen(mid, `${vp.name} mid-cord`);
    expect(mid.dashoffset, `${vp.name}: the cord has not burnt back`).toBeGreaterThan(20);
    expect(mid.dashoffset, `${vp.name}: the cord burnt too far to be a mid-burn`).toBeLessThan(90);

    // THE CORD BURNS: the rope must keep losing itself, and the ember must travel TOWARD the
    // charge (x decreasing) — not sit at the tip while only the stroke changes.
    await page.waitForTimeout(1400);
    const later = await page.evaluate(() => ({
      dashoffset: parseFloat(getComputedStyle(document.querySelector('.fcord-rope')).strokeDashoffset),
      emberX: parseFloat((document.querySelector('.fcord-ember').getAttribute('transform') || '').replace(/[^-\d. ]/g, '').trim().split(/\s+/)[0]),
    }));
    expect(later.dashoffset, `${vp.name}: the cord stopped burning`).toBeGreaterThan(mid.dashoffset + 3);
    expect(later.emberX, `${vp.name}: the ember does not ride the burn point`).toBeLessThan(mid.emberX - 2);

    // ---------- STATE 3: ACCEPTED, with the matched fragment picked out ----------
    await page.locator('.solo-input').fill('');
    const frag2 = (await page.locator('.fs-frag').innerText()).trim().toLowerCase();
    // PREFER a word where the fragment occurs TWICE. The highlight must land on the FIRST
    // occurrence — the one the engine's containment test passed on — and with a word that
    // contains the fragment once, that assertion cannot fail and so proves nothing. (It was
    // checked against `lastIndexOf` and stayed green until this line picked a doubled word.)
    const fits = (w) => w.length >= 6 && w.includes(frag2);
    const word = accept.find((w) => fits(w) && w.indexOf(frag2) !== w.lastIndexOf(frag2)) || accept.find(fits);
    expect(word, `no accepted word contains the fragment ${frag2}`).toBeTruthy();
    await page.locator('.solo-input').fill(word);
    await page.locator('.solo-input').press('Enter');
    await page.locator('.fd-chip:not(.is-ghost)').first().waitFor({ state: 'visible', timeout: 15000 });
    await page.waitForTimeout(250);

    await page.screenshot({ path: `${SHOTS}/accepted-${vp.name}.png` });
    const acc = await survey(page, MUST.concat(['.fd-chip', '.fd-frag']), OPTIONAL, ACCENT_RGB, ACCENT_OK);
    assertScreen(acc, `${vp.name} accepted`);

    // THE MATCH IS PICKED OUT. The chip carries the whole word; the fragment's letters inside
    // it are the ones on an accent plate, and they are the FIRST occurrence — the one the
    // engine's containment test passed on.
    const chip = page.locator('.fd-chip:not(.is-ghost)').first();
    await expect(chip, `${vp.name}: the defused chip is not the word that was accepted`).toHaveText(
      new RegExp(`^${word.toUpperCase()}$`)
    );
    const picked = await page.evaluate(() => {
      const c = document.querySelector('.fd-chip:not(.is-ghost)');
      const f = c.querySelector('.fd-frag');
      const r = c.querySelector('.fd-rest');
      if (!f) return { err: 'no .fd-frag inside the chip' };
      const fs = getComputedStyle(f);
      // WHERE IN THE WORD the plate actually sits — the text BEFORE it in the DOM, not
      // `indexOf` on the chip's text (which finds the first match of those letters wherever
      // the plate happens to be, and so passes even when the plate is on the wrong one).
      let before = 0;
      for (const n of c.childNodes) {
        if (n === f) break;
        before += (n.textContent || '').length;
      }
      return {
        text: f.textContent,
        offset: before,
        bg: fs.backgroundColor,
        color: fs.color,
        restColor: r ? getComputedStyle(r).color : null,
      };
    });
    expect(picked.err, `${vp.name}: ${picked.err}`).toBeUndefined();
    expect(picked.text, `${vp.name}: the picked-out letters are not the fragment`).toBe(frag2.toUpperCase());
    expect(picked.offset, `${vp.name}: the highlight is not on the first occurrence`).toBe(
      word.toUpperCase().indexOf(frag2.toUpperCase())
    );
    // It has to READ, not merely be marked up: an accent plate, and letters a different
    // colour from the rest of the word.
    expect(picked.bg, `${vp.name}: the matched letters have no accent plate`).toBe(ACCENT_RGB);
    expect(picked.color, `${vp.name}: the matched letters are the same ink as the rest`).not.toBe(picked.restColor);

    // ---------- STATE 4: NEAR BURNOUT ----------
    // Its own load on a 6s fuse: the red zone (the last 1.6s of every fuse) comes round every
    // six seconds and there are two lives, so the poll below has two windows to catch instead
    // of one 1.6s window at the end of a 20s wait. A 2.6s fuse was tried and is a trap — the
    // whole RUN is over in 5.2s, so under parallel load the screen can be gone before the
    // first poll and the wait can then never succeed.
    await enterFuse(page, '&soloms=6000');
    await page.locator('.solo-input').press('a');
    await expect(page.locator('.fcord-bar.is-red'), `${vp.name}: burnout does not read`).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: `${SHOTS}/near-burnout-${vp.name}.png` });
    const red = await survey(page, MUST, OPTIONAL, ACCENT_RGB, ACCENT_OK);
    assertScreen(red, `${vp.name} near-burnout`);

    // eslint-disable-next-line no-console
    console.log(`FUSE-CRAFT | ${vp.name} | frag "${fragment}" -> "${word}" | loudest ${acc.loudest[0].sel} ${acc.loudest[0].h}px | slab ${acc.slabWidth}px`);
  });
}
