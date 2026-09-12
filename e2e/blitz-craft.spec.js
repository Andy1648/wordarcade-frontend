// e2e/blitz-craft.spec.js — THE CATEGORY BLITZ CRAFT GATE (feat/blitz-craft).
//
// Four deliverables and three per-screen constraints, each asserted against the live DOM at
// 1366x768, 1280x720, 390x844 and 320x640, on the round screen and the between-rounds
// results screen, at 2 and 4 players.
//
//   1  HERO      the category is the biggest type on the screen, 64-80px on a desktop, and
//                it never breaks a word to fit (the 320px case is the hard one).
//   2  JUDGE     ONE <img> from /public, whose src changes EXACTLY ONCE per verdict.
//   3  CLOCK     a block that shrinks by TRANSFORM (its layout width never changes) and
//                steps its VALUE at 50% and 20% remaining.
//   4  ANSWERS   the stack grows UPWARD (the newest line is the lowest, and adding one moves
//                the TOP up while the BOTTOM stays put) and the newest is the brightest.
//   A  ACCENT    exactly one element paints Blitz's accent (#FF6B3D).
//   B  NO SCROLL neither axis, any viewport, either screen.
//   C  NO OVERLAP no two named visible elements overlap by more than 4px on both axes.
//
// WHICH OF THESE WERE SEEN RED (they are gates, not decoration):
//   - HERO word-break: red at 320x640 ("SANDWICHES" laid out as "SANDWICHE / S").
//   - HERO 64-80px: red at 1280x720 (62.7px) before the hero spanned both columns.
//   - NO OVERLAP: red at 320x640 (the fixed +WINS pill over ROUND 1/3 by 16px; the combo
//     badge over the answer count by 22px).
//   - NO CLIP on the results board: red at 320x640 and 1366x768 with 4 players.
//   - CLOCK value step: red before the steps existed (all three steps returned one colour).
//
// NAMED ELEMENTS, NOT ANCESTORS. getBoundingClientRect on .game-stage does NOT include a
// fixed-position descendant that overflows it, and the two worst overlaps tonight were
// exactly that shape — so the overlap check names every out-of-flow participant directly.
import { test, expect } from '@playwright/test';
import { startBlitz, fillAnswers, VIEWPORTS, LONG_CATEGORY, SHORT_CATEGORY, SAMPLE_ANSWERS } from './support/blitz.js';

const ACCENT = 'rgb(255, 107, 61)';
const OVERLAP_TOL = 4;

// Every element the round screen actually paints, INCLUDING the out-of-flow ones.
const ROUND_ELEMENTS = [
  '.wins-hud',
  '.cb-eyebrow',
  '.cb-header .game-leave-btn',
  '.cb-header .audio-btn',
  '.cb-hero-round',
  '.cb-reroll-btn',
  '.cb-hero-word',
  '.cb-judge-art',
  '.cb-judge-label',
  '.cb-clock-track',
  '.cb-clock-num',
  '.cb-tally-label',
  '.cb-tally-count',
  '.combo-badge',
  '.cb-answer-stack',
  '.cb-input-row .game-input',
  '.cb-input-row .game-send-btn',
  '.cb-verdict-slot .game-toast',
  '.cb-rivals',
];
const RESULT_ELEMENTS = [
  '.wins-hud',
  '.cb-eyebrow',
  '.cb-header .game-leave-btn',
  '.cb-header .audio-btn',
  '.cb-hero-word',
  '.cb-judge-art',
  '.cb-judge-label',
  '.cb-results-board',
  '.cb-missed',
  '.cb-next-round',
];

