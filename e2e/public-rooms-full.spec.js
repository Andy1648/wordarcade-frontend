// public-rooms-full.spec.js
//
// A room at capacity must not look joinable. Before this fix the `full` flag only tinted the
// count red — the row still said WAITING with an enabled JOIN, so a tap round-tripped to a
// server rejection. Now a full room reads FULL and its row button is disabled.
import { test, expect } from '@playwright/test';
import { installBackendMock, gotoMenu } from './support/backendMock.js';

test('a full public room shows FULL and cannot be joined; an open one stays joinable', async ({ page }) => {
  const mock = await installBackendMock(page);
  await gotoMenu(page);

  // Open the public-rooms browser (the app requests the list at the WS boundary).
  await page.getByRole('button', { name: 'JOIN ROOM' }).click();
  await mock.waitForSent('list_public_rooms', 10000);

  // One room at capacity, one with a free seat.
  mock.pushToClient({
    type: 'public_rooms',
    payload: {
      rooms: [
        { code: 'FULLL', gameType: 'word-bomb', playerCount: 8, maxPlayers: 8 },
        { code: 'OPENN', gameType: 'word-bomb', playerCount: 2, maxPlayers: 8 },
      ],
    },
  });

  const fullRow = page.locator('.browser-row.is-full');
  await expect(fullRow).toHaveCount(1);
  await expect(fullRow).toBeDisabled();
  await expect(fullRow.locator('.browser-row-status')).toHaveText('FULL');

  // The open room is a normal, enabled WAITING row.
  const openRow = page.locator('.browser-row:not(.is-full)').first();
  await expect(openRow).toBeEnabled();
  await expect(openRow.locator('.browser-row-status')).toHaveText('WAITING');
});
