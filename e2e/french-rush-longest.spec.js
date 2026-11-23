// e2e/french-rush-longest.spec.js — FRENCH RUSH never clips its LONGEST words (nov23, Andy: "answers are cut off a
// bit", "study cards are cut off too"). The run is steered onto the longest rows in the French data by seeding the
// learning memory: every other word is MASTERED (so the case file opens on the one fresh word) or sits in the last
// study decks (so the study screen deals the longest cards). Then at a laptop, a 1080p projector and two phones,
// on the PLAY card (every clue shown), the ANSWER card and the STUDY cards:
//   - no text box is wider than it lets show (scrollWidth <= clientWidth), and no element is cut by an overflow box;
//   - no glyph of text sits outside the box that clips it, or outside the screen;
//   - main text is >= 16px on a phone, and nothing anywhere is under 11px.
// Set FR_SHOTS=<dir> to also save a PNG of each screen.
import { test, expect } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { installBackendMock } from './support/backendMock.js';

const WORDS = JSON.parse(readFileSync(new URL('../src/data/frenchRush/words.json', import.meta.url), 'utf8'));
const SHOTS = process.env.FR_SHOTS || '';
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const SIZES = [
  [1366, 768],
  [1920, 1080],
  [390, 844],
  [360, 640],
];

// FRENCH RUSH levels (runSpec.js FR_DIFFICULTIES)
const inHard = (r) => r.tier >= 3 && r.tier <= 5;
const inMedium = (r) => r.tier >= 1 && r.tier <= 4 && (r.ap || 1) <= 2;
const byLen = (f) => (a, b) => f(b) - f(a);
// the QUIZ words: the longest meaning (MEDIUM), and the longest French word with its article (HARD)
const LONG_GLOSS = [...WORDS].filter(inMedium).sort(byLen((r) => r.gloss.length))[0];
const LONG_WORD = [...WORDS].filter(inHard).sort(byLen((r) => r.word.length + (r.pos === 'n' ? 3 : 0) + r.gloss.length / 100))[0];
// a 12-letter word: enough same-length words exist for a full set of long choices
const LONG_CHOICES = [...WORDS].filter((r) => inMedium(r) && r.word.length === 12).sort(byLen((r) => r.gloss.length))[0];
// the STUDY deck: the five hard, non-guessable rows with the most text on their card
const cardLen = (r) => r.word.length + r.gloss.length + r.context.length + r.contextEn.length + (r.root ? JSON.stringify(r.root).length : 0);
const LONG_STUDY = [...WORDS].filter((r) => inHard(r) && !r.guessable).sort(byLen(cardLen)).slice(0, 5);

const THEMES = { familles: /Families/, identites: /identities/, esthetique: /Beauty/, sciences: /Science/, vie: /Contemporary/, defis: /Global/, connecteurs: /connectors/, examen: /Exam/ };

// a device with a French voice, so the 🔊 sits on the answer + study cards (the widest version of them)
function stubVoices() {
  const voices = [{ name: 'Thomas', lang: 'fr-FR', localService: true, default: true, voiceURI: 'thomas' }];
  window.SpeechSynthesisUtterance = class {
    constructor(text) {
      this.text = text;
    }
  };
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: { getVoices: () => voices, speak() {}, cancel() {}, addEventListener() {}, removeEventListener() {}, onvoiceschanged: null },
  });
}

// the learning memory (lexicon.js, v1): `fresh` words untouched, every other word mastered and not due
function seedMastered(fresh) {
  const keep = new Set(fresh);
  const records = {};
  for (const r of WORDS) {
    if (keep.has(r.word)) continue;
    records[r.word] = { w: r.word, box: 3, seen: 3, cleared: 3, missed: 0, lastSeen: 1000, bestStage: 0, antes: [5, 5, 5] };
  }
  return JSON.stringify({ v: 1, session: 1000, mode: 'lineup', lastBriefed: [], records });
}
// every word but `deck` was on a recent study screen, so the study deck is exactly `deck`
function seedStudyDeck(deck) {
  const keep = new Set(deck);
  const rest = WORDS.map((r) => r.word).filter((w) => !keep.has(w));
  return JSON.stringify({ v: 1, session: 1000, mode: 'briefing', lastBriefed: [rest], records: {} });
}

