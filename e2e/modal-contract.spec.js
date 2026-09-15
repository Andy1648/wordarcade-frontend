// e2e/modal-contract.spec.js — THE MODAL CONTRACT, and THE CLICK-THROUGH GATE.
//
// A full-screen modal is only justified when the player has a CHOICE to make, and every modal
// that IS justified owes the player four things:
//
//   1. Escape closes it.
//   2. Focus moves IN when it opens.
//   3. Focus is CONTAINED while it is open — Tab may not walk out onto the live page behind.
//   4. Focus RETURNS to the control that opened it.
//
// (3) and (4) were the two that were missing almost everywhere. Measured on the built bundle at
// 1280x720, 12 Tab presses from open, BEFORE fix/modal-contract:
//
//   ModeDialog           0/12 escaped   focus after close: BODY
//   LockedPreviewDialog 11/12 escaped   (tab 2 was already on the live menu)
//   RankLadder           8/12 escaped   focus after close: BODY
//   MarksPicker         10/12 escaped   focus never entered, and ESCAPE DID NOTHING
//   StatsScreen          2/12 escaped   (onto the app-level audio button)
//   ShopScreen           0/12 at 12 — it has ~30 controls; it escaped on the wrap
//
// ---------------------------------------------------------------------------------------------
// WHAT THIS GATE DOES **NOT** ASSERT — read this before trusting it:
//
//  * It does not prove a modal is JUSTIFIED. `presentsAChoice` is a STRUCTURAL check (does the
//    dialog contain an enabled control that is not its own dismiss affordance). The judgement
//    that RankLadder is a player-invoked READ-ONLY SCREEN rather than a defect is a human call,
//    recorded in the SCREENS allowlist below. A new modal that reports rather than asks will fail
//    this gate; it cannot tell you whether an existing exemption is still honest.
//  * It does not assert screen-reader behaviour. It asserts the TAB RING. `aria-modal="true"`
//    governs a virtual cursor and nothing here checks that; no overlay in this app uses `inert`.
//  * It does not cover the IN-GAME overlays (GameScreen, Sticker/ShopSticker, Transitions) — a
//    different owner. `[aria-modal="true"]` is only enumerated on the MENU and its overlays.
//  * It does NOT use playwright.config.js's `use.reducedMotion`. That option is INERT in this
//    project — it does not flip `matchMedia('(prefers-reduced-motion: reduce)')`; see
//    e2e/motion-contract.spec.js, which pins that fact. Nothing here depends on reduced motion;
//    where a close is animated (ModeDialog fades for 200ms) the test WAITS for the node to be
//    detached rather than assuming a duration.
//  * The click-through test (§2) runs only at widths where a live control is actually EXPOSED
//    beside the dialog. At 390x844 and 320x640 no card is exposed, so a fall-through has nothing
//    to land on; §2b asserts that emptiness rather than leaving the narrow widths unmentioned.
//  * §2 drives a MOUSE (`page.mouse.down/up`), not a touchscreen. A real touch tap at 390x844
//    was measured by hand during this work and produced the same result, but no touch project
//    exists in playwright.config.js, so touch is NOT gated here.
//  * It exercises ONE dismiss coordinate per viewport (the centre of an exposed card), not every
//    pixel of the backdrop. e2e/overlay-modality.spec.js already sweeps centre + four corners for
//    Stats/Shop/Rebirth; this adds the gesture-level question that one does not ask.
//  * §4 asserts the close control is ON SCREEN after scrolling every scroller to its end. It does
//    NOT assert the modal is otherwise well laid out at that width — three separate layout
//    defects at 320x640 (a squashed marks grid, an overprinted stats tab bar, a mastery line cut
//    mid-word) were all green here and were found by READING THE SCREENSHOTS, not by this gate.
// ---------------------------------------------------------------------------------------------
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

const SEED = {
  'taw.keytier': '3', 'taw.wins': '5000', 'taw.winsLifetime': '9000',
  'taw.xp': JSON.stringify({ lv: 18, into: 40 }), 'taw.rebirths': '2', 'taw.letters': '1234',
};

async function menu(page) {
  await installBackendMock(page);
  await page.addInitScript((s) => {
    try { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); } catch { /* blocked */ }
  }, SEED);
  await page.goto('/?portal=1');
  await page.locator('.menu-xp-bar').waitFor({ state: 'visible' });
}