/** Pairwise overlap of the NAMED selectors (first match each), in both axes, over the tol. */
async function overlaps(page, selectors) {
  return page.evaluate(({ sels, tol }) => {
    const seen = [];
    for (const s of sels) {
      const el = document.querySelector(s);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) continue;
      seen.push({ s, el, r });
    }
    const bad = [];
    for (let i = 0; i < seen.length; i += 1) {
      for (let j = i + 1; j < seen.length; j += 1) {
        const a = seen[i]; const b = seen[j];
        if (a.el.contains(b.el) || b.el.contains(a.el)) continue; // nesting is not overlap
        const dx = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
        const dy = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
        if (dx > tol && dy > tol) {
          bad.push(`${a.s} x ${b.s} = ${Math.round(dx)}x${Math.round(dy)}px`);
        }
      }
    }
    return { bad, found: seen.map((x) => x.s) };
  }, { sels: selectors, tol: OVERLAP_TOL });
}

const pageScroll = (page) => page.evaluate(() => ({
  x: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  y: document.documentElement.scrollHeight - document.documentElement.clientHeight,
}));

// ---------------------------------------------------------------------------
// 1. THE HERO
// ---------------------------------------------------------------------------
test.describe('1. the category is the hero', () => {
  for (const vp of VIEWPORTS) {
    test(`${vp.name}: the hero is the biggest type on the screen and never breaks a word`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await startBlitz(page, { players: 4, category: LONG_CATEGORY });

      const m = await page.evaluate(() => {
        const hero = document.querySelector('.cb-hero-word');
        if (!hero) return { err: 'no .cb-hero-word' };
        const cs = getComputedStyle(hero);
        const size = parseFloat(cs.fontSize);
        // The biggest font-size anywhere else on the stage.
        let rival = 0; let rivalSel = '';
        for (const el of document.querySelectorAll('.game-stage--blitz *')) {
          if (hero.contains(el) || el.contains(hero)) continue;
          if (!el.textContent || !el.textContent.trim()) continue;
          const s = parseFloat(getComputedStyle(el).fontSize);
          if (s > rival) { rival = s; rivalSel = el.className || el.tagName; }
        }
        // WOULD the longest word fit on one line? Measured in the hero's own resolved font,
        // against the hero's own content width — this is the exact question the browser asks
        // before it decides to break a word, so it catches the break without parsing lines.
        const ctx = document.createElement('canvas').getContext('2d');
        ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        // WIDEST, not longest. The word that actually broke at 320px was "SANDWICHES" (10
        // letters), not "POLITICIANS" (11) — Bungee's W and M are far wider than I and L, so
        // a character count is the wrong ruler. Measure every word and take the max.
        const wordPx = Math.max(
          ...hero.textContent.trim().split(/\s+/).map((w) => ctx.measureText(w).width)
        );
        const contentW = hero.clientWidth
          - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        return {
          size, rival, rivalSel, wordPx, contentW,
          clipped: hero.scrollWidth > hero.clientWidth + 1,
        };
      });

      expect(m.err).toBeUndefined();
      // eslint-disable-next-line no-console
      console.log(`[hero] ${vp.name} size=${m.size.toFixed(1)}px nextBiggest=${m.rival.toFixed(1)}px longestWord=${Math.round(m.wordPx)}px slot=${Math.round(m.contentW)}px`);

      expect(m.size, `the hero must be the biggest type on the screen (next biggest: ${m.rivalSel})`)
        .toBeGreaterThan(m.rival);
      // 64-80px is the specified band, and it holds wherever there is width for it.
      if (vp.width >= 1280) {
        expect(m.size, `hero size at ${vp.name}`).toBeGreaterThanOrEqual(64);
        expect(m.size, `hero size at ${vp.name}`).toBeLessThanOrEqual(80);
      }
      // NO MID-WORD BREAK, at any width. This is the one that was red at 320x640.
      expect(m.wordPx, `the longest word must fit the hero's slot at ${vp.name}`)
        .toBeLessThanOrEqual(m.contentW);
      expect(m.clipped, `the hero must not be horizontally clipped at ${vp.name}`).toBe(false);
    });
  }

  test('1366x768: a SHORT category takes the full 80px ceiling', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await startBlitz(page, { players: 2, category: SHORT_CATEGORY });
    const size = await page.locator('.cb-hero-word').evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
    expect(size).toBe(80);
  });
});

