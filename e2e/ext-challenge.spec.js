// e2e/ext-challenge.spec.js — extension f, the WORD RACE CHALLENGE LINK (claude/specs/challenge-link.md v1).
//
// 1. RECEIVER (no flag — a received link always works): a COLD /race/play?vs=XAVI&t=41200&n=25 boots
//    straight into the EXISTING race quick match (App LAUNCH_INTENT -> handleRaceQuickMatch, one
//    race_quick_match frame once the socket opens) and the race HUD shows "BEAT XAVI: 41.2s". At the
//    end the why-line is the verdict and SEND IT BACK is offered.
// 2. SENDER flag OFF: no CHALLENGE A FRIEND on the results.
// 3. SENDER flag ON (taw.flag.challenge = '1'): CHALLENGE A FRIEND is on the results.
//
// Everything server-side is the Playwright WS mock (support/backendMock.js): no byte reaches Render.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';

const ME = 'e2e-player';
const racers = [
  { id: ME, name: 'YOU' },
  { id: 'b1', name: 'BOT', isBot: true },
];
const WORDS = Array.from({ length: 25 }, (_, i) => `word${String.fromCharCode(97 + (i % 26))}`);

function pushRoom(mock) {
  mock.pushToClient({
    type: 'room_update',
    payload: { code: 'RACE1', gameType: 'word-race', hostId: ME, difficultyKey: 'chill', players: racers.map((r, i) => ({ ...r, isHost: i === 0 })) },
  });
}

async function startRace(page, mock, { target = 25 } = {}) {
  mock.pushToClient({ type: 'game_started', payload: { gameType: 'word-race' } });
  const now = Date.now();
  mock.pushToClient({
    type: 'race_start',
    payload: { seed: 11, variant: 'words', words: WORDS.slice(0, target), target, capMs: 60000, racers, serverNow: now, goAt: now + 50 },
  });
  mock.pushToClient({ type: 'race_go', payload: { serverNow: now, goAt: now + 50, endsAt: now + 60000 } });
  await page.locator('.wr-root[data-race-status="racing"]').waitFor({ state: 'visible' });
}

function endRace(mock, { target, myWords, myMs }) {
  mock.pushToClient({
    type: 'race_over',
    payload: {
      winnerId: myWords >= target ? ME : 'b1',
      reason: 'finish',
      standings: [
        { id: ME, name: 'YOU', words: myWords, reachedAt: myMs, place: myWords >= target ? 1 : 2 },
        { id: 'b1', name: 'BOT', isBot: true, words: myWords >= target ? 10 : target, reachedAt: 50000, place: myWords >= target ? 2 : 1 },
      ],
    },
  });
}

test('cold /race/play?vs=XAVI&t=41200&n=25 boots into the race with the BEAT XAVI chip', async ({ page }) => {
  const mock = await installBackendMock(page);
  await page.goto('/race/play?vs=XAVI&t=41200&n=25');

  // The EXISTING launch path: exactly one race_quick_match, sent once the socket is open.
  const qm = await mock.waitForSent('race_quick_match', 15000);
  expect(qm.payload.variant).toBe('words');
  expect(mock.sentTypes().filter((t) => t === 'race_quick_match')).toHaveLength(1);
  // No vs-bot room was provisioned for a race link.
  expect(mock.sentTypes()).not.toContain('create_room');

  pushRoom(mock);
  await startRace(page, mock, { target: 25 });

  await expect(page.getByTestId('challenge-chip')).toHaveText('BEAT XAVI: 41.2s');

  // I finish 25 in 38.0s -> the verdict replaces the why-line; SEND IT BACK needs no flag.
  endRace(mock, { target: 25, myWords: 25, myMs: 38000 });
  await expect(page.getByTestId('challenge-verdict')).toHaveText('YOU BEAT XAVI BY 3.2s');
  await expect(page.getByTestId('challenge-send')).toHaveText('SEND IT BACK');
  // The challenge lived for one race: the stash is cleared at its end.
  expect(await page.evaluate(() => sessionStorage.getItem('taw.challenge'))).toBeNull();
});

test('flag OFF: no CHALLENGE A FRIEND on the race results', async ({ page }) => {
  const mock = await installBackendMock(page);
  await page.goto('/?portal=1&race=1');
  await menuReady(page);
  pushRoom(mock);
  await page.locator('.wr-lobby').waitFor({ state: 'visible' });
  await startRace(page, mock, { target: 12 });
  await expect(page.getByTestId('challenge-chip')).toHaveCount(0);
  endRace(mock, { target: 12, myWords: 12, myMs: 30000 });
  await expect(page.locator('.wr-over')).toBeVisible();
  await expect(page.getByTestId('challenge-send')).toHaveCount(0);
});

test('flag ON: CHALLENGE A FRIEND is on the race results', async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('taw.flag.challenge', '1');
    } catch {
      /* storage blocked */
    }
  });
  const mock = await installBackendMock(page);
  await page.goto('/?portal=1&race=1');
  await menuReady(page);
  pushRoom(mock);
  await page.locator('.wr-lobby').waitFor({ state: 'visible' });
  await startRace(page, mock, { target: 12 });
  endRace(mock, { target: 12, myWords: 12, myMs: 30000 });
  const btn = page.getByTestId('challenge-send');
  await expect(btn).toHaveText('CHALLENGE A FRIEND');
  const box = await btn.boundingBox();
  expect(box && box.height).toBeGreaterThanOrEqual(44);
});
