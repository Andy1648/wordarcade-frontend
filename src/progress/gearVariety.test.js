// gearVariety.test.js — GEAR VARIETY (Andy oct18 "why do so many cards have the same stats? (leviathan and eclipse, the
// unlisted ones....)"): every gear carries its OWN substat lines, balanced by a per-tier budget, and no two cards in the
// INDEX read the same. THE UNLISTED (found, never rolled) are LEGENDARY-sized — never ×3 on wins AND XP.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ROLL_MARKS, PERMANENT_MARKS, SUBSTAT_REF, SUBSTAT_BUDGET, SUBSTAT_LINES, substatsOf, substatText, mainTag, statOf,
  statBaseValue, critStatsOf, markWinsMult, markXpMult, markBaseWins, markBaseXp, markOverdriveSec, mainMultOf, parseSubs,
} from './markRollsCore.js';
import { UNLISTED_IDS } from '../unlisted/unlistedIds.js';

const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} ≠ ${b}`);
// every gear the INDEX can show, with the tier its budget is measured on (EARNED + UNLISTED are LEGENDARY-sized)
const ALL = [
  ...ROLL_MARKS.map((m) => ({ id: m.id, tier: m.tier, main: m.stat.kind })),
  ...PERMANENT_MARKS.map((m) => ({ id: m.id, tier: 'legendary', main: null })),
  ...UNLISTED_IDS.map((id) => ({ id, tier: 'legendary', main: statOf(id, null).kind })),
];
const lines = (id) => substatsOf(id, null).map(substatText);

test('parseSubs reads the compact codes', () => {
  assert.deepEqual(parseSubs('C9 P1.5 W10 L15 G2.5 X.5 O60').map((x) => [x.kind, x.value]), [
    ['critRatePct', 9], ['critPower', 1.5], ['baseWins', 10], ['luckPct', 15], ['gemsPct', 2.5], ['baseXp', 0.5], ['overdriveSec', 60],
  ]);
  assert.deepEqual(parseSubs(''), []);
  assert.deepEqual(parseSubs(undefined), []);
});

test('every gear has its own substats: 2–4 known lines, inside its tier budget (±10%), never repeating its MAIN', () => {
  for (const g of ALL) {
    const subs = substatsOf(g.id, null);
    assert.ok(subs.length >= 2 && subs.length <= SUBSTAT_LINES, `${g.id}: ${subs.length} lines`);
    let spent = 0;
    for (const x of subs) {
      assert.ok(SUBSTAT_REF[x.kind], `${g.id}: unknown substat ${x.kind}`);
      assert.ok(Number.isFinite(x.value) && x.value > 0, `${g.id}: ${x.kind} = ${x.value}`);
      assert.notEqual(x.kind, g.main, `${g.id}: a substat repeats its MAIN (${x.kind})`);
      spent += x.value / SUBSTAT_REF[x.kind][g.tier];
    }
    const budget = SUBSTAT_BUDGET[g.tier];
    assert.ok(Math.abs(spent - budget) <= budget * 0.1, `${g.id}: spends ${spent} of a ${g.tier} budget ${budget}`);
    const kinds = subs.map((x) => x.kind);
    assert.equal(new Set(kinds).size, kinds.length, `${g.id}: a kind twice`);
  }
});

test('no two cards read the same: no shared substat block, no shared card, at most two shared lines', () => {
  const blocks = ALL.map((g) => [...lines(g.id)].sort().join(' | '));
  assert.equal(new Set(blocks).size, blocks.length, `identical substat blocks: ${blocks.filter((b, i) => blocks.indexOf(b) !== i)}`);
  const cards = ALL.map((g) => `${mainTag(g.id, null)} || ${blocks[ALL.indexOf(g)]}`);
  assert.equal(new Set(cards).size, cards.length);
  // the ask itself: LEVIATHAN and ECLIPSE (and every LEGENDARY) used to print the same four lines
  const leg = ROLL_MARKS.filter((m) => m.tier === 'legendary').map((m) => lines(m.id).join(' | '));
  assert.equal(new Set(leg).size, leg.length, 'every LEGENDARY prints its own substats');
  assert.notDeepEqual(lines('mk-leviathan'), lines('mk-eclipse'));
  for (let i = 0; i < ALL.length; i += 1) {
    for (let j = i + 1; j < ALL.length; j += 1) {
      const a = lines(ALL[i].id);
      const shared = lines(ALL[j].id).filter((l) => a.includes(l)).length;
      assert.ok(shared <= 2, `${ALL[i].id} + ${ALL[j].id} share ${shared} lines`);
    }
  }
  // no UNLISTED main twins a rolled gear's (kind AND value), and the six are six different stats
  const rolled = new Set(ROLL_MARKS.map((m) => `${m.stat.kind}:${m.stat.value}`));
  const ul = UNLISTED_IDS.map((id) => statOf(id, null));
  for (const [i, s] of ul.entries()) assert.ok(!rolled.has(`${s.kind}:${s.value}`), `${UNLISTED_IDS[i]} twins a rolled MAIN`);
  assert.equal(new Set(ul.map((s) => s.kind)).size, ul.length);
});

test('THE UNLISTED pay ONE LEGENDARY-sized main — never ×3 on wins AND XP (Andy oct18 "essentially better legendaries")', () => {
  for (const id of UNLISTED_IDS) {
    const st = statOf(id, null);
    near(st.value, statBaseValue(st.kind, 'legendary'), `${id} main = the LEGENDARY value`);
    const opts = { markId: id, state: null };
    const w = markWinsMult(opts);
    const x = markXpMult(opts);
    assert.ok(!(w > 1 && x > 1), `${id} pays both WINS ×${w} and XP ×${x}`);
    near(x, 1, `${id} never pays XP`); // none of the six is an XP main; a one-mode WINS main pays only in its mode
    if (!st.kind.endsWith('WinsPct')) near(w, 1, `${id} never pays WINS`);
    if (st.kind === 'baseWins') near(markBaseWins(opts) - substatsOf(id, null).filter((s) => s.kind === 'baseWins').reduce((a, s) => a + s.value, 0), st.value, id);
    if (st.kind === 'baseXp') near(markBaseXp(opts), st.value, id);
    if (st.kind === 'overdriveSec') near(markOverdriveSec(opts), st.value, id);
    assert.ok(mainTag(id, null) && !/WINS \+ XP/.test(mainTag(id, null)), `${id} prints its one stat: ${mainTag(id, null)}`);
    // its crit + substats spend a LEGENDARY budget (above), so it is never stronger than a rolled LEGENDARY
    assert.ok(mainMultOf(id, null) <= mainMultOf('mk-eclipse', null), `${id} ranks at most a LEGENDARY`);
    assert.ok(mainMultOf(id, null) < mainMultOf('mk-hydra', null), `${id} ranks below a MYTHIC`);
    const c = critStatsOf(id, null);
    assert.ok(c.rate <= 0.18 + 1e-9 && c.power <= 2, `${id} crit inside the LEGENDARY budget`);
  }
});
