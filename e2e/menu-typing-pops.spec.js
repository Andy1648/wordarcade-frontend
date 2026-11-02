// e2e/menu-typing-pops.spec.js
//
// Andy oct6 (fix/menu-typing-pops): the v2 menu (PR #215) added a centre "TYPE ANYTHING" text box that
// echoed what you typed. It is gone. Typing anywhere on the menu still earns XP, and what you type shows
// ONLY as the pre-v2 letter pops: MenuXpFx's pooled "[LETTER] +N" nodes (src/components/MenuXp.jsx,
// unchanged from 40ac7bf^1), fed by useXpCapture.
//
// At the desktop width (1366×657) and the phone width (390×844) this asserts:
//   - no typed-text box exists (no .hp-typed / .hp-typed-text, no "TYPE ANYTHING" text), and the
//     desktop's held slot stays empty while typing;
//   - each typed letter lands in a .menu-xp-pop as "[LETTER]" + "+N" with a RUNNING finite WAAPI
//     animation that touches transform/opacity only;
//   - the pops come from the fixed pool (the node count never grows with keystrokes);
//   - the keystrokes credited XP (the stored progress moved).
// Motion is ON here (no-preference) so the live animation is what gets checked.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';

test.use({ reducedMotion: 'no-preference' });

const POP_POOL = 28; // MenuXp.jsx POP_POOL

for (const vp of [{ width: 1366, height: 657 }, { width: 390, height: 844 }]) {
  test(`typing on the menu pops "[KEY] +N XP" and no centre text box @ ${vp.width}x${vp.height}`, async ({ page }) => {
    await page.setViewportSize(vp);
    await installBackendMock(page);
    await page.goto('/?portal=1');
    await menuReady(page);
    await page.locator('.menu-xp-fx').waitFor({ state: 'attached' });

    const noBox = async () => {
      await expect(page.locator('.hp-typed, .hp-typed-text, .hp-typed-hint, .hp-typed-caret')).toHaveCount(0);
      await expect(page.getByText('TYPE ANYTHING', { exact: false })).toHaveCount(0);
    };
    await noBox();
    await expect(page.locator('.menu-xp-pop')).toHaveCount(POP_POOL);
    const xpBefore = await page.evaluate(() => localStorage.getItem('taw.xp'));

    // Paced under the shared 12-letters-a-second cap, so every key credits and pops.
    for (const k of ['w', 'o', 'r', 'd']) {
      await page.keyboard.press(k);
      await page.waitForTimeout(120);
    }

    const pops = await page.evaluate(() =>
      [...document.querySelectorAll('.menu-xp-pop')]
        .map((el) => {
          const anims = el.getAnimations().filter((a) => a.playState === 'running');
          const props = new Set();
          for (const a of anims) {
            for (const kf of a.effect.getKeyframes()) {
              for (const p of Object.keys(kf)) if (!['offset', 'easing', 'composite', 'computedOffset'].includes(p)) props.add(p);
            }
          }
          return {
            letter: el.children[0] ? el.children[0].textContent : '',
            plus: el.children[1] ? el.children[1].textContent : '',
            running: anims.length,
            finite: anims.every((a) => Number.isFinite(a.effect.getComputedTiming().endTime)),
            props: [...props],
          };
        })
        .filter((p) => p.running > 0)
    );
    // nov2 (Andy: "we still need the letters"): a key pops the KEY it was — "[KEY] +N XP" (oct10 had dropped the letter;
    // the +N still says what it paid). The last keys are still mid-flight.
    expect(pops.length).toBeGreaterThan(0);
    for (const p of pops) {
      expect(p.plus).toMatch(/^(CRIT \+\d.*|\+[\d,.]+[A-Z]* XP)$/);
      if (!/^CRIT/.test(p.plus)) expect(p.letter.toLowerCase(), 'a plain pop shows its typed key').toMatch(/^[word]$/);
      expect(p.finite).toBe(true);
      expect(p.props.every((x) => x === 'transform' || x === 'opacity')).toBe(true);
    }

    // Pooled: no node per keystroke.
    await expect(page.locator('.menu-xp-pop')).toHaveCount(POP_POOL);
    // Still no box after typing, and the desktop's held slot never shows text.
    await noBox();
    // Andy oct6: the TYPE ANYTHING row is gone ENTIRELY — no held slot either; the cards take the room.
    await expect(page.locator('.hp-typed-slot')).toHaveCount(0);
    // Typing anywhere still credits XP.
    const xpAfter = await page.evaluate(() => localStorage.getItem('taw.xp'));
    expect(xpAfter).not.toBe(xpBefore);
  });
}

// oct28 (Andy: "dont do anything with the number boxes bc when they disappear (like stretch or smthn) it looks goofy"):
// the +N box keeps ONE size its whole life — every keyframe has the same scale — and only fades + rises a little.
test('a key pop never scales or stretches its number box', async ({ page }) => {
  await installBackendMock(page);
  await page.goto('/?portal=1');
  await menuReady(page);
  await page.locator('.menu-xp-fx').waitFor({ state: 'attached' });
  await page.keyboard.press('w');
  await page.waitForTimeout(60);
  const arc = await page.evaluate(() => {
    const a = [...document.querySelectorAll('.menu-xp-pop')].flatMap((e) => e.getAnimations()).find((x) => x.playState === 'running');
    if (!a) return null;
    const kf = a.effect.getKeyframes();
    return {
      scales: kf.map((f) => /scale\(([^)]*)\)/.exec(f.transform)[1]),
      ys: kf.map((f) => +/translateY\((-?[\d.]+)px/.exec(f.transform)[1]),
      opacity: kf.map((f) => +f.opacity),
      ms: a.effect.getTiming().duration,
    };
  });
  expect(arc).not.toBeNull();
  expect(new Set(arc.scales).size, `one size: ${arc.scales}`).toBe(1);
  expect(arc.scales[0]).not.toContain(','); // never a non-uniform (stretch) scale
  expect(arc.opacity[0]).toBe(0);
  expect(arc.opacity[arc.opacity.length - 1]).toBe(0);
  expect(Math.min(...arc.ys)).toBeGreaterThanOrEqual(-24); // a small drift, not a launch
  expect(arc.ms).toBeGreaterThanOrEqual(1200);
});

