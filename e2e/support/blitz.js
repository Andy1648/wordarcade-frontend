// e2e/support/blitz.js — a scripted Category Blitz round over the backend mock.
//
// Blitz has no deterministic driver in the suite yet (parity-wb-blitz only exercises
// the WB half over the socket), so this is the shared one: it pushes the exact frames
// App.jsx's handlers read — room_update -> game_started -> round_start -> timer_tick /
// answer_result / player_progress -> round_end / game_over — and never touches the
// backend. Every helper is a pure frame push; nothing here is a test-only app hook.
import { installBackendMock, gotoMenu, freezeAnimations } from './backendMock.js';

export const ME = 'e2e-player';

export const VIEWPORTS = [
  { name: '1366x768', width: 1366, height: 768 },
  { name: '1280x720', width: 1280, height: 720 },
  { name: '390x844', width: 390, height: 844 },
  { name: '320x640', width: 320, height: 640 },
];

// The hard case for the hero: a long category that still has to fit at 320px.
export const LONG_CATEGORY = 'Fictional Sandwiches Named After Politicians';
export const SHORT_CATEGORY = 'Sea Creatures';

export function roster(count) {
  const names = ['YOU', 'RIVAL', 'BOTZILLA', 'MARGUERITE', 'PIP', 'QUENTIN'];
  const out = [{ id: ME, name: names[0], isHost: true }];
  for (let i = 1; i < count; i += 1) {
    out.push({ id: `p${i + 1}`, name: names[i] || `P${i + 1}`, isHost: false });
  }
  return out;
}

/**
 * Boot the app to a live Category Blitz round and return the mock handle plus
 * frame-pushing helpers. `players` is the seat count (2 or 4+).
 */
export async function startBlitz(page, {
  players = 2,
  category = SHORT_CATEGORY,
  timerSeconds = 60,
  round = 1,
  skipCountdown = true,
} = {}) {
  // The one-time first-game spotlight throws a dark scrim over the whole stage; it is a
  // different screen, not the one under test, so mark it seen before boot.
  await page.addInitScript(() => {
    try {
      localStorage.setItem('taw.seenGameSpotlight', '1');
      localStorage.setItem('taw.seenMenuSpotlight', '1');
    } catch { /* storage blocked — the flag already reads as seen */ }
  });
  const mock = await installBackendMock(page);
  await gotoMenu(page);
  const seats = roster(players);

  mock.pushToClient({
    type: 'room_update',
    payload: { code: 'BLTZ', hostId: ME, players: seats, gameType: 'category-blitz' },
  });
  await page.waitForTimeout(60);
  mock.pushToClient({ type: 'game_started', payload: { gameType: 'category-blitz' } });
  await page.waitForTimeout(60);
  mock.pushToClient({
    type: 'round_start',
    payload: { round, category, timerSeconds, rerollsRemaining: 2 },
  });
  // The 3-2-1-GO overlay runs on its own 700ms interval regardless of reduced
  // motion, so a real wait is the only way past it.
  if (skipCountdown) await page.waitForTimeout(3400);
  await freezeAnimations(page);

  const api = {
    seats,
    tick: async (secondsRemaining) => {
      mock.pushToClient({ type: 'timer_tick', payload: { secondsRemaining } });
      await page.waitForTimeout(80);
    },
    accept: async (answer) => {
      mock.pushToClient({ type: 'answer_result', payload: { accepted: true, answer } });
      await page.waitForTimeout(120);
    },
    reject: async (answer, reason = 'not_in_category') => {
      mock.pushToClient({ type: 'answer_result', payload: { accepted: false, answer, reason } });
      await page.waitForTimeout(120);
    },
    progress: async (playerId, answerCount) => {
      mock.pushToClient({ type: 'player_progress', payload: { playerId, answerCount } });
      await page.waitForTimeout(60);
    },
    roundEnd: async ({ round: r = round, category: c = category, answers } = {}) => {
      mock.pushToClient({
        type: 'round_end',
        payload: {
          round: r,
          category: c,
          playerResults: seats.map((s, i) => ({
            id: s.id,
            name: s.name,
            roundScore: 6 - i,
            answers: answers || ['TUNA MELT', 'REUBEN', 'CLUB', 'BLT', 'PO BOY', 'GRINDER'].slice(0, 6 - i),
          })),
          sampleAnswers: ['MUFFULETTA', 'BANH MI', 'CROQUE MONSIEUR', 'PATTY MELT'],
        },
      });
      await page.waitForTimeout(200);
    },
    gameOver: async () => {
      mock.pushToClient({
        type: 'game_over',
        payload: {
          winnerId: ME,
          finalScores: seats.map((s, i) => ({ id: s.id, name: s.name, score: 18 - i * 4 })),
        },
      });
      await page.waitForTimeout(200);
    },
    mock,
  };
  return api;
}

/** Fill the answer list by accepting `words` in order. */
export async function fillAnswers(api, words) {
  for (const w of words) await api.accept(w);
}

export const SAMPLE_ANSWERS = [
  'OCTOPUS', 'MANTA RAY', 'CUTTLEFISH', 'NARWHAL', 'ANGLERFISH', 'HORSESHOE CRAB',
];
