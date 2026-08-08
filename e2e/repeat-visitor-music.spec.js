// e2e/repeat-visitor-music.spec.js
//
// Regression for the silent-menu bug: music was only ever started from the
// splash click (handleSplashStart). Repeat visitors have wa_intro_seen set, so
// the splash never renders and the music never started for them — a silent menu
// and silent games. App.jsx now arms a one-shot window pointerdown/keydown
// listener on no-splash loads that unlocks + fades the music in on the first
// real gesture. This test drives exactly that path.
//
// Two things make the assertion possible:
//  1. This spec runs under the `chromium-autoplay` project (playwright.config.js),
//     launched with --autoplay-policy=no-user-gesture-required, so play() on the
//     <audio> element resolves and the media clock actually advances headless.
//  2. The music element is `new Audio()` and is never added to the DOM, so it
//     can't be reached by selector. We patch window.Audio in an init script
//     (before any app code runs) to record every instance, then assert playback
//     on the recorded element.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

test.describe('repeat-visitor music', () => {
  test('first gesture starts the music on a no-splash (repeat visitor) load', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      // Repeat visitor: intro already seen -> App boots straight to the menu with
      // no splash, so the splash click can't be music's unlock gesture.
      try {
        window.localStorage.setItem('wa_intro_seen', '1');
      } catch {
        /* storage may be unavailable; the test will surface the boot failure */
      }
      // Record every Audio the app constructs (the firecracker music element is
      // never attached to the DOM, so this is the only handle a test can get).
      const OrigAudio = window.Audio;
      window.__waAudios = [];
      const PatchedAudio = function (...args) {
        const el = new OrigAudio(...args);
        window.__waAudios.push(el);
        return el;
      };
      PatchedAudio.prototype = OrigAudio.prototype;
      window.Audio = PatchedAudio;
    });

    await installBackendMock(page);
    await page.goto('/');

    // No splash for a repeat visitor: we land on the menu (the wordmark is the
    // stable landmark). The splash screen must never appear.
    const wordmark = page.getByRole('img', { name: 'Type a Word' });
    await expect(wordmark).toBeVisible();
    await expect(page.locator('.splash-screen')).toHaveCount(0);

    const musicPlaying = () =>
      page.evaluate(() => {
        const el = (window.__waAudios || [])[0];
        return !!(el && !el.paused);
      });

    // Before any gesture the music is still paused (the whole point of the bug).
    expect(await musicPlaying()).toBe(false);

    // First click anywhere is the gesture that fades the music in.
    await wordmark.click();

    // The element is now playing and the media clock is advancing.
    await page.waitForFunction(() => {
      const el = (window.__waAudios || [])[0];
      return !!(el && !el.paused && el.currentTime > 0);
    });
  });
});
