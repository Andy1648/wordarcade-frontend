// badgeFrames.test.js — the sticker-badge avatar frames: every painted part exists, props stay round the badge, and every
// act is a short finite one-shot of transform / opacity only (CLAUDE.md: nothing loops, compositor-only motion).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { BADGE_FRAMES, BADGE_ACTS, IDLE_GAP_MS, IDLE_REST_MS, badgeFrameOf } from './badgeFrames.js';
import { AVATAR_WIN } from './avatarFrame.js';

const art = (src) => fs.existsSync(new URL(`../../public${src}`, import.meta.url));

test('every badge frame is a real frame id with its painted badge and props', () => {
  for (const [id, b] of Object.entries(BADGE_FRAMES)) {
    assert.ok(AVATAR_WIN[id], `${id} is not a frame`);
    assert.ok(art(b.badge), `${id} badge art`);
    assert.ok(b.props.length >= 2, `${id} moves with at least two props`);
    for (const p of b.props) {
      assert.ok(art(p.src), `${id} prop ${p.src}`);
      assert.ok(BADGE_ACTS[p.act], `${id} act ${p.act}`);
      assert.ok(p.x >= 0 && p.x <= 100 && p.y >= 0 && p.y <= 100 && p.w > 0 && p.w <= 40, `${id} prop box`);
    }
  }
  assert.equal(badgeFrameOf('../x'), null);
});

test('every act is short, finite and transform / opacity only; idle bursts rest longer than the scheduler tick', () => {
  for (const [name, a] of Object.entries(BADGE_ACTS)) {
    assert.ok(a.ms > 0 && a.ms <= 700, `${name} ${a.ms}`);
    for (const f of a.frames) for (const k of Object.keys(f)) assert.ok(['transform', 'opacity', 'offset'].includes(k), `${name} animates ${k}`);
  }
  assert.ok(IDLE_REST_MS > IDLE_GAP_MS);
});
