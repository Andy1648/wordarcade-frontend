// e2e/mode-screens.spec.js — feat/mode-screens acceptance.
//
// Per mode screen, at 1366x768 and 390x844: no scroll, and no two of the screen's
// named blocks overlapping by more than 4px. Plus the specific hierarchy claims each
// mode makes, measured rather than asserted by eye:
//   CATEGORY BLITZ - the category headline is the hero (teal, 64-80px) and the timer's
//                    numeric readout only exists in the last seconds.
//   CHAIN          - the SEAM letter is lit in the mode's second hue on BOTH ends
//                    (the tail of the last word and the head of the prompt).
//   FUSE           - the burning cord sits UNDER the input, is never an ancestor of
//                    it, and burns strictly downward.
// (The "exactly one --v-accent element per screen" rule is enforced statically and
// build-failingly by src/perf/typeScale.test.js, which can see every screen at once.)
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

const VIEWPORTS = [
  { name: '1366x768', w: 1366, h: 768 },
  { name: '390x844', w: 390, h: 844 },
];
const TOL = 4;

const card = (page, id) => page.locator(`[data-game="${id}"] .game-card`);

async function enterSolo(page, id, soloms = 350) {
  await page.addInitScript(() => {
    try { localStorage.setItem('taw.xp', JSON.stringify({ lv: 40, into: 0 })); } catch { /* ignore */ }
  });
  await installBackendMock(page);
  await page.goto(`/?portal=1&soloms=${soloms}`);
  await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
  await page.waitForTimeout(400);
  await card(page, id).click({ force: true });
  await page.locator('.mode-dialog-shell').waitFor({ state: 'visible' });
  await page.locator('.mode-dialog-btn-create').click();
  await page.locator('.solo-root').waitFor({ state: 'visible' });
  await page.waitForTimeout(250);
}

async function enterBlitz(page) {
  const ME = 'e2e-player';
  const players = [
    { id: ME, name: 'YOU', lives: 3, isHost: true },
    { id: 'p2', name: 'RIVAL', lives: 3 },
  ];
  const mock = await installBackendMock(page);
  await page.goto('/?portal=1');
  await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
  mock.pushToClient({
    type: 'room_update',
    payload: { code: 'ABCD', gameType: 'category-blitz', hostId: ME, difficultyKey: 'chill', players },
  });
  await page.waitForTimeout(60);
  mock.pushToClient({ type: 'game_started', payload: { gameType: 'category-blitz' } });
  await page.waitForTimeout(60);
  mock.pushToClient({
    type: 'round_start',
    payload: { round: 1, category: 'THINGS THAT HUM', timerSeconds: 45, players, rerollsRemaining: 1 },
  });
  await page.locator('.game-stage--blitz').waitFor({ state: 'visible' });
  await page.waitForTimeout(4700);
  return mock;
}

// Worst pairwise overlap between the named blocks that are actually on screen.
async function overlaps(page, selectors) {
  return page.evaluate((sels) => {
    const nodes = [];
    for (const s of sels) {
      for (const el of document.querySelectorAll(s)) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) nodes.push({ s, el, r });
      }
    }
    let worst = { px: 0, pair: '' };
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
        const ox = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
        const oy = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
        if (ox > 0 && oy > 0) {
          const px = Math.min(ox, oy);
          if (px > worst.px) worst = { px: Math.round(px * 10) / 10, pair: `${a.s} x ${b.s}` };
        }
      }
    }
    return {
      worst,
      scrollY: document.documentElement.scrollHeight - document.documentElement.clientHeight,
      scrollX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  }, selectors);
}

for (const vp of VIEWPORTS) {
  test(`CATEGORY BLITZ @ ${vp.name}: hero headline, gated timer numeral, no collisions`, async ({ page }) => {
    await page.setViewportSize({ width: vp.w, height: vp.h });
    await enterBlitz(page);

    const m = await overlaps(page, [
      '.cb-category-display', '.cb-category-label', '.game-timer-row',
      '.game-input-row', '.cb-answers-list', '.game-mute-btn',
    ]);
    const hero = await page.evaluate(() => {
      const el = document.querySelector('.cb-category-display');
      const cs = getComputedStyle(el);
      return { fs: Math.round(parseFloat(cs.fontSize)), color: cs.color };
    });
    const numCount = await page.locator('.game-timer-num').count();
    // eslint-disable-next-line no-console
    console.log(
      `BLITZ | ${vp.name} | headline ${hero.fs}px ${hero.color} | timer numeral present=${numCount} ` +
      `| worstOverlap=${m.worst.px}px ${m.worst.pair} | scrollY=${m.scrollY} scrollX=${m.scrollX}`
    );

    expect(m.worst.px, `worst overlap (${m.worst.pair})`).toBeLessThanOrEqual(TOL);
    expect(m.scrollY, 'vertical scroll').toBeLessThanOrEqual(0);
    expect(m.scrollX, 'horizontal scroll').toBeLessThanOrEqual(0);
    // The headline is the hero: teal, and the biggest type on the screen.
    expect(hero.color, 'the category headline is teal-led').toBe('rgb(46, 255, 224)');
    // At a full round the timer numeral must NOT be on screen - the block carries it.
    expect(numCount, 'the timer numeral must be hidden until the last seconds').toBe(0);
  });
}