// oct28 (Andy: "at a certain amount of key animations … i think all animations just get cleared … looks buggy"): a 30
// keys/sec mash for 10s — level-ups included — never wipes the screen. Over the cap the OLDEST pop fades out (it is
// fast-forwarded into its fade tail), one per key; no pop is ever cancelled while it is still visible, and a level-up
// leaves the live pops to finish their own fade.
test('a 10s mash recycles the oldest pop with a fade — never a mass clear', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1366, height: 657 });
  await installBackendMock(page);
  await page.goto('/?portal=1');
  await menuReady(page);
  await page.locator('.menu-xp-fx').waitFor({ state: 'attached' });
  await page.evaluate(() => {
    // every cancel() of a pop that is still visibly on screen is a hard cut
    const pops = new Set([...document.querySelectorAll('.menu-xp-pop')]);
    window.__cuts = 0;
    const cancel = Animation.prototype.cancel;
    Animation.prototype.cancel = function () {
      const t = this.effect && this.effect.target;
      if (pops.has(t) && this.playState === 'running' && +getComputedStyle(t).opacity > 0.5) window.__cuts++;
      return cancel.call(this);
    };
    window.__samples = [];
    const tick = () => {
      window.__samples.push([...pops].filter((el) => +getComputedStyle(el).opacity > 0.05).length);
      window.__raf = requestAnimationFrame(tick);
    };
    tick();
  });
  const keys = 'abcdefghijklmnopqrstuvwxyz';
  for (let n = 0; n < 300; n++) {
    await page.keyboard.press(keys[n % keys.length]);
    await page.waitForTimeout(33);
  }
  const { samples, cuts, nodes } = await page.evaluate(() => {
    cancelAnimationFrame(window.__raf);
    return { samples: window.__samples, cuts: window.__cuts, nodes: document.querySelectorAll('.menu-xp-pop').length };
  });
  expect(nodes).toBe(POP_POOL); // still the fixed pool
  expect(cuts, 'pops hard-cut while visible').toBe(0);
  // after the first second of the mash the screen always holds pops, and no frame loses more than a few at once
  const busy = samples.slice(60);
  expect(Math.min(...busy), 'the screen emptied mid-mash').toBeGreaterThanOrEqual(2);
  let worst = 0;
  for (let n = 1; n < busy.length; n++) worst = Math.max(worst, busy[n - 1] - busy[n]);
  expect(worst, 'pops vanished at once').toBeLessThanOrEqual(4);
});

// nov2 (Andy: "we still need the letters"): the KEY slams in from small on its own finite WAAPI (transform / opacity on
// the letter span alone), while the +N beside it keeps ONE size; the CRIT's key is a step bigger than a plain key's.
test('a plain key pop: the typed letter slams in from small; its +N never scales; a crit key is bigger', async ({ page }) => {
  await installBackendMock(page);
  await page.goto('/?portal=1');
  await menuReady(page);
  await page.locator('.menu-xp-fx').waitFor({ state: 'attached' });
  await page.keyboard.press('k');
  await page.waitForTimeout(40);
  const r = await page.evaluate(() => {
    const pop = [...document.querySelectorAll('.menu-xp-pop.is-key')].find((e) => e.getAnimations().some((a) => a.playState === 'running'));
    if (!pop) return null;
    const key = pop.querySelector('.menu-xp-pop-letter');
    const ka = key.getAnimations()[0];
    const kf = ka ? ka.effect.getKeyframes() : [];
    const scales = (el) => el.getAnimations().flatMap((a) => a.effect.getKeyframes().map((f) => (/scale\(([^)]*)\)/.exec(f.transform) || [])[1]));
    return {
      key: key.textContent,
      first: kf.length ? +/scale\(([\d.]+)\)/.exec(kf[0].transform)[1] : null,
      finite: !!ka && Number.isFinite(ka.effect.getComputedTiming().endTime),
      ms: ka ? ka.effect.getTiming().duration : 0,
      props: [...new Set(kf.flatMap((f) => Object.keys(f).filter((p) => !['offset', 'easing', 'composite', 'computedOffset'].includes(p))))],
      plusScales: [...new Set(scales(pop))].length,
      keyPx: parseFloat(getComputedStyle(key).fontSize),
      critPx: (() => { pop.classList.add('is-crit'); const v = parseFloat(getComputedStyle(key).fontSize); pop.classList.remove('is-crit'); return v; })(),
    };
  });
  expect(r).not.toBeNull();
  expect(r.key.toLowerCase()).toBe('k');
  expect(r.first, 'the key starts small').toBeLessThanOrEqual(0.4);
  expect(r.finite).toBe(true);
  expect(r.ms).toBeLessThanOrEqual(400); // snappy
  expect(r.props.every((p) => p === 'transform' || p === 'opacity')).toBe(true);
  expect(r.plusScales, 'the pop (and its +N) keeps one size').toBe(1);
  expect(r.critPx, 'a crit key reads bigger than a plain one').toBeGreaterThan(r.keyPx);
});
