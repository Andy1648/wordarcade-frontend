// e2e/feel-ladder.spec.js — the in-game ESCALATION LADDER (next-passes-spec PASS 2, V2 "ARCADE").
//
// WRITTEN, NOT YET RUN (feat/feel-ladder was built under a no-Playwright rule). Run locally:
//   npx playwright test e2e/feel-ladder.spec.js --reporter=line
//
// What it gates:
//   1. combo 2 / 4 / 7 / 10 each fire exactly ONE tier effect (the slam, or its tag when a
//      clutch / lucky / rare word outranks it) — never one per word;
//   2. every per-word particle burst is <= the ladder cap (40), and the full-screen flash fires on
//      TIER-UPS ONLY (never per word);
//   3. the accept path makes NO layout read (getBoundingClientRect / getComputedStyle / offset*)
//      inside the Enter keydown dispatch — which includes the submit, the accept juice and the
//      synchronous React flush it triggers;
//   4. nothing animates the input; the infinite-animation count does not grow; the document stays
//      under 60 running animations at T4;
//   5. reduced motion: no WAAPI slam, no particles, no flash — the slam label is shown static;
//   6. LUCKY in Word Bomb renders a visible label (no ×N — lucky pays no multiplier) (NEEDS the one-line App.jsx change that passes
//      `lucky` on lastLanding — red until it lands).
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';

const ME = 'e2e-player';
const PLAYERS = [
  { id: ME, name: 'ANDY', lives: 3, isHost: true },
  { id: 'p1', name: 'PLAYER1', lives: 3, isHost: false },
];
// All contain the fragment 'str' (so they pass the client's local checks and take the optimistic
// path), all distinct, mostly COMMON (so the slam — not its tag — usually owns the word).
const WORDS = ['strong', 'string', 'street', 'stream', 'strike', 'straw', 'stress', 'strict', 'stroke', 'struck', 'strength', 'strange'];

// Instrumentation, installed before any app code runs.
function instrument() {
  window.__TAW_FX_LOG = [];
  window.__TAW_NO_ACHIEVEMENT_GRANT = true;
  const log = (window.__feel = { slams: [], tags: [], inputAnims: 0, reads: 0, readStacks: [], counting: false });
  // WAAPI calls on the pooled slam / tag nodes, and anything that tries to animate the input.
  const origAnimate = Element.prototype.animate;
  Element.prototype.animate = function (...args) {
    try {
      const cl = this.classList;
      if (cl && cl.contains('tier-slam')) log.slams.push({ t: performance.now(), tier: this.getAttribute('data-tier') });
      if (cl && cl.contains('tier-slam-tag')) log.tags.push({ t: performance.now(), text: this.textContent });
      if (cl && cl.contains('game-input')) log.inputAnims += 1;
    } catch { /* never break the app */ }
    return origAnimate.apply(this, args);
  };
  // Layout-read counters, live only inside the Enter keydown dispatch (capture on, bubble off).
  const count = (name) => {
    if (!log.counting) return;
    log.reads += 1;
    log.readStacks.push(`${name}\n${String(new Error().stack).split('\n').slice(2, 7).join('\n')}`);
  };
  const origRect = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function (...a) { count('getBoundingClientRect'); return origRect.apply(this, a); };
  const origGcs = window.getComputedStyle;
  window.getComputedStyle = function (...a) { count('getComputedStyle'); return origGcs.apply(this, a); };
  for (const p of ['offsetWidth', 'offsetHeight', 'offsetTop', 'offsetLeft', 'clientWidth', 'clientHeight']) {
    const proto = p.startsWith('client') ? Element.prototype : HTMLElement.prototype;
    const d = Object.getOwnPropertyDescriptor(proto, p);
    if (!d || !d.get) continue;
    Object.defineProperty(proto, p, { configurable: true, get() { count(p); return d.get.call(this); } });
  }
  window.addEventListener('keydown', (e) => { if (e.key === 'Enter') log.counting = true; }, true);
  window.addEventListener('keydown', (e) => { if (e.key === 'Enter') log.counting = false; }, false);
  try {
    localStorage.setItem('taw.seenGameSpotlight', '1');
    localStorage.setItem('taw.rebirths', '1');
  } catch { /* blocked */ }
}

async function enterWordBomb(page, { lucky = 'off' } = {}) {
  const mock = await installBackendMock(page);
  await page.addInitScript(instrument);
  await page.addInitScript((l) => { window.__TAW_LUCKY = l; }, lucky);
  await page.goto('/?portal=1');
  await menuReady(page);
  mock.pushToClient({
    type: 'room_update',
    payload: { code: 'ABCD', gameType: 'word-bomb', hostId: ME, difficultyKey: 'hard', players: PLAYERS },
  });
  await page.waitForTimeout(60);
  mock.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } });
  await page.waitForTimeout(60);
  mock.pushToClient({
    type: 'turn_update',
    payload: { currentPlayerId: ME, players: PLAYERS, combo: 'str', usedWords: [], timerSeconds: 20, maxLives: 3 },
  });
  await page.waitForTimeout(4700); // the intro countdown
  return mock;
}

// Type + submit a word the way a player does (sets the "this result is mine" gate the streak
// counts on), then confirm it from the "server".
async function play(page, mock, word) {
  const input = page.locator('.game-input');
  await input.fill(word);
  await input.press('Enter');
  mock.pushToClient({ type: 'word_result', payload: { playerId: ME, word, valid: true, accepted: true } });
  await page.waitForTimeout(160);
}

