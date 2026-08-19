// e2e/server-waking.spec.js
//
// The cold-start copy on the menu's connect-gated CTAs. Render's free tier sleeps
// when idle, so a tapped action can wait ~30s for the socket. The app already
// queues the intent and auto-fires it on open; this asserts the PRESENTATION added
// on top: after a short threshold the button shifts to WAKING THE SERVER… with a
// reassurance sub-line, and — critically — the queued action STILL auto-fires the
// instant the socket opens (behavior unchanged).
//
// Determinism: the mock holds the socket 'connecting' for openDelayMs (awaited in
// the route handler, which delays the client onopen), and ?coldstart=<ms> shrinks
// the cold-start threshold so the phase-2 copy trips without a real 4s wait.
import { test, expect } from '@playwright/test';
import { installBackendMock, freezeAnimations } from './support/backendMock.js';

test.describe('server-waking cold-start copy', () => {
  test('shows the WAKING copy past the threshold, then auto-fires the queued action on open', async ({
    page,
  }) => {
    // Hold the socket 'connecting' for 6s; trip the cold-start hint at ~300ms.
    const mock = await installBackendMock(page, { openDelayMs: 6000 });
    await page.goto('/?portal=1&coldstart=300');
    await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
    await freezeAnimations(page);

    const join = page.locator('.homepage-btn-join');

    // Socket isn't open yet, so JOIN queues the connect-gated action instead of
    // firing. (It shows CONNECTING… first, then WAKING once the threshold passes.)
    await join.click();

    // Phase 2: the WAKING copy + the Space Mono reassurance sub-line appear, and
    // the tapped slab shifts to the yellow WAKING variant.
    await expect(page.locator('.connecting-main')).toHaveText('WAKING THE SERVER…');
    await expect(page.locator('.connecting-sub')).toHaveText(
      'free hosting naps — ~30s, game starts by itself',
    );
    await expect(join).toHaveClass(/is-waking/);

    // When the socket finally opens (~6s), the SAME queued action auto-fires: the
    // app's JOIN flow sends a list_public_rooms frame at the WebSocket boundary.
    await mock.waitForSent('list_public_rooms', 10000);
  });
});
