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

const VIEWPORTS = [
  { name: '2560x1440', width: 2560, height: 1440 },
  { name: '1920x1080', width: 1920, height: 1080 },
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1366x768', width: 1366, height: 768 },
  { name: '1163x501', width: 1163, height: 501 },
  { name: '390x844', width: 390, height: 844 },
  { name: '360x640', width: 360, height: 640 },
];

const TOL = 2; // sub-pixel / rounding tolerance (px)

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
  await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
  await page.waitForTimeout(400);
}
const card = (page, id) => page.locator(`.game-card-magnet[data-game="${id}"] .game-card`);

async function bootRoom(page, gameType, players) {
  const mock = await installBackendMock(page);
  await page.goto('/?portal=1');
  await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
  mock.pushToClient({ type: 'room_update', payload: { code: 'ABCD', gameType, hostId: 'me', difficultyKey: 'chill', players } });
  return mock;
}
async function enterSolo(page, id) {
  await page.addInitScript(() => { try { localStorage.setItem('taw.xp', JSON.stringify({ lv: 40, into: 0 })); } catch { /* ignore */ } });
  await installBackendMock(page);
  await page.goto('/?portal=1&soloms=350');
  await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
  await page.waitForTimeout(400);
  await card(page, id).click({ force: true });
  await page.locator('.mode-dialog-shell').waitFor({ state: 'visible' });
  await page.locator('.mode-dialog-btn-create').click();
  await page.locator('.solo-root').waitFor({ state: 'visible' });
}

const ME = 'me';
const wbPlayers = [{ id: ME, name: 'YOU', lives: 3, isHost: true }, { id: 'p2', name: 'RIVAL', lives: 0 }];
const cbPlayers = [{ id: ME, name: 'YOU', isHost: true }, { id: 'p2', name: 'RIVAL' }];

