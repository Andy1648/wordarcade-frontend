import test from 'node:test';
import assert from 'node:assert/strict';
import { queueClaim, listClaims, claim, claimAll, pendingCount, subscribeClaims } from './claims.js';
import { getWins, subscribeWins } from './wins.js';
import { checkRankClaims, RANK_CLAIM_KEY } from './achievements.js';

function withStorage(seed, fn) {
  const m = new Map(Object.entries(seed));
  const prev = globalThis.localStorage;
  globalThis.localStorage = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  try { return fn(m); } finally { globalThis.localStorage = prev; }
}

test('a queued claim does not move the balance; claiming does, through the labelled ledger', () => {
  withStorage({ 'taw.wins': '10' }, () => {
    const seen = [];
    const off = subscribeWins((e) => seen.push(e));
    assert.ok(queueClaim({ id: 'ach-x', kind: 'achievement', label: 'ACHIEVEMENT — X', amount: 500 }));
    assert.equal(getWins(), 10);
    assert.equal(pendingCount(), 1);
    const c = claim('ach-x');
    assert.equal(c.amount, 500);
    assert.equal(getWins(), 510);
    assert.equal(pendingCount(), 0);
    assert.ok(seen.some((e) => e.kind === 'bonus' && e.label === 'ACHIEVEMENT — X' && e.amount === 500));
    off();
  });
});

test('claims are idempotent by id and claimAll pays the sum once', () => {
  withStorage({}, () => {
    queueClaim({ id: 'a', kind: 'achievement', amount: 100 });
    assert.equal(queueClaim({ id: 'a', kind: 'achievement', amount: 100 }), null);
    queueClaim({ id: 'b', kind: 'welcome', amount: 50 });
    queueClaim({ id: 'c', kind: 'mark', amount: 0 }); // unlock-only claim
    const notes = [];
    const off = subscribeClaims((l) => notes.push(l.length));
    assert.deepEqual(claimAll(), { count: 3, wins: 150 });
    assert.equal(getWins(), 150);
    assert.deepEqual(listClaims(), []);
    assert.deepEqual(claimAll(), { count: 0, wins: 0 });
    assert.equal(getWins(), 150);
    assert.ok(notes.length >= 1);
    off();
  });
});

test('rank-up claims: none on first sight of an existing save, one per new band after', () => {
  withStorage({ 'taw.xp': JSON.stringify({ lv: 35, into: 0 }), 'taw.rebirths': '0' }, (m) => {
    assert.deepEqual(checkRankClaims(), [], 'existing save: record, no back-pay flood');
    assert.ok(m.get(RANK_CLAIM_KEY));
    m.set('taw.xp', JSON.stringify({ lv: 60, into: 0 })); // SHARK(31) → MENACE(41) → WARLORD(56)
    const q = checkRankClaims();
    assert.deepEqual(q.map((c) => c.detail), ['MENACE', 'WARLORD']);
    assert.ok(q.every((c) => c.amount > 0));
    assert.deepEqual(checkRankClaims(), [], 'idempotent');
  });
});
