// e2e/mark-rolls.spec.js — THE ROLL SCREEN (Andy oct5; replaces the in-panel roll UI + rolls-reveal.spec.js). Written
// WITHOUT being run (the authoring machine runs no Playwright); CI runs it. Covers: MARKS opens the full-screen
// ROLL screen (one big ROLL, no ×10) → the tutorial → a roll spins the reel and the card + pity only change when it
// LANDS, on the real result; the card + the worn INDEX card read the mark's STAT (Andy oct5: named — "×1.1 WINS", "+1 BASE WINS/WORD" …); tap
// anywhere jumps to the result; a LEGENDARY+ pity roll plays the cutscene with "1 IN X" huge; AUTO ROLL stops on its
// tier; AUTO ROLL spends GEMS and stops when they run out; the skip setting is stored; a short balance shows −X + gem
// (the NEED X MORE GEMS sentence is screen-reader only — Andy oct5: no prose on the ROLL screen; rolls cost 10 GEMS —
// wins never buy one); reduced motion goes straight to the card; ROLL v1 (Andy oct5 mockup, claude/mockups/roll-v1): the
// price sits UNDER the label ("ROLL" / gem 10), AUTO is ONE button cycling OFF → RARE+ → EPIC+ → LEGENDARY+, and a
// DIM / FULL reveal stays up until a tap ("TAP TO KEEP"); the reel fits 360x640 → 1366x657; INDEX opens the
// MARKS INDEX (the collection only: no REPLAY, no roll, no pity, no gems); the ROLL screen has no prose; nothing loops after.
import { test, expect } from '@playwright/test';
import { holdRoll, tapRoll } from './support/roll.js'; // HOLD TO ROLL (R4): a hold + release is a roll; a tap is not
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';

const SEED = {
  'taw.rollsOn': '1',
  'taw.seenMenu': '1',
  'taw.seenMenuSpotlight': '1',
  'taw.xp': JSON.stringify({ lv: 12, into: 0 }),
  'taw.marksRevealed': '1',
  'taw.marksOwned': '[]',
  'taw.marksSeen': '[]',
  'taw.wins': '50000000',
  // GEMS (Andy oct5): rolls cost 10 GEMS; a stamped balance so the one-time starting grant never runs here
  'taw.gems': JSON.stringify({ v: 1, bal: 1000, peak: 12, streak: 0, mig: 1 }),
};

async function seed(page, extra = {}) {
  await installBackendMock(page);
  await page.addInitScript((s) => {
    if (sessionStorage.getItem('mr.seeded')) return;
    sessionStorage.setItem('mr.seeded', '1');
    for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
  }, { ...SEED, ...extra });
}
async function openRoll(page, query = '') {
  await page.goto(`/?portal=1${query}`);
  await menuReady(page);
  // desktop: the menu's mark chip; phone (≤480px): the MARKS nav button
  await page.locator('.hp-nav.is-gears:visible').first().click(); // v2 menu: the GEARS rail button (ROLL + INDEX)
  await page.locator('.rs-overlay').waitFor();
}
const pity = (page) => page.getByTestId('roll-pity').innerText();
const card = (page) => page.locator('[data-testid="mark-roll-result"]');
const rollUiAnims = (page) => page.evaluate(() => document.getAnimations().filter((a) => {
  const el = a.effect && a.effect.target;
  // RUNNING only: a finished one-shot (the rarity sweep's fill-mode both) stays in getAnimations() but moves nothing
  return el && el.closest && el.closest('.rs-overlay') && a.playState === 'running';
}).length);
const SPUN = 4600; // past the full spin (2.4 s every tier, NIGHT oct8) + its land beat, with room
// ROLL v1 (#209): an EPIC+ DIM / FULL reveal stays up ("TAP TO KEEP") and its overlay takes every click until tapped.
// A roll's tier is random, so any test that clicks after a roll taps through whatever reveal is still up (a no-op when
// the roll landed COMMON/RARE): the reveal must be clear for 3 checks in a row (~450 ms) before the test goes on.
async function keepReveal(page) {
  const cut = page.getByTestId('roll-cutscene');
  let clear = 0;
  for (let i = 0; i < 40 && clear < 3; i += 1) {
    const on = (await cut.count()) > 0 && (await cut.evaluate((el) => el.classList.contains('is-on')));
    if (on) {
      clear = 0;
      await cut.click().catch(() => {});
      await page.waitForTimeout(900); // RollScreen swallows any click for 800 ms after the tap that closed a reveal
    } else clear += 1;
    await page.waitForTimeout(150);
  }
}

