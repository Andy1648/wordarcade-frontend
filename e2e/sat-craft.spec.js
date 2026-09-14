// e2e/sat-craft.spec.js — THE SAT RUSH CRAFT GATE.
//
// WHAT THIS EXISTS TO CATCH, and why each assertion is here rather than in
// viewport-integrity.spec.js (which walks every screen shallowly): this one walks
// SAT Rush's LIVE PLAY SCREEN — the actual bounty poster with its slots, mid-run,
// in BOTH run styles — and the results page, and holds them to the mode's own
// rules. The distinction matters: the previous SAT Rush scroll probe landed on the
// /sat-rush LANDING route (the cover), which never had the defect, so a real
// scrollbar on the question survived a green run.
//
// Every route this file drives is written into the test title, so which screen was
// probed can never be ambiguous again.
//
//   1. THE PROMPT NEVER SCROLLS. Not the page, and not one box inside the mode.
//      A timed reading mode cannot put a scrollbar on the thing you are timed to
//      read. Measured on the play screen at four viewports x two run styles.
//   2. FULL DUOTONE. Every rendered colour on the page is cream, the near-black
//      ink, or the one red — nothing else. This is a sample of COMPUTED style on
//      every visible node, not a grep of the stylesheet, so it catches the app's
//      own global chrome painting house neon on top of the mode (which is exactly
//      how the yellow WINS pill and the purple WPM pill got here).
//   3. EXACTLY ONE ACCENT ELEMENT. SAT Rush's accent is --redink (#C8321E). At
//      most one element on a screen may carry it, and on a state word (deep cut /
//      revenant) exactly one must.
//   4. NO OVERLAP > 4px between two visible elements that are not ancestors of
//      each other. Named children are tested directly, never via an ancestor's
//      box — getBoundingClientRect on a parent does not include an out-of-flow
//      child that overflows it.
//   5. ONE SURFACE HALFTONE per screen.
//
// `?satworst=1` serves the deck's LONGEST prompt every draw: a layout gate on a
// randomly dealt word is not a gate, because the same viewport passes or fails on
// the shuffle.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

const VIEWPORTS = [
  { name: '1366x768', width: 1366, height: 768 },
  { name: '1280x720', width: 1280, height: 720 },
  { name: '390x844', width: 390, height: 844 },
  { name: '320x640', width: 320, height: 640 },
];

// The whole palette. Cream paper, the near-black ink, the one red — plus the site
// void the page sits on, and pure black/white, which the browser uses for defaults
// and for nothing the design chose.
const PALETTE = [
  [240, 234, 217], // --paper  #F0EAD9
  [17, 17, 17], //    --ink    #111
  [200, 50, 30], //   --redink #C8321E
  [13, 6, 24], //     the site void behind the mode
  [0, 0, 0],
  [255, 255, 255],
];
const TOL = 10; // per-channel tolerance: antialiasing and 8-bit rounding, not a new hue

// ---------------------------------------------------------------------------
// navigation. EVERY entry point is a real shipped route; the URL is returned so
// the test can name it.
// ---------------------------------------------------------------------------
const PLAY_QS = '?satRush=1&portal=1&satworst=1&stage=12000&spell=9000';

async function toPlay(page, mode) {
  await installBackendMock(page);
  const url = `/${PLAY_QS}`;
  await page.goto(url);
  await page.locator('[data-game="sat-rush"] .game-card').click();
  await page.getByRole('button', { name: 'Play' }).click();
  await expect(page.locator('.sr-modeselect')).toBeVisible();
  await page.getByRole('button', { name: mode === 'lineup' ? /LINEUP/ : /BRIEFING/ }).click();
  if (mode !== 'lineup') {
    await expect(page.locator('.sr-brief-page')).toBeVisible();
    await page.getByRole('button', { name: 'Start the run' }).click();
  }
  await expect(page.locator('.sr-slots')).toBeVisible();
  await page.waitForTimeout(450); // let the fit settle (one layout pass, then the RO hop)
  return url;
}