async function openWith(page, w, h, lexicon) {
  await page.setViewportSize({ width: w, height: h });
  await installBackendMock(page);
  await page.addInitScript(stubVoices);
  await page.addInitScript((lex) => {
    if (!sessionStorage.getItem('fr-seeded')) {
      localStorage.setItem('wa_frenchrush_lexicon', lex);
      sessionStorage.setItem('fr-seeded', '1');
    }
  }, lexicon);
  await page.goto('/french-rush');
  await expect(page.locator('.sr-cover')).toBeVisible();
}

async function setUp(page, mode, level, theme, length) {
  await page.getByRole('button', { name: /^Play$/ }).click();
  await page.getByRole('button', { name: mode }).click();
  await expect(page.locator('.sr-setup')).toBeVisible();
  await page.getByRole('radio', { name: new RegExp(`^${level}`) }).click();
  if (theme) {
    await page.getByRole('button', { name: /^theme/ }).click();
    await page.getByRole('option', { name: THEMES[theme] }).click();
  }
  const noTimer = page.getByRole('radio', { name: /NO TIMER/ });
  if (await noTimer.count()) await noTimer.click();
  await page.getByRole('radio', { name: new RegExp(`^${length}$`) }).click();
  await page.getByRole('button', { name: /^(Start|Study)$/ }).click();
}

// let every finite one-shot (page rise, card landing) finish, so the boxes are measured at rest
async function settle(page) {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect && a.effect.getComputedTiming().endTime !== Infinity)
        .map((a) => a.finished.catch(() => null))
    )
  );
}

