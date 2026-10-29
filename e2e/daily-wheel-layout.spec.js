// e2e/daily-wheel-layout.spec.js — THE DAILY WHEEL never overlaps and never shrinks (oct28, Andy: "it's so small …
// there's overlap … its so sloppy"). At 1366x768, 1920x1080 and 390x844, READY and LANDED:
//   (and 360x640, the shortest phone)
//   1. no two parts of the panel overlap (close ✕, wordmark, streak, the wheel's disc, the pointer, every foot item);
//   2. everything sits inside the panel, and the panel inside the viewport (no scroll);
//   3. the wheel DOMINATES: its diameter is at least 86% of the panel's short side (phone: width, desktop: height)
//      (desktop ≥ 52% of the viewport height, phone ≥ 86% of the viewport width);
//   4. touch targets ≥ 44px; the foot text ≥ 13px.
// Soft asserts: one run lists EVERY defect at a size (the test still fails on any).
// SHOTS=1 saves the screenshots (claude/shots-wheel-layout/).
import { test, expect } from '@playwright/test';
import { boot } from './support/wheelBoot.js';

const SHOTS = !!process.env.SHOTS;
const DIR = process.env.SHOTS_DIR || 'claude/shots-wheel-layout';
const SIZES = [[1366, 768], [1920, 1080], [390, 844], [360, 640]]; // + the shortest phone we fit

// every visible part's box, by name (the wheel is its DISC: the rim's inscribed circle, tested as a circle)
const parts = (page) => page.evaluate(() => {
  const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return r.width && r.height ? { x: r.left, y: r.top, w: r.width, h: r.height } : null; };
  const q = (s) => document.querySelector(s);
  const out = {
    panel: box(q('.dw')), close: box(q('.dw-close')), title: box(q('.dw-title')), streak: box(q('.dw-streak')),
    wheel: box(q('.dw-wheel')), pointer: box(q('.dw-pointer')), odds: box(q('.dw-odds-btn')),
  };
  [...document.querySelectorAll('.dw-foot > *')].forEach((el, i) => { out[`foot${i}:${el.className || el.tagName}`] = box(el); });
  return out;
});
const hit = (a, b, pad = 0) => a.x < b.x + b.w - pad && b.x < a.x + a.w - pad && a.y < b.y + b.h - pad && b.y < a.y + a.h - pad;
// a rectangle against the wheel's disc (its corners are empty, so a part may tuck into them)
const hitsDisc = (r, d) => {
  const cx = d.x + d.w / 2; const cy = d.y + d.h / 2; const rad = d.w / 2;
  const nx = Math.max(r.x, Math.min(cx, r.x + r.w)); const ny = Math.max(r.y, Math.min(cy, r.y + r.h));
  return (nx - cx) ** 2 + (ny - cy) ** 2 < (rad - 1) ** 2;
};

