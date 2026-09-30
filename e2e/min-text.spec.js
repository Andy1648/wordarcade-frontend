// e2e/min-text.spec.js — fix/min-text-sweep: NO VISIBLE TEXT UNDER 13px, ANYWHERE.
//
// Every screen the app can reach (support/screens.js SCREENS + the ones only this sweep drives:
// REBIRTH, the SAT RUSH board and results page, and WORD RACE's lobby / race / results) at four
// viewports, for TWO profiles:
//   lv1   a first visit — localStorage CLEARED, so every first-run teach / spotlight shows, and the
//         menu-level screens at a real LV1 (no seeded level). Screens a LV1 player cannot open
//         (the unlocked CHAIN / FUSE dialogs) are that profile's locked-* screens instead.
//   high  a returning player — LV60, 3 rebirths, a big balance, every first-run flag seen.
//
// The rule: every rendered element that owns a text node carrying a letter or digit must paint
// at >= 13px — its computed font-size x any ancestor CSS zoom x any ancestor scale transform. The
// only exemptions are things no reader reads: pure glyphs (no letter or digit, e.g. a "·" or "▸"),
// visually-hidden 1px boxes (screen-reader text), anything not visible (display/visibility/
// opacity/content-visibility), and text COVERED by a fixed modal layer (the menu receding behind a
// mode dialog). The last test proves the detector bites.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady, navControl } from './support/menu.js';
import { SCREENS, bootMenu, bootRoom, screenProfile, card } from './support/screens.js';

const VIEWPORTS = [
  { name: '390x844', width: 390, height: 844 },
  { name: '1280x551', width: 1280, height: 551 },
  { name: '1366x625', width: 1366, height: 625 },
  { name: '1920x1080', width: 1920, height: 1080 },
];
const MIN_PX = 13;

const ME = 'e2e-player';
const racers = [
  { id: ME, name: 'YOU' },
  { id: 'p2', name: 'RIVAL' },
  { id: 'b1', name: 'BOT', isBot: true },
];

async function raceRoom(page) {
  const mock = await installBackendMock(page);
  await page.goto('/?portal=1&race=1');
  await menuReady(page);
  mock.pushToClient({
    type: 'room_update',
    payload: { code: 'RACE1', gameType: 'word-race', hostId: ME, difficultyKey: 'chill', players: racers.map((r, i) => ({ ...r, isHost: i === 0 })) },
  });
  await page.locator('.wr-lobby').waitFor({ state: 'visible' });
  return mock;
}
async function raceStart(page, mock) {
  mock.pushToClient({ type: 'game_started', payload: { gameType: 'word-race' } });
  const now = Date.now();
  mock.pushToClient({
    type: 'race_start',
    payload: { seed: 7, fragments: ['str', 'ing', 'ion', 'ent', 'ter', 'and', 'ous', 'con', 'pre', 'est', 'ble', 'ate'], target: 12, capMs: 90000, racers, serverNow: now, goAt: now + 50 },
  });
  mock.pushToClient({ type: 'race_go', payload: { serverNow: now, goAt: now + 50, endsAt: now + 90000 } });
  mock.pushToClient({ type: 'race_progress', payload: { racerId: 'p2', index: 3, word: 'STRAND' } });
  await page.locator('.wr-root[data-race-status="racing"]').waitFor({ state: 'visible' });
}