// Every overlay on the menu that declares aria-modal.
//   choice:  does it ASK the player something? (structural check below must agree)
//   opener:  the control that opens it — also the control focus must come back to
//   taps:    Tab presses to walk; must exceed the control count so the WRAP is exercised
//   wide:    the opener only exists above a breakpoint (the mark chip is display:none <=430px)
const MODALS = [
  { name: 'ModeDialog', sel: '.mode-dialog-shell', opener: '.game-card:not(.locked)', choice: true, taps: 10 },
  { name: 'LockedPreviewDialog', sel: '.lp-panel', opener: '.game-card.locked', choice: false, taps: 8, force: true },
  { name: 'RankLadder', sel: '.rank-overlay', opener: '.menu-xp-rank--btn', choice: false, taps: 8, wide: 480 },
  { name: 'MarksPicker', sel: '.marks-overlay', opener: '.menu-mark', choice: true, taps: 12, wide: 430 },
  { name: 'StatsScreen', sel: '.stats-overlay', opener: '.homepage-nav-btn.is-stats', choice: true, taps: 40 },
  { name: 'ShopScreen', sel: '.shop-overlay', opener: '.homepage-nav-btn.is-shop', choice: true, taps: 60 },
];

// Overlays that declare aria-modal but ask NOTHING. Each is a player-INVOKED read-only screen —
// you go and open it — not an interruption that appeared and demanded a decision. They keep
// aria-modal because they genuinely ARE modal in behaviour (opaque full-bleed backdrop, pointer
// input blocked), and a screen reader being told the page behind is gone is the truth.
// ADDING TO THIS LIST IS A DESIGN DECISION, not a way past a red test.
//
// LockedPreviewDialog is in here because the STRUCTURAL check put it here: this gate was written
// with it marked `choice: true` — CLAUDE-adjacent intuition said "a dialog on a card you clicked
// must be offering you something" — and it went red at all five viewports with
// `offers only a dismiss: ["Close"]`. Its own header comment agrees: "No PLAY button — it's a
// teaser, not an entry." So it is a screen, and the gate, not the author, is what said so.
const SCREENS = {
  RankLadder: 'read-only ladder of all ten ranks; opened by clicking your own rank chip',
  LockedPreviewDialog: 'read-only teaser for a level-gated mode; there is nothing to press',
};

const VIEWPORTS = [
  { name: '1536x864', width: 1536, height: 864 },
  { name: '1366x768', width: 1366, height: 768 },
  { name: '1280x720', width: 1280, height: 720 },
  { name: '390x844', width: 390, height: 844 },
  { name: '320x640', width: 320, height: 640 },
];

async function openModal(page, m, vp) {
  // The mark chip is display:none below 430px by design (MenuXp.css) — there is no width at
  // which a decorative slot is worth clipping the level readout. So open it wide, then narrow
  // WITH IT OPEN: the contract still has to hold at 320.
  if (m.wide && vp.width <= m.wide) {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(150);
    await page.locator(m.opener).first().click();
    await page.locator(m.sel).waitFor({ state: 'visible' });
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.waitForTimeout(250);
    return;
  }
  await page.locator(m.opener).first().click({ force: !!m.force });
  await page.locator(m.sel).waitFor({ state: 'visible' });
}

