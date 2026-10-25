// e2e/no-scroll.spec.js — NO SCROLLBARS EXCEPT REAL LISTS (Andy oct21: "I don't want [scrolls] for basically anything.
// Obviously there are exceptions like picking packs for category Blitz, but things that we wouldn't logically need to
// scroll on don't include scrolling. It just looks like visual inconsistency.")
//
// Every screen / popup / overlay of the season-2 menu, at Andy's sizes (laptop 1536x864 / 1366x768, laptop with bars
// 1366x657, Chromebook 1366x650 / 1280x600, phone 390x844 / 360x640): nothing may scroll — the page or any element —
// unless it is on the ALLOW list below, each entry a real LIST (or, on a phone, a page Andy chose to let scroll: oct21
// "maybe we can introduce more of the scroll"). A new scrollbar anywhere else fails here with the element and the size.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { mockBoard } from './support/boardMock.js';
import { menuReady, navControl, revealMode, isPhoneMenu } from './support/menu.js';

const SIZES = [[1536, 864], [1366, 768], [1366, 657], [1366, 650], [1280, 600], [390, 844], [360, 640]];

// REAL LISTS, at every size: [selector, why]
const ALLOW = [
  ['.lb2-scroll', 'the leaderboard: the TOP 50'],
  ['.mx-grid', 'the gear INDEX: every gear'],
  ['.pf.is-pick:not(:has(.hpv))', 'the hero picker: every hero'],
  ['.rl', 'the title ladder: all 16 titles'],
  ['.sp2-grid', 'the UPGRADES stock: more boosts below ("SCROLL FOR MORE")'],
  ['.sp2-shelf', 'the LOOKS shelf: every pop style'],
  ['.ppp-window-scroll', 'the Category Blitz pack picker (Andy\'s named exception)'],
  ['.sr-bank-list', 'the French Rush word bank'],
  ['.sr-brief-list', 'the SAT / French briefing: the words to study'],
];
// PHONES ONLY (<= 480 wide): long pages a phone scrolls instead of crushing (Andy oct21: taps, room, more scroll)
const ALLOW_PHONE = [
  ['.hp-m', 'the phone menu column (64px tap rows)'],
  ['.pf', 'the profile / hero preview page'],
  ['.sp2', 'the UPGRADES page'],
  ['.pn', 'the patch notes'],
  ['.rb2', 'rebirth on the smallest phone'],
  ['.rb2-track-list', 'the UNLOCKS row swipes sideways (Andy oct15: a list)'],
  ['.sr-lineup', 'the SAT suspects on the smallest phone'],
];

const SECRET = 'e6'.repeat(24);
const FUTURE = Date.now() + 3_600_000;
const row = (id, username, o) => ({ id, username, level: 10, rebirths: 0, stars: 0, lifetime_words: 500, lifetime_letters: 2500, wins_per_word: 10, econ: 13, submitted_at: FUTURE, ...o });
const ROWS = ['ALPHA', 'BRAVO', 'CHARLIE', 'DELTA', 'ECHO', 'FOXTROT', 'GOLF', 'HOTEL', 'INDIA', 'JULIET', 'KILO', 'LIMA']
  .map((n, i) => row(n.toLowerCase(), n, { level: 900 - i * 50, rebirths: i < 4 ? 9 - i : 0 }));

async function boot(page, w, h) {
  await page.setViewportSize({ width: w, height: h });
  await installBackendMock(page);
  await page.addInitScript(() => { window.__TAW_NO_ACHIEVEMENT_GRANT = true; });
  await mockBoard(page, [], { caps: true, shared: { rows: [...ROWS, row('me', 'NOBUFFCOOKIES', { level: 60, rebirths: 3 })], secrets: new Map([[SECRET, 'me']]), saves: new Map() }, econ: true, boardEcon: true, weekly: true, season2: true });
  await page.addInitScript((secret) => {
    if (sessionStorage.getItem('ns.seeded')) return;
    sessionStorage.setItem('ns.seeded', '1');
    for (const [k, v] of Object.entries({
      'taw.seenMenu': '1', 'taw.seenMenuSpotlight': '1', 'taw.tut.markRolls': '1', 'taw.rollsOn': '1', 'taw.marksRevealed': '1',
      'taw.lb.profile': JSON.stringify({ id: 'me', username: 'NOBUFFCOOKIES' }), 'taw.lb.secret': secret, 'taw.econ': '12',
      'taw.s2.xp': JSON.stringify({ lv: 60, f: 0.4, rc: 3, v: 10 }), 'taw.s2.rebirths': '3', 'taw.s2.gems': JSON.stringify({ bal: 5000 }),
      'taw.mastery': JSON.stringify({ 'word-bomb': 30 }),
    })) localStorage.setItem(k, v);
  }, SECRET);
  await page.goto('/?portal=1&season2=1');
  await menuReady(page);
  await page.waitForTimeout(400);
}

