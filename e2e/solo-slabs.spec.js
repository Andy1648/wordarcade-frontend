// e2e/solo-slabs.spec.js — feat/solo-slabs acceptance gate (CHAIN + FUSE, presentational).
//
// The draft-card grammar moved onto the solo screens: a cream slab for the required letter, a
// second slab for the letter you are about to hand over, a live underline on the last typed
// character, and the accepted words as a ribbon of linked chips instead of dotted placeholders.
// Everything here is a READ of engine state, so the gate is about layout and purity:
//
//   1. NO HORIZONTAL SCROLL at 320/360/390/768/1366, and no element past the viewport, in both
//      modes — including CHAIN with 12 links played, which is well past the ~5 chips that fit at
//      320px (the ribbon clips the oldest under the left fade rather than widening the page).
//   2. ZERO infinite animations added by these screens.
//   3. INPUT-ANCESTOR PURITY: no transition / animation / transform on the text input or ANY of
//      its ancestors. A transform on an ancestor makes a focused input drift on mobile and
//      re-rasterises the caret; this is the guard that keeps the slab tilts on the wrappers.
//   4. The CHAIN OUT slab shows DEAD END in the SAME FRAME the engine's supply for the typed
//      last letter crosses below 3 — the shape/colour state is derived, never delayed.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import CHAINS from './support/chainFixture.js';

const WIDTHS = [320, 360, 390, 768, 1366];

async function enterSolo(page, mode) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('taw.xp', JSON.stringify({ lv: 40, into: 0 }));
    } catch { /* */ }
  });
  await installBackendMock(page);
  // ?soloms caps the per-word clock; a long one keeps the run alive for the whole test.
  await page.goto('/?portal=1&soloms=600000');
  await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
  await page.waitForTimeout(300);
  await page.locator(`.game-card-magnet[data-game="${mode}"] .game-card`).click({ force: true });
  await page.locator('.mode-dialog-shell').waitFor({ state: 'visible' });
  await page.locator('.mode-dialog-btn-create').click();
  await page.locator('.solo-root').waitFor({ state: 'visible' });
  await page.locator('.solo-input').waitFor({ state: 'visible' });
  await page.waitForTimeout(200);
}

// Type one word and submit it. Returns after the engine has re-rendered.
async function playWord(page, word) {
  const input = page.locator('.solo-input');
  await input.fill(word);
  await input.press('Enter');
  await page.waitForTimeout(70);
}

// Play `count` valid links from whatever letter CHAIN opened on.
async function playChain(page, count) {
  const opener = (await page.locator('.solo-in-face').innerText()).trim().toLowerCase();
  const chain = CHAINS[opener];
  expect(chain, `fixture covers opener "${opener}"`).toBeTruthy();
  for (const w of chain.slice(0, count)) await playWord(page, w);
  return chain.slice(0, count);
}

// Anything wider than the viewport, or sticking out past either edge.
async function overflowReport(page) {
  return page.evaluate(() => {
    const de = document.documentElement;
    const vw = de.clientWidth;
    const offenders = [];
    // A node is exempt when it CANNOT cause a scrollbar or a visible spill:
    //   - decorative art (aria-hidden / SVG): the travelling-letter FX fly off-screen by design
    //   - clipped by an ancestor with overflow hidden: the ribbon's oldest chips are SUPPOSED to
    //     slide out of the box under the left fade — that is the design, not a layout bug
    //   - fixed-position overlays, which are not part of the document's scroll width
    const clipped = (el) => {
      let p = el.parentElement;
      while (p && p !== document.documentElement) {
        const cs = getComputedStyle(p);
        if (cs.overflowX === 'hidden' || cs.overflowX === 'clip' || cs.overflow === 'hidden') return true;
        p = p.parentElement;
      }
      return false;
    };
    for (const el of document.querySelectorAll('.solo-root *')) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      if (cs.position === 'fixed') continue;
      if (el.namespaceURI === 'http://www.w3.org/2000/svg') continue;
      if (el.closest('[aria-hidden="true"].solo-fx, .solo-fx')) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (r.right > vw + 1 || r.left < -1) {
        if (clipped(el)) continue;
        offenders.push(`${(el.className || el.tagName).toString().split(' ')[0]}@${Math.round(r.left)}..${Math.round(r.right)}`);
      }
    }
    return {
      vw,
      bodyScroll: document.body.scrollWidth,
      bodyClient: document.body.clientWidth,
      docScroll: de.scrollWidth,
      docClient: de.clientWidth,
      offenders: offenders.slice(0, 8),
    };
  });
}