// ---------------------------------------------------------------------------------------------
// 1. THE FOUR-PART CONTRACT, at every viewport
// ---------------------------------------------------------------------------------------------
for (const vp of VIEWPORTS) {
  for (const m of MODALS) {
    test(`${m.name} honours the modal contract — ${vp.name}`, async ({ page }) => {
      test.setTimeout(60_000); // ShopScreen walks a 60-long focus ring
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await menu(page);
      await openModal(page, m, vp);
      await page.waitForTimeout(350);

      // --- it announces itself as a modal, and the announcement is on the focus host
      const shape = await page.evaluate((s) => {
        const el = document.querySelector(s);
        const cs = getComputedStyle(el);
        return {
          modal: el.getAttribute('aria-modal'),
          role: el.getAttribute('role'),
          label: el.getAttribute('aria-label'),
          tabindex: el.getAttribute('tabindex'),
          pe: cs.pointerEvents,
        };
      }, m.sel);
      expect(shape.modal, `${m.name} does not declare aria-modal`).toBe('true');
      expect(shape.role, `${m.name} has no dialog role`).toBe('dialog');
      expect(shape.pe, `${m.name} lets pointers through`).not.toBe('none');
      // The element that carries role=dialog must be focusable-by-script, or "focus moves in"
      // has nowhere to land and the trap has no home.
      expect(shape.tabindex, `${m.name} role=dialog host is not tabIndex=-1`).toBe('-1');

      // --- (a) CHOICE. Structural: an enabled control that is not the dismiss affordance.
      const interactive = await page.evaluate((s) => {
        const el = document.querySelector(s);
        return Array.from(el.querySelectorAll('button, [href], input, select, textarea'))
          .filter((b) => !b.disabled && b.offsetParent !== null)
          .map((b) => (b.getAttribute('aria-label') || b.textContent || '').trim().slice(0, 24));
      }, m.sel);
      const isDismiss = (t) => /^(✕|close|back to menu|← back to menu)$/i.test(t);
      const presentsAChoice = interactive.some((t) => !isDismiss(t));
      if (m.choice) {
        expect(presentsAChoice, `${m.name} claims to be a choice but offers only a dismiss: ${JSON.stringify(interactive)}`).toBe(true);
      } else {
        // It asks nothing. That is only allowed if it is a documented player-invoked SCREEN...
        expect(SCREENS[m.name],
          `${m.name} declares aria-modal, asks nothing, and is not in the documented SCREENS allowlist`).toBeTruthy();
        // ...and the allowlist has to stay honest: if it GROWS a real choice, it stops being a
        // screen and the entry must be removed rather than silently covering a new control.
        expect(presentsAChoice,
          `${m.name} is listed as a read-only SCREEN but now offers ${JSON.stringify(interactive)} — reclassify it`).toBe(false);
      }

      // --- (b) FOCUS MOVES IN
      const landed = await page.evaluate((s) => {
        const el = document.querySelector(s);
        return !!(el && el.contains(document.activeElement));
      }, m.sel);
      expect(landed, `${m.name} did not move focus into itself on open`).toBe(true);

      // --- (c) FOCUS IS CONTAINED, across a full wrap of the ring.
      // Recorded IN THE PAGE (one round-trip, not one per Tab — ShopScreen's ring is 60 long and
      // a round-trip per press blew the 30s test cap). Both directions matter:
      //   focusin  outside the dialog  -> Tab reached the live page behind
      //   focusout with no relatedTarget -> focus left the document entirely (lands on BODY,
      //                                     which fires NO focusin, so the naive check misses it)
      await page.evaluate((s) => {
        window.__esc = [];
        const desc = (a) => (a ? a.tagName + '.' + String(a.className).slice(0, 34) : 'none');
        document.addEventListener('focusin', () => {
          const el = document.querySelector(s);
          if (!(el && el.contains(document.activeElement))) window.__esc.push(desc(document.activeElement));
        }, true);
        document.addEventListener('focusout', (e) => {
          const el = document.querySelector(s);
          if (el && el.contains(e.target) && !e.relatedTarget) window.__esc.push('LEFT THE DOCUMENT');
        }, true);
      }, m.sel);
      for (let i = 0; i < m.taps; i++) await page.keyboard.press('Tab');
      const escapees = await page.evaluate(() => window.__esc);
      const finalOutside = await page.evaluate((s) => {
        const el = document.querySelector(s);
        const a = document.activeElement;
        return el && el.contains(a) ? null : (a ? a.tagName + '.' + String(a.className).slice(0, 34) : 'none');
      }, m.sel);
      if (finalOutside) escapees.push(`final:${finalOutside}`);
      expect(escapees, `${m.name} let Tab walk out of the modal after ${m.taps} presses: ${escapees.join(', ')}`).toHaveLength(0);

      // --- (b again) ESCAPE CLOSES, and (d) FOCUS RETURNS to the opener
      await page.keyboard.press('Escape');
      await page.locator(m.sel).waitFor({ state: 'detached' });
      // The mark chip is display:none at these widths, so there is nothing on screen to return
      // focus TO — the contract can only be checked where the opener still exists.
      if (!(m.wide && vp.width <= m.wide)) {
        const returned = await page.evaluate((o) => {
          const want = document.querySelector(o);
          return { matched: !!want && want === document.activeElement, active: document.activeElement.tagName + '.' + String(document.activeElement.className).slice(0, 40) };
        }, m.opener);
        expect(returned.matched, `${m.name} did not return focus to ${m.opener} (focus is on ${returned.active})`).toBe(true);
      }
    });
  }
}

