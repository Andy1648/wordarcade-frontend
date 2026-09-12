// e2e/sat-rush-fit.spec.js — SAT RUSH MUST NEVER ASK YOU TO SCROLL.
//
// THE DEFECT. The poster's field region (LAST SEEN / DESCRIPTION / KNOWN ALIASES) was
// `overflow-y: auto`. On a short window, behind a phone keyboard, or on a word with a long gloss,
// that put a SCROLLBAR on the question — in a mode where a timer is running and reading fast IS
// the skill. A prompt you have to scroll to read is a prompt you cannot answer in time.
//
// THE GATES, at every viewport including two that model a phone with the keyboard up:
//   1. NO PAGE SCROLL     document.body.scrollHeight === clientHeight.
//   2. NO INNER SCROLL    nothing inside the card has scrollHeight > clientHeight.
//   3. NOTHING CLIPPED    every text box sits inside its clipping ancestor's content box.
//   4. CONTRAST           the DEFINITION text measures >= 4.5:1 against the paper it is on,
//                         computed from the real rendered colours (including opacity), not from
//                         the hex in the stylesheet.
// A screenshot of each is written to claude/sat-rush-shots/ and reviewed before this ships —
// numbers do not see a poster that has shrunk its own type into a grey smear.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { installBackendMock } from './support/backendMock.js';

const SHOTS = path.join('claude', 'sat-rush-shots');
fs.mkdirSync(SHOTS, { recursive: true });

// The two phone sizes are given a KEYBOARD-UP twin: a soft keyboard does not resize the layout
// viewport on every browser, but it is the single most common way this box ends up too short, and
// the honest way to test "does the prompt still fit" is to give it that height.
const VIEWPORTS = [
  { name: '1366x768', w: 1366, h: 768 },
  { name: '1280x720', w: 1280, h: 720 },
  { name: '390x844', w: 390, h: 844 },
  { name: '390x420-keyboard', w: 390, h: 420 },
  { name: '320x640', w: 320, h: 640 },
  { name: '320x340-keyboard', w: 320, h: 340 },
];

async function enterRun(page) {
  await installBackendMock(page);
  // ?satworst=1 — every draw is the deck's LONGEST prompt. A layout gate on a randomly dealt
  // word is not a gate: the same viewport passes or fails on the shuffle, so a green run proves
  // nothing and a red one cannot be reproduced.
  await page.goto('/?satRush=1&portal=1&satworst=1');
  const card = page.locator('[data-game="sat-rush"]');
  await expect(card).toBeVisible();
  await card.locator('.game-card').click();
  await page.getByRole('button', { name: 'Play' }).click();
  await expect(page.locator('.sr-modeselect')).toBeVisible();
  await page.getByRole('button', { name: /BRIEFING/ }).click();
  await expect(page.locator('.sr-brief-page')).toBeVisible();
  await page.getByRole('button', { name: 'Start the run' }).click();
  await expect(page.locator('.sr-slots')).toBeVisible();
}

