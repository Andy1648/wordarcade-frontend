// e2e-shots/mobile-keyboard.spec.js — BATCH F's camera: mobile WITH THE KEYBOARD RAISED.
//
// Every mobile audit so far measured the screen at REST, which is a state a player typing a word
// never sees. This drives each typing screen at the two sizes Andy named and reports, per element:
// undersized touch targets, anything clipped out of the viewport, anything occluded by something
// on top of it (hit-tested, so it finds collisions nobody predicted), and anything behind the
// keyboard.
//
// THE TWO PLATFORMS DIFFER AND BOTH MATTER:
//   ANDROID Chrome — the LAYOUT viewport resizes. 100vh shrinks, the page reflows, fixed elements
//     re-pin to the new (higher) bottom edge. Reproduced by actually setting a shorter viewport.
//   iOS Safari — the layout viewport is UNCHANGED; only visualViewport shrinks. position:fixed
//     stays pinned to the ORIGINAL bottom, i.e. UNDERNEATH the keyboard. Reproduced by keeping the
//     full viewport and treating everything below the keyboard line as covered.
//
// Run: SHOTS=claude/shots/kb npx playwright test --config=playwright.shots.config.js mobile-keyboard
import { test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { SCREENS } from '../e2e/support/screens.js';
import { installBackendMock } from '../e2e/support/backendMock.js';

const OUT = process.env.SHOTS || 'claude/shots/kb';
const MIN_TAP = 44; // CLAUDE.md: all touch targets 44px minimum

// Keyboard heights are the real ones: iPhone portrait is about 291px plus a 44px accessory bar; a
// 320-wide Android portrait keyboard is about 260px.
// `height` is the RESTING height the screen is navigated to; `kbHeight` (Android only) is what the
// layout viewport shrinks to once the keyboard opens. They are separate because the keyboard rises
// AFTER you are in the mode — a player never picks a mode off a 380px-tall menu, because the menu
// has no text field to raise a keyboard over. Sizing the viewport before navigating modelled that
// impossible state and made the menu's cards 31x41, which is a measurement of nothing.
const CASES = [
  { name: '390x844-rest', width: 390, height: 844, kbLine: null },
  { name: '390x844-kb-android', width: 390, height: 844, kbHeight: 509, kbLine: 509 },
  { name: '390x844-kb-ios', width: 390, height: 844, kbLine: 509 },
  { name: '320x640-rest', width: 320, height: 640, kbLine: null },
  { name: '320x640-kb-android', width: 320, height: 640, kbHeight: 380, kbLine: 380 },
  { name: '320x640-kb-ios', width: 320, height: 640, kbLine: 380 },
];

// The screens where a player is typing, plus the menu (which owns the XP bar / corner-nav cluster).
const WANTED = new Set([
  'menu',
  'ingame-word-bomb',
  'ingame-category-blitz',
  'ingame-chain',
  'ingame-fuse',
]);

// SAT Rush's play screen isn't in SCREENS (the map stops at the briefing), so it's added here.
const satPlay = {
  name: 'ingame-sat-rush',
  root: '.sr-slots',
  nav: async (page) => {
    await installBackendMock(page);
    await page.addInitScript(() => {
      try {
        localStorage.setItem('taw.xp', JSON.stringify({ lv: 40, into: 0 }));
      } catch {
        /* ignore */
      }
    });
    await page.goto('/?satRush=1&portal=1');
    await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
    await page.waitForTimeout(400);
    await page.locator('[data-game="sat-rush"] .game-card').click();
    await page.getByRole('button', { name: 'Play' }).click();
    await page.getByRole('button', { name: /BRIEFING/ }).click();
    await page.locator('.sr-brief-page').waitFor({ state: 'visible' });
    await page.getByRole('button', { name: 'Start the run' }).click();
    await page.locator('.sr-slots').waitFor({ state: 'visible', timeout: 15000 });
    await page.waitForTimeout(300);
  },
};

const TARGETS = [...SCREENS.filter((s) => WANTED.has(s.name)), satPlay];

// Readouts that carry a number a player needs. Not interactive, but being covered still costs them
// the information. The wins chip is the one Andy caught the corner nav sitting on at 320.
const READOUTS = [
  '.menu-wins-chip',
  '.menu-xp-lv',
  '.menu-xp-track',
  '.menu-streak',
  '.menu-mark',
  '.menu-xp-rank',
  '.solo-center',
  '.solo-hud',
];

/** Runs IN THE PAGE. Returns a census of every interactive element plus the tracked readouts. */
const CENSUS = ({ minTap, kbLine, readouts }) => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const sel =
    'button, a[href], input, textarea, select, [role="button"], [tabindex]:not([tabindex="-1"])';
  const seen = new Map();

  const describe = (el) => {
    const t = el.tagName.toLowerCase();
    const raw = el.className && typeof el.className === 'string' ? el.className : '';
    const cls = raw.split(/\s+/).filter(Boolean).slice(0, 3).join('.');
    const txt = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 28);
    return t + (cls ? '.' + cls : '') + (txt ? ' "' + txt + '"' : '');
  };

  const add = (el, kind) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return; // not rendered
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) return;
    const key = describe(el) + '@' + Math.round(r.x) + ',' + Math.round(r.y);
    if (seen.has(key)) return;

    const flags = [];
    // TOUCH TARGET — measured by HIT-TESTING, not by the layout box. A small box can still carry a
    // 44x44 tap area in an out-of-flow ::after (GameScreen.css does exactly this for the in-game
    // audio button, on purpose, so the chrome row stays short). Reading getBoundingClientRect alone
    // reports those as undersized, which is a false positive. Probe the corners of a 44x44 square
    // centred on the element: if they all resolve to it or its own subtree, the target is real.
    if (kind === 'tap' && (r.width < minTap || r.height < minTap)) {
      const mx = r.left + r.width / 2;
      const my = r.top + r.height / 2;
      const h = minTap / 2 - 1;
      // EDGE MIDPOINTS, not corners. The house style skews controls by -4deg, which shears a
      // box's corners by about 1.5px — probing exact corners reported the in-game audio button as
      // undersized when its 44x44 ::after was present and working (3 of 4 corners hit it). The 44px
      // rule means the target spans 44px through its centre on both axes, which is what this asks.
      const probes = [
        [mx - h, my], [mx + h, my], [mx, my - h], [mx, my + h],
      ];
      let blocker = null;
      const covered = probes.every(([px, py]) => {
        if (px < 0 || py < 0 || px >= vw || py >= vh) return false;
        const hit = document.elementFromPoint(px, py);
        // The element itself (a ::after expander resolves to its host) or its own subtree. An
        // ANCESTOR does not count — tapping the parent need not do what tapping the chip does.
        const ok = !!hit && (hit === el || el.contains(hit));
        if (!ok && !blocker) blocker = hit ? describe(hit) : 'nothing (outside viewport)';
        return ok;
      });
      if (!covered) flags.push('UNDERSIZE ' + Math.round(r.width) + 'x' + Math.round(r.height) + ' (44x44 probe blocked by ' + blocker + ')');
    }
    if (kind === 'input') {
      const fs = parseFloat(cs.fontSize) || 0;
      if (fs < 16) flags.push('FONT ' + fs + 'px (<16, iOS zooms on focus)');
    }

    // Clipped out of the viewport.
    if (r.right <= 0 || r.left >= vw) flags.push('OFFSCREEN-X');
    else if (r.left < -1 || r.right > vw + 1) {
      flags.push('CLIP-X l=' + Math.round(r.left) + ' r=' + Math.round(r.right) + ' vw=' + vw);
    }
    if (r.bottom <= 0 || r.top >= vh) flags.push('OFFSCREEN-Y');

    // Behind the keyboard: the element's own box starts below the keyboard line.
    if (kbLine != null && r.top >= kbLine) {
      flags.push('BEHIND-KB top=' + Math.round(r.top) + ' kb=' + kbLine);
    } else if (kbLine != null && r.bottom > kbLine) {
      flags.push('KB-CUT bottom=' + Math.round(r.bottom) + ' kb=' + kbLine);
    }

    // OCCLUSION — hit-test the centre. If something else answers, this element is covered there.
    const cx = Math.min(vw - 1, Math.max(1, r.left + r.width / 2));
    const cy = Math.min(vh - 1, Math.max(1, r.top + r.height / 2));
    let occluder = null;
    if (r.top < vh && r.bottom > 0 && r.left < vw && r.right > 0) {
      const hit = document.elementFromPoint(cx, cy);
      if (hit && hit !== el && !el.contains(hit) && !hit.contains(el)) {
        // Ignore pointer-transparent decoration — it covers pixels but not interaction.
        if (getComputedStyle(hit).pointerEvents !== 'none') occluder = describe(hit);
      }
    }
    if (occluder) flags.push('OCCLUDED by ' + occluder);

    seen.set(key, {
      kind,
      what: describe(el),
      rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
      flags,
    });
  };

  for (const el of document.querySelectorAll(sel)) {
    const t = el.tagName.toLowerCase();
    add(el, t === 'input' || t === 'textarea' ? 'input' : 'tap');
  }
  for (const s of readouts) for (const el of document.querySelectorAll(s)) add(el, 'readout');

  return { vw, vh, items: [...seen.values()] };
};