test('MARKS opens the ROLL screen: tutorial, one big ROLL (no ×10), pity ladder, the reel lands on the real result', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seed(page);
  await openRoll(page);
  // the one-time spotlight lights ROLL on the ROLL screen: no buttons, tap anywhere to continue
  const tut = page.locator('.ut-overlay[data-tut="markRolls"]');
  await expect(tut).toBeVisible();
  await expect(page.locator('.ut-ring')).toBeVisible();
  await expect(tut.locator('button')).toHaveCount(0);
  await tut.click({ position: { x: 8, y: 8 } });
  await expect(tut).toHaveCount(0);
  await expect(page.locator('.rs-overlay')).toBeVisible(); // the tap closed the spotlight, not the ROLL screen

  await expect(page.getByTestId('mark-roll-10')).toHaveCount(0);
  await expect(page.getByTestId('roll-pity')).toContainText(/EPIC\+ IN [\d,]+/);
  await expect(page.getByTestId('roll-pity')).toContainText(/LEGENDARY\+ IN [\d,]+/);
  const roll = page.locator('.rs-roll');
  await expect(roll).toHaveText(/FREE ROLL/);
  const pityBefore = await pity(page);
  const boxBefore = await roll.boundingBox();
  await holdRoll(page);
  // NO SPOILERS: mid-spin the card is not there and the pity ladder has not moved
  await page.waitForTimeout(300);
  await expect(card(page)).toHaveCount(0);
  expect(await pity(page)).toBe(pityBefore);
  // ...it lands (a first-time mark ALWAYS plays the full reveal: ≥ 2.5 s)
  await expect(card(page)).toHaveCount(1, { timeout: SPUN });
  // the landing cell IS the result
  const landTier = await page.locator('.rs-cell.is-land').getAttribute('data-tier');
  expect(await card(page).getAttribute('data-tier')).toBe(landTier);
  await expect(card(page).locator('.mark-pips')).toHaveCount(0); // NIGHT oct8 #4: no ★ row — a dupe is a small ×N
  // the ROLL button never moved, and is priced in ONE unit now that the starter is spent
  await page.mouse.move(1, 1); // ROLL v1: the button lifts 2px under the pointer (hover) — measure it at rest
  await page.waitForTimeout(250);
  const boxAfter = await roll.boundingBox();
  expect(Math.abs(boxAfter.y - boxBefore.y)).toBeLessThan(1);
  // price in ONE unit: GEMS (wins never buy rolls) — the gem icon + 10 — and the balance it is paid from shows
  // as icon + count right under it
  await expect(roll).toHaveText(/^HOLD TO ROLL\s*10$/); // ROLL v1: the gem price is stacked under the label (R4: the label says HOLD)
  await expect(roll).toHaveAttribute('aria-label', 'HOLD TO ROLL · 10 GEMS');
  await expect(roll.locator('img.gem-icon')).toHaveAttribute('src', '/art/gems/gem.svg');
  await expect(roll).not.toContainText('WINS');
  await expect(page.locator('.rs-sub .gem-count')).toHaveAttribute('data-gems', '1000');
  // marks v2: the card says the mark's STAT ("×1.1 WINS", "+1 BASE WINS/WORD" …)
  await expect(card(page).locator('.rs-card-stat')).toHaveText(/^[+×][\d.,]+s? [A-Z]/);
  // finite: once landed nothing animates, nothing loops, will-change is off
  await page.waitForTimeout(3600);
  expect(await rollUiAnims(page)).toBe(0);
  const infinite = await page.evaluate(() => document.getAnimations().filter((a) => {
    const t = a.effect && a.effect.getTiming && a.effect.getTiming();
    return t && t.iterations === Infinity;
  }).length);
  expect(infinite).toBeLessThanOrEqual(1); // the menu's single pre-existing loop, nothing new
  const wc = await page.evaluate(() => [...document.querySelectorAll('.rs-overlay, .rs-overlay *')].filter((n) => n.style && n.style.willChange).length);
  expect(wc).toBe(0);
});