// Screens this sweep drives on top of the shared map.
const EXTRA = [
  { name: 'rebirth', nav: async (page) => { await bootMenu(page, 40); await navControl(page, 'rebirth').click(); await page.locator('.shop-panel').waitFor({ state: 'visible' }); await page.waitForTimeout(300); } },
  {
    name: 'sat-lineup',
    nav: async (page) => {
      await installBackendMock(page);
      await page.goto('/?satRush=1&portal=1');
      await menuReady(page);
      await card(page, 'sat-rush').click();
      await page.getByRole('button', { name: 'Play' }).click();
      await page.getByRole('button', { name: /LINEUP/ }).click();
      await page.locator('.sr-lineup').waitFor({ state: 'visible', timeout: 20000 });
      await page.waitForTimeout(400);
    },
  },
  {
    name: 'sat-results',
    nav: async (page) => {
      await installBackendMock(page);
      await page.goto('/?satRush=1&portal=1');
      await menuReady(page);
      await card(page, 'sat-rush').click();
      await page.getByRole('button', { name: 'Play' }).click();
      await page.getByRole('button', { name: /LINEUP/ }).click();
      await page.locator('.sr-lineup').waitFor({ state: 'visible', timeout: 20000 });
      await expect
        .poll(async () => {
          if (await page.locator('.sr-respage').isVisible()) return true;
          await page.keyboard.press('Escape');
          await page.waitForTimeout(250);
          await page.keyboard.press('x');
          await page.waitForTimeout(250);
          return page.locator('.sr-respage').isVisible();
        }, { timeout: 30000, intervals: [300] })
        .toBe(true);
      await page.waitForTimeout(400);
    },
  },
  { name: 'race-lobby', nav: async (page) => { await raceRoom(page); await page.waitForTimeout(300); } },
  { name: 'race-racing', nav: async (page) => { const m = await raceRoom(page); await raceStart(page, m); await page.waitForTimeout(400); } },
  {
    name: 'race-results',
    nav: async (page) => {
      const m = await raceRoom(page);
      await raceStart(page, m);
      m.pushToClient({ type: 'race_over', payload: { winnerId: 'p2', reason: 'target', standings: [{ id: 'p2', name: 'RIVAL', words: 12, reachedAt: 41000 }, { id: ME, name: 'YOU', words: 7 }, { id: 'b1', name: 'BOT', words: 5 }] } });
      await page.locator('.wr-over').waitFor({ state: 'visible' });
      await page.waitForTimeout(500);
    },
  },
];

// Unreachable for a LV1 player (their locked-* previews are the LV1 screens for these modes).
// REBIRTH only appears once it is earned (Homepage showRebirth), so a LV1 player has no way in.
const LV1_SKIP = new Set(['dialog-chain', 'dialog-fuse', 'rebirth']);

const PROFILES = {
  lv1: {
    menuLevel: null,
    init: () => {
      try {
        localStorage.clear();
      } catch { /* storage blocked */ }
    },
  },
  high: {
    menuLevel: 60,
    init: () => {
      try {
        localStorage.setItem('taw.xp', JSON.stringify({ lv: 60, into: 0 }));
        localStorage.setItem('taw.wins', '4820000');
        localStorage.setItem('taw.winsLifetime', '9100000');
        localStorage.setItem('taw.rebirths', '3');
        for (const k of ['taw.seenMenu', 'taw.seenMenuSpotlight', 'taw.seenGameSpotlight', 'wa_has_played']) localStorage.setItem(k, '1');
      } catch { /* storage blocked */ }
    },
  },
};

// Runs in the page. Returns every visible text-owning element painted under `min` px.
function findSmallText(min) {
  const out = [];
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('vercel-live-feedback, script, style, noscript, title')) continue;
    const txt = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
    if (!txt || !/[\p{L}\p{N}]/u.test(txt)) continue; // no words or numbers: a glyph, not text
    if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true, contentVisibilityAuto: true })) continue;
    const r = el.getBoundingClientRect();
    if (r.width <= 1 || r.height <= 1) continue; // visually-hidden screen-reader text
    if (el.closest('[inert]')) continue; // an inert background is not being read
    let px = parseFloat(getComputedStyle(el).fontSize) * (el.currentCSSZoom || 1);
    // Every ancestor scale() shrinks the paint without touching font-size. Read the real scale off
    // each transform matrix (hypot of a,b) — a rotation alone is scale 1, not a bbox ratio.
    for (let a = el; a && a !== document.documentElement; a = a.parentElement) {
      const t = getComputedStyle(a).transform;
      if (t && t !== 'none') {
        const m = new DOMMatrixReadOnly(t);
        px *= Math.hypot(m.a, m.b);
      }
    }
    // Text UNDER a modal (the menu receding behind a mode dialog, the board behind the game-over
    // card) is covered, not read: skip it when the topmost thing at its centre belongs to a
    // position:fixed layer that is not one of its own ancestors.
    const cx = Math.min(Math.max(r.left + r.width / 2, 0), innerWidth - 1);
    const cy = Math.min(Math.max(r.top + r.height / 2, 0), innerHeight - 1);
    const onScreen = r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;
    if (onScreen) {
      const top = document.elementFromPoint(cx, cy);
      if (top && top !== el && !el.contains(top) && !top.contains(el)) {
        let layer = top;
        while (layer && getComputedStyle(layer).position !== 'fixed') layer = layer.parentElement;
        if (layer && !layer.contains(el)) continue;
      }
    }
    if (px < min - 0.05) {
      const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
      out.push(`${el.tagName.toLowerCase()}${cls ? '.' + cls : ''} ${px.toFixed(1)}px "${txt.slice(0, 28)}"`);
    }
  }
  return out;
}

