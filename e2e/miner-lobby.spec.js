// e2e/miner-lobby.spec.js — the MINER room LOBBY reads as a lobby (Andy oct28: "where are the bots" / "what is that
// interface already inside the mine"). The cause was CSS: the board rule `.mn-root > :not(.mn-wall)` also matched the
// lobby's own wall, turning it from an absolute background into an in-flow image that buried the seats, + BOT and
// START under it (a click still "worked" - Playwright scrolls a clipped button into view - so the live spec missed it).
// This pins the lobby on screen: the wall stays a background, the seats and the host's controls are inside the
// viewport, a solo host sees the BOT seats the server fills at START, and no board UI shows before the game.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

const ME = 'e2e-player'; // backendMock's `connected` id

for (const [w, h] of [[1366, 768], [1280, 600], [390, 844]]) {
  test(`MINER lobby @ ${w}x${h}: seats + controls on screen, bot seats for a solo host, no board before START`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    const mock = await installBackendMock(page);
    await page.goto('/miner/play');
    await page.locator('.lobby-continue-btn').click();
    await mock.waitForSent('create_room');
    mock.pushToClient({ type: 'room_created', payload: { code: 'MINE1' } });
    mock.pushToClient({
      type: 'room_update',
      payload: { code: 'MINE1', hostId: ME, gameType: 'miner', isPublic: true, players: [{ id: ME, name: 'ANNA' }] },
    });
    const lobby = page.getByTestId('miner-lobby');
    await lobby.waitFor();
    await page.waitForTimeout(400);

    expect(await page.locator('.mn-lobby-wall').evaluate((el) => getComputedStyle(el).position), 'the wall is a background').toBe('absolute');
    const seats = await page.locator('.mn-seat').evaluateAll((ls) => ls.map((l) => l.className));
    expect(seats.filter((c) => c.includes('is-bot-fill')).length, 'a solo host sees the two bots START will seat').toBe(2);
    await expect(page.locator('.mn-dig, .mn-race, [data-testid="miner-prompt"]')).toHaveCount(0);

    for (const name of ['+ BOT', 'START']) {
      const box = await page.getByRole('button', { name }).boundingBox();
      expect(box, `${name} renders`).not.toBeNull();
      expect(box.y + box.height, `${name} is on screen without scrolling`).toBeLessThanOrEqual(h);
      // CSS px (offsetHeight): desktop zooms the whole app (.app-scaled), the same for every screen
      expect(await page.getByRole('button', { name }).evaluate((el) => el.offsetHeight), `${name} is a 44px target`).toBeGreaterThanOrEqual(44);
    }
    const firstSeat = await page.locator('.mn-seat').first().boundingBox();
    expect(firstSeat.y + firstSeat.height, 'the seats are on screen').toBeLessThanOrEqual(h);

    // a second human arrives: the bot seats go (the server only tops up a mine with < 2 humans)
    mock.pushToClient({
      type: 'room_update',
      payload: { code: 'MINE1', hostId: ME, gameType: 'miner', isPublic: true, players: [{ id: ME, name: 'ANNA' }, { id: 'p2', name: 'BO' }] },
    });
    await expect(page.locator('.mn-seat.is-bot-fill')).toHaveCount(0);
  });
}