test('tap anywhere mid-spin jumps straight to the result', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page, { 'taw.tut.markRolls': '1' });
  await openRoll(page);
  await holdRoll(page);
  await page.waitForTimeout(250);
  await page.locator('.rs-stage').click({ position: { x: 20, y: 20 } });
  await expect(card(page)).toHaveCount(1, { timeout: 400 });
});

test('LEGENDARY pity: the full-screen cutscene says "1 IN X" huge', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page, {
    'taw.tut.markRolls': '1',
    'taw.markRolls': JSON.stringify({ v: 1, rolls: 600, sinceEpic: 3, sinceLegendary: 499, everEpic: true, starter: true, marks: {}, milestones: [] }),
  });
  await openRoll(page);
  await expect(page.getByTestId('roll-pity')).toContainText('LEGENDARY+ IN 1');
  await holdRoll(page);
  const cut = page.getByTestId('roll-cutscene');
  await expect(cut).toHaveClass(/is-on/, { timeout: SPUN });
  expect(['legendary', 'mythic', 'secret']).toContain(await cut.getAttribute('data-tier'));
  await page.waitForTimeout(900);
  await expect(page.getByTestId('roll-cutscene-odds')).toHaveText(/^1 IN [\d,.K]+$/);
  const size = await page.getByTestId('roll-cutscene-odds').evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(size).toBeGreaterThanOrEqual(40);
  // ROLL v1: the full reveal stays up ("TAP TO KEEP") until a tap, then the result line is there
  await page.waitForTimeout(1500);
  await expect(cut).toHaveClass(/is-on/);
  await cut.click();
  await expect(cut).not.toHaveClass(/is-on/, { timeout: 2000 });
  await expect(card(page)).toHaveCount(1);
  await expect(page.getByTestId('roll-pity')).toContainText('LEGENDARY+ IN 125'); // oct8: the hard pity is 125 (was 500)
});

test('AUTO ROLL "until EPIC or better" stops on an EPIC+', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seed(page, {
    'taw.tut.markRolls': '1',
    // EPIC pity 3 rolls away: at most three spins (first-time marks still play the full reveal)
    'taw.markRolls': JSON.stringify({ v: 1, rolls: 60, sinceEpic: 47, everEpic: true, starter: true, marks: {}, milestones: [] }),
  });
  await openRoll(page);
  // ROLL v1: one AUTO button cycles OFF → RARE+ → EPIC+ (the first tap starts rolling)
  await page.getByTestId('roll-auto').click();
  await page.getByTestId('roll-auto').click();
  await expect(page.getByTestId('roll-auto')).toHaveAttribute('data-target', 'epic');
  await expect(page.getByTestId('roll-auto')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('roll-auto')).toHaveAttribute('aria-pressed', 'false', { timeout: 20000 });
  expect(['epic', 'legendary', 'mythic', 'secret']).toContain(await card(page).getAttribute('data-tier'));
});

test('AUTO ROLL spends GEMS and stops when they run out (never touches wins)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seed(page, {
    'taw.tut.markRolls': '1',
    // 25 gems = two paid rolls; EPIC pity far away and "until SECRET" so only the gems can stop it
    'taw.gems': JSON.stringify({ v: 1, bal: 25, peak: 12, streak: 0, mig: 1 }),
    'taw.markRolls': JSON.stringify({ v: 1, rolls: 1, sinceEpic: 0, everEpic: true, starter: true, marks: {}, milestones: [] }),
  });
  await openRoll(page);
  // reveals below SECRET skip, so the two rolls go fast; AUTO cycled to its highest target (LEGENDARY+)
  await page.getByTestId('roll-skip').selectOption('secret');
  for (let i = 0; i < 3; i += 1) await page.getByTestId('roll-auto').click();
  await expect(page.getByTestId('roll-auto')).toHaveAttribute('aria-pressed', 'false', { timeout: 20000 });
  await expect(page.locator('.rs-msg')).toHaveAttribute('data-need', '5');
  await expect(page.locator('.rs-need')).toHaveText('−5');
  const after = await page.evaluate(() => ({
    gems: JSON.parse(localStorage.getItem('taw.gems')).bal,
    wins: localStorage.getItem('taw.wins'),
    rolls: JSON.parse(localStorage.getItem('taw.markRolls')).rolls,
  }));
  expect(after.gems).toBe(5);
  // the wins only ever GAIN here (the INDEX rewards pay wins) — they never paid for a roll
  expect(Number(after.wins)).toBeGreaterThanOrEqual(50000000);
  // two paid rolls (a worn double-roll perk can add a free extra each)
  expect(after.rolls).toBeGreaterThanOrEqual(3);
  await expect(page.locator('.rs-sub .gem-count')).toHaveAttribute('data-gems', '5');
});

