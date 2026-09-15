// e2e/overlay-inplace.spec.js — INFORMATIONAL OVERLAYS ARE IN-PLACE REACTIONS.
//
// The rule: a full-screen overlay is only justified when the player has a CHOICE to make.
// Anything that merely TELLS the player something already happened must react on the surface
// it is about, and may never cover or take a tap from that surface.
//
// Three things live here, and each one is red on the code that prompted it:
//
//  1. THE 3-2-1-GO! COUNTDOWN. It was `position:fixed; inset:0; z-index:50` with an
//     `rgba(13,6,24,0.85)` scrim and no pointer-events rule — an opaque sheet over the board
//     at exactly the moment the player is reading the board to get ready. It is pure
//     information (input is already gated elsewhere), so it now paints INSIDE the game
//     surface with no scrim and no hit area.
//
//  2. THE SHOP REVEAL STICKER STAYS MODAL, and this file records WHY rather than taking it
//     on faith. `ShopScreen.jsx`'s HoldBuy commits a purchase on a SINGLE click, and the
//     reveal sits over the shop grid for 4.2s — so a click-through scrim would turn the
//     dismiss tap into a second purchase. That is the same class as the old
//     pointer-events:none secret stamp that opened SAT RUSH, in a place where it costs wins.
//     Test 2a pins that the scrim genuinely eats a click aimed at a buy button.
//
//  3. THE KEYBOARD HOLE IN THAT SAME MODAL. The scrim only ever swallowed the MOUSE. After a
//     keyboard buy, focus is still sitting on the .shop-buy button behind the reveal, so a
//     second Enter re-fires the purchase THROUGH the modal. The dismissal leaked; it just
//     leaked down a channel nobody pointed a mouse at.
import fs from 'node:fs';
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

const ME = 'e2e-player';

// ---------------------------------------------------------------- 1. COUNTDOWN

// Drive a Word Bomb game up to the intro countdown and stop there (the overlay is only up
// for ~2.8s, so everything is asserted inside one evaluate while it is still mounted).
async function wordBombCountdown(page) {
  const players = [
    { id: ME, name: 'YOU', lives: 3, isHost: true },
    { id: 'p1', name: 'PLAYER1', lives: 3 },
  ];
  const mock = await installBackendMock(page);
  await page.goto('/?portal=1');
  await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
  mock.pushToClient({
    type: 'room_update',
    payload: { code: 'ABCD', gameType: 'word-bomb', hostId: ME, difficultyKey: 'chill', players },
  });
  await page.waitForTimeout(80);
  mock.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } });
  await page.waitForTimeout(80);
  mock.pushToClient({
    type: 'turn_update',
    payload: { currentPlayerId: ME, players, combo: 'str', usedWords: [], timerSeconds: 30, maxLives: 3 },
  });
  // ATTACHED, not a sleep — the overlay mounts a render or two after the frame lands, and a
  // fixed wait is a race on a loaded box (see motion-contract.spec.js for the same lesson).
  await page.locator('.countdown-overlay').waitFor({ state: 'attached', timeout: 8000 });
  return mock;
}

// What the countdown is, measured: its own computed style, plus what actually answers a hit
// test at the centre of the board it sits over.
async function countdownFacts(page) {
  return page.evaluate(() => {
    const ov = document.querySelector('.countdown-overlay');
    const stage = document.querySelector('.game-stage');
    if (!ov || !stage) return null;
    const cs = getComputedStyle(ov);
    const r = stage.getBoundingClientRect();
    const hit = document.elementFromPoint(
      Math.round(r.left + r.width / 2),
      Math.round(r.top + r.height / 2),
    );
    return {
      position: cs.position,
      background: cs.backgroundColor,
      pointerEvents: cs.pointerEvents,
      // true when the hit test at the board's centre reached the board (or something inside
      // it) rather than the countdown sheet.
      hitInsideStage: !!hit && stage.contains(hit),
      hitClass: hit ? hit.className.toString().slice(0, 80) : '(none)',
    };
  });
}