const nav = (page, id) => page.locator(`[data-nav="${id}"]:visible`).first();
const SCREENS = {
  menu: async () => {},
  settings: async (p) => { await nav(p, 'settings').click(); await p.locator('.sp-sheet').waitFor(); },
  'settings + reset confirm': async (p) => { await nav(p, 'settings').click(); await p.getByTestId('sp-reset-open').click(); await p.getByTestId('sp-reset-yes').waitFor(); },
  achievements: async (p) => { await p.locator(isPhoneMenu(p) ? '.hp-m-navbtn.is-ach' : '[data-nav="achievements"]:visible').first().click(); await p.locator('.av3-overlay').waitFor(); },
  'patch notes': async (p) => { await nav(p, 'news').click(); await p.getByTestId('patch-notes').waitFor(); },
  leaderboard: async (p) => { await navControl(p, 'leaderboard').click(); await p.locator('.lb2').waitFor(); await expect(p.locator('.lb2-col--1')).toHaveAttribute('data-id', /.+/, { timeout: 10_000 }); },
  'player card': async (p) => { await navControl(p, 'leaderboard').click(); await expect(p.locator('.lb2-col--1')).toHaveAttribute('data-id', /.+/, { timeout: 10_000 }); await p.locator('.lb2-col--1').click(); await p.locator('.pc').waitFor(); },
  profile: async (p) => { await nav(p, 'profile').click(); await p.locator('.pf-change').waitFor(); },
  'hero picker': async (p) => { await nav(p, 'profile').click(); await p.locator('.pf-change').click(); await p.locator('.hc').first().waitFor(); },
  'hero preview': async (p) => { await nav(p, 'profile').click(); await p.locator('.pf-change').click(); await p.locator('.hc[data-hero="hype"]').click(); await p.locator('.hpv').waitFor(); },
  // oct22 (#483): the XP bar's plate is the PROFILE plate; the ladder opens from the profile's TITLE
  'title ladder': async (p) => { await nav(p, 'profile').click(); await p.getByTestId('profile-title').click(); await p.getByTestId('rank-ladder').waitFor(); },
  'daily contracts': async (p) => { await nav(p, 'contracts').click(); await p.getByTestId('contracts-sheet').waitFor(); },
  upgrades: async (p) => { await navControl(p, 'shop').click(); await p.locator('.sp2').waitFor(); },
  'gears roll': async (p) => { await navControl(p, 'gears').click(); await p.locator('.rs-overlay').waitFor(); },
  'gear index': async (p) => { await navControl(p, 'gears').click(); await p.getByTestId('roll-index').click(); await p.locator('.mx-panel').waitFor(); },
  rebirth: async (p) => { await navControl(p, 'rebirth').click(); await p.locator('.rb2').waitFor(); },
  stats: async (p) => { await navControl(p, 'stats').click(); await p.locator('.st2').waitFor(); },
  // oct24 DAILY WHEEL: CREDITS lives inside SETTINGS (the cog moved to the bottom-right cluster)
  credits: async (p) => { await p.locator('.hp-util [data-nav="settings"]').first().click(); await p.locator('.sp-credits:visible').click(); await p.locator('.credits-wrap').waitFor(); },
  'word bomb dialog': async (p) => { await (await revealMode(p, 'word-bomb')).click(); await p.locator('.mode-dialog-shell').waitFor(); },
  'chain dialog': async (p) => { await (await revealMode(p, 'chain')).click(); await p.locator('.mode-dialog-shell').waitFor(); },
  'join room': async (p) => { await (await revealMode(p, 'word-bomb')).click(); await p.locator('.mode-dialog-btn-join').click(); await p.locator('.browser-wrap').waitFor(); },
};

for (const [name, go] of Object.entries(SCREENS)) {
  test(`no stray scrollbar: ${name}`, async ({ page }) => {
    test.setTimeout(180_000);
    const bad = [];
    for (const [w, h] of SIZES) {
      await page.context().clearCookies();
      await boot(page, w, h);
      await go(page);
      await page.waitForTimeout(700); // entrances land, FitText re-measures
      const found = await page.evaluate(({ allow, allowPhone }) => {
        const out = [];
        const phone = innerWidth <= 480;
        const ok = (el) => [...allow, ...(phone ? allowPhone : [])].some(([sel]) => el.matches(sel));
        const de = document.scrollingElement;
        if (de.scrollHeight - innerHeight > 2) out.push(`the PAGE scrolls ${de.scrollHeight - innerHeight}px`);
        if (de.scrollWidth - innerWidth > 2) out.push(`the PAGE scrolls sideways ${de.scrollWidth - innerWidth}px`);
        for (const el of document.querySelectorAll('body *')) {
          const cs = getComputedStyle(el);
          const y = /(auto|scroll)/.test(cs.overflowY) && el.scrollHeight - el.clientHeight > 2;
          const x = /(auto|scroll)/.test(cs.overflowX) && el.scrollWidth - el.clientWidth > 2;
          if (!y && !x) continue;
          const r = el.getBoundingClientRect();
          if (r.width < 2 || r.height < 2 || cs.visibility === 'hidden') continue;
          if (ok(el)) continue;
          const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).slice(0, 3).join('.') : '';
          out.push(`${el.tagName.toLowerCase()}.${cls} scrolls${y ? ` ${el.scrollHeight - el.clientHeight}px down` : ''}${x ? ` ${el.scrollWidth - el.clientWidth}px sideways` : ''}`);
        }
        return out;
      }, { allow: ALLOW, allowPhone: ALLOW_PHONE });
      for (const f of found) bad.push(`${w}x${h}: ${f}`);
    }
    expect(bad, `${name}: only real lists may scroll`).toEqual([]);
  });
}