async function audit(page, where, scope, { phone }) {
  await settle(page);
  const bad = await page.evaluate(
    ({ scope, phone }) => {
      const out = [];
      const root = document.querySelector(scope);
      if (!root) return [`no ${scope}`];
      // measure the LAYOUT: the paper's static tilts (a 1-3deg rotate on a chip or a card) turn every box into a
      // larger axis-aligned rectangle, which would read as overflow that is not there
      const flat = document.createElement('style');
      flat.textContent = '#root *, #root *::before, #root *::after { transform: none !important; }';
      document.head.appendChild(flat);
      const seen = (el) => {
        for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
          const cs = getComputedStyle(n);
          if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return false;
        }
        return true;
      };
      const clips = (el) => {
        const cs = getComputedStyle(el);
        return cs.overflowX !== 'visible' || cs.overflowY !== 'visible';
      };
      const name = (el) => `${el.tagName.toLowerCase()}.${String(el.className).trim().split(/\s+/).join('.')}`;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      // MAIN text on a phone: the clue, the answer, the study card's word / meaning / example
      const MAIN = '.sr-gloss, .sr-reencode-word, .sr-reencode-def, .sr-reencode-tag, .sr-brief-word, .sr-brief-def, .sr-brief-sentence, .sr-suspect-word';
      // the nearest drawn box (a bordered ancestor) a line of text belongs inside
      const frameOf = (el) => {
        for (let a = el, i = 0; a && a !== root.parentElement && i < 4; a = a.parentElement, i++) {
          const cs = getComputedStyle(a);
          if (cs.display === 'inline') continue;
          if (parseFloat(cs.borderLeftWidth) >= 1 && parseFloat(cs.borderRightWidth) >= 1) return a;
        }
        return null;
      };
      for (const el of [root, ...root.querySelectorAll('*')]) {
        if (!seen(el)) continue;
        // a choice already ruled out is crossed out ON PURPOSE (the NON stamp)
        if (el.closest('.sr-suspect.cleared')) continue;
        const cs = getComputedStyle(el);
        const texts = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim());
        const fs = parseFloat(cs.fontSize);
        if (texts.length && fs < 11) out.push(`${fs}px text: ${name(el)} "${el.textContent.trim().slice(0, 30)}"`);
        if (texts.length && phone && el.closest(MAIN) && fs < 16) out.push(`${fs}px main text on a phone: ${name(el)}`);
        if (cs.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1) out.push(`ellipsized: ${name(el)}`);
        // a box that cuts what it holds (an overflow box narrower / shorter than its content)
        if (texts.length && cs.display !== 'inline' && el.scrollWidth > el.clientWidth + 1) {
          out.push(`text wider than its box: ${name(el)} ${el.scrollWidth} > ${el.clientWidth} "${el.textContent.trim().slice(0, 40)}"`);
        }
        // every line of text, against every box that clips it and the screen
        for (const t of texts) {
          const range = document.createRange();
          range.selectNodeContents(t);
          const lines = [...range.getClientRects()].filter((r) => r.width > 0.5 && r.height > 0.5);
          for (const r of lines) {
            // (a line below the fold of a real list is scrolled, not cut — the list is allowed to scroll)
            const inList = !!el.closest('.sr-brief-list');
            if (r.left < -1 || r.right > vw + 1 || (!inList && (r.top < -1 || r.bottom > vh + 1))) {
              out.push(`off screen: ${name(el)} "${t.textContent.trim().slice(0, 30)}"`);
              break;
            }
            const f = frameOf(el);
            if (f) {
              const fr = f.getBoundingClientRect();
              const L = fr.left + f.clientLeft;
              // (and it keeps clear of the rule: a name printed edge to edge INTO the border reads as cut off)
              const pad = el.closest(MAIN) && !el.closest('.sr-say') ? 6 : -1; // the main words keep 6px off the rule; a tiny label chip may sit snug
              if (r.left < L + pad || r.right > L + f.clientWidth - pad) {
                out.push(`runs into its box's edge ${name(f)}: ${name(el)} "${t.textContent.trim().slice(0, 30)}"`);
                break;
              }
            }
            let clipped = false;
            let scrolled = false; // past a list that scrolls, a line below its fold is scrolled, not cut
            for (let a = el; a && a !== document.body; a = a.parentElement) {
              if (!clips(a)) continue;
              const ar = a.getBoundingClientRect();
              const L = ar.left + a.clientLeft;
              const T = ar.top + a.clientTop;
              const scrollsY = /(auto|scroll)/.test(getComputedStyle(a).overflowY);
              const yCut = !scrolled && !scrollsY && (r.top < T - 1 || r.bottom > T + a.clientHeight + 1);
              if (scrollsY) scrolled = true;
              if (r.left < L - 1 || r.right > L + a.clientWidth + 1 || yCut) {
                out.push(`clipped by ${name(a)}: ${name(el)} "${t.textContent.trim().slice(0, 30)}"`);
                clipped = true;
                break;
              }
            }
            if (clipped) break;
          }
        }
      }
      flat.remove();
      return [...new Set(out)];
    },
    { scope, phone }
  );
  return bad.map((b) => `${where}: ${b}`);
}

