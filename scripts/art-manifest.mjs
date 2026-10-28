// art-manifest.mjs — records a content hash for every long-cached file in public/ (vercel.json
// serves them `immutable` for a year). Run after ADDING art: `node scripts/art-manifest.mjs`.
// Never re-run it to "accept" a changed file: changed art must get a NEW filename, or returning
// players keep the old picture for up to a year. src/perf/artImmutable.test.js enforces that.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const PUBLIC = join(ROOT, 'public');
export const MANIFEST = join(ROOT, 'src', 'perf', 'artHashes.json');
export const CACHED = /\.(webp|png|avif|svg|jpg|woff2|mp3)$/;

export function cachedFiles(dir = PUBLIC) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...cachedFiles(p));
    else if (CACHED.test(name)) out.push(p);
  }
  return out;
}

// SVG is text: strip CR so a Windows (autocrlf) checkout hashes the same as CI's Linux one.
export const hashOf = (p) => {
  let buf = readFileSync(p);
  if (p.endsWith('.svg')) buf = Buffer.from(buf.toString('utf8').replace(/\r/g, ''));
  return createHash('sha1').update(buf).digest('hex').slice(0, 16);
};
export const keyOf = (p) => relative(PUBLIC, p).split(sep).join('/');

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  let old = {};
  try { old = JSON.parse(readFileSync(MANIFEST, 'utf8')); } catch {}
  const next = {};
  for (const p of cachedFiles().sort()) {
    const k = keyOf(p), h = hashOf(p);
    if (old[k] && old[k] !== h) {
      console.error(`CHANGED: ${k} — give it a new filename instead (it is cached immutable for a year).`);
      process.exitCode = 1;
      next[k] = old[k];
    } else next[k] = h;
  }
  writeFileSync(MANIFEST, JSON.stringify(next, null, 1) + '\n');
  console.log(`${Object.keys(next).length} files recorded`);
}