// ---------------------------------------------------------------------------------------------
// 1b. NOTHING CLAIMS aria-modal WITHOUT BEING IN THE TABLE ABOVE
//
// The per-modal tests can only check what they are told about. This one opens every overlay the
// menu can reach and asserts the set of things declaring aria-modal is EXACTLY the audited set —
// so a seventh modal cannot arrive unaudited and inherit none of the contract.
// ---------------------------------------------------------------------------------------------
test('the set of aria-modal elements on the menu is exactly the audited set', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await menu(page);
  const seen = [];
  for (const m of MODALS) {
    await page.locator(m.opener).first().click({ force: !!m.force });
    await page.locator(m.sel).waitFor({ state: 'visible' });
    await page.waitForTimeout(250);
    const found = await page.evaluate(() => Array.from(document.querySelectorAll('[aria-modal="true"]'))
      .map((e) => String(e.className).trim().split(/\s+/)[0]));
    seen.push({ name: m.name, found });
    await page.keyboard.press('Escape');
    await page.locator(m.sel).waitFor({ state: 'detached' });
    await page.waitForTimeout(150);
  }
  // every open state showed exactly ONE aria-modal element, and it was that modal's own root
  for (const { name, found } of seen) {
    expect(found.length, `${name}: ${found.length} elements declared aria-modal at once (${found.join(', ')})`).toBe(1);
  }
  const roots = seen.map((x) => x.found[0]).sort();
  expect(roots).toEqual(['lp-panel', 'marks-overlay', 'mode-dialog-shell', 'rank-overlay', 'shop-overlay', 'stats-overlay']);
  // and with everything closed, nothing is left claiming it
  expect(await page.locator('[aria-modal="true"]').count(), 'an aria-modal element survived its own close').toBe(0);
});

// ---------------------------------------------------------------------------------------------
// 2. THE CLICK-THROUGH GATE — a backdrop dismiss must not activate what it reveals
//
// Not `scrim.click()`: a REAL pointerdown/pointerup/click sequence at a coordinate that sits over
// a live mode card. The Sticker component's own source records that this bug class already
// happened once here ("the old pointer-events:none secret stamp did exactly that and opened SAT
// RUSH"), and a dismiss-tap that falls through onto a mode card launches a game.
// ---------------------------------------------------------------------------------------------
async function exposedCard(page, panelSel) {
  const p = await page.locator(panelSel).boundingBox();
  const cards = page.locator('.game-card');
  for (let i = 0, n = await cards.count(); i < n; i++) {
    const b = await cards.nth(i).boundingBox();
    if (!b) continue;
    const mx = b.x + b.width / 2;
    const my = b.y + b.height / 2;
    if (mx < p.x - 5 || mx > p.x + p.width + 5 || my < p.y - 5 || my > p.y + p.height + 5) return { b, mx, my };
  }
  return null;
}

