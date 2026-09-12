// e2e/overlay-modality.spec.js — NO MODALS FOR THINGS THAT ARE NOT CHOICES.
//
// The rule this enforces, in three parts:
//   1. A TRUE MODAL (it asks you to choose) must SWALLOW its dismiss click. Clicking its
//      backdrop — centre or any corner — may never reach an element behind it and may
//      never change the route. A scrim you can click through is not a scrim.
//   2. Anything PURELY INFORMATIONAL must not be a modal at all. It reacts in place, at
//      the element it concerns.
//   3. No informational element may be `position: fixed` with coordinates of its own
//      (CLAUDE.md NO ORPHAN FIXED UI). That is how the welcome-back card ended up on the
//      wordmark: it was fixed at top:16/left:50%, and what was underneath was the game's
//      own name — measured 309x88 of overlap at 1280x720, so TYPE A WORD read "TYP...RD"
//      on a returning player's first screen.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

const SEED = {
  'taw.keytier': '3', 'taw.wins': '5000', 'taw.winsLifetime': '9000',
  'taw.xp': JSON.stringify({ lv: 18, into: 40 }), 'taw.rebirths': '2', 'taw.letters': '1234',
};
const VIEWPORTS = [
  { name: '1366x768', width: 1366, height: 768 },
  { name: '1280x720', width: 1280, height: 720 },
  { name: '390x844', width: 390, height: 844 },
  { name: '320x640', width: 320, height: 640 },
];

async function menu(page, extra = {}) {
  await installBackendMock(page);
  await page.addInitScript((s) => {
    try { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); } catch { /* blocked */ }
  }, { ...SEED, ...extra });
  await page.goto('/?portal=1');
  await page.locator('.menu-xp-bar').waitFor({ state: 'visible' });
}

// A menu whose last-seen is 30h old, i.e. a real welcome-back grant on this load.
// The claim is once per CALENDAR DAY and the flag lives in localStorage, so a second load
// in the same context has no grant — clearing taw.returnClaim is what makes this callable
// more than once per test (the width ladder below re-enters ten times).
async function menuAfterAbsence(page) {
  await installBackendMock(page);
  await page.addInitScript((s) => {
    try {
      for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
      localStorage.removeItem('taw.returnClaim');
      localStorage.setItem('wa_last_seen', String(Date.now() - 30 * 3600000));
    } catch { /* blocked */ }
  }, SEED);
  await page.goto('/?portal=1');
  await page.locator('.menu-xp-bar').waitFor({ state: 'visible' });
  await page.waitForTimeout(500);
}

// Arm a capture-phase recorder, then click the backdrop's centre and its four corners.
// Returns what each click actually reached, and whether the route moved.
async function clickThrough(page, overlaySel) {
  await page.evaluate((s) => {
    window.__hits = [];
    window.__route0 = location.pathname + location.search + location.hash;
    window.__sel = s;
    if (!window.__armed) {
      window.__armed = true;
      document.addEventListener('click', (e) => {
        const ov = document.querySelector(window.__sel);
        const path = e.composedPath ? e.composedPath() : [e.target];
        // "behind" = the click landed on something that is NOT the overlay and NOT inside it
        const behind = !ov || !path.some((n) => n === ov || (n.nodeType === 1 && ov.contains(n)));
        const t = path[0];
        window.__hits.push({
          behind,
          what: t && t.nodeType === 1
            ? t.tagName.toLowerCase() + (typeof t.className === 'string' && t.className
              ? '.' + t.className.trim().split(/\s+/).slice(0, 2).join('.') : '')
            : String(t),
        });
      }, true);
    }
  }, overlaySel);

  const { width: w, height: h } = page.viewportSize();
  for (const [x, y] of [[w / 2, h / 2], [4, 4], [w - 4, 4], [4, h - 4], [w - 4, h - 4]]) {
    try { await page.mouse.click(Math.round(x), Math.round(y)); } catch { /* off-screen */ }
    await page.waitForTimeout(50);
  }
  return page.evaluate(() => ({
    hits: window.__hits,
    routeChanged: (location.pathname + location.search + location.hash) !== window.__route0,
  }));
}

