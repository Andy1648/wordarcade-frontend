// e2e/ko-screen.spec.js — feat/ko-screen: the Word Bomb LOSS game-over card (the "K.O." sign).
//
// For each viewport, with motion ON (the harder case — reduced motion only removes animation):
//   (a) the card does not scroll: scrollHeight - clientHeight === 0
//   (b) REMATCH is fully inside the card and the viewport, with no scrolling
//   (c) no rendered text under 13px anywhere on the game-over overlay
//   (d) zero INFINITE animations running on the screen
//   (e) the cursor trail sits UNDER the overlay (lower z-index), so it cannot paint over it
//   (f) the K.O. hero is there and carries an accessible name (the LayeredWord stack is aria-hidden)
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

const ME = 'e2e-player';
const VIEWPORTS = [
  { width: 1366, height: 625 },
  { width: 1341, height: 815 },
  { width: 390, height: 844 },
];

test.use({ reducedMotion: 'no-preference' });

for (const vp of VIEWPORTS) {
  test(`Word Bomb K.O. card fits and holds still @ ${vp.width}x${vp.height}`, async ({ page }) => {
    await page.setViewportSize(vp);
    const mock = await installBackendMock(page);
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

    const live = [{ id: ME, name: 'YOU', lives: 3, isHost: true }, { id: 'p2', name: 'RIVAL', lives: 3 }];
    mock.pushToClient({ type: 'room_update', payload: { code: 'ABCD', gameType: 'word-bomb', hostId: ME, difficultyKey: 'chill', players: live } });
    await page.waitForTimeout(80);
    mock.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } });
    await page.waitForTimeout(80);
    mock.pushToClient({ type: 'turn_update', payload: { currentPlayerId: ME, players: live, combo: 'at', usedWords: [], timerSeconds: 30 } });
    await page.waitForTimeout(200);
    const dead = [{ id: ME, name: 'YOU', lives: 0, isHost: true }, { id: 'p2', name: 'RIVAL', lives: 2 }];
    mock.pushToClient({ type: 'turn_update', payload: { currentPlayerId: 'p2', players: dead, combo: 'ing', usedWords: [], timerSeconds: 30 } });
    await page.waitForTimeout(80);
    mock.pushToClient({ type: 'game_over', payload: { winnerId: 'p2' } });

    const hero = page.locator('.ko-hero');
    await expect(hero).toBeVisible();
    await expect(hero).toHaveAttribute('aria-label', /Knocked out\. RIVAL WINS/);
    await page.evaluate(() => document.fonts.ready);
    // Let every finite entrance (slam, pulses, hop) run out before judging "at rest".
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
        .filter((el) => vis(el) && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()))
        .map((el) => ({ t: el.textContent.trim().slice(0, 24), px: parseFloat(getComputedStyle(el).fontSize) * (el.currentCSSZoom || 1) }))
        .filter((x) => x.px < 13);
      const infinite = document.getAnimations()
        .filter((a) => a.playState === 'running' && a.effect && a.effect.getComputedTiming().iterations === Infinity)
        .map((a) => a.animationName || a.id || 'anim');
      const trail = document.querySelector('.cursor-trail');
      const overlayZ = Number(getComputedStyle(document.querySelector('.game-over-overlay')).zIndex) || 0;
      const trailZ = trail ? Number(getComputedStyle(trail).zIndex) || 0 : null;
      return {
        overflow: card.scrollHeight - card.clientHeight,
        rematchInside: r.top >= c.top && r.bottom <= c.bottom && r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth,
        small,
        infinite,
        overlayZ,
        trailZ,
      };
    });

    expect(m.overflow, 'game-over card must not scroll').toBe(0);
    expect(m.rematchInside, 'REMATCH fully visible without scrolling').toBe(true);
    expect(m.small, `text under 13px: ${JSON.stringify(m.small)}`).toEqual([]);
    expect(m.infinite, `infinite animations: ${m.infinite.join(', ')}`).toEqual([]);
    if (m.trailZ !== null) expect(m.trailZ, 'cursor trail must sit under the overlay').toBeLessThan(m.overlayZ);
  });
}
