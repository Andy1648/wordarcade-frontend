// e2e/support/menu.js — THE MENU HAS TWO TREES. This module is the one place that knows it.
//
// WHAT BROKE. PR #47 (feat/mobile-first-screen, f92e464) made `(max-width: 480px)` a RENDER
// branch, not a CSS one: Homepage.jsx reads it through useMediaQuery and, when it matches,
// renders <MobileMenu> INSTEAD OF the desktop tree. At or below 480px the corner nav, the
// wordmark, the XP cluster, the five-card grid, the bottom bar and the footer link do not
// exist in the DOM at all — that is the entire point of the change (the card region alone is
// ~390 nodes).
//
// Every spec that reached the menu did so by waiting on the DESKTOP wordmark
// (`getByRole('img', { name: 'Type a Word' })`) and then clicking a DESKTOP card
// (`.game-card-magnet[data-game=…] .game-card`). Neither exists on a phone, so at <=480px
// those specs sat in a 30s locator timeout and died before asserting anything. They were not
// finding bugs; they were describing a menu that no longer ships at that width.
//
// THE RULE THIS MODULE ENFORCES: a spec says WHAT it wants ("the menu is up", "open Word
// Bomb"), never WHICH tree it is in. The width decides, here, once. A spec that hardcodes a
// desktop selector and then runs at 390px is a spec that will rot again the next time the
// phone screen changes.
//
// WHAT IS *NOT* REACHABLE ON A PHONE (product, not test, facts — MobileMenu.jsx renders three
// sections and no more):
//   - SHOP / STATS / REBIRTH   the corner nav is desktop-only; there is no phone entry point
//   - CREDITS                  the footer link is desktop-only
//   - the CHAIN and FUSE cards the phone menu replaces both with one "CHAIN + FUSE UNLOCK AS
//                              YOU PLAY" line, so their mode dialog and locked-preview panel
//                              have no phone entry either
// CHAIN and FUSE themselves ARE reachable, via the shipped `/chain/play` / `/fuse/play` deep
// links (router.js), which is what soloEntryQuery() below uses.

export const PHONE_MENU_MAX = 480; // Homepage.jsx PHONE_MENU_QUERY = '(max-width: 480px)'

/** The three modes the phone menu gives a row to (MobileMenu.jsx MODE_IDS). */
export const PHONE_MODE_IDS = ['word-bomb', 'category-blitz', 'sat-rush'];

/**
 * Does THIS page render the phone menu? Read from the live viewport, so a spec that calls
 * setViewportSize() mid-test gets the right answer without being told.
 */
export function isPhoneMenu(page) {
  const vp = page.viewportSize();
  return !!vp && vp.width <= PHONE_MENU_MAX;
}

/**
 * The menu's landmark AT EITHER WIDTH: the desktop wordmark or the phone title. Both are
 * menu-only (the splash has its own `.splash-logo`), so this can never resolve on the wrong
 * screen — it is exactly as strict a "the menu has painted" signal as the old wordmark wait.
 */
export function menuMark(page) {
  return page.locator('.homepage-logo, .hp-m-title').first();
}

/**
 * The same union WITHOUT `.first()`, for presence/absence assertions — `toHaveCount(0)` on a
 * `.first()` locator does not mean what it looks like it means.
 */
export function menuMarkAll(page) {
  return page.locator('.homepage-logo, .hp-m-title');
}

/** Wait until the menu has painted, whichever tree this width renders. */
export async function menuReady(page, timeout = 15000) {
  await menuMark(page).waitFor({ state: 'visible', timeout });
}

/**
 * The tappable thing that opens `id`, at either width: the desktop card or the phone row.
 * Both call the SAME Homepage handler (handleOpenDialog), so what happens after the click is
 * identical — only the object you press differs.
 *
 * THROWS for chain/fuse on a phone rather than returning an empty locator: a silent
 * never-resolving locator is a 30s timeout with no explanation, which is the failure mode this
 * whole module exists to delete. See phoneCanOpen().
 */
export function modeEntry(page, id) {
  if (isPhoneMenu(page)) {
    if (!PHONE_MODE_IDS.includes(id)) {
      throw new Error(
        `modeEntry("${id}") at phone width: the phone menu has no ${id} row (MobileMenu.jsx ` +
        `MODE_IDS = ${PHONE_MODE_IDS.join(', ')}). Use soloEntryQuery("${id}") for the deep ` +
        `link, or gate this test to >${PHONE_MENU_MAX}px.`
      );
    }
    return page.locator(`.hp-m-row--${id}`);
  }
  return page.locator(`.game-card-magnet[data-game="${id}"] .game-card`);
}

/** Can the phone menu open this mode at all? Lets a spec branch instead of guessing. */
export const phoneCanOpen = (id) => PHONE_MODE_IDS.includes(id);

/**
 * The JOIN ROOM control, at either width. The phone menu puts it in the foot row next to the
 * unlock line; the desktop menu has it in the bottom bar.
 */
export function joinControl(page) {
  return isPhoneMenu(page) ? page.locator('.hp-m-join') : page.locator('.homepage-btn-join');
}

/**
 * The shipped deep-link query for a solo mode (router.js PATH_TO_QUERY). `/chain/play` bridges
 * to `?chain=1`, which every entry-param reader already understands — so this is the REAL
 * production path a phone player arrives on, not a test-only hook.
 */
export function soloEntryQuery(id) {
  const Q = { chain: 'chain=1', fuse: 'fuse=1', 'sat-rush': 'satRush=1&satrush=1' };
  const q = Q[id];
  if (!q) throw new Error(`soloEntryQuery: no deep link for "${id}"`);
  return q;
}