test('skip reveals below [tier]: default EPIC, the pick is stored', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seed(page, { 'taw.tut.markRolls': '1' });
  await openRoll(page);
  await expect(page.getByTestId('roll-skip')).toHaveValue('epic');
  await page.getByTestId('roll-skip').selectOption('legendary');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('taw.markRolls') || '{}').skipBelow);
  expect(stored).toBe('legendary');
});

test('short balance: the press shows −X + gem (never a silent grey button) — a huge wins balance never buys a roll', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seed(page, {
    'taw.tut.markRolls': '1',
    'taw.wins': '50000000',
    'taw.gems': JSON.stringify({ v: 1, bal: 4, peak: 12, streak: 0, mig: 1 }),
    'taw.markRolls': JSON.stringify({ v: 1, rolls: 1, starter: true, marks: {}, milestones: [] }),
  });
  await page.goto('/?portal=1');
  await menuReady(page);
  // the MARKS dot means "a roll is affordable": 4 gems, the starter spent → no dot
  await expect(page.locator('.hp-nav.is-gears .kb-rdot')).toHaveCount(0); // v2 menu: the GEARS rail button (ROLL + INDEX)'s dot
  await page.locator('.hp-nav.is-gears:visible').first().click(); // v2 menu: the GEARS rail button (ROLL + INDEX)
  await page.locator('.rs-overlay').waitFor();
  await holdRoll(page);
  await expect(page.locator('.rs-msg')).toHaveAttribute('data-need', '6');
  await expect(page.locator('.rs-need')).toHaveText('−6');
  await expect(page.locator('.rs-sr')).toHaveText('NEED 6 MORE GEMS'); // screen readers still get the sentence
  await expect(card(page)).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('taw.wins'))).toBe('50000000');
});

test('GEMS on the menu: icon + count under the wins pill; the ROLL dot only when a roll is affordable', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seed(page, {
    'taw.tut.markRolls': '1',
    'taw.gems': JSON.stringify({ v: 1, bal: 12, peak: 12, streak: 0, mig: 1 }),
    'taw.markRolls': JSON.stringify({ v: 1, rolls: 1, starter: true, marks: {}, milestones: [] }),
  });
  await page.goto('/?portal=1');
  await menuReady(page);
  const chip = page.locator('.menu-gems-chip:visible').first();
  // v2 menu: the kit's GEMS pill (KitPill) in the left rail, its gem the kit icon; the dot rides ROLL
  await expect(chip).toHaveAttribute('data-value', '12');
  await expect(chip.locator('.kit-icon[data-icon="gems"]')).toHaveCount(1);
  await expect(page.locator('.hp-nav.is-gears .kb-rdot').first()).toBeAttached();
  // it is in the bar cluster, not a fixed element of its own
  expect(await chip.evaluate((el) => getComputedStyle(el).position)).not.toBe('fixed');
});

test('reduced motion: straight to the result card, no reel animation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seed(page, { 'taw.tut.markRolls': '1' });
  await openRoll(page);
  await holdRoll(page);
  await expect(card(page)).toHaveCount(1, { timeout: 300 });
  // the REEL never moves (the app-wide press squash on the ROLL button itself — shallow under reduced motion,
  // juice/motion.js — is button feedback, not the reveal)
  const reelAnims = await page.evaluate(() => document.getAnimations().filter((a) => {
    const el = a.effect && a.effect.target;
    return el && el.closest && el.closest('.rs-stage') && a.playState === 'running';
  }).length);
  expect(reelAnims).toBe(0);
});

