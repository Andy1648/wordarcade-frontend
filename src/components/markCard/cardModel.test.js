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
import { cardModel, splitTag, pipNext, tilePips, pipsLabel, perkLines } from './cardModel.js';
import { CARD_RAR } from './palette.js';
import { pipPlateW } from './frameLayout.js';
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
    assert.match(c.statNum, /^(?:[+×][\d.,]+(?:s|%|×)?|EVERY [\d,]+(?:ST|ND|RD|TH))$/, `${m.id} stat number`);
    assert.ok(c.statKind.length > 0, `${m.id} stat kind`);
    assert.equal(`${c.statNum} ${c.statKind}`, mainTag(m.id, null));
    assert.equal(c.pips, 0);
    assert.equal(c.name, m.name);
    assert.ok(CARD_RAR[c.tier], `${m.id} palette`);
    if (['legendary', 'mythic', 'secret'].includes(m.tier) && m.perks.length) assert.ok(c.perk, `${m.id} perk chip`);
  }
});

test('locked is a HIDDEN design (Andy oct9): "???", the odds as the hero, NO stat value anywhere, "?" pips', () => {
  for (const m of ROLL_MARKS) {
    const c = cardModel({ id: m.id, tier: m.tier, name: m.name, locked: true, state: null });
    assert.equal(c.name, '???');
    assert.equal(c.pips, null);
    assert.equal(c.odds, `1 IN ${c.oddsNum}`);
    assert.equal(c.statNum, '', `${m.id}: no stat number`);
    assert.equal(c.statKind, '', `${m.id}: no stat kind`);
    assert.equal(c.crit, null, `${m.id}: no crit values`);
    assert.deepEqual(c.critLines, []);
    const owned = cardModel({ id: m.id, tier: m.tier, name: m.name, state: null });
    assert.equal(c.extras, owned.extras, `${m.id}: a locked card still knows HOW MANY extra stats it has`);
    assert.deepEqual(tilePips(c), [], `${m.id}: a locked tile has NO pip row (Andy oct9: the "?" pips were confusing)`);
  }
  for (const p of PERMANENT_MARKS) {
    const c = cardModel({ id: p.id, kind: 'perm', tier: 'permanent', name: p.name, locked: true });
    assert.equal(c.statNum, '');
    assert.equal(c.crit, null);
  }
});

test('the tile pip row: a dot per extra stat, ✦ per perk, ★ per dupe pip (in that order)', () => {
  const eclipse = ROLL_MARKS.find((m) => m.id === 'mk-eclipse');
  const st = { v: 2, marks: { 'mk-eclipse': { n: 999 } } };
  const c = cardModel({ id: eclipse.id, tier: eclipse.tier, name: eclipse.name, state: st });
  assert.deepEqual(tilePips(c).map((p) => p.k), ['stat', 'stat', 'perk', 'star', 'star', 'star', 'star', 'star']);
  assert.equal(pipsLabel(c), '2 EXTRA STATS · 1 PERK · ★5');
  const rare = ROLL_MARKS.find((m) => m.tier === 'rare');
  assert.deepEqual(tilePips(cardModel({ id: rare.id, tier: 'rare', name: rare.name, state: null })).map((p) => p.k), ['stat'], 'RARE (the floor): its +2% CRIT RATE');
  // the most any card carries fits the pip plate (frameLayout.pipPlateW caps at 9)
  for (const m of ROLL_MARKS) {
    const n = tilePips(cardModel({ id: m.id, tier: m.tier, name: m.name, state: { v: 2, marks: { [m.id]: { n: 9999 } } } })).length;
    assert.ok(n <= 10 && pipPlateW(n) <= 164, `${m.id}: ${n} pips`);
  }
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
  assert.deepEqual(splitTag('×1.5 WINS IN WORD BOMB'), { num: '×1.5', kind: 'WINS IN WORD BOMB' });
  assert.deepEqual(splitTag('EVERY 4TH KEY CRITS'), { num: 'EVERY 4TH', kind: 'KEY CRITS' });
  assert.equal(pipNext({ pips: 2, have: 7, need: 10 }), '7/10 → ★3');
  assert.equal(pipNext({ pips: 5, have: 0, need: 0 }), '');
});

test('the detail sheet: one PERK line per perk; a locked card\'s counts line names no value', () => {
  const origin = ROLL_MARKS.find((m) => m.tier === 'secret');
  assert.equal(perkLines(origin.id).length, origin.perks.length);
  const locked = cardModel({ id: origin.id, tier: origin.tier, name: origin.name, locked: true, state: null });
  assert.match(pipsLabel(locked, { stars: false }), /^\d+ EXTRA STATS? · \d+ PERKS?$/);
});
