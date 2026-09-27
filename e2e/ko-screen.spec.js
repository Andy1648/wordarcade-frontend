// e2e/ko-screen.spec.js — feat/ko-screen: the Word Bomb LOSS game-over card (the "K.O." sign).
//
// A REAL round, not an empty card: every player plays two words (so the payout breakdown, the
// highlights, the game summary at 3+ players and a per-player row all exist), then one survivor
// wins. For 2, 3 and 4 players at each viewport, with motion ON (the harder case):
//   (a) the card does not scroll: scrollHeight - clientHeight === 0
//   (b) REMATCH is fully inside the card and the viewport, with no scrolling
//   (c) no rendered text under 13px anywhere on the game-over overlay
//   (d) zero INFINITE animations running on the screen
//   (e) the cursor trail sits UNDER the overlay (lower z-index), so it cannot paint over it
//   (f) the K.O. hero is there and carries an accessible name (the LayeredWord stack is aria-hidden)
//   (g) when the breakdown is folded (phone, or a laptop card that would not fit), its toggle is a
//       real >= 44px control inside the card
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

const ME = 'e2e-player';
const NAMES = ['YOU', 'RIVAL', 'KIMBERLY', 'SAMWISE'];
const WORDS = ['STRAND', 'INSTRUCT', 'STRONGEST', 'ASTRAY', 'DESTROY', 'STRIPE', 'CONSTRUCT', 'STRESS'];
const VIEWPORTS = [
  { width: 1280, height: 551 },
  { width: 1366, height: 625 },
  { width: 1341, height: 815 },
  { width: 390, height: 844 },
];

test.use({ reducedMotion: 'no-preference' });

async function playToKnockout(page, n) {
  const mock = await installBackendMock(page);
  // The real faces: Bungee is wider than the fallback, and a fit measured without it proves nothing.
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.continue());
  await page.addInitScript(() => {
    try {
      localStorage.setItem('taw.seenMenu', '1');
      localStorage.setItem('taw.seenMenuSpotlight', '1');
      localStorage.setItem('taw.seenGameSpotlight', '1');
    } catch { /* storage blocked */ }
  });
  await page.goto('/?portal=1');
  await expect.poll(() => mock.connectionAttempts(), { timeout: 15000 }).toBeGreaterThan(0);
  await page.waitForTimeout(300);

  const players = Array.from({ length: n }, (_, i) => ({ id: i ? `p${i + 1}` : ME, name: NAMES[i], lives: 3, isHost: i === 0 }));
  mock.pushToClient({ type: 'room_update', payload: { code: 'ABCD', gameType: 'word-bomb', hostId: ME, difficultyKey: 'chill', players } });
  await page.waitForTimeout(80);
  mock.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } });
  await page.waitForTimeout(80);
  let k = 0;
  for (let round = 0; round < 2; round += 1) {
    for (const p of players) {
      mock.pushToClient({
        type: 'turn_update',
        payload: { currentPlayerId: p.id, players, combo: 'str', timerSeconds: 22, maxLives: 3, round: 1, difficultyKey: 'chill', usedWords: [], usedAnswers: [] },
      });
      await page.waitForTimeout(40);
      mock.pushToClient({ type: 'word_result', payload: { accepted: true, word: WORDS[k % WORDS.length] } });
      k += 1;
      await page.waitForTimeout(40);
    }
  }
  // I am knocked out; RIVAL survives.
  const final = players.map((p) => ({ ...p, lives: p.id === 'p2' ? 2 : 0 }));
  mock.pushToClient({ type: 'turn_update', payload: { currentPlayerId: 'p2', players: final, combo: 'ing', timerSeconds: 22, usedWords: [] } });
  await page.waitForTimeout(80);
  mock.pushToClient({ type: 'game_over', payload: { winnerId: 'p2' } });
}

for (const n of [2, 3, 4]) {
  for (const vp of VIEWPORTS) {
    test(`K.O. card, ${n} players @ ${vp.width}x${vp.height}: fits, REMATCH visible, holds still`, async ({ page }) => {
      await page.setViewportSize(vp);
      await playToKnockout(page, n);

      const hero = page.locator('.ko-hero');
      await expect(hero).toBeVisible();
      await expect(hero).toHaveAttribute('aria-label', /Knocked out\. RIVAL WINS/);
      await page.evaluate(() => document.fonts.ready);
      // Let every finite entrance (slam, pulses, hop, count-ups) run out before judging "at rest".
      await page.waitForTimeout(3200);
      await page.mouse.move(vp.width / 2, vp.height / 2);
      await page.mouse.move(vp.width / 2 + 30, vp.height / 2 + 20);

      const m = await page.evaluate(() => {
        const card = document.querySelector('.game-over-card');
        const btn = document.querySelector('.game-over-rematch');
        const c = card.getBoundingClientRect();
        const r = btn.getBoundingClientRect();
        const vis = (el) => {
          const cs = getComputedStyle(el);
          return cs.display !== 'none' && cs.visibility !== 'hidden' && el.getBoundingClientRect().width > 0;
        };
        const small = [...document.querySelectorAll('.game-over-overlay *')]
          .filter((el) => vis(el) && [...el.childNodes].some((x) => x.nodeType === 3 && x.textContent.trim()))
          .map((el) => ({ t: el.textContent.trim().slice(0, 24), px: parseFloat(getComputedStyle(el).fontSize) * (el.currentCSSZoom || 1) }))
          .filter((x) => x.px < 13);
        const infinite = document.getAnimations()
          .filter((a) => a.playState === 'running' && a.effect && a.effect.getComputedTiming().iterations === Infinity)
          .map((a) => a.animationName || a.id || 'anim');
        const trail = document.querySelector('.cursor-trail');
        const overlayZ = Number(getComputedStyle(document.querySelector('.game-over-overlay')).zIndex) || 0;
        const trailZ = trail ? Number(getComputedStyle(trail).zIndex) || 0 : null;
        const more = document.querySelector('.go-more');
        const toggle = document.querySelector('.go-more-toggle');
        const folded = more && !more.open;
        const t = toggle && vis(toggle) ? toggle.getBoundingClientRect() : null;
        return {
          overflow: card.scrollHeight - card.clientHeight,
          rematchInside: r.top >= c.top && r.bottom <= c.bottom && r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth,
          small,
          infinite,
          overlayZ,
          trailZ,
          folded,
          toggle: t ? { h: Math.round(t.height), inside: t.top >= c.top && t.bottom <= c.bottom } : null,
        };
      });
      test.info().annotations.push({ type: 'ko', description: JSON.stringify(m) });

      expect(m.overflow, 'game-over card must not scroll').toBe(0);
      expect(m.rematchInside, 'REMATCH fully visible without scrolling').toBe(true);
      expect(m.small, `text under 13px: ${JSON.stringify(m.small)}`).toEqual([]);
      expect(m.infinite, `infinite animations: ${m.infinite.join(', ')}`).toEqual([]);
      if (m.trailZ !== null) expect(m.trailZ, 'cursor trail must sit under the overlay').toBeLessThan(m.overlayZ);
      if (m.folded) {
        expect(m.toggle, 'a folded breakdown needs its toggle').not.toBeNull();
        expect(m.toggle.h).toBeGreaterThanOrEqual(44);
        expect(m.toggle.inside).toBe(true);
      }
    });
  }
}