test('the 3-2-1 countdown does not cover the board it is counting down to', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await wordBombCountdown(page);
  const f = await countdownFacts(page);
  expect(f, 'no countdown overlay / no stage to measure against').not.toBeNull();
  // NO SCRIM. `rgba(13,6,24,0.85)` over the board is the defect: the player is trying to read
  // the fragment and the timer, and the countdown is what hides them.
  expect(f.background, `countdown scrim still painted: ${f.background}`)
    .toMatch(/^rgba\(0, 0, 0, 0\)$|^transparent$/);
  // The board is genuinely reachable underneath.
  expect(f.hitInsideStage, `the board centre hit-tests to "${f.hitClass}", not the board`).toBe(true);
});

test('the countdown can never take a tap, and is scoped to the game surface', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await wordBombCountdown(page);
  const f = await countdownFacts(page);
  expect(f.pointerEvents, 'an informational overlay must not be in the hit-test path').toBe('none');
  // Not `fixed`: it is a reaction ON the game surface, not a sheet over the whole app. A
  // fixed sheet outranks every screen it does not belong to; an absolute one cannot.
  expect(f.position, 'the countdown is still a viewport-level fixed sheet').toBe('absolute');
  expect(f.hitInsideStage).toBe(true);
});

// ---------------------------------------- 2. THE SHOP STICKER, AND WHY IT STAYS A MODAL

async function openShop(page, { wins = 999999, keytier = 0 } = {}) {
  await page.addInitScript(() => { window.__TAW_NO_ACHIEVEMENT_GRANT = true; });
  await page.addInitScript((s) => {
    try {
      localStorage.setItem('taw.wins', String(s.wins));
      localStorage.setItem('taw.keytier', String(s.keytier));
      localStorage.setItem('taw.xp', JSON.stringify({ lv: 40, into: 0 }));
    } catch { /* storage blocked */ }
  }, { wins, keytier });
  await installBackendMock(page);
  await page.goto('/?portal=1');
  await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
  await page.waitForTimeout(400);
  await page.locator('.homepage-nav-btn.is-shop').click();
  await page.locator('.shop-panel').waitFor({ state: 'visible' });
}

const keyPowerBuy = (page) => page.locator('.shop-keypower').first().locator('.shop-buy');
const keyPowerHeading = (page) => page.locator('.shop-subtitle', { hasText: 'KEY POWER' });

test('2a — the reveal scrim eats a click aimed at a BUY button (this is why it is modal)', async ({ page }) => {
  await openShop(page, { keytier: 0 });
  const btn = keyPowerBuy(page);
  const box = await btn.boundingBox();
  await btn.click();
  await expect(page.locator('.sticker')).toBeVisible();
  await expect(keyPowerHeading(page)).toContainText('TIER 1');

  // Click exactly where the buy button is. With a modal scrim this dismisses the reveal and
  // reaches nothing. Make the scrim click-through and this same tap buys TIER 2 — the
  // dismissal leaking into a purchase, which is the reason this overlay is not converted.
  await page.mouse.click(Math.round(box.x + box.width / 2), Math.round(box.y + box.height / 2));
  await expect(page.locator('.sticker')).toHaveCount(0);
  await expect(keyPowerHeading(page), 'the dismiss tap fell through and bought a tier')
    .toContainText('TIER 1');
});

test('2b — the reveal does not leak a second purchase through the KEYBOARD', async ({ page }) => {
  await openShop(page, { keytier: 0 });
  const btn = keyPowerBuy(page);
  await btn.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.sticker')).toBeVisible();
  await expect(keyPowerHeading(page)).toContainText('TIER 1');

  // The scrim swallows the mouse. Focus, though, was left on the buy button BEHIND it, so a
  // second Enter re-fires the purchase straight through the "modal".
  await page.keyboard.press('Enter');
  await expect(
    keyPowerHeading(page),
    'Enter re-fired the buy through the reveal — the modal only ever blocked the mouse',
  ).toContainText('TIER 1');
});

test('2c — the reveal is dismissible from the keyboard, by a real control', async ({ page }) => {
  await openShop(page, { keytier: 0 });
  const btn = keyPowerBuy(page);
  await btn.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.sticker')).toBeVisible();
  // A reveal you can only wait out is not dismissible. Escape closes it, and it closes well
  // before the 4.2s auto-dismiss could be credited with the result.
  await page.keyboard.press('Escape');
  await expect(page.locator('.sticker')).toHaveCount(0, { timeout: 1500 });
  await expect(page.locator('.shop-panel')).toBeVisible();
});

