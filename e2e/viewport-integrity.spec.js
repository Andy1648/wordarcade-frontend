// e2e/viewport-integrity.spec.js — THE SYSTEMIC GATE (fix/qa-sweep §1).
//
// Walks every screen / dialog / overlay / game-over at 7 viewports and asserts
// nothing goes off-screen, gets clipped, or forces a scrollbar. This is the
// guard class that was missing when the Word-Bomb game-over shipped off-screen
// and the Blitz badge shipped cut off.
//
// PER SCREEN, PER VIEWPORT, we assert:
//   (a) the screen's root box is inside the viewport (horizontal always; vertical
//       too for OVERLAY screens — dialogs/game-overs must fully fit; scrolling
//       full-page screens are allowed to run past the fold).
//   (b) no descendant's box exceeds a CLIPPING ancestor's box (overflow hidden/
//       auto/scroll) — i.e. no content is clipped or hidden behind a cropped
//       container. (Decorative bleed out of an overflow:visible parent — the wall
//       texture, the beat glow — is intentional and NOT flagged; those are
//       aria-hidden anyway and excluded.)
//   (c) no text-bearing element is horizontally clipped (scrollWidth<=clientWidth).
//   (d) document.body.scrollWidth === clientWidth (no horizontal page scroll).
//   (7) no dialog/preview/overlay container shows a scrollbar (overflow auto/scroll
//       that actually overflows).
//
// The BEFORE matrix is the deliverable: run `npx playwright test viewport-integrity`
// and read the per-(viewport,screen) MATRIX lines. The suite is RED until every
// cell is clean.
import { test, expect } from '@playwright/test';
import { installBackendMock, freezeAnimations } from './support/backendMock.js';
// THE SCREEN MAP LIVES IN ONE PLACE (e2e/support/screens.js). It used to be defined here, which
// meant every other run that wanted to visit "every screen" had to copy it — and a copied screen
// map is a map that quietly stops matching the app. The arcane-pass screenshot run and the
// cold-stranger walk import the same list.
import { VIEWPORTS, TOL, SCREENS, NOSCROLL, THEME_IDS } from './support/screens.js';
import { PHONE_MENU_MAX, isPhoneMenu, menuReady, modeEntry, phoneCanOpen, soloEntryQuery } from './support/menu.js';

// ---- navigation primitives (reused from coverage / gameover specs) ----
async function bootMenu(page, level = 40, query = '?portal=1') {
  await installBackendMock(page);
  if (level != null) {
    await page.addInitScript((lv) => {
      try {
        localStorage.setItem('taw.xp', JSON.stringify({ lv, into: 0 }));
        localStorage.setItem('taw.wins', '999999');
      } catch { /* ignore */ }
    }, level);
  }
  await page.goto(`/${query}`);
  await menuReady(page);
  await page.waitForTimeout(400);
}
// THE MODE ENTRY POINT, at either width — the desktop card or the phone row. Both call the
// same Homepage handler, so only the object you press differs (support/menu.js).
const card = (page, id) => modeEntry(page, id);

async function bootRoom(page, gameType, players) {
  const mock = await installBackendMock(page);
  await page.goto('/?portal=1');
  await menuReady(page);
  mock.pushToClient({ type: 'room_update', payload: { code: 'ABCD', gameType, hostId: 'me', difficultyKey: 'chill', players } });
  return mock;
}
async function enterSolo(page, id) {
  await page.addInitScript(() => { try { localStorage.setItem('taw.xp', JSON.stringify({ lv: 40, into: 0 })); } catch { /* ignore */ } });
  await installBackendMock(page);
  // PHONE: CHAIN and FUSE have no card to click — the phone menu replaces both with one
  // "CHAIN + FUSE UNLOCK AS YOU PLAY" line (MobileMenu.jsx). They are still REACHABLE, by the
  // shipped /chain/play and /fuse/play deep links, which bridge to ?chain=1 / ?fuse=1
  // (router.js). That is the path a phone player actually arrives on, so it is the path this
  // drives — the mode is entered for real, not through a test-only hook.
  if (isPhoneMenu(page) && !phoneCanOpen(id)) {
    await page.goto(`/?portal=1&soloms=350&${soloEntryQuery(id)}`);
    await page.locator('.solo-root').waitFor({ state: 'visible', timeout: 15000 });
    return;
  }
  await page.goto('/?portal=1&soloms=350');
  await menuReady(page);
  await page.waitForTimeout(400);
  await card(page, id).click({ force: true });
  await page.locator('.mode-dialog-shell').waitFor({ state: 'visible' });
  await page.locator('.mode-dialog-btn-create').click();
  await page.locator('.solo-root').waitFor({ state: 'visible' });
}

const ME = 'me';
const wbPlayers = [{ id: ME, name: 'YOU', lives: 3, isHost: true }, { id: 'p2', name: 'RIVAL', lives: 0 }];
const cbPlayers = [{ id: ME, name: 'YOU', isHost: true }, { id: 'p2', name: 'RIVAL' }];

// SCREENS / NOSCROLL / THEME_IDS come from e2e/support/screens.js (imported above). The inline
// copy that used to live here was removed in the release merge: it had drifted to 24 screens
// while the shared map had 40, which is exactly the divergence that extraction prevents.