// Everything the gates need, in one evaluate.
async function measure(page) {
  return page.evaluate(() => {
    const out = { pageScroll: 0, innerScroll: [], clipped: [], contrast: null, fit: null, texts: {} };
    const de = document.documentElement;
    out.pageScroll = Math.max(
      de.scrollHeight - de.clientHeight,
      document.body.scrollHeight - document.body.clientHeight
    );

    const app = document.querySelector('.sr-app');
    if (!app) return out;

    // (2) NO INNER SCROLL. Every element inside the mode, not just the ones we expect to be
    // trouble — a scrollbar anywhere on a timed prompt is the defect, wherever it turns up.
    for (const el of app.querySelectorAll('*')) {
      const over = el.scrollHeight - el.clientHeight;
      if (over > 1 && el.clientHeight > 0) {
        const cs = getComputedStyle(el);
        // `visible` overflow does not scroll or clip — it spills, which gate (3) catches instead.
        if (cs.overflowY === 'visible' && cs.overflow === 'visible') continue;
        out.innerScroll.push(`${el.className || el.tagName} +${Math.round(over)}px`);
      }
    }

    // (3) NOTHING CLIPPED. For each text box, walk up to the nearest CLIPPING ancestor and check
    // the box sits inside its content area.
    const clipper = (el) => {
      let p = el.parentElement;
      while (p) {
        const cs = getComputedStyle(p);
        if (cs.overflow !== 'visible' || cs.overflowY !== 'visible') return p;
        p = p.parentElement;
      }
      return null;
    };
    const px = (v) => (Number.isFinite(parseFloat(v)) ? parseFloat(v) : 0);
    // The HUD readouts and the REWARD multiplier are in the list because both were found clipped
    // at 320px while reviewing the shots — the skewed hud row overflowing the page's left edge,
    // and the multiplier cut by the card frame. A gate that only watched the prompt would have
    // called that screen fine.
    for (const el of app.querySelectorAll(
      '.sr-sentence, .sr-gloss, .sr-root, .sr-fieldlabel, .sr-caseid, .sr-wanted, .sr-slot,' +
      ' .sr-hval, .sr-hlabel, .sr-lives, .sr-heat, .sr-mult'
    )) {
      const c = clipper(el);
      if (!c) continue;
      const b = el.getBoundingClientRect();
      const cb = c.getBoundingClientRect();
      const cs = getComputedStyle(c);
      const inner = {
        t: cb.top + px(cs.borderTopWidth),
        b: cb.bottom - px(cs.borderBottomWidth),
        l: cb.left + px(cs.borderLeftWidth),
        r: cb.right - px(cs.borderRightWidth),
      };
      if (b.width < 1 || b.height < 1) continue;
      const outBy = Math.max(inner.t - b.top, b.bottom - inner.b, inner.l - b.left, b.right - inner.r);
      if (outBy > 1) {
        out.clipped.push(`${el.className.split(' ')[0]} out of ${c.className.split(' ')[0]} by ${Math.round(outBy)}px`);
      }
    }

    // (4) CONTRAST of the DEFINITION against the paper behind it. Computed from RENDERED colour,
    // opacity included and composited onto the first opaque background up the tree — reading the
    // hex out of the stylesheet would miss exactly the thing that goes wrong (a text colour that
    // is fine on its own but is sitting at 0.6 opacity).
    const parse = (c) => {
      const m = String(c).match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const p = m[1].split(',').map((x) => parseFloat(x));
      return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
    };
    const over = (fg, bg) => ({
      r: fg.r * fg.a + bg.r * (1 - fg.a),
      g: fg.g * fg.a + bg.g * (1 - fg.a),
      b: fg.b * fg.a + bg.b * (1 - fg.a),
      a: 1,
    });
    const lum = (c) => {
      const f = (v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
    };
    const bgOf = (el) => {
      let p = el;
      while (p) {
        const c = parse(getComputedStyle(p).backgroundColor);
        if (c && c.a > 0.95) return c;
        p = p.parentElement;
      }
      return { r: 255, g: 255, b: 255, a: 1 };
    };
    // The EFFECTIVE alpha of an element is its own opacity times every ancestor's.
    const chainAlpha = (el) => {
      let a = 1;
      let p = el;
      while (p && p !== document.documentElement) {
        a *= parseFloat(getComputedStyle(p).opacity || '1');
        p = p.parentElement;
      }
      return a;
    };
    const gloss = app.querySelector('.sr-gloss');
    if (gloss && gloss.textContent.trim()) {
      const fg = parse(getComputedStyle(gloss).color) || { r: 0, g: 0, b: 0, a: 1 };
      fg.a = Math.min(1, (fg.a || 1) * chainAlpha(gloss));
      const bg = bgOf(gloss);
      const c = over(fg, bg);
      const L1 = Math.max(lum(c), lum(bg));
      const L2 = Math.min(lum(c), lum(bg));
      out.contrast = Math.round(((L1 + 0.05) / (L2 + 0.05)) * 100) / 100;
      out.texts.gloss = gloss.textContent.trim().slice(0, 60);
    }

    const fields = app.querySelector('.sr-fields');
    if (fields) {
      out.fit = parseFloat(getComputedStyle(fields).getPropertyValue('--sr-fit')) || 1;
      out.fieldsBox = `${Math.round(fields.clientHeight)}/${Math.round(fields.scrollHeight)}`;
    }
    return out;
  });
}

for (const vp of VIEWPORTS) {
  test(`SAT RUSH fits @ ${vp.name}: no scroll, nothing clipped, definition readable`, async ({ page }) => {
    await page.setViewportSize({ width: vp.w, height: vp.h });
    await enterRun(page);
    // Let the reveals land so the field region is carrying real text, not an empty box — the whole
    // question is whether a FULL prompt fits, and an empty one always does.
    await page.waitForTimeout(3200);

    // SHOT FIRST, so the evidence exists even when an assertion below fails.
    await page.screenshot({ path: path.join(SHOTS, `${vp.name}.png`) });

    const m = await measure(page);
    // eslint-disable-next-line no-console
    console.log(
      `SATFIT | ${vp.name} | pageScroll=${m.pageScroll} | innerScroll=${m.innerScroll.length ? m.innerScroll.join(' ; ') : 'none'}` +
      ` | clipped=${m.clipped.length ? m.clipped.join(' ; ') : 'none'} | contrast=${m.contrast} | fit=${m.fit} fields=${m.fieldsBox}`
    );

    expect(m.pageScroll, 'the PAGE must not scroll').toBeLessThanOrEqual(0);
    expect(m.innerScroll, 'nothing inside the mode may scroll').toEqual([]);
    expect(m.clipped, 'nothing may be clipped by its container').toEqual([]);
    expect(m.contrast, `definition contrast (${m.texts.gloss})`).not.toBeNull();
    expect(m.contrast, `definition contrast (${m.texts.gloss})`).toBeGreaterThanOrEqual(4.5);
    // The fit is allowed to shrink — that is the mechanism — but if it has bottomed out, the
    // prompt only fits because it ran out of room to shrink, and that is worth knowing.
    expect(m.fit, 'the type-fit scale bottomed out — the box is too small for the prompt').toBeGreaterThan(0.52);
  });
}