for (const [w, h] of [[360, 640], [390, 844], [1366, 657]]) {
  test(`${w}x${h}: the reel plays and lands, nothing sticks out, the card never covers ROLL`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await seed(page, { 'taw.tut.markRolls': '1' });
    await openRoll(page);
    await holdRoll(page);
    await expect(card(page)).toHaveCount(1, { timeout: SPUN });
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(sw).toBeLessThanOrEqual(w);
    const c = await card(page).boundingBox();
    const r = await page.locator('.rs-roll').boundingBox();
    expect(c.y + c.height).toBeLessThanOrEqual(r.y + 1);
    expect(r.y + r.height).toBeLessThanOrEqual(h);
  });
}

test('coming back from the INDEX never replays the last reveal', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page, { 'taw.tut.markRolls': '1' });
  await openRoll(page);
  await holdRoll(page);
  await expect(card(page)).toHaveCount(1, { timeout: SPUN });
  await page.waitForTimeout(4200);
  await keepReveal(page);
  await page.getByTestId('roll-index').click();
  await page.locator('.mx-panel').waitFor();
  await page.locator('.mx-close').click();
  await expect(page.locator('.rs-overlay')).toBeVisible();
  await page.waitForTimeout(200);
  expect(await rollUiAnims(page)).toBe(0);
  await expect(page.getByTestId('roll-cutscene')).not.toHaveClass(/is-on/);
});

test('INDEX opens the MARKS INDEX and closes back to the ROLL screen', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seed(page, { 'taw.tut.markRolls': '1' });
  await openRoll(page);
  await holdRoll(page);
  await expect(card(page)).toHaveCount(1, { timeout: SPUN });
  await keepReveal(page);
  await page.getByTestId('roll-index').click();
  await page.locator('.mx-panel').waitFor();
  // nothing worn → the first mark AUTO-equipped; INDEX v2: the worn card says its stat
  await expect(page.locator('.mx-tile.is-on')).toHaveCount(1);
  await expect(page.locator('.mx-tile.is-on .mx-tile-sub')).toHaveText(/^[+×][\d.,]+s? [A-Z]/);
  await page.locator('.mx-close').click();
  await expect(page.locator('.rs-overlay')).toBeVisible();
  await page.locator('.rs-close').click();
  await expect(page.locator('.rs-overlay')).toHaveCount(0);
});

test('ROLL vs INDEX never mix (Andy oct5): INDEX has no REPLAY / roll / pity / gems; ROLL has no prose', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seed(page, { 'taw.tut.markRolls': '1' });
  await openRoll(page);
  await holdRoll(page);
  await expect(card(page)).toHaveCount(1, { timeout: SPUN });
  // the result card: the ★ pip graphic, never the "7/10 → ★3" sentence
  await expect(card(page)).not.toContainText('→');
  // the auto-roll settings are compact — no UNTIL / OR BETTER / SKIP REVEALS BELOW captions
  const controls = await page.locator('.rs-controls').innerText();
  expect(controls).not.toMatch(/UNTIL|OR BETTER|REVEALS BELOW/);
  const markId = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('taw.markRolls')).marks)[0]);
  await keepReveal(page);
  await page.getByTestId('roll-index').click();
  await page.locator('.mx-panel').waitFor();
  await expect(page.locator('.mx-overlay .rs-roll, .mx-overlay [data-testid="roll-pity"], .mx-overlay .gem-count')).toHaveCount(0);
  // ROLL v1 / R2 oct8 #5: the card face is data only and NOTHING sits under a card — the "7/10 → ★3" progress line
  // lives in the detail sheet (rarity is colour, dupes are the card's own ×N)
  await expect(page.locator('.mx-grid .mx-pips-text')).toHaveCount(0);
  await expect(page.locator('.mx-tile').filter({ hasText: '→' })).toHaveCount(0);
  await expect(page.locator('.mx-grid .mx-tile-next')).toHaveCount(0);
  await page.locator(`.mx-tile[data-mark="${markId}"]`).click();
  await expect(page.locator('.mx-sheet')).toBeVisible();
  await expect(page.locator('.mx-replay')).toHaveCount(0);
});