test.describe('feel ladder — Word Bomb', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.setViewportSize({ width: 1366, height: 768 });
  });

  test('combo 2 / 4 / 7 / 10 each fire ONE tier effect; flash on tier-ups only; particles capped', async ({ page }) => {
    const mock = await enterWordBomb(page);
    await page.evaluate(() => { window.__TAW_FX_LOG.length = 0; });
    const fired = [];
    for (let i = 0; i < 11; i++) {
      await play(page, mock, WORDS[i]);
      const n = await page.evaluate(() => window.__feel.slams.length + window.__feel.tags.length);
      fired.push(n);
    }
    // cumulative tier effects after words 1..11: crossings land on the 2nd, 4th, 7th and 10th word
    expect(fired).toEqual([0, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4]);

    const { slams, fx } = await page.evaluate(() => ({ slams: window.__feel.slams, fx: window.__TAW_FX_LOG }));
    const bursts = fx.filter((e) => e.kind === 'burst');
    const flashes = fx.filter((e) => e.kind === 'flash');
    expect(bursts.length, 'one burst per accepted word').toBeGreaterThanOrEqual(11);
    for (const b of bursts) expect(b.n, 'per-word particles stay under the ladder cap').toBeLessThanOrEqual(40);
    // the flash rides the slam (an outranked tier is a tag and does not flash) — never per word
    expect(flashes.length).toBe(slams.length);
    // the edge frame is a static attribute at T4
    await expect(page.locator('.game-stage--wb')).toHaveAttribute('data-heat', '4');
  });

  test('NO layout reads on the accept path', async ({ page }) => {
    const mock = await enterWordBomb(page);
    await play(page, mock, WORDS[0]); // warm-up: first-use caches (the flash overlay, fonts…)
    await page.evaluate(() => { window.__feel.reads = 0; window.__feel.readStacks = []; });
    for (let i = 1; i < 5; i++) await play(page, mock, WORDS[i]);
    const { reads, readStacks } = await page.evaluate(() => window.__feel);
    expect(reads, `layout reads inside the Enter dispatch:\n${readStacks.join('\n---\n')}`).toBe(0);
  });

  test('nothing animates the input; infinite count unchanged; < 60 animations at T4', async ({ page }) => {
    const mock = await enterWordBomb(page);
    const infiniteBefore = await page.evaluate(
      () => document.getAnimations().filter((a) => a.effect && a.effect.getComputedTiming().iterations === Infinity).length
    );
    for (let i = 0; i < 10; i++) await play(page, mock, WORDS[i]);
    const after = await page.evaluate(() => ({
      infinite: document.getAnimations().filter((a) => a.effect && a.effect.getComputedTiming().iterations === Infinity).length,
      total: document.getAnimations().length,
      onInput: document.getAnimations().filter((a) => a.effect && a.effect.target && a.effect.target.classList && a.effect.target.classList.contains('game-input')).length,
      inputAnims: window.__feel.inputAnims,
    }));
    expect(after.infinite, 'no new infinite animations').toBeLessThanOrEqual(infiniteBefore);
    expect(after.total).toBeLessThan(60);
    expect(after.onInput).toBe(0);
    expect(after.inputAnims).toBe(0);
  });

  test('reduced motion: no slam animation, no particles, no flash — the label is shown static', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const mock = await enterWordBomb(page);
    await page.evaluate(() => { window.__TAW_FX_LOG.length = 0; });
    for (let i = 0; i < 4; i++) await play(page, mock, WORDS[i]);
    const r = await page.evaluate(() => ({
      slams: window.__feel.slams.length,
      tags: window.__feel.tags.length,
      fx: window.__TAW_FX_LOG.filter((e) => e.kind === 'burst' || e.kind === 'flash').length,
      slamRunning: document.querySelector('.tier-slam').getAnimations().length,
    }));
    expect(r.slams, 'no WAAPI slam under reduced motion').toBe(0);
    expect(r.tags, 'no WAAPI tag under reduced motion').toBe(0);
    expect(r.fx, 'no particles / flashes under reduced motion').toBe(0);
    expect(r.slamRunning).toBe(0);
    // ...but the state is still SAID: the 4th word crossed into T2, and its label is up, static.
    await expect(page.locator('.tier-slam')).toHaveCSS('opacity', '1');
    await expect(page.locator('.game-stage--wb')).toHaveAttribute('data-heat', '2');
  });

  test('a RARE word owns the slot: its landing shows, the hype word does not', async ({ page }) => {
    const mock = await enterWordBomb(page);
    mock.pushToClient({ type: 'word_result', payload: { playerId: ME, word: 'zymurgy', valid: true, accepted: true } });
    await expect(page.locator('.wl-stamp')).toBeVisible({ timeout: 2000 });
    await expect(page.locator('.wb-react .hype-popup')).toHaveCount(0);
  });

  // NEEDS the App.jsx line (lastLanding.lucky). Red until it lands — that is the point.
  test('LUCKY in Word Bomb is visible, never silent — and claims no ×N (Rebirth Rush pays none)', async ({ page }) => {
    const mock = await enterWordBomb(page, { lucky: 'always' });
    await play(page, mock, WORDS[0]);
    await expect(page.locator('.fx-lucky-label')).toBeVisible({ timeout: 2000 });
    await expect(page.locator('.fx-lucky-label')).toContainText('LUCKY');
    await expect(page.locator('.fx-lucky-label')).not.toContainText('×');
  });
});
