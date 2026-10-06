import test from 'node:test';
import assert from 'node:assert/strict';
import { TUTORIALS, dueTutorial, dueHosted, alreadyReached, initTutorials, hasSeenTutorial, markTutorialSeen, TUT_INIT_KEY } from './registry.js';

function withStorage(seed, fn) {
  const m = new Map(Object.entries(seed));
  const prev = globalThis.localStorage;
  globalThis.localStorage = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  try { return fn(m); } finally { globalThis.localStorage = prev; }
}
const fresh = { level: 1, rebirths: 0, marksRevealed: false, rebirthReady: false, keyAffordable: false, keyTier: 0 };
const noTarget = () => false;
const anyTarget = () => true;

test('ONLY the four that matter: roll, gems, rebirth, KEY TIER (Andy oct5)', () => {
  assert.deepEqual(TUTORIALS.map((t) => t.id), ['markRolls', 'gems', 'rebirth', 'keyTier']);
  for (const cut of ['pv10', 'marks', 'frenzy', 'boost', 'weekly', 'chain', 'fuse', 'wall']) {
    assert.ok(!TUTORIALS.some((t) => t.id === cut), `${cut} is cut`);
  }
});

test('every tutorial is ONE spotlight: a target to light + one short line, no steps / buttons', () => {
  for (const t of TUTORIALS) {
    assert.equal(typeof t.target, 'string', `${t.id} has a target`);
    assert.ok(t.target.length > 0);
    assert.equal(typeof t.line, 'string', `${t.id} has a line`);
    assert.ok(t.line.length > 0 && t.line.length <= 48, `${t.id}: short line (${t.line.length})`);
    assert.equal(t.line, t.line.toUpperCase());
    assert.equal(t.steps, undefined, `${t.id}: no multi-step card`);
  }
  assert.match(TUTORIALS.find((t) => t.id === 'keyTier').line, /POWER/);
  assert.doesNotMatch(TUTORIALS.map((t) => t.line).join(" "), /KEY POWER/);
});

test('targets: ROLL on the ROLL screen, the gem count, the REBIRTH button, the SHOP KEY item', () => {
  const by = Object.fromEntries(TUTORIALS.map((t) => [t.id, t]));
  assert.match(by.markRolls.target, /\.rs-roll/);
  assert.match(by.gems.target, /\.gems-count/);
  assert.match(by.rebirth.target, /is-rebirth/);
  assert.match(by.keyTier.target, /\.shop-keypower/);
  assert.equal(by.markRolls.host, 'marks');
  assert.equal(by.keyTier.host, 'shop');
  assert.equal(by.gems.host, undefined);
  assert.equal(by.rebirth.host, undefined);
});

test('a fresh LV1 player is shown nothing; rebirth readiness shows the rebirth spotlight, once', () => {
  withStorage({}, () => {
    initTutorials(fresh);
    assert.equal(dueTutorial(fresh, hasSeenTutorial, anyTarget), null);
    const ready = { ...fresh, level: 15, rebirthReady: true };
    assert.equal(dueTutorial(ready, hasSeenTutorial, anyTarget).id, 'rebirth');
    markTutorialSeen('rebirth');
    assert.equal(dueTutorial(ready, hasSeenTutorial, anyTarget), null, 'shown once');
    assert.equal(dueTutorial({ ...ready, rebirths: 1 }, () => false, anyTarget), null, 'only before the first rebirth');
  });
});

test('gems: due once marks are out, but a NO-OP until the gem count is on screen', () => {
  const s = { ...fresh, level: 12, marksRevealed: true };
  withStorage({}, () => {
    initTutorials(s);
    assert.equal(dueTutorial(s, hasSeenTutorial, noTarget), null, 'no target → no tutorial');
    let asked = null;
    const t = dueTutorial(s, hasSeenTutorial, (sel) => { asked = sel; return true; });
    assert.equal(t.id, 'gems');
    assert.equal(asked, t.target);
    markTutorialSeen('gems');
    assert.equal(dueTutorial(s, hasSeenTutorial, anyTarget), null);
  });
});

test('the menu never picks a hosted one; each panel gets its own', () => {
  const s = { ...fresh, level: 12, marksRevealed: true, keyAffordable: true };
  withStorage({ 'taw.rollsOn': '1' }, () => {
    initTutorials(s);
    const menu = dueTutorial(s, hasSeenTutorial, noTarget);
    assert.equal(menu, null, 'markRolls / keyTier are not the menu’s');
    assert.equal((dueHosted('shop', s, hasSeenTutorial) || {}).id, 'keyTier');
    markTutorialSeen('keyTier');
    assert.equal(dueHosted('shop', s, hasSeenTutorial), null, 'once');
    assert.equal(dueHosted('nowhere', s, hasSeenTutorial), null);
  });
});

test('KEY TIER: only the FIRST affordable tier (T0, no rebirth yet)', () => {
  const never = () => false;
  assert.equal(dueHosted('shop', { ...fresh, keyAffordable: false }, never), null, 'not affordable');
  assert.equal(dueHosted('shop', { ...fresh, keyAffordable: true }, never).id, 'keyTier');
  assert.equal(dueHosted('shop', { ...fresh, keyAffordable: true, keyTier: 1 }, never), null, 'already bought one');
  assert.equal(dueHosted('shop', { ...fresh, keyAffordable: true, rebirths: 2 }, never), null, 'a rebirthed player knows KEY');
});

test('an EXISTING player is not walked through what they already reached; the new ones still show', () => {
  const vet = { ...fresh, level: 300, rebirths: 0, marksRevealed: true, rebirthReady: true, keyAffordable: true };
  withStorage({}, () => {
    const marked = initTutorials(vet);
    assert.deepEqual(marked, ['rebirth']);
    assert.equal(localStorage.getItem(TUT_INIT_KEY), '1');
    assert.deepEqual(initTutorials(vet), [], 'init runs once');
    assert.equal(hasSeenTutorial('gems'), false, 'gems are new to everyone');
    assert.equal(hasSeenTutorial('keyTier'), false);
    assert.equal(hasSeenTutorial('markRolls'), false);
  });
  for (const id of ['gems', 'keyTier', 'markRolls']) assert.ok(!alreadyReached(vet).includes(id));
});

test('a throwing when() never shows a tutorial; blocked storage never nags', () => {
  assert.equal(dueTutorial(null, () => false, anyTarget), null);
  const prev = globalThis.localStorage;
  globalThis.localStorage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  try {
    assert.equal(hasSeenTutorial('rebirth'), true);
    assert.equal(dueTutorial({ ...fresh, rebirthReady: true }, hasSeenTutorial, anyTarget), null);
    assert.deepEqual(initTutorials(fresh), []);
  } finally {
    globalThis.localStorage = prev;
  }
});