async function toScene(page, scene) {
  await installBackendMock(page);
  const url = `/?satrush=1&tune=1&satworst=1&freeze=1&scene=${scene}`;
  await page.goto(url);
  await expect(page.locator(scene === 'results' ? '.sr-respage' : '.sr-slots')).toBeVisible();
  // THE RESULTS PAGE ARRIVES IN STAGES. Its lower half (the cleared/missed strip, the run
  // film-strip, the hardest clear, the share bar and the actions) enters on a staggered
  // opacity transition and is opacity:0 for the first ~600ms. Measuring — or shooting — before
  // that lands reads a half-empty page and silently skips everything below the fold: the two
  // neon buttons down there were caught by this gate only intermittently until it waited.
  if (scene === 'results') await expect(page.locator('.sr-results-actions.in')).toBeVisible();
  await page.waitForTimeout(450);
  return url;
}

// The page's STATIC decorative leans, off. SAT Rush leans the whole page 1.1 degrees and each
// suspect card up to 3 — form, not motion, and it survives prefers-reduced-motion by design. It
// also inflates every axis-aligned bounding box by up to 16px, which is not a collision. This is
// injected only for the overlap measurement; nothing else in the audit reads geometry.
const FLATTEN_LEANS = `
  .sr-stage, .sr-respage, .sr-suspect, .sr-wanted, .sr-brief-page, .sr-brief-card, .sr-modecard,
  .sr-card, .sr-cardframe, .sr-hud, .sr-hud .sr-hcell > * { transform: none !important; }
  .sr-escaped { transform: translate(-50%, -50%) !important; }
`;