// Each screen: name, root selector, overlay?, and an async nav(page) that lands on it.
const SCREENS = [
  { name: 'splash', root: '.splash-screen', overlay: true, nav: async (page) => { await installBackendMock(page); await page.goto('/'); await page.locator('.splash-screen').waitFor({ state: 'visible' }); await page.waitForTimeout(300); } },
  { name: 'menu', root: '.homepage-wrap', overlay: false, nav: async (page) => bootMenu(page, 40) },
  { name: 'dialog-word-bomb', root: '.mode-dialog-shell', overlay: true, nav: async (page) => { await bootMenu(page, 40); await card(page, 'word-bomb').click(); await page.locator('.mode-dialog-shell').waitFor({ state: 'visible' }); await page.waitForTimeout(300); } },
  { name: 'dialog-category-blitz', root: '.mode-dialog-shell', overlay: true, nav: async (page) => { await bootMenu(page, 40); await card(page, 'category-blitz').click(); await page.locator('.ppp-picker').waitFor({ state: 'visible' }); await page.waitForTimeout(300); } },
  { name: 'dialog-chain', root: '.mode-dialog-shell', overlay: true, nav: async (page) => { await bootMenu(page, 40); await card(page, 'chain').click(); await page.locator('.mode-dialog-shell').waitFor({ state: 'visible' }); await page.waitForTimeout(300); } },
  { name: 'dialog-fuse', root: '.mode-dialog-shell', overlay: true, nav: async (page) => { await bootMenu(page, 40); await card(page, 'fuse').click(); await page.locator('.mode-dialog-shell').waitFor({ state: 'visible' }); await page.waitForTimeout(300); } },
  { name: 'locked-chain', root: '.lp-panel', overlay: true, nav: async (page) => { await bootMenu(page, 1); await card(page, 'chain').click({ force: true }); await page.locator('.lp-panel').waitFor({ state: 'visible' }); await page.waitForTimeout(300); } },
  { name: 'locked-fuse', root: '.lp-panel', overlay: true, nav: async (page) => { await bootMenu(page, 16); await card(page, 'fuse').click({ force: true }); await page.locator('.lp-panel').waitFor({ state: 'visible' }); await page.waitForTimeout(300); } },
  { name: 'credits', root: '.credits-wrap', overlay: true, nav: async (page) => { await bootMenu(page, 40); await page.locator('.homepage-credits-link').click(); await page.locator('.credits-wrap').waitFor({ state: 'visible' }); await page.waitForTimeout(300); } },
  { name: 'shop', root: '.shop-panel', overlay: true, nav: async (page) => { await bootMenu(page, 40); await page.locator('.homepage-nav-btn.is-shop').click(); await page.locator('.shop-panel').waitFor({ state: 'visible' }); await page.waitForTimeout(300); } },
  { name: 'stats', root: '.stats-panel', overlay: true, nav: async (page) => { await bootMenu(page, 40); await page.locator('.homepage-nav-btn.is-stats').click(); await page.locator('.stats-panel').waitFor({ state: 'visible' }); await page.waitForTimeout(300); } },
  { name: 'lobby', root: '.lobby-wrap', overlay: false, nav: async (page) => { await bootMenu(page, 40); await card(page, 'word-bomb').click(); await page.locator('.mode-dialog-btn-create').click(); await page.locator('.lobby-wrap').waitFor({ state: 'visible' }); await page.waitForTimeout(300); } },
  { name: 'browser', root: '.browser-wrap', overlay: false, nav: async (page) => { await bootMenu(page, 40); await page.locator('.homepage-btn-join').click(); await page.locator('.browser-wrap').waitFor({ state: 'visible' }); await page.waitForTimeout(300); } },
  { name: 'room', root: '.room-wrap', overlay: false, nav: async (page) => { await bootRoom(page, 'word-bomb', wbPlayers); await page.locator('.room-wrap').waitFor({ state: 'visible' }); await page.waitForTimeout(300); } },
  { name: 'ingame-word-bomb', root: '.game-wrap', overlay: false, nav: async (page) => { const m = await bootRoom(page, 'word-bomb', wbPlayers); await page.waitForTimeout(80); m.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } }); await page.waitForTimeout(80); m.pushToClient({ type: 'turn_update', payload: { currentPlayerId: ME, players: wbPlayers, combo: 'at', usedWords: [], timerSeconds: 30 } }); await page.locator('.game-wrap').waitFor({ state: 'visible' }); await page.waitForTimeout(300); } },
  { name: 'ingame-category-blitz', root: '.game-wrap', overlay: false, nav: async (page) => { const m = await bootRoom(page, 'category-blitz', cbPlayers); await page.waitForTimeout(80); m.pushToClient({ type: 'game_started', payload: { gameType: 'category-blitz' } }); await page.waitForTimeout(80); m.pushToClient({ type: 'round_start', payload: { round: 1, timerSeconds: 60, category: 'FRUITS', categoryId: 'fruits', rerollsRemaining: 1 } }); await page.locator('.game-wrap').waitFor({ state: 'visible' }); await page.waitForTimeout(300); } },
  { name: 'gameover-word-bomb', root: '.game-over-overlay', overlay: true, nav: async (page) => { const m = await bootRoom(page, 'word-bomb', wbPlayers); await page.waitForTimeout(80); m.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } }); await page.waitForTimeout(80); m.pushToClient({ type: 'turn_update', payload: { currentPlayerId: ME, players: wbPlayers, combo: 'at', usedWords: [], timerSeconds: 30 } }); await page.waitForTimeout(80); m.pushToClient({ type: 'game_over', payload: { winnerId: ME } }); await page.locator('.game-over-overlay').waitFor({ state: 'visible' }); await page.waitForTimeout(500); } },
  { name: 'gameover-category-blitz', root: '.game-over-overlay', overlay: true, nav: async (page) => { const m = await bootRoom(page, 'category-blitz', cbPlayers); await page.waitForTimeout(80); m.pushToClient({ type: 'game_started', payload: { gameType: 'category-blitz' } }); await page.waitForTimeout(80); m.pushToClient({ type: 'round_start', payload: { round: 1, timerSeconds: 60, category: 'FRUITS', categoryId: 'fruits', rerollsRemaining: 1 } }); await page.waitForTimeout(60); m.pushToClient({ type: 'game_over', payload: { winnerId: ME, finalScores: [{ id: ME, name: 'YOU', score: 30 }, { id: 'p2', name: 'RIVAL', score: 10 }] } }); await page.locator('.game-over-overlay').waitFor({ state: 'visible' }); await page.waitForTimeout(500); } },
  { name: 'ingame-chain', root: '.solo-root', overlay: false, nav: async (page) => { await enterSolo(page, 'chain'); await page.waitForTimeout(200); } },
  { name: 'ingame-fuse', root: '.solo-root', overlay: false, nav: async (page) => { await enterSolo(page, 'fuse'); await page.waitForTimeout(200); } },
  { name: 'gameover-chain', root: '.solo-deathcard', overlay: true, nav: async (page) => { await enterSolo(page, 'chain'); const input = page.locator('.solo-root input').first(); await input.waitFor({ state: 'visible' }); await input.fill('a'); await page.locator('.solo-deathcard').waitFor({ state: 'visible', timeout: 8000 }); await page.waitForTimeout(300); } },
  { name: 'gameover-fuse', root: '.solo-deathcard', overlay: true, nav: async (page) => { await enterSolo(page, 'fuse'); const input = page.locator('.solo-root input').first(); await input.waitFor({ state: 'visible' }); await input.fill('a'); await page.locator('.solo-deathcard').waitFor({ state: 'visible', timeout: 8000 }); await page.waitForTimeout(300); } },
  { name: 'sat-modeselect', root: '.sr-modeselect', overlay: true, nav: async (page) => { await installBackendMock(page); await page.addInitScript(() => { try { localStorage.setItem('taw.xp', JSON.stringify({ lv: 40, into: 0 })); } catch { /* ignore */ } }); await page.goto('/?satRush=1&portal=1'); await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' }); await page.waitForTimeout(400); await page.locator('[data-game="sat-rush"] .game-card').click(); await page.getByRole('button', { name: 'Play' }).click(); await page.locator('.sr-modeselect').waitFor({ state: 'visible' }); await page.waitForTimeout(300); } },
  { name: 'sat-briefing', root: '.sr-brief-page', overlay: false, nav: async (page) => { await installBackendMock(page); await page.addInitScript(() => { try { localStorage.setItem('taw.xp', JSON.stringify({ lv: 40, into: 0 })); } catch { /* ignore */ } }); await page.goto('/?satRush=1&portal=1'); await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' }); await page.waitForTimeout(400); await page.locator('[data-game="sat-rush"] .game-card').click(); await page.getByRole('button', { name: 'Play' }).click(); await page.getByRole('button', { name: 'briefing' }).click(); await page.locator('.sr-brief-page').waitFor({ state: 'visible' }); await page.waitForTimeout(300); } },
];

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
      if (hasText && clipsText && el.scrollWidth > el.clientWidth + TOL) {
        clipTextN++;
        if (!clipText1) clipText1 = `${desc(el)} sw=${el.scrollWidth}>cw=${el.clientWidth} "${el.textContent.trim().slice(0, 24)}"`;
      }

      // (7) container that actually scrolls (scrollbar). HORIZONTAL overflow is
      // never acceptable anywhere. VERTICAL overflow is fine for content panels
      // (shop/stats/menu scroll by design) but NOT for dialogs / preview cards /
      // game-over cards, which must shrink to fit (noScroll screens).
      const hOver = el.scrollWidth > el.clientWidth + TOL;
      const vOver = el.scrollHeight > el.clientHeight + TOL;
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

// Dialogs, preview cards and game-over cards must FIT (shrink to content) — a
// scrollbar on these is a bug (fix/qa-sweep §7). Content panels (menu/shop/stats/
// browser/ingame) may scroll vertically; horizontal scroll is a bug everywhere.
const NOSCROLL = new Set([
  'dialog-word-bomb', 'dialog-category-blitz', 'dialog-chain', 'dialog-fuse',
  'locked-chain', 'locked-fuse', 'gameover-word-bomb', 'gameover-category-blitz',
  'gameover-chain', 'gameover-fuse', 'sat-modeselect',
]);

for (const vp of VIEWPORTS) {
  test.describe(`@ ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });
    for (const screen of SCREENS) {
      test(`${screen.name}`, async ({ page }) => {
        test.setTimeout(40000);
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
        console.log(`MATRIX | ${vp.name.padEnd(9)} | ${screen.name.padEnd(24)} | ${violations.length ? 'FAIL: ' + violations.join(' ;; ') : 'PASS'}`);
        expect(violations, `${vp.name} / ${screen.name}`).toEqual([]);
      });
    }
  });
}
