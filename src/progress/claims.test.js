import test from 'node:test';
import assert from 'node:assert/strict';
import { queueClaim, listClaims, claim, claimAll, pendingCount, subscribeClaims, claimPolicy, trimClaimInbox, CLAIMS_KEY, claimAmount, codeWordsPayout } from './claims.js';
import { getWins, subscribeWins, perWordWins } from './wins.js';
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
    queueClaim({ id: 'b', kind: 'rank', amount: 50 });
    const notes = [];
    const off = subscribeClaims((l) => notes.push(l.length));
    assert.deepEqual(claimAll(), { count: 2, wins: 150 });
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

test('E4: only achievements + rank-ups reach the inbox; codes/marks/systems/collection apply at once; welcome back is cut', () => {
  withStorage({}, () => {
    assert.equal(claimPolicy('achievement', 'ach-x'), 'inbox');
    assert.equal(claimPolicy('rank', 'rank-x'), 'inbox');
    for (const k of ['code', 'boost', 'mark', 'layer', 'collection']) assert.equal(claimPolicy(k, 'x'), 'instant', k);
    assert.equal(claimPolicy('welcome', 'theme-refund'), 'instant');
    assert.equal(claimPolicy('welcome', 'welcome-2026-10-02'), 'cut');
    const r = queueClaim({ id: 'code:ZZ', kind: 'code', amount: 40 });
    assert.equal(r.instant, true);
    assert.equal(getWins(), 40, 'a code pays the moment it is redeemed');
    assert.equal(queueClaim({ id: 'welcome-x', kind: 'welcome', amount: 999 }), null);
    assert.equal(getWins(), 40, 'welcome back is cut');
    assert.deepEqual(listClaims(), [], 'none of those touched the inbox');
  });
});

test('E4: trimClaimInbox applies or drops the claims of a pre-trim save, keeping achievements + rank-ups', () => {
  const old = [
    { id: 'ach-1', kind: 'achievement', amount: 10, ts: 1 },
    { id: 'code:A', kind: 'code', amount: 5, ts: 2 },
    { id: 'welcome-d', kind: 'welcome', amount: 500, ts: 3 },
    { id: 'col-100', kind: 'collection', amount: 7, ts: 4 },
    { id: 'rank-X', kind: 'rank', amount: 3, ts: 5 },
  ];
  withStorage({ [CLAIMS_KEY]: JSON.stringify(old) }, () => {
    assert.deepEqual(trimClaimInbox(), { applied: 2, dropped: 1 });
    assert.equal(getWins(), 12, 'the code + the collection milestone paid; welcome back dropped');
    assert.deepEqual(listClaims().map((c) => c.id), ['ach-1', 'rank-X']);
  });
});

test('K2: a per-level code pays its amount in WORDS at the live rate — not × level', () => {
  withStorage({ 'taw.xp': JSON.stringify({ lv: 50, into: 0 }) }, () => {
    const rate = perWordWins({ mode: 'wordBomb' });
    assert.ok(rate > 0);
    assert.equal(codeWordsPayout(30), Math.round(30 * rate));
    assert.equal(claimAmount({ amount: 30, meta: { perLevel: true } }), Math.round(30 * rate));
    assert.notEqual(claimAmount({ amount: 30, meta: { perLevel: true } }), 30 * 50);
    assert.equal(claimAmount({ amount: 30 }), 30, 'a plain wins code is unchanged');
    assert.equal(codeWordsPayout(-5), 0);
  });
});
