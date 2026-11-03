import test from 'node:test';
import assert from 'node:assert/strict';
import { ALL_HEROES } from './cast.js';
import { HEAD_BOX, headBox, headWindow, headImgStyle } from './faceBox.js';

test('every hero in the cast has its own measured head box', () => {
  const missing = ALL_HEROES.map((c) => c.id).filter((id) => !HEAD_BOX[id]);
  assert.deepEqual(missing, []);
});

test("every hero's whole head sits inside the frame's window (Andy nov2: never part of a face cut off)", () => {
  for (const c of ALL_HEROES) {
    const [cx, cy, hs] = headBox(c.id);
    const w = headWindow(c.id);
    const eps = 1e-9;
    assert.ok(cx - hs / 2 >= w.x - eps && cx + hs / 2 <= w.x + w.s + eps, `${c.id}: head runs off the frame sideways`);
    assert.ok(cy - hs / 2 >= w.y - eps && cy + hs / 2 <= w.y + w.s + eps, `${c.id}: head runs off the frame top/bottom`);
    assert.ok(w.x >= 0 && w.y >= 0 && w.x + w.s <= 1 + eps && w.y + w.s <= 1 + eps, `${c.id}: window leaves the art`);
  }
});

test('the frame shows MORE than the head (zoomed out), never the whole body', () => {
  for (const c of ALL_HEROES) {
    const w = headWindow(c.id);
    assert.ok(w.s > headBox(c.id)[2] && w.s < 0.8, `${c.id}: window ${w.s}`);
  }
});

test('the img style maps the window onto the frame', () => {
  assert.deepEqual(headImgStyle('riot'), { width: '153.85%', height: '153.85%', left: '-22.31%', top: '-0.77%' });
  assert.deepEqual(headBox('nobody'), [0.5, 0.36, 0.52]);
});
