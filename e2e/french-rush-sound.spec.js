// e2e/french-rush-sound.spec.js
//
// FRENCH RUSH SOUND + PRONUNCIATION (feat/french-rush-sound; Andy: "give some sound to the transitions (and make
// sure they know abt pronunciation)"). AudioContext and speechSynthesis are STUBBED before the page loads, so the
// spec sees every voice the game schedules and every word it asks the browser to say:
//   - a transition (the next card sliding in) schedules a synthesized sound;
//   - the first 🔊 carries the one-time "TAP 🔊 TO HEAR IT" note, and the next card does not;
//   - the 🔊 asks speechSynthesis for the word in fr-FR (and the review card says it by itself);
//   - a device with NO French voice shows no 🔊 at all, and nothing throws.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { installBackendMock } from './support/backendMock.js';

const WORDS = JSON.parse(readFileSync(new URL('../src/data/frenchRush/words.json', import.meta.url), 'utf8'));
const fold = (s) => s.replace(/œ/g, 'oe').normalize('NFD').replace(/[̀-ͯ]/g, '');

// Runs in the page before any app code. `voices` = the device's voice list.
function stubAudioAndSpeech(voices) {
  const log = { starts: 0, spoken: [] };
  window.__snd = log;
  const param = () => ({
    value: 0,
    setValueAtTime() { return this; },
    linearRampToValueAtTime() { return this; },
    exponentialRampToValueAtTime() { return this; },
    setTargetAtTime() { return this; },
    cancelScheduledValues() { return this; },
  });
  const node = (extra = {}) => ({
    connect(n) { return n; },
    disconnect() {},
    start() { log.starts += 1; },
    stop() {},
    ...extra,
  });
  class FakeAudioContext {
    constructor() {
      this.state = 'running';
      this.sampleRate = 44100;
      this.destination = node();
      this._t0 = performance.now();
    }
    get currentTime() { return (performance.now() - this._t0) / 1000; }
    resume() { return Promise.resolve(); }
    createGain() { return node({ gain: param() }); }
    createOscillator() { return node({ type: 'sine', frequency: param(), detune: param() }); }
    createBiquadFilter() { return node({ type: 'lowpass', frequency: param(), Q: param(), gain: param() }); }
    createDynamicsCompressor() {
      return node({ threshold: param(), knee: param(), ratio: param(), attack: param(), release: param() });
    }
    createBuffer(ch, length) { return { getChannelData: () => new Float32Array(length) }; }
    createBufferSource() { return node({ buffer: null, playbackRate: param() }); }
  }
  window.AudioContext = FakeAudioContext;
  window.webkitAudioContext = FakeAudioContext;

  window.SpeechSynthesisUtterance = class {
    constructor(text) {
      this.text = text;
      this.lang = '';
      this.voice = null;
      this.rate = 1;
    }
  };
  const listeners = [];
  const synth = {
    getVoices: () => voices,
    speak: (u) => log.spoken.push({ text: u.text, lang: u.lang, voice: u.voice ? u.voice.name : null }),
    cancel() {},
    addEventListener: (type, fn) => { if (type === 'voiceschanged') listeners.push(fn); },
    removeEventListener() {},
    onvoiceschanged: null,
  };
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
}

const FR_VOICES = [
  { name: 'Samantha', lang: 'en-US', localService: true, default: true, voiceURI: 'sam' },
  { name: 'Thomas', lang: 'fr-FR', localService: true, default: false, voiceURI: 'thomas' },
];
const EN_ONLY = [{ name: 'Samantha', lang: 'en-US', localService: true, default: true, voiceURI: 'sam' }];