// The STUDY list scrolls (it is a list), but a card is never sliced by it: every card — tilt and hard shadow
// included — sits inside the list's sides, the first row clears its top, and no card is taller than the list
// (so any card can be read whole).
async function cardsInList(page) {
  await settle(page);
  return page.evaluate(() => {
    const out = [];
    const list = document.querySelector('.sr-brief-list');
    list.style.scrollSnapType = 'none';
    list.scrollTop = 0;
    const lr = list.getBoundingClientRect();
    const L = lr.left + list.clientLeft;
    const R = L + list.clientWidth;
    const T = lr.top + list.clientTop;
    const cards = [...list.querySelectorAll('.sr-brief-card')];
    const firstRow = Math.min(...cards.map((c) => c.offsetTop));
    const sh = 3; // the card's hard offset shadow
    for (const c of cards) {
      const r = c.getBoundingClientRect(); // the TILTED box: a tilt's corner is what got sliced
      const label = c.querySelector('.sr-brief-word')?.textContent.trim();
      if (r.left < L - 0.5 || r.right + sh > R + 0.5) out.push(`study: card ${label} sliced at the side (${Math.round(r.left)}..${Math.round(r.right + sh)} inside ${Math.round(L)}..${Math.round(R)})`);
      if (c.offsetTop === firstRow && r.top < T - 0.5) out.push(`study: card ${label} sliced at the top (${Math.round(r.top)} < ${Math.round(T)})`);
      if (c.offsetHeight + sh > list.clientHeight) out.push(`study: card ${label} is taller than the list (${c.offsetHeight} > ${list.clientHeight})`);
    }
    list.style.scrollSnapType = '';
    return out;
  });
}

async function shot(page, name, w, h) {
  if (SHOTS) await page.screenshot({ path: join(SHOTS, `${name}-${w}x${h}.png`) });
}

for (const [w, h] of SIZES) {
  const phone = w <= 520;
  test.describe(`${w}x${h}`, () => {
    // a phone is a touch device: it answers by tapping a choice (no text field)
    if (phone) test.use({ hasTouch: true, isMobile: true });

    for (const [label, row, level] of [
      ['long-meaning', LONG_GLOSS, 'MEDIUM'],
      ['long-word', LONG_WORD, 'HARD'],
      ['long-choices', LONG_CHOICES, 'MEDIUM'],
    ]) {
      test(`play + answer cards never clip the ${label} word (${row.word})`, async ({ page }) => {
        await openWith(page, w, h, seedMastered([row.word]));
        await setUp(page, /QUIZ/, level, row.category, 10);
        await expect(page.locator('.sr-gloss')).toHaveText(row.gloss);
        // every clue on the card: the meaning, then HINT prints the French example
        const hint = page.getByRole('button', { name: /^Hint/ });
        for (let i = 0; i < 3 && (await hint.isEnabled()); i++) {
          if (await page.locator('.sr-field--sentence.in').count()) break;
          await hint.click();
        }
        await expect(page.locator('.sr-field--sentence.in')).toBeVisible();
        const bad = await audit(page, 'play', '.sr-stage', { phone });
        await shot(page, `play-${label}`, w, h);

        await page.getByRole('button', { name: /^Show answer/ }).click();
        const card = page.locator('.sr-reencode');
        await expect(card).toBeVisible();
        await expect(card.locator('.sr-reencode-word')).toContainText(row.word);
        // the fullest version of the card: any folded English opened
        const en = card.locator('.sr-en-toggle');
        while (await en.count()) await en.first().click();
        bad.push(...(await audit(page, 'answer', '.sr-stage', { phone })));
        await shot(page, `answer-${label}`, w, h);
        expect(bad).toEqual([]);
      });
    }

    test('study cards never clip the longest cards', async ({ page }) => {
      await openWith(page, w, h, seedStudyDeck(LONG_STUDY.map((r) => r.word)));
      await setUp(page, /STUDY FIRST/, 'HARD', null, 5);
      await expect(page.locator('.sr-brief-card')).toHaveCount(5);
      for (const r of LONG_STUDY) await expect(page.locator('.sr-brief-list')).toContainText(r.word);
      const bad = await audit(page, 'study', '.sr-brief-page', { phone });
      bad.push(...(await cardsInList(page)));
      await shot(page, 'study', w, h);
      // with every English line open too
      const toggles = page.locator('.sr-brief-list .sr-en-toggle');
      while (await toggles.count()) await toggles.first().click();
      bad.push(...(await audit(page, 'study (English open)', '.sr-brief-page', { phone })));
      bad.push(...(await cardsInList(page)));
      await shot(page, 'study-english', w, h);
      expect(bad).toEqual([]);
    });
  });
}
