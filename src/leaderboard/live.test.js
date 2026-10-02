import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanTick, isLevelMilestone } from './live.js';
import { tickText } from './tickText.js';

test('the ticker renders only well-formed, clean {kind, name, number} messages', () => {
  assert.deepEqual(cleanTick({ k: 'lv', n: 'ZED', v: 50 }), { k: 'lv', n: 'ZED', v: 50 });
  assert.equal(cleanTick({ k: 'lv', n: 'ZED', v: 50.5 }), null);
  assert.equal(cleanTick({ k: 'hack', n: 'ZED', v: 1 }), null);
  assert.equal(cleanTick({ k: 'lv', n: 'fuckface', v: 1 }), null, 'names pass the board filter');
  assert.equal(cleanTick({ k: 'lv', n: '<img src=x onerror=alert(1)>', v: 1 }), null);
  assert.equal(cleanTick({ k: 'rank', n: 'ZED', v: 101 }), null);
  assert.deepEqual(cleanTick({ k: 'rank', n: '小明', v: 3 }), { k: 'rank', n: '小明', v: 3 });
  assert.equal(cleanTick(null), null);
});

test('templated text only', () => {
  assert.equal(tickText({ k: 'lv', n: 'ZED', v: 50 }), 'ZED just hit LV 50');
  assert.equal(tickText({ k: 'rank', n: 'ZED', v: 3 }), 'ZED took #3');
  assert.equal(tickText({ k: 'rb', n: 'ZED', v: 5 }), 'ZED reached REBIRTH 5');
});

test('milestone levels: 10, 25, then every 50', () => {
  assert.deepEqual([9, 10, 25, 26, 50, 75, 100, 150].map(isLevelMilestone), [false, true, true, false, true, false, true, true]);
});
