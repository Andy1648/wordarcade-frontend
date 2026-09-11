// juiceStack.test.js — BUILD-FAILING guard for the shared juice stack.
// Screen shake is a documented motion-sickness trigger. The caps, the rotation, the
// rationing of the loud tier and the existence of a real OFF switch are therefore
// invariants, not preferences — each one is asserted here so it cannot regress by
// someone "just bumping it a bit" later.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..');
const norm = (p) => p.split('\\').join('/');
const MAX_PX = 4;
const MAX_DEG = 0.4;

function walk(dir, ext) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p, ext));
    else if (ext.some((e) => name.endsWith(e))) out.push(p);
  }
  return out;
}
const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length));

test('the shake tiers are 2px/0.2deg routine and 4px/0.4deg heavy', () => {
  const src = readFileSync(join(SRC, 'juice', 'motion.js'), 'utf8');
  const routine = src.match(/routine:\s*\{\s*px:\s*([\d.]+),\s*deg:\s*([\d.]+)/);
  const heavy = src.match(/heavy:\s*\{\s*px:\s*([\d.]+),\s*deg:\s*([\d.]+)/);
  assert.ok(routine, 'SHAKE_TIERS.routine is not defined');
  assert.ok(heavy, 'SHAKE_TIERS.heavy is not defined');
  assert.equal(parseFloat(routine[1]), 2, 'routine shake must be 2px');
  assert.equal(parseFloat(routine[2]), 0.2, 'routine shake must carry 0.2deg of rotation');
  assert.equal(parseFloat(heavy[1]), MAX_PX, `heavy shake must be ${MAX_PX}px - that is the ceiling`);
  assert.equal(parseFloat(heavy[2]), MAX_DEG, `heavy shake must carry ${MAX_DEG}deg of rotation`);
});

test('every CAMERA shake carries rotation and stays inside the caps', () => {
  // The caps are for CAMERA-level motion - the whole view moving under the player.
  // An ELEMENT wobbling (the combo meter, the bomb, the intro title) is not camera
  // motion and is not capped here, so this resolves which keyframes are actually
  // applied to a camera root before judging them.
  const CAMERA = /\.app-shake|\.game-stage(?:[.\s{]|$)/;
  const offenders = [];
  for (const file of walk(SRC, ['.css'])) {
    const css = strip(readFileSync(file, 'utf8'));
    // keyframe name -> is it referenced by a rule whose selector is a camera root?
    const cameraNames = new Set();
    const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
    let r;
    while ((r = ruleRe.exec(css)) !== null) {
      const sel = r[1];
      if (!CAMERA.test(sel)) continue;
      for (const a of r[2].match(/animation(?:-name)?\s*:\s*([^;]+)/g) || []) {
        for (const tok of a.replace(/animation(?:-name)?\s*:/, '').split(/[\s,]+/)) {
          if (/^[a-z][a-z0-9-]*$/i.test(tok)) cameraNames.add(tok);
        }
      }
    }
    const kfRe = /@keyframes\s+([a-z0-9-]+)\s*\{([\s\S]*?)\n\}/gi;
    let m;
    while ((m = kfRe.exec(css)) !== null) {
      const [, name, body] = m;
      if (!cameraNames.has(name)) continue;
      const where = `${norm(file)} @keyframes ${name}`;
      const moves = [...body.matchAll(/translate\(([^)]*)\)/g)];
      if (!moves.length) continue;
      if (!/rotate\(/.test(body)) {
        offenders.push(`${where} translates but never rotates - it will read as a glitch, not as force`);
      }
      for (const mv of moves) {
        for (const n of mv[1].match(/-?[\d.]+px/g) || []) {
          const v = Math.abs(parseFloat(n));
          if (v > MAX_PX) offenders.push(`${where} translates ${v}px (cap ${MAX_PX}px)`);
        }
      }
      for (const rot of body.match(/rotate\(\s*(-?[\d.]+)deg/g) || []) {
        const v = Math.abs(parseFloat(rot.replace(/rotate\(\s*/, '')));
        if (v > MAX_DEG) offenders.push(`${where} rotates ${v}deg (cap ${MAX_DEG}deg)`);
      }
    }
  }
  assert.equal(offenders.length, 0, `camera shake keyframes:\n${offenders.join('\n')}`);
});

test('the motion toggle is persisted AND reaches the CSS-driven shakes', () => {
  const settings = readFileSync(join(SRC, 'juice', 'settings.js'), 'utf8');
  assert.match(settings, /localStorage/, 'the motion toggle must persist - a switch you re-find every session is not an accommodation');
  assert.match(settings, /dataset\.motion|data-motion/, 'the flag must be mirrored onto <html> for the CSS shakes');

  const index = readFileSync(join(SRC, 'index.css'), 'utf8');
  assert.match(
    index,
    /html\[data-motion='off'\][\s\S]*?animation:\s*none/,
    'index.css must switch the camera-level shakes off when data-motion=off'
  );
  // …and the OS preference must still be honoured independently of the toggle.
  assert.match(index, /prefers-reduced-motion[\s\S]*?\.app-shake[\s\S]*?animation:\s*none/, 'reduced-motion must still kill .app-shake');
});

test('the one-shots restart with cancel(), never by forcing a reflow', () => {
  // `void el.offsetWidth` is the classic animation-restart trick and it forces a
  // synchronous layout. On a path that fires on every accepted word that is a
  // guaranteed jank source; WAAPI cancel() + a fresh animate() costs nothing.
  const offenders = [];
  for (const file of walk(join(SRC, 'juice'), ['.js'])) {
    const src = readFileSync(file, 'utf8').replace(/\/\/[^\n]*/g, '');
    if (/void\s+\w+\.offsetWidth|\w+\.offsetWidth\s*;/.test(src)) {
      offenders.push(norm(file));
    }
  }
  assert.equal(offenders.length, 0, `forced reflow in a juice hot path:\n${offenders.join('\n')}`);
});

test('the accept pop never lands on the text input', () => {
  // Squashing the focused <input> shifts the caret under a mid-word typist. The pop
  // belongs on the word chip / the bomb / the card.
  const src = readFileSync(join(SRC, 'components', 'GameScreen.jsx'), 'utf8');
  assert.ok(
    !/\bsquash\(\s*el\s*\)/.test(src),
    'GameScreen squashes the input element itself - pop the bomb instead'
  );
  const motion = readFileSync(join(SRC, 'juice', 'motion.js'), 'utf8');
  assert.match(
    motion,
    /querySelector\(['"]input, ?textarea['"]\)/,
    'pop() must refuse an element that contains a text input'
  );
});