// ---------------------------------------------------------------------------
// the probes. All five run in ONE page.evaluate so a screen is measured once.
// ---------------------------------------------------------------------------
async function audit(page) {
  await page.addStyleTag({ content: FLATTEN_LEANS });
  return page.evaluate((cfg) => {
    const { palette, tol } = cfg;
    const de = document.documentElement;
    const app = document.querySelector('.sr-app');
    const out = {
      pageScroll: {
        h: de.scrollHeight - de.clientHeight,
        w: de.scrollWidth - de.clientWidth,
      },
      scrollers: [],
      offPalette: [],
      accents: [],
      halftones: [],
      overlaps: [],
    };
    if (!app) return out;

    const sel = (el) => {
      if (el === document.body) return 'body';
      const c = typeof el.className === 'string' ? el.className.trim().split(/\s+/).filter(Boolean) : [];
      return el.tagName.toLowerCase() + (c.length ? '.' + c.join('.') : '');
    };
    const visible = (el) => {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.05) return false;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return false;
      // fully off-screen nodes are not on the page
      return r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight;
    };

    // --- 1. SCROLL. The page, and every box inside the mode. -----------------
    // Anything that both CAN scroll (overflow auto/scroll) and DOES overflow is a
    // scrollbar on the question.
    for (const el of [app, ...app.querySelectorAll('*')]) {
      const cs = getComputedStyle(el);
      const canY = cs.overflowY === 'auto' || cs.overflowY === 'scroll';
      const canX = cs.overflowX === 'auto' || cs.overflowX === 'scroll';
      const overY = el.scrollHeight - el.clientHeight;
      const overX = el.scrollWidth - el.clientWidth;
      if ((canY && overY > 2) || (canX && overX > 2)) {
        out.scrollers.push({ sel: sel(el), overY, overX, h: el.clientHeight, sh: el.scrollHeight });
      }
    }

    // --- 2. DUOTONE + 3. ACCENT + 5. HALFTONE -------------------------------
    const near = (rgb) =>
      palette.some((p) => Math.abs(p[0] - rgb[0]) <= tol && Math.abs(p[1] - rgb[1]) <= tol && Math.abs(p[2] - rgb[2]) <= tol);
    const isRed = (rgb) => Math.abs(rgb[0] - 200) <= tol && Math.abs(rgb[1] - 50) <= tol && Math.abs(rgb[2] - 30) <= tol;
    const parse = (v) => {
      const m = /rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,/\s]+([\d.]+))?\)/.exec(v || '');
      if (!m) return null;
      const a = m[4] === undefined ? 1 : parseFloat(m[4]);
      if (a < 0.06) return null; // effectively not painted
      return [+m[1], +m[2], +m[3]];
    };

    // WHAT COUNTS AS "ON THE PAGE". SAT Rush is a `position: fixed; inset: 0` takeover, so the
    // menu is still in the DOM underneath it, fully laid out and neon — scanning the whole body
    // would report the wall bricks and the paint drips as SAT Rush defects. Only two things can
    // paint on top of a fixed full-screen mode: the mode's own subtree, and other FIXED chrome.
    // Both are scanned; nothing else can be seen, so nothing else is judged. (Scoping this to
    // .sr-app alone would have missed the yellow WINS pill, which is a SIBLING of it.)
    // HALFTONES ARE COUNTED ON THE SCREEN THAT IS IN FRONT. The play poster stays mounted under
    // the opaque results overlay, so its corner wedge is in the DOM but not on the page you are
    // looking at, and counting it would make every results screen read as two halftones.
    const frontScreen = [...document.querySelectorAll('.sr-screen')].find(visible) || app;
    const onFront = (el) => frontScreen === el || frontScreen.contains(el);
    const all = [
      app,
      ...app.querySelectorAll('*'),
      ...[...document.body.querySelectorAll('*')].filter(
        (el) => !app.contains(el) && getComputedStyle(el).position === 'fixed'
      ),
    ].filter(visible);
    for (const el of all) {
      const cs = getComputedStyle(el);
      const props = ['color', 'backgroundColor', 'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor', 'outlineColor', 'webkitTextStrokeColor'];
      let accented = false;
      for (const p of props) {
        // a border colour only counts where there is a border to paint
        if (p.startsWith('border')) {
          const w = parseFloat(cs[p.replace('Color', 'Width')]);
          if (!(w > 0) || cs[p.replace('Color', 'Style')] === 'none') continue;
        }
        const rgb = parse(cs[p]);
        if (!rgb) continue;
        if (isRed(rgb)) accented = true;
        if (!near(rgb)) out.offPalette.push({ sel: sel(el), prop: p, value: cs[p] });
      }
      // box-shadow / text-shadow carry colour too (the RARE tier's red plate is one)
      for (const p of ['boxShadow', 'textShadow']) {
        const v = cs[p];
        if (!v || v === 'none') continue;
        for (const m of v.matchAll(/rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,/\s]+([\d.]+))?\)/g)) {
          const a = m[4] === undefined ? 1 : parseFloat(m[4]);
          if (a < 0.06) continue;
          const rgb = [+m[1], +m[2], +m[3]];
          if (isRed(rgb)) accented = true;
          if (!near(rgb)) out.offPalette.push({ sel: sel(el), prop: p, value: m[0] });
        }
      }
      if (accented) out.accents.push(sel(el));

      // A SURFACE HALFTONE is a repeating dot grid painted as an element's own
      // background over an area — not the off-register type plate (which is
      // background-clip:text) and not a glyph tile's state tone.
      const bi = cs.backgroundImage;
      if (bi && bi !== 'none' && /radial-gradient/.test(bi) && cs.webkitBackgroundClip !== 'text' && cs.backgroundClip !== 'text') {
        const size = cs.backgroundSize;
        const cell = parseFloat(size);
        const r = el.getBoundingClientRect();
        // a dot GRID (small repeating cell) over a real area, and not a slot tile
        if (cell > 0 && cell <= 20 && r.width * r.height > 8000 && !el.classList.contains('sr-slot')) {
          if (onFront(el)) out.halftones.push({ sel: sel(el), size, opacity: cs.opacity });
        }
      }
    }
    // pseudo-elements carry most of this mode's tone; sample them too
    for (const el of all) {
      for (const pe of ['::before', '::after']) {
        const cs = getComputedStyle(el, pe);
        if (cs.content === 'none') continue;
        const bi = cs.backgroundImage;
        if (bi && bi !== 'none' && /radial-gradient|repeating-/.test(bi) && cs.webkitBackgroundClip !== 'text' && cs.backgroundClip !== 'text') {
          const cell = parseFloat(cs.backgroundSize);
          if (cell > 0 && cell <= 20 && parseFloat(cs.opacity) > 0.06) {
            if (onFront(el)) out.halftones.push({ sel: sel(el) + pe, size: cs.backgroundSize, opacity: cs.opacity });
          }
        }
        const rgb = parse(cs.color);
        if (rgb && isRed(rgb)) out.accents.push(sel(el) + pe);
        const bg = parse(cs.backgroundColor);
        if (bg && isRed(bg)) out.accents.push(sel(el) + pe);
      }
    }

    // --- 4. OVERLAP. Named blocks, on the screen that is actually in front. ---
    // Three things had to be right here, and each was wrong first.
    // (a) NAMED, NOT INFERRED. getBoundingClientRect on an ancestor does not include an
    //     out-of-flow descendant that overflows it, so every block that owns a region of the
    //     poster is listed by name, plus the app's own fixed chrome (the pills and the corner
    //     sound button, which are what actually landed on the hud and the REWARD footer).
    // (b) THE LEAN IS NOT A COLLISION. Nearly everything here is tilted a degree or three (the
    //     page's static manga lean, each suspect card). An axis-aligned box round an 850px-wide
    //     panel leaning 1.1 degrees is 16px taller than the panel, so two panels separated by a
    //     real ink gutter "overlap" by 9-11px on paper and by nothing at all on screen — the
    //     first version of this gate reported exactly that, sixteen times over. The caller
    //     flattens those static leans before measuring (see FLATTEN_LEANS); a decorative lean
    //     cannot make two panels collide, and with it off the rects are the layout truth.
    //     (getBoxQuads, the exact answer, is not implemented in this Chromium — measured.)
    // (c) THE SCREEN IN FRONT IS THE SCREEN. The play poster stays mounted UNDER the results
    //     overlay, so comparing across that boundary reports the whole results page as
    //     "overlapping" the card behind it. Only what is on top is measured.
    const overlay = [...document.querySelectorAll('.sr-screen')].find(visible) || null;
    const root = overlay || app;
    const NAMES = [
      '.sr-hud', '.sr-hcell', '.sr-hud-exit', '.sr-wanted-wrap', '.sr-caseid', '.sr-fields',
      '.sr-field', '.sr-slotwrap', '.sr-slots', '.sr-lineup', '.sr-spell', '.sr-reward',
      '.sr-msg', '.sr-suspect', '.sr-mult', '.sr-antebox', '.sr-pips', '.sr-tick',
      '.sr-respage', '.sr-dead', '.sr-share', '.sr-results-actions',
    ];
    const nodes = [];
    for (const n of NAMES) {
      for (const el of root.querySelectorAll(n)) if (visible(el)) nodes.push(el);
    }
    // the app's own fixed chrome is compared against everything, whichever screen is up
    for (const n of ['.wins-hud', '.wpm-hud', '.audio-ctrl']) {
      for (const el of document.querySelectorAll(n)) if (visible(el)) nodes.push(el);
    }
    const contains = (a, b) => a.contains(b) || b.contains(a);
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const A = nodes[i];
        const B = nodes[j];
        if (contains(A, B)) continue;
        const ra = A.getBoundingClientRect();
        const rb = B.getBoundingClientRect();
        const ox = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
        const oy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
        // the penetration depth is the smaller of the two, i.e. how far one would have to move
        if (ox > 4 && oy > 4) out.overlaps.push({ a: sel(A), b: sel(B), d: Math.round(Math.min(ox, oy)) });
      }
    }
    return out;
  }, { palette: PALETTE, tol: TOL });
}