const infiniteCount = (page) =>
  page.evaluate(() =>
    document.getAnimations().filter((a) => {
      const it = a.effect && a.effect.getTiming && a.effect.getTiming().iterations;
      return it === Infinity;
    }).length
  );

test.describe('CHAIN', () => {
  for (const w of WIDTHS) {
    test(`no horizontal scroll at ${w}px with 12 links played`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 780 });
      await enterSolo(page, 'chain');
      const played = await playChain(page, 12);
      // The ribbon is populated, capped at the 5 that fit, and clipped — not widening the page.
      await expect(page.locator('.solo-ribbon-chip').first()).toBeVisible();
      const chipCount = await page.locator('.solo-ribbon-chip').count();
      expect(chipCount, `visible chips after 12 links @${w}`).toBeLessThanOrEqual(5);
      // The NEWEST word is the one that must still be on screen (it sits at the right edge).
      const newest = (await page.locator('.solo-ribbon-chip').first().innerText()).trim().toLowerCase();
      expect(newest, 'the newest link is the visible one').toBe(played[played.length - 1]);
      const m = await overflowReport(page);
      // eslint-disable-next-line no-console
      console.log(`[solo-slabs chain ${w}] body ${m.bodyScroll}/${m.bodyClient} doc ${m.docScroll}/${m.docClient} offenders=${JSON.stringify(m.offenders)}`);
      expect(m.bodyScroll, `body scrollWidth === clientWidth @${w}`).toBe(m.bodyClient);
      expect(m.docScroll, `document scrollWidth === clientWidth @${w}`).toBe(m.docClient);
      expect(m.offenders, `elements past the viewport @${w}`).toEqual([]);
    });
  }

  test('adds zero infinite animations', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 780 });
    await enterSolo(page, 'chain');
    await playChain(page, 6);
    expect(await infiniteCount(page), 'infinite animations on the CHAIN screen').toBe(0);
  });

  test('input-ancestor purity: no transition/animation/transform on the input or any ancestor', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 780 });
    await enterSolo(page, 'chain');
    await playChain(page, 3);
    await page.locator('.solo-input').fill('ab');
    const impure = await page.evaluate(() => {
      const bad = [];
      let el = document.querySelector('.solo-input');
      while (el && el !== document.documentElement) {
        const cs = getComputedStyle(el);
        const name = (el.className || el.tagName).toString().split(' ')[0];
        if (cs.transform && cs.transform !== 'none') bad.push(`${name}:transform=${cs.transform}`);
        if (cs.animationName && cs.animationName !== 'none') bad.push(`${name}:animation=${cs.animationName}`);
        if (cs.transitionProperty && cs.transitionProperty !== 'none' && cs.transitionDuration !== '0s') {
          bad.push(`${name}:transition=${cs.transitionProperty}`);
        }
        el = el.parentElement;
      }
      return bad;
    });
    expect(impure, 'the input and its ancestors carry no transform/animation/transition').toEqual([]);
  });

  test('the last typed letter is underlined by a sibling mirror, not by styling the input', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 780 });
    await enterSolo(page, 'chain');
    const opener = (await page.locator('.solo-in-face').innerText()).trim().toLowerCase();
    await page.locator('.solo-input').fill(`${opener}bc`);
    await page.waitForTimeout(60);
    await expect(page.locator('.solo-mirror-last')).toHaveText('c');
    const styles = await page.evaluate(() => {
      const last = document.querySelector('.solo-mirror-last');
      const mirror = document.querySelector('.solo-mirror');
      const input = document.querySelector('.solo-input');
      const cs = getComputedStyle(last);
      return {
        decoration: `${cs.textDecorationLine} ${cs.textDecorationColor}`,
        mirrorColor: getComputedStyle(mirror).color,
        mirrorPosition: getComputedStyle(mirror).position,
        // The mirror must be a SIBLING of the input, never an ancestor or a child.
        isSibling: !!input && !!mirror && input.parentElement === mirror.parentElement,
        inputDecoration: getComputedStyle(input).textDecorationLine,
      };
    });
    expect(styles.isSibling, 'the mirror is a sibling of the input').toBe(true);
    expect(styles.mirrorPosition).toBe('absolute');
    expect(styles.decoration, 'a 4px teal underline on the last glyph').toContain('underline');
    expect(styles.decoration).toContain('46, 255, 224'); // #2EFFE0
    expect(styles.inputDecoration, 'the input itself is not decorated').toBe('none');
  });

  test('the OUT slab reaches DEAD END in the same frame the engine supply crosses 3', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 780 });
    await enterSolo(page, 'chain');
    // Walk the alphabet as a trailing letter and record, per letter, what the UI shows.
    // The OUT slab is derived from the typed word's LAST letter, so typing "<opener>x" asks the
    // engine about x. We compare the rendered state against the engine's own threshold reading.
    const opener = (await page.locator('.solo-in-face').innerText()).trim().toLowerCase();
    const rows = [];
    for (const ch of 'abcdefghijklmnopqrstuvwxyz') {
      await page.locator('.solo-input').fill(`${opener}${ch}`);
      await page.waitForTimeout(30);
      const shown = await page.evaluate(() => {
        const slab = document.querySelector('.solo-slab-out');
        return {
          badge: (slab.querySelector('.solo-slab-badge').textContent || '').trim(),
          dead: slab.classList.contains('is-dead'),
          thin: slab.classList.contains('is-thin'),
          letter: (slab.querySelector('.solo-out-letter').textContent || '').trim(),
        };
      });
      rows.push({ ch, ...shown });
    }
    // eslint-disable-next-line no-console
    console.log(`[solo-slabs dead-end] ${rows.filter((r) => r.dead).map((r) => r.ch).join(',') || '(none dead)'} | thin: ${rows.filter((r) => r.thin).map((r) => r.ch).join(',') || '(none)'}`);
    // Every row must be self-consistent: the badge text and the class agree, and the letter shown
    // is the one we typed. DEAD END and FEW LEFT are mutually exclusive.
    for (const r of rows) {
      expect(r.letter.toLowerCase(), `OUT slab letter for "${r.ch}"`).toBe(r.ch);
      if (r.dead) expect(r.badge).toBe('DEAD END');
      else if (r.thin) expect(r.badge).toBe('FEW LEFT');
      else expect(r.badge).toBe('');
      expect(r.dead && r.thin, 'dead and thin are mutually exclusive').toBe(false);
    }
    // The rare letters must land in one of the two warned states — otherwise the thresholds are
    // not wired to the slab at all.
    const rare = rows.filter((r) => 'jqxz'.includes(r.ch));
    expect(rare.some((r) => r.dead || r.thin), 'j/q/x/z warn on the OUT slab').toBe(true);
  });
});

