// e2e/deep-link.spec.js — THE ACQUISITION PATH, END TO END.
//
// Every piece of this existed and was individually correct; the path still did not work, because
// nothing tested the path — only its pieces. A cold stranger following /chain/play got the SPLASH,
// typed through it, landed on the MENU, and found CHAIN locked. Three correct features in a row,
// and the visitor never reached the game.
//
// So this spec is deliberately written as ONE VISITOR'S JOURNEY per mode, not as unit assertions:
// cleared storage, ONE navigation, no typing to get in. If any link in the chain breaks, the
// journey stops and the test fails at the step that broke it.
//
//   land cold -> the MODE is on screen (not the splash, not the menu)
//     -> a labelled >=44x44 way out is reachable
//     -> the run ends -> the run-over card offers the rest of the game
//     -> taking the offer reaches the menu -> the mode is NOT locked
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

const MIN_TOUCH = 44;

// The three solo modes that own a `/<mode>/play` deep link and a landing page pointing at it.
// word-bomb / category-blitz need a room, so their play path lands on the MENU by design — covered
// in router.spec.js, not here.
const MODES = [
  { id: 'chain', path: '/chain/play', root: '.solo-root', exit: '.solo-exit', offer: '.solo-offer' },
  { id: 'fuse', path: '/fuse/play', root: '.solo-root', exit: '.solo-exit', offer: '.solo-offer' },
  // SAT RUSH deep-lands straight into a live run now (see the dedicated test below), so its board
  // root is the run stage and its exit is the HUD's — not the cover's .sr-screen / .sr-exit-chip.
  { id: 'sat-rush', path: '/sat-rush/play', root: '.sr-app', exit: '.sr-hud-exit', offer: '.sr-offer' },
];

const menuWordmark = (page) => page.getByRole('img', { name: 'Type a Word' });

// A control you can actually hit, that says where it goes, fully inside the viewport.
async function assertLabelledTouchTarget(page, locator, where) {
  await expect(locator).toBeVisible();
  await expect(locator).toContainText('MENU'); // names its destination, not a bare glyph
  const box = await locator.boundingBox();
  expect(box, `no box for the exit (${where})`).not.toBeNull();
  expect(box.width, `exit width (${where})`).toBeGreaterThanOrEqual(MIN_TOUCH);
  expect(box.height, `exit height (${where})`).toBeGreaterThanOrEqual(MIN_TOUCH);
  const vp = page.viewportSize();
  expect(box.x, `exit left edge (${where})`).toBeGreaterThanOrEqual(0);
  expect(box.y, `exit top edge (${where})`).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width, `exit right edge (${where})`).toBeLessThanOrEqual(vp.width + 1);
}