// SEASON 2 (P6, ?season2=1 — progression-v3.md "75 gems a roll"): the same ROLL screen at the v3 price. The season keeps
// its own gems (taw.s2.gems); the live save's taw.gems is never read or charged. AUTO ROLL is the R1 unlock (FINAL).
const S2_GEMS = (bal) => JSON.stringify({ v: 1, bal, peak: 12, streak: 0, mig: 1 });
const S2_STARTED = JSON.stringify({ v: 2, rolls: 3, sinceEpic: 3, sinceLegendary: 3, everEpic: true, starter: true, marks: {}, milestones: [], skipBelow: 'secret' });
const s2Store = (page) => page.evaluate(() => ({
  s2: JSON.parse(localStorage['taw.s2.gems'] || '{}').bal,
  live: JSON.parse(localStorage['taw.gems'] || '{}').bal, // named access = the RAW season-1 key
  rolls: JSON.parse(localStorage['taw.markRolls'] || '{}').rolls,
}));

test('SEASON2: a roll costs 75 gems — charged once from the season-2 wallet, the live wallet untouched', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seed(page, { 'taw.tut.markRolls': '1', 'taw.s2.gems': S2_GEMS(100), 'taw.s2.rebirths': '2', 'taw.markRolls': S2_STARTED });
  await openRoll(page, '&season2=1');
  const roll = page.locator('.rs-roll');
  await expect(roll).toHaveText(/^HOLD TO ROLL\s*75$/);
  await expect(roll).toHaveAttribute('aria-label', 'HOLD TO ROLL · 75 GEMS');
  await expect(page.locator('.rs-sub .gem-count')).toHaveAttribute('data-gems', '100');
  await holdRoll(page);
  await page.waitForTimeout(SPUN);
  await keepReveal(page);
  await expect(card(page)).toHaveCount(1);
  const st = await s2Store(page);
  expect(st.s2).toBe(25); // exactly one 75-gem charge
  expect(st.live).toBe(1000); // the season-1 balance is never charged
  expect(st.rolls).toBe(4);
  await expect(page.locator('.rs-sub .gem-count')).toHaveAttribute('data-gems', '25');
  // 25 < 75: the next press shows the gap, charges nothing, rolls nothing
  await holdRoll(page);
  await expect(page.locator('.rs-need')).toHaveText('−50');
  expect(await s2Store(page)).toEqual(st);
});

test('SEASON2: AUTO ROLL is locked before R1: a tap rolls nothing and charges nothing', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seed(page, { 'taw.tut.markRolls': '1', 'taw.s2.gems': S2_GEMS(150), 'taw.s2.rebirths': '0', 'taw.markRolls': S2_STARTED });
  await openRoll(page, '&season2=1');
  const auto = page.getByTestId('roll-auto');
  await expect(auto).toHaveText('AUTO · R1');
  await expect(auto).toHaveAttribute('aria-disabled', 'true');
  await auto.click({ force: true }); // a real tap on the locked button (aria-disabled): it must do nothing
  await page.waitForTimeout(600);
  await expect(auto).toHaveAttribute('aria-pressed', 'false');
  const st = await s2Store(page);
  expect(st.s2).toBe(150);
  expect(st.rolls).toBe(3);
});

test('SEASON2 at R1+: AUTO ROLL spends 75 a roll and stops when the season-2 gems run out', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seed(page, { 'taw.tut.markRolls': '1', 'taw.s2.gems': S2_GEMS(160), 'taw.s2.rebirths': '2', 'taw.markRolls': S2_STARTED });
  await openRoll(page, '&season2=1');
  const auto = page.getByTestId('roll-auto');
  await expect(auto).toHaveText('AUTO: OFF');
  for (let i = 0; i < 3; i += 1) await auto.click(); // → LEGENDARY+: only the gems (or a LEGENDARY+) stop it
  await expect(auto).toHaveAttribute('aria-pressed', 'false', { timeout: 30000 });
  await keepReveal(page);
  const st = await s2Store(page);
  // 160 = two rolls (or one, if the first already hit LEGENDARY+); never negative, never the live wallet
  expect([10, 85]).toContain(st.s2);
  expect(st.live).toBe(1000);
  expect(st.rolls).toBe(3 + (160 - st.s2) / 75);
});