async function startSelfPacedQuiz(page) {
  await page.goto('/french-rush');
  await expect(page.locator('.sr-cover')).toContainText('FRENCH');
  await page.getByRole('button', { name: 'Play' }).click();
  await page.getByRole('button', { name: /QUIZ/ }).click();
  await expect(page.locator('.sr-setup')).toBeVisible();
  await page.getByRole('radio', { name: /Families/i }).click();
  await expect(page.getByRole('radio', { name: /MY PACE/ })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('button', { name: /^Start$/ }).click();
  await expect(page.locator('.sr-field--gloss.in')).toBeVisible();
}

// type the current card's answer (the meaning names exactly one word — frenchRush.test.js)
async function answerCurrent(page) {
  const gloss = (await page.locator('.sr-gloss').innerText()).trim();
  const row = WORDS.find((r) => r.category === 'familles' && r.gloss === gloss);
  expect(row, `a Families word with the meaning "${gloss}"`).toBeTruthy();
  await page.keyboard.type(fold(row.word));
  await expect(page.locator('.sr-reencode')).toBeVisible();
  return row;
}

test('transitions make a sound; the 🔊 note shows once; the 🔊 says the word in fr-FR', async ({ page }) => {
  await installBackendMock(page);
  await page.addInitScript(stubAudioAndSpeech, FR_VOICES);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await startSelfPacedQuiz(page);
  // the cover told them up front
  // (checked on the way back below — the cover is gone once the run starts)

  const row = await answerCurrent(page);
  const say = page.locator('.sr-reencode .sr-say');
  await expect(say).toBeVisible();
  // the 🔊 is a real touch target (layout size — the review card lands with a scale one-shot)
  const [sw, sh] = await say.evaluate((el) => [el.offsetWidth, el.offsetHeight]);
  expect(sw).toBeGreaterThanOrEqual(44);
  expect(sh).toBeGreaterThanOrEqual(44);
  // FIRST 🔊 = the one-time note
  await expect(page.getByTestId('say-hint')).toBeVisible();
  await expect(page.getByTestId('say-hint')).toContainText('TAP 🔊 TO HEAR IT');
  // the review card read the word by itself as it landed (a French voice is available)
  await expect.poll(() => page.evaluate(() => window.__snd.spoken.length)).toBeGreaterThanOrEqual(1);

  // the 🔊 asks speechSynthesis for the word, in French, with the French voice
  const before = await page.evaluate(() => window.__snd.spoken.length);
  await say.click();
  const spoken = await page.evaluate(() => window.__snd.spoken);
  expect(spoken.length).toBe(before + 1);
  expect(spoken.at(-1)).toEqual({ text: row.word, lang: 'fr-FR', voice: 'Thomas' });
  await expect(page.getByTestId('say-hint')).toHaveCount(0); // tapping it retires the note

  // a TRANSITION (the next card slides in) schedules a synthesized sound
  await page.waitForTimeout(200); // past the sound gate's window, so the next cue is not swallowed
  const startsBefore = await page.evaluate(() => window.__snd.starts);
  await page.getByRole('button', { name: /Continue/ }).click();
  await expect(page.locator('.sr-reencode')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.__snd.starts)).toBeGreaterThan(startsBefore);

  // the next review card: the note is NOT shown again (once per device)
  await answerCurrent(page);
  await expect(page.locator('.sr-reencode .sr-say')).toBeVisible();
  await expect(page.getByTestId('say-hint')).toHaveCount(0);

  // …not even after a reload
  await page.reload();
  await expect(page.locator('.sr-cover')).toContainText('HEAR EVERY WORD');
  expect(await page.evaluate(() => localStorage.getItem('fr.sayHint.v1'))).toBe('1');
  expect(errors).toEqual([]);
});

test('the run header SOUND switch is the arcade mute: off = no transition sounds, no auto-read', async ({ page }) => {
  await installBackendMock(page);
  await page.addInitScript(stubAudioAndSpeech, FR_VOICES);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await startSelfPacedQuiz(page);

  // it lives IN the run header strip, beside HOME — not a floating control
  const sound = page.locator('.sr-hud .sr-hud-ctl .sr-hud-sound');
  await expect(sound).toBeVisible();
  await expect(sound).toHaveAttribute('aria-checked', 'true');
  expect(await sound.evaluate((el) => getComputedStyle(el).position)).not.toBe('fixed');
  const box = await sound.boundingBox();
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);

  await sound.click();
  await expect(sound).toHaveAttribute('aria-checked', 'false');
  expect(await page.evaluate(() => localStorage.getItem('taw.sfxEvents'))).toBe('0'); // the arcade's own mute

  // muted: the capture + review card make no sound and the word is not read by itself…
  const startsBefore = await page.evaluate(() => window.__snd.starts);
  await answerCurrent(page);
  await page.getByRole('button', { name: /Continue/ }).click();
  await expect(page.locator('.sr-reencode')).toHaveCount(0);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__snd.starts)).toBe(startsBefore);
  expect(await page.evaluate(() => window.__snd.spoken.length)).toBe(0);

  // …and back on, the transitions sound again
  await sound.click();
  await expect(sound).toHaveAttribute('aria-checked', 'true');
  expect(await page.evaluate(() => localStorage.getItem('taw.sfxEvents'))).toBe('1');
  await page.waitForTimeout(200);
  const before2 = await page.evaluate(() => window.__snd.starts);
  await page.getByRole('button', { name: /Hint/ }).click(); // the clue stage decays → an ink tick
  await expect.poll(() => page.evaluate(() => window.__snd.starts)).toBeGreaterThan(before2);
  expect(errors).toEqual([]);
});