// ---------------------------------------------------------------------------
// 1. THE COLD LANDING. No query string, no seeded storage, no typing — exactly what a stranger
//    following a link from the landing page, a share card or a group chat gets.
// ---------------------------------------------------------------------------
test.describe('a genuinely cold visitor lands IN the mode', () => {
  for (const mode of MODES) {
    test(`${mode.path} opens ${mode.id} — not the splash, not the menu`, async ({ page }) => {
      await installBackendMock(page);
      await page.goto(mode.path); // ONE navigation. Nothing else.

      // The mode is on screen.
      await expect(page.locator(mode.root).first()).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.getAttribute('data-view'))
      ).toBe(mode.id);

      // And the two things that used to be in front of it are not.
      await expect(page.locator('.splash-root, .splash-screen')).toHaveCount(0);
      await expect(menuWordmark(page)).toHaveCount(0);

      // The URL still reads as the deep link, so a reload or a re-share returns here.
      expect(await page.evaluate(() => location.pathname)).toBe(mode.path);
    });

    test(`${mode.path} — the way out is labelled and >=44x44`, async ({ page }) => {
      await installBackendMock(page);
      await page.goto(mode.path);
      await expect(page.locator(mode.root).first()).toBeVisible();
      await assertLabelledTouchTarget(page, page.locator(mode.exit).first(), `${mode.id} on landing`);
      // And it goes where it says.
      await page.locator(mode.exit).first().click();
      await expect(menuWordmark(page)).toBeVisible();
    });
  }

  // ---------------------------------------------------------------------------
  // THE FIRST FRAME IS NOT WASHED OUT.
  //
  // The first-run coach mark dims the screen with a 100vmax box-shadow at rgba(6,3,12,0.76) — the
  // whole board down to about a quarter brightness. On the menu that is the point (it picks one bar
  // out of a grid of cards). On a game board, where the board IS the screen, it meant the very first
  // thing a deep-link visitor ever saw — score, multiplier, timer ring, the letter — was washed out,
  // which reads as a broken render, not as teaching. Game surfaces now pass dim={false}.
  //
  // NOTE the board's own `opacity` was ALWAYS 1: the wash is an overlay painted on top. A gate that
  // only checked opacity would have passed the broken screen, so this checks both.
  // ---------------------------------------------------------------------------
  for (const mode of MODES) {
    test(`${mode.path} — the board is at full brightness within 1s, not behind a scrim`, async ({ page }) => {
      await installBackendMock(page);
      await page.goto(mode.path);
      await expect(page.locator(mode.root).first()).toBeVisible();

      await expect
        .poll(
          async () =>
            page.evaluate((sel) => {
              const el = document.querySelector(sel);
              if (!el) return 'no-root';
              // Every ancestor must be fully opaque and unfiltered.
              for (let n = el; n; n = n.parentElement) {
                const cs = getComputedStyle(n);
                if (parseFloat(cs.opacity) < 0.999) return 'dim-ancestor:' + n.className;
                if (cs.filter && cs.filter !== 'none') return 'filtered-ancestor:' + n.className;
              }
              // And nothing may be painting a full-screen wash over it.
              if (document.querySelector('.spotlight-dim')) return 'spotlight-dim present';
              const hole = document.querySelector('.spotlight-hole');
              if (hole && !hole.classList.contains('is-bare')) return 'spotlight scrim not bare';
              return 'clear';
            }, mode.root),
          { timeout: 1000 }
        )
        .toBe('clear');
    });
  }

  // A WHOLE PLAYABLE BOARD WITHIN 2s, not "some element exists".
  //
  // The weaker version of this test asserted `.sr-slots` was visible and stopped there, which would
  // still pass on a board with no clue and nothing to pick — and a hand probe that sampled the page
  // before the lazy SAT chunk resolved reported exactly that shape. So this names every part a
  // player needs in order to play, and puts a 2s ceiling on all of them. (Measured against the
  // deployed build: ~1.0s from navigation commit, the wait being the lazy chunk + word data.)
  //
  // NOTE there is deliberately no `<input>` assertion: SAT RUSH has no text input. It is typed at
  // directly and the letters land in the mugshot slots, which is why its own specs drive it with
  // page.keyboard. The slots ARE the typing affordance, so they are what gets asserted.
  test('/sat-rush/play is a WHOLE playable board within 2s of a cold navigation', async ({ page }) => {
    test.setTimeout(30000);
    await installBackendMock(page);
    await page.goto('/sat-rush/play');

    await expect
      .poll(
        async () =>
          page.evaluate(() => ({
            clue: (document.querySelector('.sr-sentence') || {}).textContent?.trim().length || 0,
            suspects: document.querySelectorAll('.sr-suspect-word').length,
            slots: document.querySelectorAll('.sr-slots .sr-slot, .sr-slots > *').length,
            exit: (document.querySelector('.sr-hud-exit') || {}).textContent?.trim() || '',
          })),
        { timeout: 2000, intervals: [100] }
      )
      .toMatchObject({ suspects: 6, exit: expect.stringContaining('MENU') });

    const state = await page.evaluate(() => ({
      clue: (document.querySelector('.sr-sentence') || {}).textContent?.trim() || '',
      slots: document.querySelectorAll('.sr-slots > *').length,
    }));
    expect(state.clue.length, 'the LAST SEEN clue sentence must be on screen').toBeGreaterThan(20);
    expect(state.slots, 'the mugshot slots are the typing affordance').toBeGreaterThan(2);

    // NOT the cover, NOT the mode picker, NOT the briefing — the four taps that used to stand
    // between a stranger following a link and a single word appearing.
    await expect(page.locator('.sr-cover')).toHaveCount(0);
    await expect(page.locator('.sr-modeselect')).toHaveCount(0);
    await expect(page.locator('.sr-brief-page')).toHaveCount(0);
    // And the way out is labelled and big enough to hit.
    await assertLabelledTouchTarget(page, page.locator('.sr-hud-exit'), 'sat-rush cold deep link');
  });

  test('a trailing slash is the same link (/chain/play/)', async ({ page }) => {
    await installBackendMock(page);
    await page.goto('/chain/play/');
    await expect(page.locator('.solo-root')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 2. THE HANDOVER. The landing page is what gets crawled and shared; its PLAY button is the seam
//    between "found us on Google" and "is playing". Click it for real.
// ---------------------------------------------------------------------------
test.describe('the landing page hands the visitor to the game', () => {
  for (const mode of MODES) {
    test(`/${mode.id} PLAY button -> the ${mode.id} board`, async ({ page }) => {
      await installBackendMock(page);
      await page.goto(`/${mode.id}`);
      await page.locator('a.lp-btn', { hasText: 'PLAY' }).first().click();
      await expect(page.locator(mode.root).first()).toBeVisible({ timeout: 20000 });
      expect(
        await page.evaluate(() => document.documentElement.getAttribute('data-view'))
      ).toBe(mode.id);
    });
  }
});

// ---------------------------------------------------------------------------
// 3. THE RUN ENDS. The run-over card is the one moment a deep-link visitor is looking at a stopped
//    screen — the only chance to tell them the rest of the game exists. Then: is the mode they
//    just played still claiming to be locked?
// ---------------------------------------------------------------------------
test.describe('the run ends, and the rest of the game is offered', () => {
  // CHAIN / FUSE: `soloms` is the dev clock cap that ends a run in well under a second once armed.
  // It rides with portal=1 because the solo chunk reads ?soloms at import time and App canonicalises
  // the URL (dropping non-sticky query) before that lazy chunk evaluates. portal=1 is sticky, so the
  // whole search survives. It changes nothing here: the launch intent is still the /play path's.
  for (const mode of MODES.filter((m) => m.id !== 'sat-rush')) {
    test(`${mode.id}: die -> offer -> menu -> ${mode.id} is not locked`, async ({ page }) => {
      test.setTimeout(30000);
      await installBackendMock(page);
      await page.goto(`${mode.path}?soloms=350&portal=1`);
      await expect(page.locator(mode.root)).toBeVisible();

      // Arm the clock and let it run out. This is the only typing in the journey.
      const input = page.locator(`${mode.root} input`).first();
      await input.fill('a');
      await expect(page.locator('.solo-deathcard')).toBeVisible({ timeout: 10000 });

      // The offer is on the run-over card, and the exit is still reachable over the scrim.
      const offer = page.locator(mode.offer);
      await expect(offer).toBeVisible();
      await expect(offer.locator('.solo-offer-line')).toContainText('MORE MODES');
      await assertLabelledTouchTarget(page, page.locator(mode.exit).first(), `${mode.id} on run-over`);

      // Take the offer.
      await offer.locator('button').click();
      await expect(menuWordmark(page)).toBeVisible();

      // THE CONTRADICTION THIS CLOSES: the menu used to tell a player who had just finished a run
      // that the mode was locked (progress/modeAccess.js). It must not.
      await expect(page.locator(`[data-game="${mode.id}"] .game-card.locked`)).toHaveCount(0);
      await expect(page.locator(`[data-game="${mode.id}"] .game-card`)).toBeVisible();
    });
  }

  test('sat-rush: die -> offer -> menu', async ({ page }) => {
    test.setTimeout(45000);
    await installBackendMock(page);
    await page.goto('/sat-rush/play');
    // Already playing — the deep link starts the run itself (no cover, no picker, no briefing).
    await expect(page.locator('.sr-slots')).toBeVisible({ timeout: 20000 });

    // Mid-run, the exit is labelled and big enough.
    await assertLabelledTouchTarget(page, page.locator('.sr-hud-exit'), 'sat-rush mid-run');

    // Give up words until the run is over. State-driven (the engine owns real-time pauses), the
    // same pattern sat-rush.spec.js uses rather than fixed waits.
    await expect
      .poll(
        async () => {
          if (await page.locator('.sr-respage').isVisible()) return true;
          await page.keyboard.press('Escape');
          await page.waitForTimeout(250);
          await page.keyboard.press('x'); // skip the re-encode teaching beat
          await page.waitForTimeout(250);
          return page.locator('.sr-respage').isVisible();
        },
        { timeout: 35000, intervals: [400] }
      )
      .toBe(true);

    // The offer is on the results page, in SAT RUSH's own voice, and it works.
    const offer = page.locator('.sr-offer');
    await expect(offer).toBeVisible();
    await expect(offer.locator('.sr-offer-line')).toContainText('MORE CASES');
    await offer.locator('button').click();
    await expect(menuWordmark(page)).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 4. THE TWO ROOM MODES. Word Bomb and Category Blitz need a room AND an opponent before there is
//    anything to land in, so their deep link provisions both with no clicks — the same frames the
//    menu's Quick Play / Daily paths send. The backend is mocked, so this asserts the exact
//    conversation the app has with the server, which is the part that can actually be wrong.
// ---------------------------------------------------------------------------
const ME = 'me';
const ROOM_MODES = [
  { id: 'word-bomb', path: '/word-bomb/play', title: 'WORD BOMB' },
  { id: 'category-blitz', path: '/category-blitz/play', title: 'CATEGORY BLITZ' },
];

test.describe('a cold visitor on a room-mode deep link gets a game, not a lobby', () => {
  for (const mode of ROOM_MODES) {
    test(`${mode.path}: boot screen -> room + bot provisioned -> live game`, async ({ page }) => {
      test.setTimeout(30000);
      const mock = await installBackendMock(page);
      await page.goto(mode.path); // ONE navigation, no typing.

      // The boot screen names the mode the visitor asked for — never the menu, never the splash.
      await expect(page.locator('.deepland-title')).toHaveText(mode.title);
      await expect(menuWordmark(page)).toHaveCount(0);
      await expect(page.locator('.splash-root, .splash-screen')).toHaveCount(0);
      // And it is not a trap: the same labelled >=44x44 way out as every other mode.
      await assertLabelledTouchTarget(page, page.locator('.deepland-exit'), `${mode.id} boot`);

      // The provisioning conversation, in order, with no clicks.
      await mock.waitForSent('add_bot');
      const types = mock.sentTypes();
      const provision = types.filter((t) =>
        ['create_room', 'set_game_type', 'set_difficulty', 'set_packs', 'add_bot', 'start_game'].includes(t)
      );
      expect(provision[0]).toBe('create_room');
      expect(provision[1]).toBe('set_game_type');
      expect(provision[provision.length - 1]).toBe('add_bot'); // start_game is HELD until the roster is up
      const gameType = mock.sentFrames().find((f) => f && f.type === 'set_game_type');
      expect(gameType.payload.gameType).toBe(mode.id);
      const created = mock.sentFrames().find((f) => f && f.type === 'create_room');
      expect(created.payload.isPublic).toBe(false); // a solo-vs-bot room is never public

      // The room fills in. THE TRAP: create_room and add_bot each broadcast a room_update, and being
      // pulled to the waiting room here is exactly how a deep-link visitor gets stranded.
      const players = [{ id: ME, name: 'YOU', lives: 3, isHost: true }, { id: 'bot', name: 'BOT', lives: 3 }];
      mock.pushToClient({
        type: 'room_update',
        payload: { code: 'ABCD', gameType: mode.id, hostId: ME, difficultyKey: 'chill', players: [players[0]] },
      });
      await page.waitForTimeout(100);
      await expect(page.locator('.deepland-title')).toBeVisible(); // still on the boot screen

      mock.pushToClient({
        type: 'room_update',
        payload: { code: 'ABCD', gameType: mode.id, hostId: ME, difficultyKey: 'chill', players },
      });

      // Roster complete -> the round starts by itself. No arm gesture, no tap.
      await mock.waitForSent('start_game');
      await expect(page.locator('.deepland-title')).toBeVisible(); // and STILL not the waiting room

      // The live board replaces the boot screen.
      mock.pushToClient({ type: 'game_started', payload: { gameType: mode.id } });
      await expect
        .poll(async () => page.evaluate(() => document.documentElement.getAttribute('data-view')))
        .toBe('game');
      await expect(page.locator('.deepland')).toHaveCount(0);
    });

    test(`${mode.path}: the run ends -> the game-over card -> the menu, ${mode.id} unlocked`, async ({ page }) => {
      test.setTimeout(30000);
      await page.setViewportSize({ width: 1280, height: 720 }); // deterministic: above the 680px gate
      const mock = await installBackendMock(page);
      await page.goto(mode.path);
      await mock.waitForSent('add_bot');
      const players = [{ id: ME, name: 'YOU', lives: 3, isHost: true }, { id: 'bot', name: 'BOT', lives: 3 }];
      mock.pushToClient({
        type: 'room_update',
        payload: { code: 'ABCD', gameType: mode.id, hostId: ME, difficultyKey: 'chill', players },
      });
      await mock.waitForSent('start_game');
      mock.pushToClient({ type: 'game_started', payload: { gameType: mode.id } });
      await expect
        .poll(async () => page.evaluate(() => document.documentElement.getAttribute('data-view')))
        .toBe('game');

      // Word Bomb's overlay reads off live turn state, so give it a turn first (same setup
      // gameover-coverage.spec.js uses). Blitz renders its scoreboard straight from game_over.
      if (mode.id === 'word-bomb') {
        mock.pushToClient({
          type: 'turn_update',
          payload: { currentPlayerId: ME, players, combo: 'at', usedWords: [], timerSeconds: 30 },
        });
        await page.waitForTimeout(80);
      }

      // Die.
      mock.pushToClient({
        type: 'game_over',
        payload: {
          winnerId: 'bot',
          finalScores: [{ id: ME, name: 'YOU', score: 10 }, { id: 'bot', name: 'BOT', score: 30 }],
        },
      });
      await expect(page.locator('.game-over-overlay')).toBeVisible();

      // The rest of the game is offered here too — the same offer CHAIN/FUSE/SAT make, because the
      // visitor is in the same position: they arrived on a link and have never seen the menu.
      const offer = page.locator('.game-over-offer');
      await expect(offer).toBeVisible();
      await expect(offer.getByRole('button', { name: 'SEE ALL MODES' })).toBeVisible();
      // The explanatory line is height-gated (it is dropped under 680px tall, where the sticky
      // footer already crowds the card), so assert it only where it is meant to show.
      if (page.viewportSize().height > 680) {
        await expect(offer.locator('.game-over-offer-line')).toContainText('MORE MODES');
      }
      // It is inside the STICKY actions footer, so it is on screen without scrolling.
      const offerBox = await offer.boundingBox();
      expect(offerBox.y + offerBox.height).toBeLessThanOrEqual(page.viewportSize().height + 1);

      // Take it: out to the menu, and the mode they just played is not claiming to be locked.
      await offer.locator('button').click();
      await expect(menuWordmark(page)).toBeVisible();
      await expect(page.locator(`[data-game="${mode.id}"] .game-card.locked`)).toHaveCount(0);
    });
  }

  // THE BUG THIS LOCKS DOWN (found by the adversarial review, not by a gate): cancelling used to
  // clear local state only, while the provisioning effect stayed armed on wsStatus + a once-ref.
  // A visitor who tapped ← MENU three seconds into a thirty-second cold start would, half a minute
  // later, have a room and a bot created under them, be pulled into the waiting room from wherever
  // they had navigated to, and then dropped into a live match they had explicitly cancelled.
  test('cancelling the boot screen ENDS the session — no room is created afterwards', async ({ page }) => {
    test.setTimeout(30000);
    // openDelayMs holds the socket in 'connecting', which is the whole exposure window: the frames
    // have not been sent yet, so this is the moment cancelling has to actually stick.
    const mock = await installBackendMock(page, { openDelayMs: 4000 });
    await page.goto('/word-bomb/play');
    await expect(page.locator('.deepland-title')).toBeVisible();
    expect(mock.sentTypes()).not.toContain('create_room'); // still connecting

    await page.locator('.deepland-exit').click();
    await expect(menuWordmark(page)).toBeVisible();
    expect(await page.evaluate(() => location.pathname)).toBe('/');

    // Now let the original connect window elapse and then some. Nothing may be provisioned, and
    // the player must still be on the menu — not yanked into a room or a game.
    await page.waitForTimeout(6000);
    expect(mock.sentTypes()).not.toContain('create_room');
    expect(mock.sentTypes()).not.toContain('start_game');
    expect(await page.evaluate(() => document.documentElement.getAttribute('data-view'))).toBe('home');
    await expect(page.locator('.deepland')).toHaveCount(0);
  });

  test('the boot screen is never a dead end — a server error offers a way forward', async ({ page }) => {
    test.setTimeout(30000);
    const mock = await installBackendMock(page);
    await page.goto('/word-bomb/play');
    await mock.waitForSent('create_room');
    // The server refuses. Without a failure branch this screen would say "SEATING YOUR OPPONENT…"
    // forever; a stranger's whole impression of the game would be a spinner.
    mock.pushToClient({ type: 'error', payload: { message: 'ROOM LIMIT REACHED' } });
    await expect(page.locator('.deepland-retry')).toBeVisible();
    await expect(page.locator('.deepland-sub-failed')).toBeVisible();
    // And the way out is still there, still labelled, still big enough.
    await assertLabelledTouchTarget(page, page.locator('.deepland-exit'), 'word-bomb boot failed');
  });

  test('an unknown ?play= value is ignored and boots the menu (a deep link cannot force a game type)', async ({ page }) => {
    await installBackendMock(page);
    await page.goto('/?play=not-a-mode');
    await expect(menuWordmark(page)).toBeVisible();
    await expect(page.locator('.deepland')).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------
// 5. THE OFFER IS FOR STRANGERS ONLY. Someone who came through the menu already knows.
// ---------------------------------------------------------------------------
test('a visitor who has seen the menu is not offered the rest of the game', async ({ page }) => {
  test.setTimeout(30000);
  await installBackendMock(page);
  await page.addInitScript(() => {
    try { localStorage.setItem('taw.seenMenu', '1'); } catch { /* blocked storage */ }
  });
  await page.goto('/chain/play?soloms=350&portal=1');
  await page.locator('.solo-root input').first().fill('a');
  await expect(page.locator('.solo-deathcard')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('.solo-offer')).toHaveCount(0);
});

test('a room-mode player who came from the menu is not offered it either', async ({ page }) => {
  test.setTimeout(30000);
  const mock = await installBackendMock(page);
  await page.addInitScript(() => {
    try { localStorage.setItem('taw.seenMenu', '1'); } catch { /* blocked storage */ }
  });
  // No deep link at all: the ordinary menu entry, driven straight to game-over.
  await page.goto('/?portal=1');
  await menuWordmark(page).waitFor({ state: 'visible' });
  const players = [{ id: ME, name: 'YOU', lives: 3, isHost: true }, { id: 'p2', name: 'RIVAL', lives: 0 }];
  mock.pushToClient({
    type: 'room_update',
    payload: { code: 'ABCD', gameType: 'word-bomb', hostId: ME, difficultyKey: 'chill', players },
  });
  await page.waitForTimeout(80);
  mock.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } });
  await page.waitForTimeout(80);
  mock.pushToClient({
    type: 'turn_update',
    payload: { currentPlayerId: ME, players, combo: 'at', usedWords: [], timerSeconds: 30 },
  });
  await page.waitForTimeout(80);
  mock.pushToClient({ type: 'game_over', payload: { winnerId: ME } });
  await expect(page.locator('.game-over-overlay')).toBeVisible();
  await expect(page.locator('.game-over-offer')).toHaveCount(0);
});