function uniq(list) {
  return [...new Set(list)];
}

// ---------------------------------------------------------------------------
// THE SCREENS. Route is in every title; the assertions are shared.
// ---------------------------------------------------------------------------
const SCREENS = [
  { key: 'briefing-play', route: `/${PLAY_QS} -> BRIEFING -> Start the run`, go: (p) => toPlay(p, 'briefing') },
  { key: 'lineup-play', route: `/${PLAY_QS} -> LINEUP`, go: (p) => toPlay(p, 'lineup') },
  { key: 'deep-cut', route: '/?satrush=1&tune=1&satworst=1&freeze=1&scene=deep', go: (p) => toScene(p, 'deep') },
  { key: 'revenant', route: '/?satrush=1&tune=1&satworst=1&freeze=1&scene=revenant', go: (p) => toScene(p, 'revenant') },
  { key: 'results', route: '/?satrush=1&tune=1&satworst=1&freeze=1&scene=results', go: (p) => toScene(p, 'results') },
];

for (const vp of VIEWPORTS) {
  for (const s of SCREENS) {
    test(`${vp.name} ${s.key} — ON THE GAME (${s.route})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const url = await s.go(page);
      const a = await audit(page);

      // 1. NOTHING SCROLLS — not the page, not a box in the mode.
      expect(
        a.pageScroll.h,
        `the PAGE scrolls vertically on ${url} (${a.pageScroll.h}px past the fold)`
      ).toBeLessThanOrEqual(2);
      expect(
        a.pageScroll.w,
        `the PAGE scrolls horizontally on ${url} (${a.pageScroll.w}px)`
      ).toBeLessThanOrEqual(2);
      // THE ONE DOCUMENTED EXCEPTION, and it is not the play screen. The RESULTS page is 1100px
      // of genuine summary — ante, score, wins, cleared/missed, the run film-strip, the hardest
      // clear, the sticky-miss list, the share bar and the actions. On a wide screen it is now
      // TWO COLUMNS and fits exactly (768/768 at 1366x768, 720/720 at 1280x720, measured). On a
      // phone there is no second column to give and the only way to make it fit is to delete
      // content, so it scrolls — inside its own container; the document still never scrolls.
      // The PLAY SCREEN has no exception at any viewport.
      const allowed = vp.width < 1000 ? ['div.sr-screen.sr-results'] : [];
      expect(
        a.scrollers.filter((x) => !allowed.includes(x.sel)).map((x) => `${x.sel} wants ${x.sh}px in ${x.h}px`),
        `a box inside SAT Rush has a scrollbar on ${url}`
      ).toEqual([]);

      // 2. FULL DUOTONE — cream, ink, the one red, nothing else.
      expect(
        uniq(a.offPalette.map((x) => `${x.sel} { ${x.prop}: ${x.value} }`)),
        `off-palette colour on ${url} — SAT Rush is cream + one ink + --redink`
      ).toEqual([]);

      // 3. EXACTLY ONE ACCENT ELEMENT.
      const accents = uniq(a.accents);
      expect(accents.length, `more than one accent element on ${url}: ${accents.join(' | ')}`).toBeLessThanOrEqual(1);
      if (s.key === 'deep-cut' || s.key === 'revenant' || s.key.endsWith('-play')) {
        expect(accents.length, `no accent element at all on ${url} — the accent is --redink`).toBe(1);
      }

      // 4. NO OVERLAP > 4px.
      expect(
        uniq(a.overlaps.map((o) => `${o.a} x ${o.b} (${o.d}px deep)`)),
        `elements overlap by more than 4px on ${url}`
      ).toEqual([]);

      // 5. ONE SURFACE HALFTONE.
      const tones = uniq(a.halftones.map((h) => h.sel));
      expect(tones.length, `${tones.length} surface halftones on ${url}: ${tones.join(' | ')}`).toBeLessThanOrEqual(1);
    });
  }
}

// ---------------------------------------------------------------------------
// THE PROMPT IS STILL READABLE after the fit shrinks it. "It fits" is trivially
// satisfiable by shrinking the type to nothing, so the fit is only a fix if what
// is left can be read: the sentence must still render at >= 11px and the fit must
// not be sitting on its own floor (which would mean it ran out of room rather
// than found room).
// ---------------------------------------------------------------------------
for (const vp of VIEWPORTS) {
  for (const mode of ['briefing', 'lineup']) {
    test(`${vp.name} ${mode} — the prompt is on the page and legible`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const url = await toPlay(page, mode);
      const m = await page.evaluate(() => {
        const fields = document.querySelector('.sr-fields');
        const sentence = document.querySelector('.sr-sentence');
        if (!fields || !sentence) return null;
        const fr = fields.getBoundingClientRect();
        const sr = sentence.getBoundingClientRect();
        return {
          fit: parseFloat(getComputedStyle(fields).getPropertyValue('--sr-fit')),
          px: parseFloat(getComputedStyle(sentence).fontSize),
          clippedBy: Math.round(sr.bottom - fr.bottom),
          hidden: fields.scrollHeight - fields.clientHeight,
        };
      });
      expect(m, `no prompt rendered on ${url}`).not.toBeNull();
      // the sentence is fully inside its (clipping) region — not cut off at the bottom
      expect(m.clippedBy, `the sentence is cut off by ${m.clippedBy}px on ${url}`).toBeLessThanOrEqual(2);
      expect(m.hidden, `${m.hidden}px of the prompt is clipped out of sight on ${url}`).toBeLessThanOrEqual(2);
      expect(m.px, `the sentence rendered at ${m.px}px on ${url} — too small to read`).toBeGreaterThanOrEqual(11);
      expect(m.fit, `the fit is on its FLOOR on ${url} — it ran out of room rather than found it`).toBeGreaterThan(0.52);
    });
  }
}