// The integrity check, run in the page against the live DOM.
async function integrity(page, rootSel, overlay, noScroll) {
  return page.evaluate(({ rootSel, overlay, noScroll, TOL }) => {
    const out = [];
    const root = document.querySelector(rootSel);
    if (!root) return ['ROOT NOT FOUND: ' + rootSel];
    const vw = window.innerWidth, vh = window.innerHeight;
    const de = document.documentElement, body = document.body;
    const desc = (el) => {
      let s = el.tagName.toLowerCase();
      if (el.id) s += '#' + el.id;
      if (el.className && typeof el.className === 'string') s += '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.');
      return s;
    };
    const vis = (el, cs) => cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity || '1') > 0.01;
    const clips = (cs) => /^(hidden|auto|scroll|clip)$/.test(cs.overflowX) || /^(hidden|auto|scroll|clip)$/.test(cs.overflowY) || /^(hidden|auto|scroll|clip)$/.test(cs.overflow);

    // (d) horizontal page scroll
    const bodyW = Math.max(body.scrollWidth, de.scrollWidth);
    if (bodyW > de.clientWidth + TOL) out.push(`(d) H-SCROLL: body scrollWidth ${bodyW} > viewport ${de.clientWidth}`);

    // (a) root inside the viewport
    const r = root.getBoundingClientRect();
    if (r.left < -TOL) out.push(`(a) ROOT off LEFT edge (left=${Math.round(r.left)})`);
    if (r.right > vw + TOL) out.push(`(a) ROOT off RIGHT edge (right=${Math.round(r.right)} > ${vw})`);
    if (overlay) {
      if (r.top < -TOL) out.push(`(a) ROOT off TOP edge (top=${Math.round(r.top)})`);
      if (r.bottom > vh + TOL) out.push(`(a) ROOT off BOTTOM edge (bottom=${Math.round(r.bottom)} > ${vh})`);
    }

    // walk descendants
    const els = root.querySelectorAll('*');
    let clipTextN = 0, clipText1 = '';
    let overN = 0, over1 = '';
    let scrollN = 0, scroll1 = '';
    for (const el of els) {
      if (el.getAttribute && el.getAttribute('aria-hidden') === 'true') continue; // decorative
      // Skip SVG vector art: <g>/<path>/<line> boxes routinely exceed the <svg>'s
      // viewBox by design (that's what a viewBox clip IS), and scrollWidth/clientWidth
      // are not meaningful on them. This is real art, not a layout bug.
      if (el.namespaceURI === 'http://www.w3.org/2000/svg') continue;
      const cs = getComputedStyle(el);
      if (!vis(el, cs)) continue;
      const er = el.getBoundingClientRect();
      if (er.width < 1 && er.height < 1) continue;

      // (c) text-bearing element clipped horizontally. Only counts when the element
      // actually CLIPS (overflow hidden/clip/auto/scroll) — text that merely lays
      // out a hair wider than its box under overflow:visible (e.g. trailing
      // letter-spacing on a Bungee button) renders fully and is NOT clipped.
      const hasText = Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim().length);
      const clipsText = /^(hidden|clip|auto|scroll)$/.test(cs.overflowX) || /^(hidden|clip|auto|scroll)$/.test(cs.overflow);
      // sr-only / visually-hidden nodes (position:absolute, ~1px box, overflow:hidden, clip) hold the
      // full accessible-name text in a 1px box ON PURPOSE — scrollWidth >> clientWidth is the technique,
      // not clipped UI. WaveText (a11y MED-3) renders its accessible name exactly this way. A box that is
      // <=1px in either axis cannot show readable text to a user, so it can never be "clipping" visible
      // text; excluding it removes the false positive without weakening real clipped-text detection
      // (genuinely clipped labels have client boxes tens-to-hundreds of px wide).
      const srOnly = el.clientWidth <= 1 || el.clientHeight <= 1;
      if (hasText && clipsText && !srOnly && el.scrollWidth > el.clientWidth + TOL) {
        clipTextN++;
        if (!clipText1) clipText1 = `${desc(el)} sw=${el.scrollWidth}>cw=${el.clientWidth} "${el.textContent.trim().slice(0, 24)}"`;
      }

      // (7) container that actually scrolls (scrollbar). HORIZONTAL overflow is
      // never acceptable anywhere. VERTICAL overflow is fine for content panels
      // (shop/stats/menu scroll by design) but NOT for dialogs / preview cards /
      // game-over cards, which must shrink to fit (noScroll screens).
      // A scrollBAR only exists when the axis is auto/scroll — overflow:hidden/clip
      // CLIPS (no bar) even though scrollWidth still reports the hidden content (e.g.
      // a decorative burst behind the game-over card). So (7) keys off auto/scroll,
      // not the hidden clip.
      const scrollsX = /^(auto|scroll)$/.test(cs.overflowX);
      const scrollsY = /^(auto|scroll)$/.test(cs.overflowY);
      const hOver = scrollsX && el.scrollWidth > el.clientWidth + TOL;
      const vOver = scrollsY && el.scrollHeight > el.clientHeight + TOL;
      // Designated inner scroll regions are legitimate lists/tables (the pack
      // picker "shrinks and scrolls" per §2's spec; the game-over stats table).
      // Their VERTICAL scroll is allowed even inside a noScroll card; horizontal
      // scroll is still a bug everywhere.
      const cls = (el.className && typeof el.className === 'string') ? el.className : '';
      // game-over-card is a max-height:calc(100vh-48px) scroll-capped modal by
      // design (it fits the viewport and scrolls its body rather than going
      // off-screen) — same class as shop/stats/the pack list.
      const intentionalScroll = /ppp-window-scroll|shop-body|stats-body|go-stats|game-over-card|sr-[a-z]*scroll/.test(cls);
      if (clips(cs) && el.clientHeight > 0 && el.clientWidth > 0 && (hOver || (vOver && noScroll && !intentionalScroll))) {
        scrollN++;
        if (!scroll1) scroll1 = `${desc(el)} ${hOver ? 'H' : 'V'}-scroll ${el.scrollWidth}x${el.scrollHeight} vs client ${el.clientWidth}x${el.clientHeight}`;
      }

      // (b) exceeds a CLIPPING ancestor's client box (content cropped/hidden).
      // Skip position:fixed/sticky: they are positioned against the viewport (or a
      // transformed containing block), NOT their DOM ancestor, so "exceeds a DOM
      // ancestor" is not a real clip — a fixed top-right HUD legitimately sits
      // outside a centered column. Their off-screen risk is covered by (a)/(d).
      let p = (cs.position === 'fixed' || cs.position === 'sticky') ? null : el.parentElement;
      while (p && p !== document.body) {
        const pcs = getComputedStyle(p);
        // Stop at a fixed/sticky ancestor: it is the element's containing block, so
        // clippers ABOVE it don't clip this element (a static label inside a fixed
        // top-right HUD is bounded by the HUD, not by a centered column above it).
        if (pcs.position === 'fixed' || pcs.position === 'sticky') break;
        if (/^(hidden|auto|scroll|clip)$/.test(pcs.overflowX) || /^(hidden|auto|scroll|clip)$/.test(pcs.overflow)) {
          const pr = p.getBoundingClientRect();
          if (er.right > pr.right + TOL || er.left < pr.left - TOL) {
            overN++;
            if (!over1) over1 = `${desc(el)} exceeds clipping ${desc(p)} (el ${Math.round(er.left)}..${Math.round(er.right)} vs ${Math.round(pr.left)}..${Math.round(pr.right)})`;
          }
          break; // nearest clipping ancestor only
        }
        p = p.parentElement;
      }
    }
    if (clipTextN) out.push(`(c) ${clipTextN} clipped text: ${clipText1}`);
    if (overN) out.push(`(b) ${overN} clipped-by-parent: ${over1}`);
    if (scrollN) out.push(`(7) ${scrollN} scrollbar(s): ${scroll1}`);
    return out;
  }, { rootSel, overlay, noScroll, TOL });
}


