// e2e/mobile-cards.spec.js — MODE REACHABILITY ON A PHONE.
//
// WHAT THIS GUARDS, and what it used to guard. The original spec was written for the card grid:
// on a phone the five mode cards were taller than the viewport, so the menu kept its frame
// (title + XP bar + buttons pinned) and SCROLLED the card region inside it. This proved, at four
// phone sizes, that every card could be brought fully into view, that the XP bar never scrolled
// out, and that there was no horizontal scroll. It was guarding the regression where the lower
// cards (CHAIN/FUSE) were clipped and unreachable.
//
// PR #47 (feat/mobile-first-screen) answered the same problem a different way: at <=480px the
// card grid is not rendered at all. <MobileMenu> puts the three playable modes on full-width
// rows that flex to share the height, so there is nothing to scroll — the screen is exactly one
// viewport by construction. The old spec could only sit in a 30s timeout waiting for a wordmark
// the phone menu does not draw; it was describing a screen that stopped shipping.
//
// THE PROPERTY IS UNCHANGED AND THE BAR IS RAISED. "Every mode is reachable without scrolling
// past it" is still the question. On this screen the honest form of it is stronger than the old
// one, so that is what is asserted:
//   1. every mode row is FULLY inside the viewport — with NO scrolling at all, not "after
//      scrolling to it" (the old test's bar),
//   2. the foot row (the unlock line + JOIN ROOM) is fully visible too — the phone equivalent of
//      "the XP bar never scrolls out": the persistent control that must not be pushed off,
//   3. no horizontal scroll AND no vertical scroll — the old spec could only check horizontal,
//      because vertical scrolling was the mechanism it was testing,
//   4. every row is a real 44px touch target, which the card grid was never asked about.
// CHAIN and FUSE are deliberately NOT rows here — the phone menu replaces both with one
// "CHAIN + FUSE UNLOCK AS YOU PLAY" line — so this asserts that line is present instead of
// asserting two cards that do not exist. See MobileMenu.jsx.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady, PHONE_MODE_IDS, PHONE_MENU_MAX } from './support/menu.js';

const VIEWPORTS = [
  { w: 390, h: 844 },
  { w: 360, h: 640 },
  { w: 414, h: 896 },
  { w: 360, h: 740 },
  { w: 320, h: 568 }, // the smallest phone the app supports — the tightest height budget
];

for (const { w, h } of VIEWPORTS) {
  test(`${w}x${h}: every mode row reachable with no scroll, foot pinned, 44px targets`, async ({ page }) => {
    expect(w, 'this spec is about the phone menu').toBeLessThanOrEqual(PHONE_MENU_MAX);
    await page.setViewportSize({ width: w, height: h });
    await installBackendMock(page);
    await page.goto('/?portal=1');
    await menuReady(page);
    await page.waitForTimeout(400);

    const r = await page.evaluate((ids) => {
      const vh = window.innerHeight;
      const vw = window.innerWidth;
      const de = document.documentElement;
      const rows = {};
      for (const id of ids) {
        const el = document.querySelector(`.hp-m-row--${id}`);
        if (!el) { rows[id] = null; continue; }
        const b = el.getBoundingClientRect();
        rows[id] = {
          inside: b.top >= -0.5 && b.bottom <= vh + 0.5 && b.left >= -0.5 && b.right <= vw + 0.5,
          h: Math.round(b.height),
          box: `${Math.round(b.top)}..${Math.round(b.bottom)} of ${vh}`,
        };
      }
      const footEl = document.querySelector('.hp-m-foot');
      const joinEl = document.querySelector('.hp-m-join');
      const unlockEl = document.querySelector('.hp-m-unlock');
      const boxOf = (el) => {
        if (!el) return null;
        const b = el.getBoundingClientRect();
        return { inside: b.top >= -0.5 && b.bottom <= vh + 0.5, h: Math.round(b.height), box: `${Math.round(b.top)}..${Math.round(b.bottom)} of ${vh}` };
      };
      return {
        rows,
        foot: boxOf(footEl),
        join: boxOf(joinEl),
        unlockText: unlockEl ? (unlockEl.textContent || '').trim() : null,
        hOver: de.scrollWidth - de.clientWidth,
        vOver: de.scrollHeight - de.clientHeight,
        // No card grid at this width — that is the change, and asserting it keeps this spec
        // honest if the render branch is ever reverted without updating the menu.
        cardsMounted: document.querySelectorAll('.game-card-magnet').length,
      };
    }, PHONE_MODE_IDS);

    // eslint-disable-next-line no-console
    console.log(`[mobile-rows ${w}x${h}] ${JSON.stringify(r)}`);

    const missing = PHONE_MODE_IDS.filter((id) => !r.rows[id]);
    expect(missing, `mode rows not rendered @ ${w}x${h}: ${missing.join(', ')}`).toHaveLength(0);

    const outside = PHONE_MODE_IDS.filter((id) => !r.rows[id].inside);
    expect(
      outside,
      `mode rows not fully in view @ ${w}x${h}: ${outside.map((id) => `${id} ${r.rows[id].box}`).join(' ;; ')}`
    ).toHaveLength(0);

    // 44px touch floor (CLAUDE.md) — a full-width row has no excuse to be short.
    for (const id of PHONE_MODE_IDS) {
      expect(r.rows[id].h, `${id} row height @ ${w}x${h}`).toBeGreaterThanOrEqual(44);
    }

    expect(r.foot, 'the foot row is rendered').not.toBeNull();
    expect(r.foot.inside, `foot row pushed out of view @ ${w}x${h} (${r.foot.box})`).toBe(true);
    expect(r.join, 'JOIN ROOM is rendered').not.toBeNull();
    expect(r.join.inside, `JOIN ROOM pushed out of view @ ${w}x${h} (${r.join.box})`).toBe(true);
    expect(r.join.h, `JOIN ROOM height @ ${w}x${h}`).toBeGreaterThanOrEqual(44);

    // CHAIN + FUSE are represented by the unlock line, not by two padlocked cards.
    expect(r.unlockText, `the CHAIN/FUSE unlock line @ ${w}x${h}`).toMatch(/CHAIN/i);
    expect(r.unlockText).toMatch(/FUSE/i);

    expect(r.hOver, `horizontal overflow @ ${w}x${h}`).toBeLessThanOrEqual(0);
    expect(r.vOver, `vertical overflow @ ${w}x${h} — the phone menu is ONE screen`).toBeLessThanOrEqual(0);
    expect(r.cardsMounted, `the desktop card grid must not mount @ ${w}x${h}`).toBe(0);
  });
}