// ------------------------------------------------- 3. THE ALREADY-IN-PLACE ONES, PINNED

test('KO / clutch / hype are non-blocking, at every layer, including the panic band', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  const mock = await wordBombCountdown(page);
  await page.locator('.countdown-overlay').waitFor({ state: 'detached', timeout: 25000 });
  // Panic band: the loudest state the board has, and the one where a stray hit area hurts.
  mock.pushToClient({ type: 'timer_tick', payload: { secondsRemaining: 3 } });
  await page.waitForTimeout(300);
  const blockers = await page.evaluate(() => {
    const out = [];
    for (const sel of ['.ko-overlay', '.clutch-popup', '.hype-popup']) {
      for (const el of document.querySelectorAll(sel)) {
        // The element AND every descendant — pointer-events:none inherits, but a single
        // child re-enabling it puts a hit area back over the board.
        for (const n of [el, ...el.querySelectorAll('*')]) {
          if (getComputedStyle(n).pointerEvents !== 'none') out.push(`${sel} > ${n.className}`);
        }
      }
    }
    return out;
  });
  expect(blockers, `these informational nodes are in the hit-test path: ${blockers.join(', ')}`)
    .toEqual([]);
  // And the input is reachable: the board's own control answers a hit test at its centre.
  const inputOwned = await page.evaluate(() => {
    const input = document.querySelector('.game-input, .word-input, input[type="text"]');
    if (!input) return 'no input';
    const r = input.getBoundingClientRect();
    const hit = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2));
    return hit === input ? 'ok' : `covered by ${hit && hit.className}`;
  });
  expect(inputOwned).toBe('ok');
});

// ------------------------------------------------------- 4. THE PICTURE, NOT THE NUMBERS
// This project's history is that serious defects are green on the numbers and only visible in
// the image (the hype popup measured fine and was painting over the B in WORD BOMB). Both
// changed overlays get shot at the five viewports so the images can be read, not inferred.
const SHOT_VIEWPORTS = [
  { name: '1536x864', width: 1536, height: 864 },
  { name: '1366x768', width: 1366, height: 768 },
  { name: '1280x720', width: 1280, height: 720 },
  { name: '390x844', width: 390, height: 844 },
  { name: '320x640', width: 320, height: 640 },
];

fs.mkdirSync('claude/overlay-inplace', { recursive: true });

for (const vp of SHOT_VIEWPORTS) {
  test(`shot — countdown over the live board @ ${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await wordBombCountdown(page);
    await page.waitForTimeout(250); // land mid-numeral, not on the mount frame
    await page.screenshot({ path: `claude/overlay-inplace/countdown-${vp.name}.png` });
    // The numeral is genuinely on screen in the shot above, not a picture of an empty board.
    await expect(page.locator('.countdown-text')).toBeVisible();
  });

  test(`shot — shop reveal sticker @ ${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await openShop(page, { keytier: 0 });
    await keyPowerBuy(page).click();
    await expect(page.locator('.sticker')).toBeVisible();
    await page.waitForTimeout(450); // past the 380ms punch-in, at rest
    await page.screenshot({ path: `claude/overlay-inplace/sticker-${vp.name}.png` });
    // THE STICKER MUST FIT. At 320x640 it is the tightest, and the dismiss control is the
    // newest thing in it — a sticker taller than the viewport would put GOT IT off-screen.
    const fits = await page.evaluate(() => {
      const el = document.querySelector('.sticker');
      const btn = document.querySelector('.sticker-dismiss');
      const r = el.getBoundingClientRect();
      const b = btn.getBoundingClientRect();
      return {
        top: Math.round(r.top), bottom: Math.round(r.bottom),
        btnBottom: Math.round(b.bottom), btnH: Math.round(b.height),
        vh: window.innerHeight,
      };
    });
    expect(fits.top, `sticker top off-screen: ${JSON.stringify(fits)}`).toBeGreaterThanOrEqual(0);
    expect(fits.btnBottom, `GOT IT below the fold: ${JSON.stringify(fits)}`)
      .toBeLessThanOrEqual(fits.vh);
    expect(fits.btnH, 'the dismiss control is under the 44px touch floor').toBeGreaterThanOrEqual(44);
  });
}
