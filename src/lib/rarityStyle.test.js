// rarityStyle.test.js — the RARITY IDENTITY tokens (Andy oct5): every tier has a look, the look escalates with
// rarity, the CSS finish classes say the same colours as the table, and the app-wide ramps are monotonic.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  RARITY, RARITY_ORDER, RAINBOW_STOPS, FX_FROM, rarityKey, rarityRank, rarityOf, rarityClass, rarityFx, clampPips,
  KEY_RAMP, REBIRTH_RAMP, LEVEL_RAMP, rampRarity, keyRarity, rebirthRarity, levelRarity,
} from './rarityStyle.js';
import { ROLL_TIER_ORDER } from '../progress/markRollsCore.js';
import { MARK_TIERS } from '../progress/marks.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const HEX = /^#[0-9a-f]{6}$/i;

test('six tiers in order (COMMON + the five gear tiers), each with a full look', () => {
  // GEAR POOL v2: gears start at RARE; COMMON stays here as the LEVEL / KEY / REBIRTH ramp's first step (LV 1, T0)
  assert.deepEqual(RARITY_ORDER, ['common', ...ROLL_TIER_ORDER.filter((t) => t !== 'permanent')]);
  for (const t of RARITY_ORDER) {
    const s = RARITY[t];
    for (const k of ['fill', 'hi', 'line', 'ink', 'text', 'glowColour']) assert.match(s[k], HEX, `${t}.${k}`);
    assert.equal(typeof s.glow, 'number');
  }
});

test("Andy's colours: COMMON grey, RARE blue, EPIC purple, LEGENDARY gold, MYTHIC red-pink, SECRET rainbow", () => {
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [cr, cg, cb] = rgb(RARITY.common.fill);
  assert.ok(Math.max(cr, cg, cb) - Math.min(cr, cg, cb) < 32, 'common is a grey');
  const [, , rb] = rgb(RARITY.rare.fill);
  assert.ok(rb > rgb(RARITY.rare.fill)[0] && rb > rgb(RARITY.rare.fill)[1], 'rare is blue');
  assert.equal(RARITY.epic.fill, '#9A1AFF'); // the house purple
  const [lr, lg, lb] = rgb(RARITY.legendary.fill);
  assert.ok(lr > 200 && lg > 180 && lb < 120, 'legendary is gold');
  const [mr, mg] = rgb(RARITY.mythic.fill);
  assert.ok(mr > 230 && mg < 100, 'mythic is red-pink');
  assert.equal(RARITY.secret.rainbow, true);
  assert.ok(RAINBOW_STOPS.includes(RARITY.secret.fill.toUpperCase()), 'secret fill is a rainbow stop');
  assert.ok(RAINBOW_STOPS.length >= 5);
  // #FF2EC4 is RESERVED for the beat flash (CLAUDE.md)
  for (const t of RARITY_ORDER) for (const v of Object.values(RARITY[t])) assert.notEqual(String(v).toUpperCase(), '#FF2EC4');
});

test('the look escalates: COMMON / RARE fill only; glow + shimmer from EPIC, particles from LEGENDARY', () => {
  assert.deepEqual(FX_FROM, { glow: 2, shimmer: 2, particles: 3 });
  for (let i = FX_FROM.glow + 1; i < RARITY_ORDER.length; i += 1) {
    assert.ok(RARITY[RARITY_ORDER[i]].glow > RARITY[RARITY_ORDER[i - 1]].glow, `${RARITY_ORDER[i]} glows more`);
  }
  for (const t of RARITY_ORDER) {
    const r = rarityRank(t);
    assert.equal(RARITY[t].glow > 0, r >= 2, `${t} glow`);
    assert.equal(RARITY[t].shimmer, r >= 2, `${t} shimmer`);
    assert.equal(RARITY[t].particles, r >= 3, `${t} particles`);
    assert.equal(RARITY[t].rainbow, t === 'secret', `${t} rainbow`);
  }
});

test('rarityKey: PERMANENT reads as LEGENDARY, unknown as COMMON', () => {
  assert.equal(rarityKey('permanent'), 'legendary');
  assert.equal(rarityKey('mythic'), 'mythic');
  assert.equal(rarityKey(undefined), 'common');
  assert.equal(rarityKey('toString'), 'common');
  assert.equal(rarityOf('permanent'), RARITY.legendary);
  assert.equal(rarityRank('secret'), 5);
});

test('rarityClass + rarityFx: tier + tint; no GOLD / RAINBOW finish any more (dupes are pips)', () => {
  assert.equal(rarityClass('epic'), 'rarity-fin is-epic');
  assert.equal(rarityClass('permanent', { tint: true }), 'rarity-fin is-legendary is-tint');
  assert.equal(rarityClass('rare', { finish: 'gold' }), 'rarity-fin is-rare', 'an old finish option is ignored');
  assert.equal(rarityClass('common', { finish: 'rainbow', tint: true }), 'rarity-fin is-common is-tint');
  const none = { glow: false, shimmer: false, particles: false, rainbow: false };
  assert.deepEqual(rarityFx('common'), none);
  assert.deepEqual(rarityFx('rare'), none);
  assert.deepEqual(rarityFx('epic'), { glow: true, shimmer: true, particles: false, rainbow: false });
  assert.deepEqual(rarityFx('legendary'), { glow: true, shimmer: true, particles: true, rainbow: false });
  assert.deepEqual(rarityFx('secret'), { glow: true, shimmer: true, particles: true, rainbow: true });
});

