// menu-spec-check.mjs — the numeric parts of Phase 6's MENU brief, measured.
//
// Several of that item's requirements are numbers, which means they can be checked instead
// of admired: "JOIN ROOM >=48px", "level numeral 3-4x the XP label", "the featured card at
// 1.5x", and the 44px touch floor on the corner nav. This reads the rendered geometry at
// three viewports and prints pass/fail per claim.
// Usage: node menu-spec-check.mjs   (needs vite preview on :4173)
import { chromium } from '@playwright/test';
import { installBackendMock } from '../../e2e/support/backendMock.js';

const BASE = 'http://localhost:4173';
const VIEWPORTS = [
  [1920, 1080, '1920x1080'],
  [1366, 768, '1366x768'],
  [390, 844, '390x844'],
];

const MEASURE = () => {
  const box = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      w: Math.round(r.width),
      h: Math.round(r.height),
      fs: Math.round(parseFloat(cs.fontSize) * 10) / 10,
      font: cs.fontFamily.split(',')[0].replace(/["']/g, ''),
      color: cs.color,
    };
  };
  const cards = [...document.querySelectorAll('.game-card-magnet')].map((el) => {
    const r = el.getBoundingClientRect();
    return { spotlit: el.classList.contains('is-spotlit'), w: Math.round(r.width), h: Math.round(r.height) };
  });
  const nav = [...document.querySelectorAll('.homepage-nav-btn')].map((el) => {
    const r = el.getBoundingClientRect();
    return { cls: String(el.className).split(/\s+/).pop(), w: Math.round(r.width), h: Math.round(r.height) };
  });
  return {
    join: box('.homepage-btn-join'),
    level: box('.menu-xp-level') || box('.menu-xp-lv') || box('.menu-xp-levelnum'),
    xpLabel: box('.menu-xp-label') || box('.menu-xp-readout'),
    rank: box('.menu-xp-rank'),
    cards,
    nav,
  };
};

const browser = await chromium.launch();
for (const [w, h, tag] of VIEWPORTS) {
  const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: w, height: h }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await installBackendMock(page);
  await page.goto('/?portal=1');
  await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
  await page.waitForTimeout(700);
  const m = await page.evaluate(MEASURE);
  console.log(`\n=== ${tag} ===`);

  // JOIN ROOM >= 48px tall
  if (m.join) {
    const ok = m.join.h >= 48;
    console.log(`  JOIN ROOM height        ${String(m.join.h).padStart(4)}px   ${ok ? 'PASS' : 'FAIL'}  (brief: >=48px)`);
  } else {
    console.log('  JOIN ROOM               not found');
  }

  // the spotlit card vs the others
  const spot = m.cards.find((c) => c.spotlit);
  const other = m.cards.find((c) => !c.spotlit);
  if (spot && other) {
    const ratio = spot.w / other.w;
    const single = Math.abs(m.cards[0].h - m.cards[m.cards.length - 1].h) < 4;
    console.log(
      `  spotlit / other card    ${ratio.toFixed(2)}x   ${ratio >= 1.4 ? 'PASS' : ratio > 1.02 ? 'PARTIAL' : 'EQUAL'}` +
        `  (brief: 1.5x on the single-row layout${single ? '' : '; this layout is multi-row, where equal is intended'})`
    );
  }

  // level numeral vs the XP label
  if (m.level && m.xpLabel) {
    const r = m.level.fs / m.xpLabel.fs;
    console.log(
      `  level fs / xp label fs  ${r.toFixed(2)}x   ${r >= 3 && r <= 4 ? 'PASS' : 'FAIL'}  (brief: 3-4x)  [${m.level.fs}px vs ${m.xpLabel.fs}px]`
    );
  } else {
    console.log(`  level / xp label        not both found (level=${!!m.level} label=${!!m.xpLabel})`);
  }

  // corner nav touch floor
  const small = m.nav.filter((n) => n.h < 44 || n.w < 44);
  console.log(`  corner nav >=44x44      ${m.nav.length} buttons, ${small.length} under floor   ${small.length ? 'FAIL ' + JSON.stringify(small) : 'PASS'}`);
  await ctx.close();
}
await browser.close();
