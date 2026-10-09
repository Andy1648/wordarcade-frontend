// cardModel.test.js — ROLL v1: EVERY mark the game can show renders as a card. Every rollable, permanent and legacy
// mark id has a glyph (MarkBadge.jsx GLYPHS or markGlyphsRolled.jsx) AND a finish body (markGlyphFinish.jsx — the
// shade / highlight), and its card model reads real numbers: the stat split numbers-first, the real "1 IN X".
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROLL_MARKS, PERMANENT_MARKS, oneInX, mainTag } from '../../progress/markRolls.js';
import { MARKS } from '../../progress/marks.js';
import { cardModel, splitTag, pipNext } from './cardModel.js';
import { CARD_RAR } from './palette.js';
import { formatNum } from '../../format.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const src = (f) => readFileSync(join(HERE, '..', f), 'utf8');
const glyphSrc = src('MarkBadge.jsx') + src('markGlyphsRolled.jsx');
const finishSrc = src('markGlyphFinish.jsx');
const ALL_IDS = [...new Set([...ROLL_MARKS.map((m) => m.id), ...PERMANENT_MARKS.map((m) => m.id), ...MARKS.map((m) => m.id)])];

test('every mark id has a glyph and a finish body (shade + highlight)', () => {
  for (const id of ALL_IDS) {
    assert.ok(glyphSrc.includes(`'${id}': (`), `${id} has no glyph`);
    // a finish body, or kit-drawn (markGlyphFinish.jsx KIT_DRAWN — the shade + glint are in the art itself)
    assert.ok(finishSrc.includes(`'${id}': [`) || finishSrc.includes(`'${id}',`), `${id} has no finish body`);
  }
});

test('every rollable mark: real odds, its stat numbers-first, ★ pips', () => {
  for (const m of ROLL_MARKS) {
    const c = cardModel({ id: m.id, tier: m.tier, name: m.name, state: null });
    assert.equal(c.odds, `1 IN ${formatNum(oneInX(m.id))}`); // the real per-mark odds, through formatNum
    assert.match(c.statNum, /^[+×][\d.,]+s?$/, `${m.id} stat number`);
    assert.ok(c.statKind.length > 0, `${m.id} stat kind`);
    assert.equal(`${c.statNum} ${c.statKind}`, mainTag(m.id, null));
    assert.equal(c.pips, 0);
    assert.equal(c.name, m.name);
    assert.ok(CARD_RAR[c.tier], `${m.id} palette`);
    if (['legendary', 'mythic', 'secret'].includes(m.tier) && m.perks.length) assert.ok(c.perk, `${m.id} perk chip`);
  }
});

test('locked: "???", no pips, still the odds + the ★0 stat', () => {
  const m = ROLL_MARKS.find((x) => x.tier === 'legendary');
  const c = cardModel({ id: m.id, tier: m.tier, name: m.name, locked: true, state: null });
  assert.equal(c.name, '???');
  assert.equal(c.pips, null);
  assert.match(c.odds, /^1 IN /);
  assert.ok(c.statNum);
});

test('earned gears (Andy oct8): drawn as LEGENDARY with the rest; locked = ACHIEVEMENT REQUIRED, owned = EARNED', () => {
  for (const p of PERMANENT_MARKS) {
    const c = cardModel({ id: p.id, kind: 'perm', tier: 'permanent', name: p.name });
    assert.equal(c.rarityName, 'LEGENDARY');
    assert.equal(c.tier, 'legendary');
    assert.equal(c.odds, 'EARNED');
    assert.equal(c.earned, true);
    assert.equal(c.statKind, 'WINS + XP');
    assert.equal(cardModel({ id: p.id, kind: 'perm', tier: 'permanent', name: p.name, locked: true }).odds, 'ACHIEVEMENT');
    assert.equal(cardModel({ id: p.id, kind: 'perm', tier: 'permanent', name: p.name, locked: true }).name, p.name);
  }
});

test('helpers: the tag split and the "7/10 → ★3" line', () => {
  assert.deepEqual(splitTag('×1.5 WINS'), { num: '×1.5', kind: 'WINS' });
  assert.deepEqual(splitTag('+2.5 BASE WINS'), { num: '+2.5', kind: 'BASE WINS' });
  assert.equal(pipNext({ pips: 2, have: 7, need: 10 }), '7/10 → ★3');
  assert.equal(pipNext({ pips: 5, have: 0, need: 0 }), '');
});
