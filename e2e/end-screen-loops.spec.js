// end-screen-loops.spec.js — nothing may start looping on a screen that has settled.
//
// THE GAP THIS CLOSES. The animation budget's first rule is "ZERO new infinite animations —
// nothing loops at rest", and Phase 6's brief for the end screens ends "entry juice
// one-shot, nothing loops after". The suite already asserts the infinite count on the menu
// (splash-loops) and that an accept adds none (juice-stack). Nothing covered the END
// SCREENS — which is exactly where a celebratory loop is most tempting to write, and where
// one can sit forever without any test noticing.
//
// WHY THESE NUMBERS AND NOT ZERO. Measured on this branch, four seconds after arrival, the
// Word Bomb game-over screen runs FIVE infinite animations (go-burst-spin, go-mascot-hop,
// mascot-celebrate, mascot-breathe, rematch-pulse) and the solo death card runs one
// (mascot-breathe). All six keyframes exist on release/prod-1 as well, so they are not new
// — the phase work introduced none. The target is still 0, and these ceilings are a RATCHET
// so the number can only ever go down: raising one is a deliberate act that shows up in a
// diff, which is the whole point.
//
// One of the five sits on `.game-over-rematch`, the primary CTA, which the squint test
// independently names as that screen's single entry point — the thing the eye lands on is
// also the thing that never stops moving.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

const ME = 'e2e-player';
const waitImg = (p) => p.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });

// Counts animations whose effect never ends and which are actually running. getAnimations()
// sees WAAPI and CSS keyframes alike, so a JS-driven loop is caught as surely as a keyframe.
const countLoops = () =>
  document.getAnimations().reduce((acc, a) => {
    const t = a.effect && a.effect.getTiming ? a.effect.getTiming() : {};
    if (t.iterations !== Infinity) return acc;
    if (a.playState !== 'running') return acc;
    const el = a.effect && a.effect.target;
    // SVG elements expose className as an SVGAnimatedString, which stringifies to
    // "[object SVGAnimatedString]" - getAttribute is the one that works for both.
    const raw = el ? el.getAttribute('class') || '' : '';
    const cls = raw.trim().split(/\s+/)[0];
    acc.push(`${cls ? '.' + cls : (el && el.tagName) || '?'} :: ${a.animationName || '(waapi)'}`);
    return acc;
  }, []);

// The settled ceiling for each screen. Lower is always allowed; higher fails.
const CEILING = {
  menu: 0,
  'wb-gameover': 5,
  'chain-death': 1,
};

test('the MENU is at rest: zero infinite animations, on arrival and after settling', async ({ page }) => {
  await installBackendMock(page);
  await page.goto('/?portal=1');
  await waitImg(page);
  const onArrival = await page.evaluate(countLoops);
  await page.waitForTimeout(3000);
  const settled = await page.evaluate(countLoops);
  expect(onArrival, `menu loops on arrival:\n${onArrival.join('\n')}`).toHaveLength(CEILING.menu);
  expect(settled, `menu loops after settling:\n${settled.join('\n')}`).toHaveLength(CEILING.menu);
});

test('WORD BOMB game over adds no new loop (ratchet; the target is zero)', async ({ page }) => {
  const mock = await installBackendMock(page);
  const dead = [
    { id: ME, name: 'YOU', lives: 3, isHost: true },
    { id: 'p2', name: 'RIVAL', lives: 0 },
  ];
  await page.goto('/?portal=1');
  await waitImg(page);
  mock.pushToClient({ type: 'room_update', payload: { code: 'ABCD', gameType: 'word-bomb', hostId: ME, difficultyKey: 'chill', players: dead } });
  await page.waitForTimeout(80);
  mock.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } });
  await page.waitForTimeout(80);
  mock.pushToClient({ type: 'turn_update', payload: { currentPlayerId: ME, players: dead, combo: 'at', usedWords: ['CAT', 'BAT', 'RAT'], timerSeconds: 30 } });
  await page.waitForTimeout(80);
  mock.pushToClient({ type: 'game_over', payload: { winnerId: ME } });
  await page.locator('.game-over-overlay').waitFor();
  // Well past every entry one-shot, so anything still running is a genuine loop.
  await page.waitForTimeout(4000);
  const settled = await page.evaluate(countLoops);
  // eslint-disable-next-line no-console
  console.log(`[end-screen-loops] wb-gameover settled=${settled.length}\n  ${settled.join('\n  ')}`);
  expect(
    settled.length,
    `Word Bomb game over must not START looping anything new. Target is 0; ceiling is ` +
      `${CEILING['wb-gameover']}. Still running:\n${settled.join('\n')}`
  ).toBeLessThanOrEqual(CEILING['wb-gameover']);
});

test('the solo death card adds no new loop (ratchet; the target is zero)', async ({ page }) => {
  await installBackendMock(page);
  await page.addInitScript(() => {
    try {
      localStorage.setItem('taw.xp', JSON.stringify({ lv: 30, into: 0 }));
    } catch {
      /* private mode reads back as no progress, which is fine here */
    }
  });
  await page.goto('/?portal=1&soloms=350');
  await waitImg(page);
  await page.waitForTimeout(300);
  await page.locator('.game-card-magnet[data-game="chain"] .game-card').click({ force: true });
  await page.locator('.mode-dialog-shell').waitFor();
  await page.locator('.mode-dialog-btn-create').click();
  await page.locator('.solo-root').waitFor();
  const input = page.locator('.solo-root input').first();
  await input.waitFor();
  await input.fill('a');
  await page.locator('.solo-deathcard').waitFor({ timeout: 9000 });
  await page.waitForTimeout(4000);
  const settled = await page.evaluate(countLoops);
  // eslint-disable-next-line no-console
  console.log(`[end-screen-loops] chain-death settled=${settled.length}\n  ${settled.join('\n  ')}`);
  expect(
    settled.length,
    `The solo death card must not START looping anything new. Target is 0; ceiling is ` +
      `${CEILING['chain-death']}. Still running:\n${settled.join('\n')}`
  ).toBeLessThanOrEqual(CEILING['chain-death']);
});