async function settle(page) {
  await page.evaluate(() => document.fonts.ready);
  // Let every finite entrance (slams, pops, count-ups) finish: a mid-scale frame is not the rest pose.
  await page
    .waitForFunction(
      () => !document.getAnimations().some((a) => a.playState === 'running' && a.effect && a.effect.getComputedTiming().iterations !== Infinity),
      null,
      { timeout: 5000 },
    )
    .catch(() => {});
}

const ALL = [...SCREENS.map((s) => ({ name: s.name, nav: s.nav })), ...EXTRA];

for (const [profileName, profile] of Object.entries(PROFILES)) {
  test.describe(`min text 13px [${profileName}]`, () => {
    for (const vp of VIEWPORTS) {
      for (const screen of ALL) {
        if (profileName === 'lv1' && LV1_SKIP.has(screen.name)) continue;
        test(`${screen.name} @ ${vp.name}`, async ({ page }) => {
          test.setTimeout(90_000);
          screenProfile.menuLevel = profile.menuLevel;
          await page.setViewportSize({ width: vp.width, height: vp.height });
          await page.addInitScript(profile.init);
          try {
            await screen.nav(page);
          } finally {
            screenProfile.menuLevel = undefined;
          }
          await settle(page);
          const small = await page.evaluate(findSmallText, MIN_PX);
          test.info().annotations.push({ type: 'small', description: JSON.stringify(small) });
          expect(small, `[${profileName}] ${screen.name} @ ${vp.name}: text under ${MIN_PX}px`).toEqual([]);
        });
      }
    }
  });
}

test('the detector bites: a 12px word and a scaled-down word are caught; a glyph and sr-only text are not', async ({ page }) => {
  await bootMenu(page, 40);
  await page.evaluate(() => {
    const add = (html) => {
      const d = document.createElement('div');
      d.innerHTML = html;
      document.body.appendChild(d.firstElementChild);
    };
    add('<p style="position:fixed;top:0;left:0;margin:0;font-size:12px;z-index:99999">PROBE</p>');
    add('<span style="position:fixed;top:40px;left:0;font-size:9px">▸ ·</span>');
    add('<span style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);font-size:9px">HIDDEN LABEL</span>');
    add('<div style="position:fixed;top:80px;left:0;font-size:16px;transform:scale(0.5);transform-origin:0 0"><b style="display:inline-block">HALF</b></div>');
    add('<div style="position:fixed;top:120px;left:0;font-size:16px;transform:rotate(-45deg)">TILTED</div>');
  });
  const found = await page.evaluate(findSmallText, MIN_PX);
  expect(found.some((s) => s.includes('PROBE'))).toBe(true);
  expect(found.some((s) => s.includes('HALF'))).toBe(true);
  expect(found.some((s) => s.includes('TILTED')), 'a rotation is not a shrink').toBe(false);
  expect(found.some((s) => s.includes('▸'))).toBe(false);
  expect(found.some((s) => s.includes('HIDDEN LABEL'))).toBe(false);
});