for (const vp of VIEWPORTS.filter((v) => v.width >= 1280)) {
  for (const m of [
    { name: 'ModeDialog', sel: '.mode-dialog-shell', opener: '.game-card:not(.locked)', scrim: '.mode-dialog-scrim' },
    { name: 'LockedPreviewDialog', sel: '.lp-panel', opener: '.game-card.locked', scrim: '.lp-scrim', force: true },
  ]) {
    test(`${m.name}: the dismiss gesture does not activate the card it reveals — ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await menu(page);
      await page.locator(m.opener).first().click({ force: !!m.force });
      await page.locator(m.sel).waitFor({ state: 'visible' });
      await page.waitForTimeout(350);

      const spot = await exposedCard(page, m.sel);
      expect(spot, `no live card is exposed beside ${m.name} at ${vp.name} — this test has nothing to prove`).not.toBeNull();

      // the scrim really is the thing under that pixel
      const under = await page.evaluate(([x, y]) => {
        const e = document.elementFromPoint(x, y);
        return e ? e.className : 'none';
      }, [Math.round(spot.mx), Math.round(spot.my)]);
      expect(String(under), `${m.name}: the backdrop is not the topmost element over the card`).toContain(m.scrim.slice(1));

      await page.evaluate(() => {
        window.__hits = [];
        window.__route0 = location.pathname + location.search;
        for (const t of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
          document.addEventListener(t, (e) => {
            const el = e.target;
            window.__hits.push({
              t,
              onCard: !!(el.nodeType === 1 && el.closest && el.closest('.game-card')),
              what: el.nodeType === 1 ? el.tagName + '.' + String(el.className).slice(0, 30) : String(el),
            });
          }, true);
        }
      });

      // ONE physical gesture, at the card's centre.
      await page.mouse.move(Math.round(spot.mx), Math.round(spot.my));
      await page.mouse.down();
      await page.mouse.up();
      await page.locator(m.sel).waitFor({ state: 'detached' });
      await page.waitForTimeout(400);

      const res = await page.evaluate(() => ({
        hits: window.__hits,
        routeChanged: (location.pathname + location.search) !== window.__route0,
        menuStillUp: !!document.querySelector('.homepage-wrap'),
        // the thing a fall-through would have OPENED
        modeDialogOpen: !!document.querySelector('.mode-dialog-shell'),
        lockedOpen: !!document.querySelector('.lp-panel'),
      }));
      const onCard = res.hits.filter((h) => h.onCard);
      expect(onCard, `${m.name}: the dismiss gesture reached the card beneath — ${JSON.stringify(onCard)}`).toHaveLength(0);
      expect(res.hits.length, `${m.name}: the gesture produced no events at all — the test measured nothing`).toBeGreaterThan(0);
      expect(res.routeChanged, `${m.name}: the dismiss changed the route`).toBe(false);
      expect(res.menuStillUp, `${m.name}: the dismiss navigated off the menu`).toBe(true);
      expect(res.modeDialogOpen || res.lockedOpen, `${m.name}: the dismiss opened another dialog`).toBe(false);
    });
  }
}

// §2b — at phone widths there is nothing behind to leak INTO, and that is worth pinning: if a
// future layout leaves a live card exposed beside a 320-wide dialog, the leak question comes back
// and §2 above (which only runs >= 1280) would not be asking it.
for (const vp of VIEWPORTS.filter((v) => v.width < 1280)) {
  test(`no live menu control is exposed beside an open dialog — ${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await menu(page);
    await page.locator('.game-card:not(.locked)').first().click();
    await page.locator('.mode-dialog-shell').waitFor({ state: 'visible' });
    await page.waitForTimeout(350);
    const spot = await exposedCard(page, '.mode-dialog-shell');
    expect(spot,
      `a mode card is exposed beside the dialog at ${vp.name} — §2's click-through question now applies at this width too`).toBeNull();
  });
}

// ---------------------------------------------------------------------------------------------
// 3. NOTHING INFORMATIONAL BLOCKS POINTER INPUT
// ---------------------------------------------------------------------------------------------
test('the first-run coach mark is informational and must not block pointer input', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await menu(page);
  const spot = page.locator('.spotlight-overlay');
  await expect(spot).toBeVisible();
  const state = await page.evaluate(() => {
    const el = document.querySelector('.spotlight-overlay');
    return { pe: getComputedStyle(el).pointerEvents, modal: el.getAttribute('aria-modal') };
  });
  expect(state.pe, 'the coach mark must be pointer-events:none').toBe('none');
  expect(state.modal, 'a coach mark must never claim aria-modal — it asks nothing').not.toBe('true');
});

