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

    // design audit 10 (nov2): START / + BOT are CHUNKY primary buttons, not 28px flat ones; the empty seats are ONE
    // inviting OPEN seat (with the room code), not a grid of dashed boxes
    for (const name of ['+ BOT', 'START']) {
      const b = page.getByRole('button', { name });
      expect(await b.evaluate((el) => el.offsetHeight), `${name} is chunky`).toBeGreaterThanOrEqual(60);
      expect(await b.evaluate((el) => parseFloat(getComputedStyle(el).fontSize)), `${name} type`).toBeGreaterThanOrEqual(20);
    }
    await expect(page.locator('.mn-seat.is-open')).toHaveCount(1);
    await expect(page.locator('.mn-seat.is-open')).toContainText('MINE1');
    expect(await page.locator('.mn-seat').evaluateAll((ls) => ls.filter((l) => getComputedStyle(l).borderStyle === 'dashed').length), 'no dashed seats').toBe(0);
    // every miner is drawn as a hero (not the one shared miner sprite)
    await expect(page.locator('.mn-seat:not(.is-open) .mn-seat-digger')).toHaveCount(3);
    if (process.env.MINER_SHOTS) await page.screenshot({ path: `${process.env.MINER_SHOTS}/miner-lobby-${w}.png` });

    // a second human arrives wearing their hero: their seat shows THAT hero, and the bot seats go (the server only tops
    // up a mine with < 2 humans)
    mock.pushToClient({
      type: 'room_update',
      payload: { code: 'MINE1', hostId: ME, gameType: 'miner', isPublic: true, players: [{ id: ME, name: 'ANNA' }, { id: 'p2', name: 'BO', hero: 'glitch' }] },
    });
    await expect(page.locator('.mn-seat.is-bot-fill')).toHaveCount(0);
    await expect(page.locator('.mn-seat').nth(1).locator('.mn-seat-digger')).toHaveAttribute('data-hero', 'glitch');
    // nothing on the lobby overlaps: seats, the open seat, the buttons
    const boxes = await page.locator('.mn-seat, .mn-lobby-actions .mn-btn').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON()));
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]; const b = boxes[j];
      expect(Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1, `lobby boxes ${i} x ${j} overlap`).toBe(false);
    }
  });
}
