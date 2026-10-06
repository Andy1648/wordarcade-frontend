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

const POP_POOL = 20; // MenuXp.jsx POP_POOL

for (const vp of [{ width: 1366, height: 657 }, { width: 390, height: 844 }]) {
  test(`typing on the menu shows the restored letter pops and no centre text box @ ${vp.width}x${vp.height}`, async ({ page }) => {
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
    const letters = pops.map((p) => p.letter);
    // the last keys are still mid-flight (POP_MS 600) — at least the latest letters are up
    expect(letters).toContain('D');
    expect(letters).toContain('R');
    for (const p of pops) {
      expect(p.plus).toMatch(/^\+\d/);
      expect(p.finite).toBe(true);
      expect(p.props.every((x) => x === 'transform' || x === 'opacity')).toBe(true);
    }

    // Pooled: no node per keystroke.
    await expect(page.locator('.menu-xp-pop')).toHaveCount(POP_POOL);
    // Still no box after typing, and the desktop's held slot never shows text.
    await noBox();
    if (vp.width > 480) {
      await expect(page.locator('.hp-typed-slot')).toHaveCount(1);
      await expect(page.locator('.hp-typed-slot')).toHaveText('');
    }
    // Typing anywhere still credits XP.
    const xpAfter = await page.evaluate(() => localStorage.getItem('taw.xp'));
    expect(xpAfter).not.toBe(xpBefore);
  });
}