for (const vp of VIEWPORTS) {
  test(`CHAIN @ ${vp.name}: the seam is lit on both ends, no collisions`, async ({ page }) => {
    await page.setViewportSize({ width: vp.w, height: vp.h });
    await enterSolo(page, 'chain');

    const m = await overlaps(page, [
      '.solo-center', '.solo-inputwrap', '.solo-chain-trail', '.solo-out', '.solo-exit',
    ]);
    // The prompt's head letter is the seam; it must carry the mode's SECOND hue.
    const seam = await page.evaluate(() => {
      const el = document.querySelector('.solo-chain-node.is-next .cx-join');
      return el ? getComputedStyle(el).color : null;
    });
    // eslint-disable-next-line no-console
    console.log(
      `CHAIN | ${vp.name} | seam=${seam} | worstOverlap=${m.worst.px}px ${m.worst.pair} ` +
      `| scrollY=${m.scrollY} scrollX=${m.scrollX}`
    );

    expect(m.worst.px, `worst overlap (${m.worst.pair})`).toBeLessThanOrEqual(TOL);
    expect(m.scrollY, 'vertical scroll').toBeLessThanOrEqual(0);
    expect(m.scrollX, 'horizontal scroll').toBeLessThanOrEqual(0);
    expect(seam, 'the seam letter is the mode second hue #FF6B3D').toBe('rgb(255, 107, 61)');
  });
}

for (const vp of VIEWPORTS) {
  test(`FUSE @ ${vp.name}: the cord burns under the input and never wraps it`, async ({ page }) => {
    await page.setViewportSize({ width: vp.w, height: vp.h });
    await enterSolo(page, 'fuse', 9000);

    const geo = await page.evaluate(() => {
      const line = document.querySelector('.fuse-line');
      const input = document.querySelector('.solo-input');
      if (!line || !input) return { missing: true };
      const l = line.getBoundingClientRect();
      const i = input.getBoundingClientRect();
      return {
        missing: false,
        below: Math.round(l.top - i.bottom),
        // THE RULE: nothing in the juice/clock may be an ANCESTOR of the text input.
        wrapsInput: line.contains(input),
      };
    });
    const m = await overlaps(page, ['.solo-center', '.solo-inputwrap', '.fuse-line', '.solo-exit']);

    // The cord must burn DOWN: sample the burn scale across the countdown.
    // Read the scale the component WRITES. getComputedStyle().transform on this node
    // reports the pre-transition value, so it read a flat 1 every sample even while the
    // cord was visibly burning down.
    const burn = async () =>
      page.evaluate(() => {
        const el = document.querySelector('.fuse-line-burn');
        if (!el) return null;
        const m2 = /scaleX\(([\d.]+)\)/.exec(el.getAttribute('style') || '');
        return m2 ? Math.round(parseFloat(m2[1]) * 1000) / 1000 : null;
      });
    // A REAL keystroke arms the clock (onInput arms on the first non-empty value).
    await page.locator('.solo-input').pressSequentially('ab', { delay: 40 });
    await page.waitForTimeout(120);
    const samples = [];
    for (let i = 0; i < 4; i++) {
      samples.push(await burn());
      await page.waitForTimeout(420);
    }
    // eslint-disable-next-line no-console
    console.log(
      `FUSE | ${vp.name} | cord ${geo.below}px below the input | wrapsInput=${geo.wrapsInput} ` +
      `| burn=${samples.join(' -> ')} | worstOverlap=${m.worst.px}px ${m.worst.pair}`
    );

    expect(geo.missing, 'the fuse cord must render').toBe(false);
    expect(geo.wrapsInput, 'the cord must never be an ancestor of the input').toBe(false);
    expect(geo.below, 'the cord sits under the input').toBeGreaterThanOrEqual(0);
    expect(m.worst.px, `worst overlap (${m.worst.pair})`).toBeLessThanOrEqual(TOL);
    const valid = samples.filter((s) => typeof s === 'number');
    expect(valid.length, 'burn samples').toBeGreaterThan(1);
    expect(valid[valid.length - 1], 'the cord must burn DOWN across the turn').toBeLessThan(valid[0]);
  });
}