// ---------------------------------------------------------------------------
// 1. TRUE MODALS SWALLOW THEIR DISMISS CLICK
// ---------------------------------------------------------------------------
const MODALS = [
  ['STATS', '.homepage-nav-btn.is-stats', '.stats-overlay'],
  ['SHOP', '.homepage-nav-btn.is-shop', '.shop-overlay'],
  ['REBIRTH', '.homepage-nav-btn.is-rebirth', '.shop-overlay'],
];

for (const [label, opener, sel] of MODALS) {
  test(`${label}: the backdrop swallows every dismiss click`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await menu(page);
    await page.locator(opener).click();
    await expect(page.locator(sel)).toBeVisible();
    await page.waitForTimeout(250);

    // it must actually be modal: full-bleed, and announced as one
    const shape = await page.evaluate((s) => {
      const el = document.querySelector(s);
      const r = el.getBoundingClientRect();
      return {
        cover: (r.width * r.height) / (innerWidth * innerHeight),
        pe: getComputedStyle(el).pointerEvents,
        modal: el.getAttribute('aria-modal'),
        role: el.getAttribute('role'),
      };
    }, sel);
    expect(shape.cover, `${label} does not cover the viewport`).toBeGreaterThan(0.98);
    expect(shape.pe, `${label} lets pointers through`).not.toBe('none');
    expect(shape.modal, `${label} is not announced as modal`).toBe('true');
    expect(shape.role, `${label} has no dialog role`).toBe('dialog');

    const res = await clickThrough(page, sel);
    const leaked = res.hits.filter((hh) => hh.behind);
    expect(leaked, `clicks reached past ${label}: ${leaked.map((l) => l.what).join(', ')}`).toHaveLength(0);
    expect(res.routeChanged, `${label} let a click change the route`).toBe(false);
  });
}

// ---------------------------------------------------------------------------
// 2. THE COACH MARK IS NOT A MODAL — it must never swallow the first input
// ---------------------------------------------------------------------------
test('the spotlight coach mark passes every click through to the app', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await menu(page);
  const spot = page.locator('.spotlight-overlay');
  await expect(spot).toBeVisible();
  const pe = await page.evaluate(() => getComputedStyle(document.querySelector('.spotlight-overlay')).pointerEvents);
  // The whole point of a coach mark is that it teaches without blocking: the very first
  // keystroke must land in the app, not in the overlay.
  expect(pe, 'the coach mark must be pointer-events:none').toBe('none');
});

