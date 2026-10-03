// acceptPath.test.js — BUILD-FAILING guard for the accept path's budget breaks that feat/feel-ladder
// fixed (next-passes-spec PASS 2 §2.2.5). A static read of the source — the runtime half is
// e2e/feel-ladder.spec.js.
//   1. The Word Bomb / Blitz accept (`fireAccept`) makes NO layout read.
//   2. juice `flash()` animates opacity only — never filter / box-shadow.
//   3. Per-word particles go through the ladder's capped particleCount(), not a raw combo formula.
//   4. There is no per-word full-screen flash on the accept path (it fires on TIER-UP only).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(SRC, p), 'utf8');
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/[^\n]*/g, '$1');

// The body of a `const NAME = useCallback(() => { ... }, [deps])` / `function NAME(...) { ... }`,
// found by brace matching from its opening line.
function bodyOf(src, startRe) {
  const m = startRe.exec(src);
  assert.ok(m, `could not find ${startRe}`);
  let i = src.indexOf('{', m.index + m[0].length - 1);
  let depth = 0;
  const from = i;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) return src.slice(from, i + 1);
    }
  }
  throw new Error('unbalanced');
}

const LAYOUT_READS = /getBoundingClientRect|getComputedStyle|offset(?:Width|Height|Top|Left)|client(?:Width|Height)|scroll(?:Width|Height)/;

test('fireAccept (WB + Blitz accept) makes no layout read', () => {
  const src = stripComments(read('components/GameScreen.jsx'));
  const body = bodyOf(src, /const fireAccept = useCallback\(\(\) => /);
  assert.ok(!LAYOUT_READS.test(body), `layout read on the accept path:\n${body.match(LAYOUT_READS)}`);
});

test('fireAccept: capped ladder particles, no per-word screen flash, input never animated', () => {
  const src = stripComments(read('components/GameScreen.jsx'));
  const body = bodyOf(src, /const fireAccept = useCallback\(\(\) => /);
  assert.match(body, /particleCount\(/, 'per-word particles must come from the capped ladder');
  assert.ok(!/particlePerCombo|ringPerCombo/.test(body), 'no uncapped combo scaling');
  // the WB/ladder branch: no screenFlash (that fires per TIER-UP in FeelLadder)
  const ladderBranch = body.slice(0, body.indexOf('} else {'));
  assert.ok(!/screenFlash\(/.test(ladderBranch), 'no per-word full-screen flash');
  assert.ok(!/squash\(|flash\(el/.test(body), 'the input is never animated');
});

test('juice flash() animates opacity only', () => {
  const src = stripComments(read('juice/motion.js'));
  const body = bodyOf(src, /export function flash\(el, color\) /);
  assert.ok(!/filter|boxShadow|box-shadow/.test(body), 'flash() must not animate filter / box-shadow');
  assert.match(body, /opacity/);
});

test('the per-keystroke floater reads the cached centre, not the DOM', () => {
  const src = stripComments(read('components/GameScreen.jsx'));
  const i = src.indexOf('JUICE.FLOATERS && gameType');
  assert.ok(i > 0);
  const near = src.slice(i - 200, i + 400);
  assert.ok(!/getBoundingClientRect/.test(near), 'keystroke path must not read layout');
});