test('clampPips: whole pips in 0..max', () => {
  assert.deepEqual(clampPips(3), { on: 3, max: 5 });
  assert.deepEqual(clampPips(9), { on: 5, max: 5 });
  assert.deepEqual(clampPips(-2), { on: 0, max: 5 });
  assert.deepEqual(clampPips('2.7', 3), { on: 2, max: 3 });
  assert.deepEqual(clampPips(undefined, 0), { on: 0, max: 5 });
});

test('no GOLD / RAINBOW finish classes or assets remain in the rarity layer; pips are assets', () => {
  const css = readFileSync(join(ROOT, 'src', 'components', 'rarity', 'RarityFin.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!/\.is-gold\b|\.is-rainbow\b|rarity-glint|--rar-fin/.test(css));
  assert.ok(!existsSync(join(ROOT, 'public', 'art', 'rarity', 'glint-gold.svg')));
  for (const f of ['pip-on.svg', 'pip-off.svg']) assert.ok(existsSync(join(ROOT, 'public', 'art', 'rarity', f)), f);
  const pips = readFileSync(join(ROOT, 'src', 'components', 'rarity', 'MarkPips.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!/\binfinite\b/i.test(pips) && !/will-change/i.test(pips));
});

test('MARK_TIERS accents ARE the rarity identity (one source of truth)', () => {
  for (const t of RARITY_ORDER) if (t !== 'common') assert.equal(MARK_TIERS[t].colour, RARITY[t].text, t);
  assert.equal(MARK_TIERS.common, undefined, 'no COMMON gear tier (GEAR POOL v2)');
});

test('RarityFin.css: every tier class carries the table colours, nothing loops, will-change never appears', () => {
  const css = readFileSync(join(ROOT, 'src', 'components', 'rarity', 'RarityFin.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const t of RARITY_ORDER) {
    const m = css.match(new RegExp(`:is\\(\\.rarity-fin, \\.rarity-ink, \\.rarity-edge\\)\\.is-${t}\\s*\\{([^}]*)\\}`));
    assert.ok(m, `the .is-${t} tier vars exist`);
    const v = (name) => (m[1].match(new RegExp(`--${name}:\\s*([^;]+);`)) || [])[1];
    assert.equal(v('rar').toUpperCase(), RARITY[t].fill.toUpperCase(), `${t} --rar`);
    assert.equal(v('rar-line').toUpperCase(), RARITY[t].line.toUpperCase(), `${t} --rar-line`);
    assert.equal(v('rar-text').toUpperCase(), RARITY[t].text.toUpperCase(), `${t} --rar-text`);
    assert.equal(v('rar-g'), `${RARITY[t].glow}px`, `${t} --rar-g`);
  }
  assert.ok(!/\binfinite\b/i.test(css), 'shimmer / rainbow are finite one-shots');
  assert.ok(!/will-change/i.test(css));
  // animated properties: transform + opacity only
  for (const kf of css.match(/@keyframes[^{]+\{([\s\S]*?\}\s*)\}/g) || []) {
    const props = [...kf.matchAll(/([a-z-]+)\s*:/g)].map((x) => x[1]);
    for (const p of props) assert.ok(p === 'transform' || p === 'opacity', `keyframes animate ${p}`);
  }
});

test('the effect art is real assets in /public/art/rarity', () => {
  for (const f of ['shimmer.svg', 'rainbow.svg', 'spark-gold.svg', 'spark-mythic.svg', 'spark-secret.svg']) {
    assert.ok(existsSync(join(ROOT, 'public', 'art', 'rarity', f)), f);
  }
});

test('app-wide ramps: monotonic, start where the ladder starts, top out at SECRET', () => {
  for (const ramp of [KEY_RAMP, REBIRTH_RAMP, LEVEL_RAMP]) {
    assert.equal(ramp.length, RARITY_ORDER.length);
    for (let i = 1; i < ramp.length; i += 1) assert.ok(ramp[i] >= ramp[i - 1]);
  }
  const climb = (fn, from, to) => {
    let prev = -1;
    for (let v = from; v <= to; v += 1) {
      const r = rarityRank(fn(v));
      assert.ok(r >= prev, `${fn.name}(${v}) never drops`);
      prev = r;
    }
    return prev;
  };
  assert.equal(keyRarity(0), 'common');
  assert.equal(climb(keyRarity, 0, 40), 5);
  assert.equal(rebirthRarity(0), null, 'R0 has no rebirth tier');
  assert.equal(rebirthRarity(1), 'rare');
  assert.equal(rebirthRarity(20), 'secret');
  assert.equal(climb(rebirthRarity, 1, 60), 5);
  assert.equal(levelRarity(1), 'common');
  assert.equal(levelRarity(0), 'common');
  assert.equal(climb(levelRarity, 1, 500), 5);
  assert.equal(rampRarity(NaN, KEY_RAMP), null);
  assert.equal(rampRarity(5, []), null);
});