// ---------------------------------------------------------------------------
// 2. THE JUDGE
// ---------------------------------------------------------------------------
test.describe('2. the judge is one PNG with one swap per verdict', () => {
  test('one asset, one src change per verdict, no emote sequence', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    const api = await startBlitz(page, { players: 2 });

    const judge = page.locator('.cb-judge-art img');
    await expect(judge, 'exactly one judge image').toHaveCount(1);
    // ART VS MOTION: the judge is a real asset out of /public, not CSS shapes.
    const idleSrc = await judge.getAttribute('src');
    expect(idleSrc).toMatch(/^\/mascot-[a-z]+\.png$/);
    expect(idleSrc).toContain('idle');

    // An emote would layer an animation SEQUENCE on the swap. There must be none.
    const emoteClass = await page.locator('.cb-judge-art .mascot-emote').getAttribute('class');
    expect(emoteClass.trim(), 'the judge carries no emote class').toBe('mascot-emote');

    await api.accept('OCTOPUS');
    const okSrc = await page.locator('.cb-judge-art img').getAttribute('src');
    expect(okSrc, 'accept swaps the expression').not.toBe(idleSrc);
    expect(okSrc).toContain('celebrate');
    await expect(page.locator('.cb-judge-art img')).toHaveCount(1);

    await page.waitForTimeout(1200); // the swap holds ~1s, then returns
    expect(await page.locator('.cb-judge-art img').getAttribute('src')).toBe(idleSrc);

    await api.reject('BICYCLE');
    const noSrc = await page.locator('.cb-judge-art img').getAttribute('src');
    expect(noSrc).toContain('panic');
    await expect(page.locator('.cb-judge-art img'), 'still ONE image').toHaveCount(1);
  });
});

// ---------------------------------------------------------------------------
// 3. THE CLOCK
// ---------------------------------------------------------------------------
test.describe('3. the clock is a transform-driven block that steps its value', () => {
  test('shrinks by transform (layout width never changes) and steps at 50% and 20%', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    const api = await startBlitz(page, { players: 2, timerSeconds: 60 });

    // The block drains through a 1s linear transition. Wait for it to SETTLE before
    // reading, or a loaded run reads a mid-interpolation scaleX and the test flakes.
    const read = () => page.evaluate(async () => {
      const blk = document.querySelector('.cb-clock-block');
      await Promise.all(blk.getAnimations().map((a) => a.finished.catch(() => {})));
      return null;
    }).then(() => page.evaluate(() => {
      const b = document.querySelector('.cb-clock-block');
      const cs = getComputedStyle(b);
      return {
        step: document.querySelector('.cb-clock').dataset.step,
        layoutWidth: b.getBoundingClientRect().width / (new DOMMatrix(cs.transform).a || 1),
        cssWidth: cs.width,
        scaleX: new DOMMatrix(cs.transform).a,
        bg: cs.backgroundColor,
        radius: cs.borderRadius,
        numColor: getComputedStyle(document.querySelector('.cb-clock-num')).color,
      };
    }));

    await api.tick(60);
    const full = await read();
    await api.tick(30); // exactly 50% -> the first step
    const half = await read();
    await api.tick(11); // 18% -> the second step
    const fin = await read();

    // eslint-disable-next-line no-console
    console.log(`[clock] full=${full.step}/${full.bg} half=${half.step}/${half.bg} final=${fin.step}/${fin.bg} cssWidth=${full.cssWidth}/${fin.cssWidth}`);

    expect(full.step).toBe('full');
    expect(half.step).toBe('half');
    expect(fin.step).toBe('final');

    // THE VALUE STEPS. Three distinct values, and each brighter than the last.
    const lum = (rgb) => {
      const [r, g, b] = rgb.match(/\d+/g).map(Number);
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    expect(new Set([full.bg, half.bg, fin.bg]).size, 'three distinct clock values').toBe(3);
    expect(lum(half.bg)).toBeGreaterThan(lum(full.bg));
    expect(lum(fin.bg)).toBeGreaterThan(lum(half.bg));
    // The numeral steps on the same two thresholds.
    expect(new Set([full.numColor, half.numColor, fin.numColor]).size).toBe(3);

    // TRANSFORM, NOT WIDTH: the CSS width is identical at every step; only scaleX moves.
    expect(fin.cssWidth).toBe(full.cssWidth);
    expect(full.scaleX).toBeGreaterThan(0.95);
    expect(fin.scaleX).toBeLessThan(half.scaleX);
    expect(half.scaleX).toBeLessThan(full.scaleX);
    // Hard edges: the only softness allowed is the house 8px, and it lives on the TRACK.
    expect(fin.radius).toBe('0px');
  });
});