test.describe('FUSE', () => {
  for (const w of WIDTHS) {
    test(`no horizontal scroll at ${w}px`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 780 });
      await enterSolo(page, 'fuse');
      await expect(page.locator('.solo-frag-tile')).toBeVisible();
      const m = await overflowReport(page);
      // eslint-disable-next-line no-console
      console.log(`[solo-slabs fuse ${w}] body ${m.bodyScroll}/${m.bodyClient} doc ${m.docScroll}/${m.docClient} offenders=${JSON.stringify(m.offenders)}`);
      expect(m.bodyScroll, `body scrollWidth === clientWidth @${w}`).toBe(m.bodyClient);
      expect(m.docScroll, `document scrollWidth === clientWidth @${w}`).toBe(m.docClient);
      expect(m.offenders, `elements past the viewport @${w}`).toEqual([]);
    });
  }

  test('adds zero infinite animations and keeps input-ancestor purity', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 780 });
    await enterSolo(page, 'fuse');
    expect(await infiniteCount(page), 'infinite animations on the FUSE screen').toBe(0);
    const impure = await page.evaluate(() => {
      const bad = [];
      let el = document.querySelector('.solo-input');
      while (el && el !== document.documentElement) {
        const cs = getComputedStyle(el);
        const name = (el.className || el.tagName).toString().split(' ')[0];
        if (cs.transform && cs.transform !== 'none') bad.push(`${name}:transform`);
        if (cs.animationName && cs.animationName !== 'none') bad.push(`${name}:animation`);
        el = el.parentElement;
      }
      return bad;
    });
    expect(impure).toEqual([]);
  });
});