for (const screen of TARGETS) {
  for (const c of CASES) {
    test(screen.name + ' @ ' + c.name, async ({ page }) => {
      test.slow();
      await page.setViewportSize({ width: c.width, height: c.height });

      // A nav that CANNOT COMPLETE at this size is itself the finding — the screen is unreachable
      // with the keyboard up. Record it and still photograph whatever the player would be staring
      // at, rather than aborting the run and losing every frame behind it.
      // Bound every locator wait inside the shared nav helpers. Without this they inherit the TEST
      // timeout, so a nav that cannot complete kills the test before the catch below can record it.
      page.setDefaultTimeout(20000);

      let navError = null;
      try {
        await screen.nav(page);
      } catch (e) {
        navError = String((e && e.message) || e).split('\n')[0];
      }

      // WAIT OUT THE 3-2-1. The multiplayer nav lands the moment the game starts, with the
      // countdown overlay still up — it covers the whole screen, so every element hit-tests to it
      // and the census reads as "everything is occluded". That is the camera standing in front of
      // the thing it is photographing, not a defect. Measure the screen a player actually types on.
      try {
        await page.locator('.countdown-overlay').waitFor({ state: 'hidden', timeout: 15000 });
      } catch {
        /* screens without a countdown never had one to wait for */
      }

      // NOW raise the keyboard: on Android the layout viewport shrinks under the screen that is
      // already open. This is the order it happens in on a real phone.
      if (c.kbHeight) {
        await page.setViewportSize({ width: c.width, height: c.kbHeight });
        await page.waitForTimeout(250);
      }

      // Focus the typing field so the screen is in the state it holds while a word is being typed.
      let hasInput = false;
      try {
        const input = page.locator('.game-wrap input, .solo-root input, input').first();
        if (await input.count()) {
          await input.focus({ timeout: 2000 });
          hasInput = true;
        }
      } catch {
        /* some screens type through a document-level handler (SAT) */
      }
      await page.waitForTimeout(250);

      const census = await page.evaluate(CENSUS, {
        minTap: MIN_TAP,
        kbLine: c.kbLine,
        readouts: READOUTS,
      });

      const dir = path.join(OUT, screen.name);
      fs.mkdirSync(dir, { recursive: true });
      await page.screenshot({ path: path.join(dir, c.name + '.png'), fullPage: false });

      // A SCREEN WITH NO TEXT FIELD CANNOT RAISE A KEYBOARD. The menu is the case: it has no input,
      // so a keyboard line there measures a state that does not exist, and every flag it produced
      // ("JOIN ROOM is behind the keyboard") was fiction. Keep the frame for the record, judge
      // nothing from it. The resting frames are where the menu is actually held to account.
      const impossible = c.kbLine != null && !hasInput;
      const bad = impossible ? [] : census.items.filter((i) => i.flags.length);
      const lines = [
        '# ' + screen.name + ' @ ' + c.name,
        'viewport ' + census.vw + 'x' + census.vh +
          '  keyboard-line ' + (c.kbLine == null ? 'none' : c.kbLine) +
          '  focusable-input ' + hasInput,
        impossible ? '_No text field on this screen — a keyboard cannot open here; nothing judged._' : '',
        navError ? '**NAV FAILED — the screen could not be reached at this size:** ' + navError : '',
        census.items.length + ' elements, ' + bad.length + ' flagged',
        '',
        ...bad.map(
          (i) =>
            '- [' + i.kind + '] ' + i.what + ' @' + i.rect.x + ',' + i.rect.y +
            ' ' + i.rect.w + 'x' + i.rect.h + '\n    ' + i.flags.join('\n    '),
        ),
      ];
      fs.writeFileSync(path.join(dir, c.name + '.md'), lines.join('\n'));
      fs.writeFileSync(path.join(dir, c.name + '.json'), JSON.stringify(census, null, 2));
      // eslint-disable-next-line no-console
      console.log(screen.name + ' @ ' + c.name + ': ' + bad.length + ' flagged of ' + census.items.length + (navError ? '  NAV-FAILED' : ''));
    });
  }
}