for (const themeId of THEME_IDS) {
for (const vp of VIEWPORTS) {
  test.describe(`[${themeId}] @ ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });
    for (const screen of SCREENS) {
      test(`${screen.name}`, async ({ page }) => {
        test.setTimeout(40000);
        // THE CELL IS SKIPPED ONLY WHEN THE APP HAS NO WAY IN. `phone: false` is a statement
        // about the product at <=480px (see the note over SCREENS in support/screens.js), and
        // the reason is printed so a skipped cell reads as a known gap rather than as coverage
        // quietly going missing. Every other phone cell runs and asserts exactly as it does on
        // a desktop — the phone tree is measured, not excused.
        test.skip(
          vp.width <= PHONE_MENU_MAX && screen.phone === false,
          `no phone entry point: ${screen.phoneWhy || 'desktop-only'}`
        );
        // Apply the theme before any navigation in this test (init scripts run on every load,
        // before page scripts) so the app boots already in this palette.
        await page.addInitScript((t) => {
          try { localStorage.setItem('taw.theme', t); } catch { /* ignore */ }
        }, themeId);
        let violations;
        try {
          await screen.nav(page);
          // Measure the SETTLED layout: collapse animation/transition durations so
          // any entrance (e.g. the game-over stamp/stagger) finishes before we read
          // geometry — a transient mid-animation transform is not a layout bug.
          await freezeAnimations(page);
          await page.waitForTimeout(150);
          await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
          violations = await integrity(page, screen.root, screen.overlay, NOSCROLL.has(screen.name));
        } catch (e) {
          violations = ['NAV/EVAL ERROR: ' + String(e).split('\n')[0]];
        }
        // eslint-disable-next-line no-console
        console.log(`MATRIX | ${themeId.padEnd(8)} | ${vp.name.padEnd(9)} | ${screen.name.padEnd(24)} | ${violations.length ? 'FAIL: ' + violations.join(' ;; ') : 'PASS'}`);
        expect(violations, `[${themeId}] ${vp.name} / ${screen.name}`).toEqual([]);
      });
    }
  });
}
}
