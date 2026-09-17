// e2e/solo-exit.spec.js (fix/solo-exit)
//
// A visitor from a shared link lands straight in CHAIN or FUSE, has never seen the menu, and the
// only way out used to be a bare 40x40 "X" glyph — under the 44px touch minimum and telling them
// nothing about where it goes. With traffic pointed at these two modes it is the last thing
// between a curious stranger and the other four modes.
//
// This covers both halves of the fix:
//   1. the exit is a LABELLED control at >=44x44, on screen and clickable at every viewport
//      including a raised software keyboard, in BOTH the playing and run-over phases;
//   2. the run-over card offers the rest of the game to a deep-link visitor who has never seen
//      the menu — and to nobody else.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

const MIN_TOUCH = 44;

// Viewports. The two mobile ones are also run "keyboard raised": a software keyboard eats the
// bottom ~45% of the visual viewport, which is exactly when a top-anchored control gets pushed
// or clipped out of reach. 1366x768 is the desktop case (no keyboard).
const VIEWPORTS = [
  { name: '320x640', width: 320, height: 640 },
  { name: '320x640 keyboard raised', width: 320, height: 352 },
  { name: '390x844', width: 390, height: 844 },
  { name: '390x844 keyboard raised', width: 390, height: 464 },
  { name: '1366x768', width: 1366, height: 768 },
];

// Land in CHAIN the way a shared link does: no menu, ever. ?chain=1 is exactly what the clean
// /chain path bridges to (router.js PATH_TO_QUERY), so this IS the shared-link entry.
//
// `soloms` is the dev clock cap that ends the run in well under a second once armed (the hook
// gameover-coverage.spec.js uses). It has to be carried alongside ?portal=1: the solo chunk reads
// ?soloms at import time, and App canonicalises the URL back to /chain BEFORE that lazy chunk
// evaluates — stripping any non-sticky query with it. portal=1 is a sticky query
// (router.hasStickyQuery), so it keeps the whole search string intact. It changes nothing about
// this scenario: SOLO_LAUNCH.chain is still the launch intent and the menu is still never seen.
async function deepLandChain(page, { fast = false } = {}) {
  await installBackendMock(page);
  const fastParams = fast ? '&soloms=350&portal=1' : '';
  await page.goto('/?chain=1' + fastParams);
  await page.locator('.solo-root').waitFor({ state: 'visible' });
}

// Arm the clock (arm-on-first-keystroke) so the run ends; fill() targets the element rather than
// relying on ambient focus, which was the flaky part elsewhere in this suite.
async function armAndDie(page) {
  const input = page.locator('.solo-root input').first();
  await input.waitFor({ state: 'visible' });
  await input.fill('a');
  await page.locator('.solo-deathcard').waitFor({ state: 'visible', timeout: 8000 });
}

const exitBtn = (page) => page.locator('.solo-exit');

// The control is big enough to hit, says where it goes, and is fully inside the viewport.
async function assertReachableAndLabelled(page, vp) {
  const btn = exitBtn(page);
  await expect(btn).toBeVisible();
  await expect(btn).toContainText('MENU'); // labelled: names its destination, not a bare glyph
  const box = await btn.boundingBox();
  expect(box, 'the exit has no box').not.toBeNull();
  expect(box.width, 'exit width at ' + vp.name).toBeGreaterThanOrEqual(MIN_TOUCH);
  expect(box.height, 'exit height at ' + vp.name).toBeGreaterThanOrEqual(MIN_TOUCH);
  // Fully on screen — a control the keyboard has pushed off the edge is not reachable.
  expect(box.x, 'exit left edge at ' + vp.name).toBeGreaterThanOrEqual(0);
  expect(box.y, 'exit top edge at ' + vp.name).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width, 'exit right edge at ' + vp.name).toBeLessThanOrEqual(vp.width + 1);
  expect(box.y + box.height, 'exit bottom edge at ' + vp.name).toBeLessThanOrEqual(vp.height + 1);
}

test.describe('the way out of a solo mode', () => {
  for (const vp of VIEWPORTS) {
    test(vp.name + ': the exit is >=44x44, labelled MENU, and on screen while playing', async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await deepLandChain(page);
      await assertReachableAndLabelled(page, vp);
    });

    test(vp.name + ': the exit stays >=44x44 and reachable on the run-over card', async ({ page }) => {
      test.setTimeout(30000);
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await deepLandChain(page, { fast: true });
      await armAndDie(page);
      // The run-over scrim is fixed inset:0 at z-50; the exit is lifted to z-60 precisely so it
      // survives this screen. Assert that, and that it still actually takes the click.
      await assertReachableAndLabelled(page, vp);
      await exitBtn(page).click();
      await expect(page.getByRole('img', { name: 'Type a Word' })).toBeVisible();
    });
  }

  test('the exit actually reaches the menu mid-run', async ({ page }) => {
    await deepLandChain(page);
    await exitBtn(page).click();
    await expect(page.getByRole('img', { name: 'Type a Word' })).toBeVisible();
    await expect(page.locator('.solo-root')).toHaveCount(0);
  });
});

test.describe('the run-over offer', () => {
  test('a deep-link visitor who has never seen the menu is offered the rest of the game', async ({ page }) => {
    test.setTimeout(30000);
    await page.setViewportSize({ width: 390, height: 844 });
    await deepLandChain(page, { fast: true });
    await armAndDie(page);

    const offer = page.locator('.solo-offer');
    await expect(offer).toBeVisible();
    await expect(offer.locator('.solo-offer-line')).toContainText('MORE MODES');
    // ONE button, in place — no modal, no share widget inside the offer.
    await expect(offer.locator('button')).toHaveCount(1);
    await expect(page.locator('.solo-offer [class*="share"]')).toHaveCount(0);
    // RESTART is still the primary action, and it is still above the offer.
    const restartBox = await page.locator('.solo-restart').boundingBox();
    const offerBox = await offer.boundingBox();
    expect(restartBox.y).toBeLessThan(offerBox.y);
    // And the button does what it says.
    await offer.locator('button').click();
    await expect(page.getByRole('img', { name: 'Type a Word' })).toBeVisible();
  });

  test('a player who came from the menu never sees the offer', async ({ page }) => {
    test.setTimeout(30000);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      try { localStorage.setItem('taw.xp', JSON.stringify({ lv: 30, into: 0 })); } catch { /* ignore */ }
    });
    await installBackendMock(page);
    await page.goto('/?portal=1&soloms=350');
    await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
    await page.waitForTimeout(400);
    await page.locator('.game-card-magnet[data-game="chain"] .game-card').click({ force: true });
    await page.locator('.mode-dialog-shell').waitFor({ state: 'visible' });
    await page.locator('.mode-dialog-btn-create').click();
    await page.locator('.solo-root').waitFor({ state: 'visible' });
    await armAndDie(page);

    await expect(page.locator('.solo-deathcard')).toBeVisible();
    await expect(page.locator('.solo-offer')).toHaveCount(0);
  });

  test('a deep-link visitor who HAS seen the menu before never sees the offer', async ({ page }) => {
    test.setTimeout(30000);
    await page.setViewportSize({ width: 390, height: 844 });
    // taw.seenMenu is written on Homepage mount; seed it to stand in for an earlier visit.
    await page.addInitScript(() => {
      try { localStorage.setItem('taw.seenMenu', '1'); } catch { /* ignore */ }
    });
    await deepLandChain(page, { fast: true });
    await armAndDie(page);

    await expect(page.locator('.solo-deathcard')).toBeVisible();
    await expect(page.locator('.solo-offer')).toHaveCount(0);
  });
});
