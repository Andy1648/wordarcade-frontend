// e2e/solo-phone-overlap.spec.js — fix/solo-phone-overlap GATE.
//
// Three regressions were measured on the preview during a real CHAIN run on a phone:
//   1. the wins badge overlapped the timer ring (120x27px @390x844, 120x39px @320x640)
//   2. the ribbon's newest chip ran under the fixed sound toggle (32x30 @390, 33x43 @320)
//   3. the supply hint ("N common words start with E") overlapped the input's own text
//
// This gate plays a REAL 4-link CHAIN run at 320x640 / 390x844 / 1366x768 and asserts:
//   * ZERO pairwise overlap greater than 4px in BOTH axes among the six chrome boxes
//     (input, supply hint, wins badge, timer ring, ribbon, sound button)
//   * the ribbon's NEWEST (right-most) chip is fully inside the viewport
//   * scrollWidth === clientWidth (no horizontal scroll)
// The rect table is printed for every viewport so a reviewer can read the numbers off the log.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import CHAINS from './support/chainFixture.js';

const VIEWPORTS = [
  { w: 320, h: 640 },
  { w: 390, h: 844 },
  { w: 1366, h: 768 },
];

// The six boxes that must not collide. Order matters only for the printed table.
const BOXES = [
  ['input', '.solo-input'],
  ['supplyHint', '.solo-supply'],
  ['winsBadge', '.solo-hud-wins'],
  ['timerRing', '.solo-clock'],
  ['ribbon', '.solo-ribbon-wrap'],
  ['soundBtn', '.audio-btn'],
];

async function enterChain(page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('taw.xp', JSON.stringify({ lv: 40, into: 0 }));
    } catch { /* */ }
  });
  await installBackendMock(page);
  await page.goto('/?portal=1&soloms=600000');
  await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
  await page.waitForTimeout(300);
  await page.locator('.game-card-magnet[data-game="chain"] .game-card').click({ force: true });
  await page.locator('.mode-dialog-shell').waitFor({ state: 'visible' });
  await page.locator('.mode-dialog-btn-create').click();
  await page.locator('.solo-root').waitFor({ state: 'visible' });
  await page.locator('.solo-input').waitFor({ state: 'visible' });
  await page.waitForTimeout(200);
}

async function playChain(page, count) {
  const opener = (await page.locator('.solo-in-face').innerText()).trim().toLowerCase();
  const chain = CHAINS[opener];
  expect(chain, `fixture covers opener "${opener}"`).toBeTruthy();
  for (const w of chain.slice(0, count)) {
    const input = page.locator('.solo-input');
    await input.fill(w);
    await input.press('Enter');
    await page.waitForTimeout(80);
  }
}

// Measure every box + the newest ribbon chip, in the page.
function measure(boxes) {
  const r1 = (n) => Math.round(n * 10) / 10;
  const rect = (el) => {
    const b = el.getBoundingClientRect();
    return { x: r1(b.left), y: r1(b.top), w: r1(b.width), h: r1(b.height), right: r1(b.right), bottom: r1(b.bottom) };
  };
  const out = { boxes: {}, missing: [] };
  for (const [name, sel] of boxes) {
    const el = document.querySelector(sel);
    if (!el) { out.missing.push(name); continue; }
    const b = el.getBoundingClientRect();
    // A zero-area box cannot collide with anything; record it but skip it in the pairs.
    out.boxes[name] = { ...rect(el), zero: b.width < 1 || b.height < 1 };
  }
  // The ribbon's NEWEST chip is the right-most one (the row is row-reverse).
  const chips = [...document.querySelectorAll('.solo-ribbon-chip')];
  out.chipCount = chips.length;
  if (chips.length) {
    let best = chips[0];
    for (const c of chips) if (c.getBoundingClientRect().right > best.getBoundingClientRect().right) best = c;
    out.newestChip = rect(best);
    out.newestChipText = best.innerText.trim();
  }
  out.vw = document.documentElement.clientWidth;
  out.vh = document.documentElement.clientHeight;
  out.scrollWidth = document.documentElement.scrollWidth;
  out.clientWidth = document.documentElement.clientWidth;
  return out;
}

// Rectangle intersection. An overlap only counts as a COLLISION when it exceeds the
// tolerance on BOTH axes — a 1px shared edge is not a visual collision.
function overlap(a, b) {
  const iw = Math.min(a.right, b.right) - Math.max(a.x, b.x);
  const ih = Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y);
  if (iw <= 0 || ih <= 0) return null;
  return { w: Math.round(iw * 10) / 10, h: Math.round(ih * 10) / 10 };
}

const TOL = 4;

for (const { w, h } of VIEWPORTS) {
  test(`solo phone chrome does not collide @ ${w}x${h} (real CHAIN run, 4 links)`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await enterChain(page);
    await playChain(page, 4);
    await page.waitForTimeout(150);

    const m = await page.evaluate(measure, BOXES);

    // ---- printed rect table -------------------------------------------------------
    const rows = Object.entries(m.boxes).map(([k, b]) =>
      `    ${k.padEnd(11)} x=${String(b.x).padStart(7)} y=${String(b.y).padStart(7)} w=${String(b.w).padStart(6)} h=${String(b.h).padStart(6)}${b.zero ? '  (zero-area)' : ''}`);
    if (m.newestChip) {
      const c = m.newestChip;
      rows.push(`    ${'newestChip'.padEnd(11)} x=${String(c.x).padStart(7)} y=${String(c.y).padStart(7)} w=${String(c.w).padStart(6)} h=${String(c.h).padStart(6)}  "${m.newestChipText}"`);
    }
    // eslint-disable-next-line no-console
    console.log(`[solo-phone-overlap ${w}x${h}] vw=${m.vw} vh=${m.vh} chips=${m.chipCount} scrollW=${m.scrollWidth} clientW=${m.clientWidth}\n${rows.join('\n')}`);

    expect(m.missing, `all chrome boxes present @${w}x${h}`).toEqual([]);

    // ---- pairwise collisions ------------------------------------------------------
    const names = Object.keys(m.boxes).filter((k) => !m.boxes[k].zero);
    const collisions = [];
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const o = overlap(m.boxes[names[i]], m.boxes[names[j]]);
        if (o && o.w > TOL && o.h > TOL) collisions.push(`${names[i]} x ${names[j]} = ${o.w}x${o.h}px`);
      }
    }
    // eslint-disable-next-line no-console
    if (collisions.length) console.log(`[solo-phone-overlap ${w}x${h}] COLLISIONS: ${collisions.join(' | ')}`);
    expect(collisions, `pairwise overlaps >${TOL}px @${w}x${h}`).toEqual([]);

    // ---- the newest chip must be fully on screen ----------------------------------
    expect(m.newestChip, `a ribbon chip is rendered @${w}x${h}`).toBeTruthy();
    expect(m.newestChip.x, `newest chip left inside viewport @${w}x${h}`).toBeGreaterThanOrEqual(0);
    expect(m.newestChip.right, `newest chip right inside viewport (vw ${m.vw}) @${w}x${h}`).toBeLessThanOrEqual(m.vw);

    // ---- no horizontal scroll ------------------------------------------------------
    expect(m.scrollWidth, `scrollWidth === clientWidth @${w}x${h}`).toBe(m.clientWidth);
  });
}