test('SAT Rush gets the same SOUND switch in its run header', async ({ page }) => {
  await installBackendMock(page);
  await page.addInitScript(stubAudioAndSpeech, FR_VOICES);
  await page.goto('/sat-rush/play');
  const sound = page.locator('.sr-hud .sr-hud-ctl .sr-hud-sound');
  await expect(sound).toBeVisible();
  await expect(sound).toHaveAttribute('aria-checked', 'true');
  await sound.click();
  expect(await page.evaluate(() => localStorage.getItem('taw.sfxEvents'))).toBe('0');
});

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test('the 🔊 note sits under the 🔊 and points UP; header fits with no page scroll', async ({ page }) => {
    await installBackendMock(page);
    await page.addInitScript(stubAudioAndSpeech, FR_VOICES);
    await page.goto('/french-rush');
    await page.getByRole('button', { name: 'Play' }).click();
    await page.getByRole('button', { name: /QUIZ/ }).click();
    await page.getByRole('button', { name: /^theme/ }).click();
    await page.getByRole('option', { name: /Families/i }).click();
    await page.getByRole('button', { name: /^Start$/ }).click();
    await expect(page.locator('.sr-field--gloss.in')).toBeVisible();
    const sound = page.locator('.sr-hud .sr-hud-sound');
    await expect(sound).toBeVisible();
    const sb = await sound.boundingBox();
    expect(sb.width).toBeGreaterThanOrEqual(44);
    expect(sb.height).toBeGreaterThanOrEqual(44);
    const gloss = (await page.locator('.sr-gloss').innerText()).trim();
    const row = WORDS.find((r) => r.category === 'familles' && r.gloss === gloss);
    await page.locator('.sr-suspect-btn', { hasText: new RegExp(`^${row.word}$`, 'i') }).first().tap();
    const hint = page.getByTestId('say-hint');
    await expect(hint).toBeVisible();
    await expect(hint.locator('.sr-say-hint-arrow.up')).toBeVisible();
    await expect(hint.locator('.sr-say-hint-arrow.side')).toBeHidden();
    // let the one-shot pop-in (scale + tilt) and the card's landing finish, then compare CENTRES (robust to the tilt)
    await hint.evaluate((el) => Promise.all(document.getAnimations().filter((a) => a.effect && a.effect.getComputedTiming().endTime !== Infinity).map((a) => a.finished.catch(() => null))));
    const hb = await hint.boundingBox();
    const btn = await page.locator('.sr-reencode .sr-say').boundingBox();
    expect(hb.y + hb.height / 2).toBeGreaterThan(btn.y + btn.height); // its middle sits below the 🔊 = under it
    const s = await page.evaluate(() => ({ sh: document.scrollingElement.scrollHeight, ch: innerHeight }));
    expect(s.sh).toBeLessThanOrEqual(s.ch + 1);
  });
});

test('a device with no French voice shows no 🔊 and never speaks — and nothing breaks', async ({ page }) => {
  await installBackendMock(page);
  await page.addInitScript(stubAudioAndSpeech, EN_ONLY);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/french-rush');
  await expect(page.locator('.sr-cover')).toBeVisible();
  await expect(page.locator('.sr-cover')).not.toContainText('HEAR EVERY WORD');
  await page.getByRole('button', { name: 'Play' }).click();
  await page.getByRole('button', { name: /QUIZ/ }).click();
  await page.getByRole('radio', { name: /Families/i }).click();
  await page.getByRole('button', { name: /^Start$/ }).click();
  await expect(page.locator('.sr-field--gloss.in')).toBeVisible();
  await answerCurrent(page);
  await expect(page.locator('.sr-say')).toHaveCount(0);
  await expect(page.getByTestId('say-hint')).toHaveCount(0);
  expect(await page.evaluate(() => window.__snd.spoken.length)).toBe(0);
  // the transitions still sound
  expect(await page.evaluate(() => window.__snd.starts)).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