// ---------------------------------------------------------------------------
// 4. THE ANSWER STACK
// ---------------------------------------------------------------------------
test.describe('4. answers build upward, newest brightest', () => {
  test('the newest line is the lowest and the brightest, and the stack grows up', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    const api = await startBlitz(page, { players: 2 });

    await fillAnswers(api, SAMPLE_ANSWERS.slice(0, 2));
    const before = await page.evaluate(() => {
      const ls = [...document.querySelectorAll('.cb-answer-line')];
      return {
        top: Math.min(...ls.map((l) => l.getBoundingClientRect().top)),
        bottom: Math.max(...ls.map((l) => l.getBoundingClientRect().bottom)),
      };
    });

    await fillAnswers(api, SAMPLE_ANSWERS.slice(2, 4));
    const after = await page.evaluate(() => {
      const ls = [...document.querySelectorAll('.cb-answer-line')].map((l) => ({
        text: l.textContent.trim(),
        top: l.getBoundingClientRect().top,
        bottom: l.getBoundingClientRect().bottom,
        opacity: Number(getComputedStyle(l).opacity),
      }));
      return {
        lines: ls,
        top: Math.min(...ls.map((l) => l.top)),
        bottom: Math.max(...ls.map((l) => l.bottom)),
      };
    });

    // eslint-disable-next-line no-console
    console.log(`[stack] ${JSON.stringify(after.lines.map((l) => [l.text, Math.round(l.top), l.opacity.toFixed(2)]))}`);

    // GROWS UPWARD: the bottom stays put, the top rises.
    expect(Math.abs(after.bottom - before.bottom), 'the stack is bottom-anchored').toBeLessThanOrEqual(1);
    expect(after.top, 'the stack grows UPWARD').toBeLessThan(before.top);

    // NEWEST IS LOWEST.
    const newest = after.lines.reduce((a, b) => (b.bottom > a.bottom ? b : a));
    expect(newest.text).toBe(SAMPLE_ANSWERS[3]);
    // NEWEST IS BRIGHTEST, and every step above it is dimmer than the one below.
    const byPos = [...after.lines].sort((a, b) => b.top - a.top); // bottom-up
    for (let i = 1; i < byPos.length; i += 1) {
      expect(byPos[i].opacity, `line ${i} recedes`).toBeLessThan(byPos[i - 1].opacity);
    }
    expect(byPos[0].opacity).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// A / B / C — the per-screen constraints, everywhere.
// ---------------------------------------------------------------------------
for (const vp of VIEWPORTS) {
  for (const players of [2, 4]) {
    test(`round screen @ ${vp.name} ${players}p: one accent, no scroll, no overlap`, async ({ page }) => {
      test.setTimeout(60_000);
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const api = await startBlitz(page, { players, category: LONG_CATEGORY });
      await fillAnswers(api, SAMPLE_ANSWERS.slice(0, 4));
      for (const s of api.seats.slice(1)) await api.progress(s.id, 3);
      await api.tick(11); // final step, worst case for the clock numeral's width
      await api.accept('HORSESHOE CRAB');

      // A. ONE ACCENT.
      const accented = await page.evaluate((accent) => {
        const hits = [];
        for (const el of document.querySelectorAll('.game-stage--blitz *')) {
          // A PLAYER DOT IS NOT AN ACCENT. The five player-identity hues ARE the house
          // palette (src/playerColors.js), so whichever colour a mode picks, some seat
          // eventually wears it. The dot is an 8px identity token that follows a player
          // across every screen; excluding it is the only way this gate can be honest
          // about "one accent element" rather than about how many people are in the room.
          if (el.classList.contains('player-dot')) continue;
          const cs = getComputedStyle(el);
          const paints = cs.backgroundColor === accent;
          const inks = cs.color === accent && (el.textContent || '').trim().length > 0;
          if (!paints && !inks) continue;
          // Count the OUTERMOST element only: an inherited colour on a child span (the
          // hero's own SprayReveal wrapper) is the same one accent, not a second.
          let inherited = false;
          for (let a = el.parentElement; a && a.closest('.game-stage--blitz'); a = a.parentElement) {
            const acs = getComputedStyle(a);
            if (acs.backgroundColor === accent || acs.color === accent) { inherited = true; break; }
          }
          if (inherited) continue;
          hits.push(`${paints ? 'bg' : 'fg'}:${el.className}`);
        }
        return hits;
      }, ACCENT);
      // eslint-disable-next-line no-console
      console.log(`[accent] ${vp.name} ${players}p -> ${JSON.stringify(accented)}`);
      expect(accented.length, `exactly one accent element (${accented.join(', ')})`).toBe(1);
      expect(accented[0]).toContain('cb-hero-word');

      // B. NO PAGE SCROLL.
      const sc = await pageScroll(page);
      expect(sc, `no page scroll at ${vp.name}`).toEqual({ x: 0, y: 0 });

      // C. NO OVERLAP > 4px.
      const o = await overlaps(page, ROUND_ELEMENTS);
      // Guard against the silent-pass failure mode: a renamed class matches nothing.
      expect(o.found.length, `the overlap gate must actually find elements (${o.found.join(', ')})`)
        .toBeGreaterThanOrEqual(12);
      expect(o.bad, `overlaps at ${vp.name} ${players}p`).toEqual([]);
    });

    test(`results screen @ ${vp.name} ${players}p: every player visible, no scroll, no overlap`, async ({ page }) => {
      test.setTimeout(60_000);
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const api = await startBlitz(page, { players, category: LONG_CATEGORY });
      await fillAnswers(api, SAMPLE_ANSWERS.slice(0, 3));
      await api.roundEnd();
      await page.locator('.cb-results-board').waitFor({ state: 'visible' });

      // EVERY PLAYER'S ROW FULLY INSIDE THE BOARD. The board clips (overflow:hidden), so a
      // row that does not fit disappears silently — red at 320x640 and at 1366x768 with 4.
      const clipped = await page.evaluate(() => {
        const board = document.querySelector('.cb-results-board');
        const bb = board.getBoundingClientRect();
        return [...board.querySelectorAll('.cb-result-player')]
          .filter((r) => {
            const b = r.getBoundingClientRect();
            return b.bottom > bb.bottom + 1 || b.top < bb.top - 1;
          })
          .map((r) => r.textContent.trim().slice(0, 14));
      });
      expect(clipped, `no player row clipped at ${vp.name} ${players}p`).toEqual([]);
      await expect(page.locator('.cb-result-player')).toHaveCount(players);

      const sc = await pageScroll(page);
      expect(sc, `no page scroll on results at ${vp.name}`).toEqual({ x: 0, y: 0 });

      const o = await overlaps(page, RESULT_ELEMENTS);
      expect(o.found.length, `the results overlap gate must find elements (${o.found.join(', ')})`)
        .toBeGreaterThanOrEqual(6);
      expect(o.bad, `overlaps on results at ${vp.name} ${players}p`).toEqual([]);
    });
  }
}
