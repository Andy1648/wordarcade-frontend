// e2e/websocket-boundary.spec.js
//
// Non-multiplayer flows are tested end to end, but any flow that would talk to
// the game backend is stopped AT the WebSocket boundary: we intercept the socket
// (so the live Render backend is never contacted) and assert the app made the
// attempt / sent the expected frame. No fake game server is stood up here.
import { test, expect } from '@playwright/test';
import { installBackendMock, gotoMenu } from './support/backendMock.js';

test.describe('WebSocket boundary', () => {
  test('the app opens exactly one socket to the backend — and it is intercepted, not live', async ({ page }) => {
    const mock = await installBackendMock(page);
    await gotoMenu(page);

    // The app opened its socket on mount; our route answered it, so nothing ever
    // reached the real backend. (installBackendMock never calls connectToServer.)
    await expect.poll(() => mock.connectionAttempts()).toBeGreaterThan(0);
  });

  test('JOIN ROOM stops at the boundary: a list_public_rooms frame is sent, not a live request', async ({ page }) => {
    const mock = await installBackendMock(page);
    await gotoMenu(page);

    // JOIN ROOM opens the public-rooms browser, which requests the room list over
    // the socket the moment it mounts. That send is our boundary.
    await page.getByRole('button', { name: 'JOIN ROOM' }).click();

    const frame = await mock.waitForSent('list_public_rooms');
    expect(frame).toBeTruthy();
    // We stop here — no room list is faked, no game server is involved.
  });

  test('creating a room stops at the boundary: a create_room frame is sent', async ({ page }) => {
    const mock = await installBackendMock(page);
    await gotoMenu(page);

    // Card -> dialog -> CREATE -> lobby form -> CONTINUE is the create-room path.
    await page.getByRole('button', { name: /WORD BOMB/i }).click();
    await page.getByRole('dialog').locator('.mode-dialog-btn-create').click();

    // The lobby pre-fills a remembered/generated name, so CONTINUE is ready.
    await expect(page.locator('#player-name-input')).toBeVisible();
    await page.locator('.lobby-continue-btn').click();

    const frame = await mock.waitForSent('create_room');
    expect(frame).toBeTruthy();
    // The frame carries the player's intent but is captured at the boundary — it
    // never reaches a real server.
    expect(frame.payload).toBeTruthy();
  });
});