test('the lazy-overlay skeleton is a status, not a modal, and traps nothing', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  // HOLD the Stats chunk until this test says so, so the Suspense fallback is guaranteed to be
  // the thing on screen. Two traps, both hit while writing this:
  //   1. A fixed `setTimeout` delay is a RACE, not a hold — App warms the Stats/Shop chunks on
  //      idle (App.jsx ~2100), and under one worker the prefetch won and the fallback never
  //      rendered. Hence a promise this test releases itself.
  //   2. `installBackendMock` installs a CATCH-ALL `page.route('**/*')`. Playwright matches
  //      routes in REVERSE registration order, so a route registered BEFORE it never fires —
  //      measured: 0 route hits while `page.on('request')` plainly showed StatsScreen-*.js being
  //      fetched. This one is registered AFTER the mock, which is the only order that works.
  await installBackendMock(page);
  await page.addInitScript((s) => {
    try { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); } catch { /* blocked */ }
  }, SEED);
  let release;
  const held = new Promise((r) => { release = r; });
  let routeHits = 0;
  await page.route((u) => u.href.includes('StatsScreen'), async (route) => {
    routeHits += 1;
    await held;
    await route.continue();
  });
  await page.goto('/?portal=1');
  await page.locator('.menu-xp-bar').waitFor({ state: 'visible' });
  await page.locator('.homepage-nav-btn.is-stats').click();

  const sk = page.locator('.ovsk-overlay');
  await expect(sk).toBeVisible();
  const state = await page.evaluate(() => {
    const el = document.querySelector('.ovsk-overlay');
    return {
      role: el.getAttribute('role'),
      modal: el.getAttribute('aria-modal'),
      busy: el.getAttribute('aria-busy'),
      focusables: el.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])').length,
    };
  });
  // It reports; it does not ask. So it must not claim to be a dialog — and because it holds no
  // controls at all, there is nothing to trap and no way for a player to be stuck inside it: it
  // is replaced the instant the chunk lands.
  expect(state.role, 'the skeleton should be a status region').toBe('status');
  expect(state.modal, 'a loading placeholder must not claim aria-modal').not.toBe('true');
  expect(state.busy).toBe('true');
  expect(state.focusables, 'the skeleton grew controls — it is no longer a placeholder').toBe(0);
  expect(routeHits, 'the chunk hold never fired — this test proved nothing').toBeGreaterThan(0);
  release();
  await expect(page.locator('.stats-overlay')).toBeVisible(); // and it really was only a placeholder
  await expect(sk).toHaveCount(0);
});

// ---------------------------------------------------------------------------------------------
// 4. NOBODY IS TRAPPED AT 320x640 — the way out is on screen even after scrolling to the end
// ---------------------------------------------------------------------------------------------
const SMALL = [
  { name: 'MarksPicker', sel: '.marks-overlay', close: '.marks-close', wide: 430, opener: '.menu-mark' },
  { name: 'RankLadder', sel: '.rank-overlay', close: '.rank-close', opener: '.menu-xp-rank--btn', wide: 480 },
  { name: 'StatsScreen', sel: '.stats-overlay', close: '.stats-close', opener: '.homepage-nav-btn.is-stats' },
  { name: 'ShopScreen', sel: '.shop-overlay', close: '.shop-close', opener: '.homepage-nav-btn.is-shop' },
];

for (const vp of [{ name: '320x640', width: 320, height: 640 }, { name: '390x844', width: 390, height: 844 }]) {
  for (const s of SMALL) {
    test(`${s.name} keeps a visible way out after scrolling to the end — ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await menu(page);
      await openModal(page, { ...s, taps: 0 }, vp);
      await page.waitForTimeout(300);

      const out = await page.evaluate(([closeSel, overlaySel]) => {
        // Scroll EVERY scrollable node inside the overlay to its end — not a named one. The
        // first version of this test scrolled `.marks-grid`, which only EXISTS after the fix;
        // against the defect it was written for (the whole `.marks-card` was the scroller and
        // took the ✕ with it) it scrolled nothing and passed. A gate that only knows the shape
        // of the fix cannot see the bug.
        const ov = document.querySelector(overlaySel);
        for (const el of [ov, ...ov.querySelectorAll('*')]) {
          if (el.scrollHeight > el.clientHeight + 1) el.scrollTop = el.scrollHeight;
        }
        // ...and the page itself, in case the panel is the document scroller
        window.scrollTo(0, document.body.scrollHeight);
        const c = document.querySelector(closeSel);
        if (!c) return { missing: true };
        const r = c.getBoundingClientRect();
        return {
          y: Math.round(r.y),
          x: Math.round(r.x),
          w: Math.round(r.width),
          h: Math.round(r.height),
          onScreen: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth,
          sideScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        };
      }, [s.close, s.sel]);

      expect(out.missing, `${s.name} has no ${s.close}`).toBeFalsy();
      expect(out.onScreen,
        `${s.name} scrolled its own exit off screen at ${vp.name} — close is ${out.w}x${out.h} at (${out.x}, ${out.y}), viewport ${vp.width}x${vp.height}`).toBe(true);
      expect(out.sideScroll, `${s.name} made the page scroll sideways at ${vp.name}`).toBe(false);

      // ...and the keyboard exit works from the bottom of the list, too.
      await page.keyboard.press('Escape');
      await page.locator(s.sel).waitFor({ state: 'detached' });
    });
  }
}
