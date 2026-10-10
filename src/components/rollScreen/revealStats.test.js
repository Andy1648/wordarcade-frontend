// ONE GEAR, ONE NUMBER (Andy: "no more dumb things like that"): the tile / sheet (cardModel), the roll result line and
// the reveal's stats extension (revealStatsOf) all print a gear's MAIN stat from markRolls.mainTag → statText with
// the LIVE roll state, so a levelled (★) gear shows its levelled value everywhere; the reel cells draw from that same
// state (Reel.jsx passes `state={view}` to every cell).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROLL_MARKS, normalize, mainTag, statText, statOf } from '../../progress/markRolls.js';
import { cardModel, splitTag } from '../markCard/cardModel.js';
import { revealStatsOf } from './revealStats.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const state = (marks) => normalize({ v: 2, rolls: 40, sinceEpic: 1, sinceLegendary: 1, everEpic: true, starter: true, marks, milestones: [], done: [] });

test('a levelled gear shows the SAME main number on the card, the result line and the stats extension', () => {
  for (const tier of ['rare', 'epic', 'legendary', 'mythic']) {
    const m = ROLL_MARKS.find((x) => x.tier === tier);
    const s = state({ [m.id]: { n: 12, first: 2 } }); // enough dupes for ★ pips at every tier
    const card = cardModel({ id: m.id, tier: m.tier, name: m.name, state: s });
    const line = splitTag(mainTag(m.id, s));
    const ext = revealStatsOf({ markId: m.id, tier: m.tier, dupe: true, pips: 2, copies: 12 }, s);
    assert.equal(card.statNum, line.num, `${m.id} card vs line`);
    assert.equal(ext.num, card.statNum, `${m.id} extension vs card`);
    assert.equal(ext.kind, card.statKind, `${m.id} label`);
    // and it IS the levelled value — not the ★0 base a stateless card would print
    const base = cardModel({ id: m.id, tier: m.tier, name: m.name, state: null });
    assert.notEqual(card.statNum, base.statNum, `${m.id} levelled ≠ base`);
  }
});

test('the label comes from statText (one place to rename "BASE WINS/WORD")', () => {
  const m = ROLL_MARKS.find((x) => x.stat.kind === 'baseWins') || ROLL_MARKS[0];
  const s = state({ [m.id]: { n: 1, first: 1 } });
  const want = splitTag(statText(statOf(m.id, s)));
  assert.equal(cardModel({ id: m.id, tier: m.tier, name: m.name, state: s }).statKind, want.kind);
  assert.equal(revealStatsOf({ markId: m.id, tier: m.tier }, s).kind, want.kind);
});

test('the reel cells draw from the live roll state, and no reveal file hardcodes a stat label', () => {
  const reel = readFileSync(join(HERE, 'Reel.jsx'), 'utf8');
  assert.match(reel, /<MarkCard id=\{id\} tier=\{m\.tier\} name=\{m\.name\} state=\{view\}[^>]* still \/>/);
  for (const f of ['RevealStats.jsx', 'revealStats.js']) {
    const code = readFileSync(join(HERE, f), 'utf8').replace(/\/\/.*$/gm, '');
    assert.doesNotMatch(code, /BASE WINS|WINS\/WORD/, f);
  }
});