async function check(page, w, h, tag) {
  const p = await parts(page);
  const noScroll = await page.evaluate(() => ({ y: document.documentElement.scrollHeight - innerHeight, x: document.documentElement.scrollWidth - innerWidth }));
  expect.soft(noScroll, `${tag}: page scrolls`).toEqual({ x: 0, y: 0 });
  const { panel, wheel, pointer } = p;
  expect.soft(panel.x).toBeGreaterThanOrEqual(-0.5);
  expect.soft(panel.y).toBeGreaterThanOrEqual(-0.5);
  expect.soft(panel.x + panel.w).toBeLessThanOrEqual(w + 0.5);
  expect.soft(panel.y + panel.h).toBeLessThanOrEqual(h + 0.5);
  const named = Object.entries(p).filter(([k, v]) => v && k !== 'panel');
  for (const [k, r] of named) {
    expect.soft(r.x, `${tag}: ${k} leaves the panel (left)`).toBeGreaterThanOrEqual(panel.x - 0.5);
    expect.soft(r.x + r.w, `${tag}: ${k} leaves the panel (right)`).toBeLessThanOrEqual(panel.x + panel.w + 0.5);
    expect.soft(r.y, `${tag}: ${k} leaves the panel (top)`).toBeGreaterThanOrEqual(panel.y - 0.5);
    expect.soft(r.y + r.h, `${tag}: ${k} leaves the panel (bottom)`).toBeLessThanOrEqual(panel.y + panel.h + 0.5);
  }
  // pairwise: nothing overlaps anything (the pointer belongs ON the wheel, so only that pair is exempt)
  const rects = named.filter(([k]) => k !== 'wheel');
  for (let i = 0; i < rects.length; i += 1) {
    for (let j = i + 1; j < rects.length; j += 1) {
      const [ka, a] = rects[i]; const [kb, b] = rects[j];
      expect.soft(hit(a, b, 0.5), `${tag}: ${ka} overlaps ${kb}`).toBe(false);
    }
    const [k, r] = rects[i];
    if (k !== 'pointer') expect.soft(hitsDisc(r, wheel), `${tag}: ${k} overlaps the wheel`).toBe(false);
  }
  expect.soft(pointer.y + pointer.h).toBeGreaterThan(wheel.y); // the pointer really points INTO the wheel
  // INSIDE THE WHEEL, in the rotor's own (unturned) frame: every wedge NAME sits wholly inside the rim's opening (the
  // lip used to clip LEGEND+ / +120), never on its prize, and every prize stays inside its own wedge
  const face = await page.evaluate(() => {
    const wheel = document.querySelector('.dw-wheel'); const rotor = document.querySelector('.dw-rotor');
    const open = parseFloat(getComputedStyle(wheel).getPropertyValue('--dw-open'));
    const c = rotor.offsetWidth / 2;
    const rOpen = open * wheel.offsetWidth / 2; // the visible face, in px (the rotor shares the wheel's centre)
    const rect = (el) => ({ x: el.offsetLeft - el.offsetWidth / 2, y: el.offsetTop - el.offsetHeight / 2, w: el.offsetWidth, h: el.offsetHeight });
    return [...document.querySelectorAll('.dw-slice')].map((s) => {
      const lab = s.querySelector('.dw-slice-lab'); const ico = s.querySelector('.dw-slice-ico');
      const l = rect(lab); const i = rect(ico);
      const far = Math.max(...[[l.x, l.y], [l.x + l.w, l.y], [l.x, l.y + l.h], [l.x + l.w, l.y + l.h]].map(([x, y]) => Math.hypot(x - c, y - c)));
      const icoR = Math.hypot(i.x + i.w / 2 - c, i.y + i.h / 2 - c);
      return { name: lab.textContent, far, rOpen, labBottom: l.y + l.h, icoTop: i.y, wedgeRoom: icoR * Math.sin(Math.PI / 8), icoHalf: i.w / 2 };
    });
  });
  for (const f of face) {
    expect.soft(f.far, `${tag}: the ${f.name} name runs under the rim`).toBeLessThanOrEqual(f.rOpen - 2);
    expect.soft(f.labBottom, `${tag}: the ${f.name} name sits on its prize`).toBeLessThanOrEqual(f.icoTop + 2);
    expect.soft(f.icoHalf * 0.85, `${tag}: the ${f.name} prize spills into the next wedge`).toBeLessThanOrEqual(f.wedgeRoom);
  }
  // THE WHEEL DOMINATES
  expect.soft(wheel.w / Math.min(panel.w, panel.h), `${tag}: wheel too small for the panel`).toBeGreaterThanOrEqual(0.86); // phone: its width; desktop: its height
  if (w >= 1000) expect.soft(wheel.w / h, `${tag}: wheel too small for the screen`).toBeGreaterThanOrEqual(0.52);
  else expect.soft(wheel.w / w, `${tag}: wheel too small for the phone`).toBeGreaterThanOrEqual(h >= 800 ? 0.86 : 0.74); // a 640-tall phone trades some width for the head + foot
  // touch targets + readable text
  const tiny = await page.evaluate(() => [...document.querySelectorAll('.dw button:not(.dw-hub)')].filter((b) => b.offsetParent)
    .map((b) => { const r = b.getBoundingClientRect(); return { t: b.textContent.trim() || b.getAttribute('aria-label'), w: r.width, h: r.height }; })
    .filter((r) => r.w < 44 || r.h < 44));
  expect.soft(tiny, `${tag}: touch targets under 44px`).toEqual([]);
  const small = await page.evaluate(() => [...document.querySelectorAll('.dw-foot *, .dw-streak *')].filter((el) => el.offsetParent && el.childNodes[0]?.nodeType === 3 && el.textContent.trim())
    .map((el) => ({ t: el.textContent.trim(), px: parseFloat(getComputedStyle(el).fontSize) })).filter((r) => r.px < 13));
  expect.soft(small, `${tag}: text under 13px`).toEqual([]);
}

const artLoaded = (page) => page.waitForFunction(() => [...document.querySelectorAll('.dw img')].every((i) => i.complete && i.naturalWidth > 0));

for (const [w, h] of SIZES) {
  test(`daily wheel ${w}x${h}: big, inside the panel, nothing overlaps (ready + landed)`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await boot(page, { slot: 2 });
    await page.locator('[data-nav="wheel"]').first().click();
    await expect(page.getByTestId('wheel-spin')).toBeVisible();
    await artLoaded(page);
    await page.waitForTimeout(300);
    if (SHOTS) await page.screenshot({ path: `${DIR}/ready-${w}x${h}.png` });
    await check(page, w, h, `ready ${w}x${h}`);
    await page.getByTestId('wheel-spin').click();
    await expect(page.getByTestId('wheel-result')).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1600); // the result slam + the prize drop have finished
    if (SHOTS) await page.screenshot({ path: `${DIR}/landed-${w}x${h}.png` });
    await check(page, w, h, `landed ${w}x${h}`);
  });
}