// ---------------------------------------------------------------------------
// 3. NO ORPHAN FIXED INFORMATIONAL UI — and specifically, nothing on the wordmark
// ---------------------------------------------------------------------------
for (const vp of VIEWPORTS) {
  test(`welcome-back grant reacts at the counter, not over the wordmark — ${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await menuAfterAbsence(page);

    const r = await page.evaluate(() => {
      const g = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; };
      const chip = document.querySelector('.menu-wins-chip');
      return {
        card: g('.return-bonus'),                 // the retired fixed card — must be gone
        bonus: g('.menu-wins-bonus'),
        winsChip: g('.menu-wins-chip'),
        granted: !!(chip && chip.classList.contains('is-granted')),
        logo: g('.homepage-logo'),
        track: g('.menu-xp-track'),
        scroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      };
    });

    // the orphan is gone at every width
    expect(r.card, 'the fixed welcome-back card is back').toBeNull();
    // the grant is acknowledged AT the counter, one way or the other
    expect(r.winsChip, 'no wins counter to react at').not.toBeNull();
    expect(r.granted, 'the wins counter does not show the grant').toBe(true);

    // Under 480px the chip is display:none (the strip has no width to give — see the
    // note in MenuXp.css) and a display:none rect reads as all zeros, so absence is
    // "no box", not "no node".
    if (r.bonus && r.bonus.w > 0) {
      // where it is drawn, it is drawn IN the strip beside the counter — not floating
      const gap = r.bonus.x - (r.winsChip.x + r.winsChip.w);
      expect(gap, `the grant chip is not beside the counter (gap ${Math.round(gap)}px)`).toBeLessThan(40);
      expect(Math.abs(r.bonus.y - r.winsChip.y), 'the grant chip is off the counter row').toBeLessThan(30);
      // and it never lands on the wordmark
      if (r.logo) {
        const ov = Math.min(r.bonus.x + r.bonus.w, r.logo.x + r.logo.w) - Math.max(r.bonus.x, r.logo.x);
        const oh = Math.min(r.bonus.y + r.bonus.h, r.logo.y + r.logo.h) - Math.max(r.bonus.y, r.logo.y);
        expect(ov > 4 && oh > 4, `the grant covers ${Math.round(ov)}x${Math.round(oh)} of the wordmark`).toBe(false);
      }
    }
    expect(r.scroll, 'the grant made the menu scroll sideways').toBe(false);
    // it must not have eaten the XP track (see the ladder test below)
    if (r.track) expect(r.track.w, `XP track squeezed to ${Math.round(r.track.w)}px`).toBeGreaterThanOrEqual(55);
  });
}

// ---------------------------------------------------------------------------
// 5. THE XP TRACK NEVER COLLAPSES — the defect the grant work walked into
// ---------------------------------------------------------------------------
// The menu strip sheds chips as it narrows, and the breakpoints were one stop out. The
// rank chip dropped at 380px, tuned against viewport-integrity's 360x640 — a width BELOW
// the threshold, so the test that motivated the rule never saw where it fails. Measured
// baseline before the fix, with no grant on screen:
//
//   1366:353  1280:353  900:236  768:105  600:113  480:51  430:40  390:4  360:55  320:15
//
// Four pixels at 390 — the commonest phone width there is, and WORSE than 320, because at
// 360 the chip finally drops and the track jumps back to 55. Non-monotonic collapse is the
// signature of a breakpoint in the wrong place, and it is invisible to any test that only
// samples the two ends. This walks the whole ladder, with and without the grant.
const TRACK_WIDTHS = [1366, 1280, 900, 768, 600, 480, 430, 390, 360, 320];
const TRACK_FLOOR = 55;

for (const grant of [false, true]) {
  test(`the XP track holds at least ${TRACK_FLOOR}px at every width — grant=${grant}`, async ({ page }) => {
    const seen = [];
    for (const w of TRACK_WIDTHS) {
      await page.setViewportSize({ width: w, height: 800 });
      if (grant) await menuAfterAbsence(page); else await menu(page);
      await page.waitForTimeout(250);
      const t = await page.evaluate(() => {
        const e = document.querySelector('.menu-xp-track');
        return e ? Math.round(e.getBoundingClientRect().width) : null;
      });
      if (grant) {
        // the chip clears itself after 7s / on the first input — if it has gone, this rung
        // is measuring the ungranted layout and the test would silently pass on the wrong thing
        const live = await page.evaluate(() => !!document.querySelector('.menu-xp-bar.has-grant'));
        expect(live, `the grant was not on screen at ${w}px — the ladder is measuring nothing`).toBe(true);
      }
      seen.push(`${w}:${t}`);
      expect(t, `XP track at ${w}px is ${t} — ladder so far ${seen.join(' ')}`).not.toBeNull();
      expect(t, `XP track collapsed at ${w}px — ladder ${seen.join(' ')}`).toBeGreaterThanOrEqual(TRACK_FLOOR);
    }
    // and it must never be WIDER on a narrower screen: that non-monotonicity is what a
    // misplaced breakpoint looks like from the outside.
    const vals = seen.map((x) => Number(x.split(':')[1]));
    for (let i = 1; i < vals.length; i++) {
      expect(vals[i], `track grows as the screen shrinks — ${seen.join(' ')}`).toBeLessThanOrEqual(vals[i - 1] + 40);
    }
  });
}

// ---------------------------------------------------------------------------
// 4. IT CLEARS ITSELF — an informational reaction never needs a dismiss control
// ---------------------------------------------------------------------------
test('the grant clears on the first input, with no dismiss button to find', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await menuAfterAbsence(page);
  await expect(page.locator('.menu-wins-bonus')).toBeVisible();
  expect(await page.locator('.return-bonus-close').count(), 'the old dismiss button is back').toBe(0);
  await page.keyboard.press('a');
  await page.waitForTimeout(400);
  await expect(page.locator('.menu-wins-bonus')).toHaveCount(0);
});
