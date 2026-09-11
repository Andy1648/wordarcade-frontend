// gen-motifs.mjs — author the PHASE 7c background motifs as real vector assets.
//
// CLAUDE.md's ART VS MOTION rule: art comes from vector assets in /public, never from
// CSS shapes. These are generated rather than hand-typed because the two that need real
// geometry - the blast's irregular spikes and the chain's interlocking links - are much
// more accurate computed than eyeballed, and a seeded generator gives the deliberate
// ASYMMETRY the house style asks for instead of a machine-perfect star.
//
// Each file is a flat single-colour silhouette on a 200x200 box. They are used as CSS
// MASKS, not images, so the mode script supplies the colour and one asset serves every
// hue. Usage: node gen-motifs.mjs
import fs from 'fs';
import path from 'path';

const OUT = path.resolve('public/art/motif');
fs.mkdirSync(OUT, { recursive: true });

const wrap = (body, title) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" role="img" aria-label="${title}">\n` +
  `  <title>${title}</title>\n${body}\n</svg>\n`;

const n = (v) => Number(v.toFixed(2));

// A small deterministic PRNG so the asymmetry is authored once and never drifts.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// ---------------------------------------------------------------- 1. BLAST (Word Bomb)
// A comic impact star. Sixteen spikes whose outer radius wanders, so it reads as drawn
// rather than plotted, with the inner radius held steady to keep the body solid.
{
  const r = rng(7);
  const SPIKES = 16;
  const pts = [];
  for (let i = 0; i < SPIKES; i++) {
    const outer = 62 + r() * 34; // 62..96
    const inner = 36 + r() * 6;
    const a0 = ((i * 2) / (SPIKES * 2)) * Math.PI * 2 - Math.PI / 2;
    const a1 = ((i * 2 + 1) / (SPIKES * 2)) * Math.PI * 2 - Math.PI / 2;
    pts.push([100 + Math.cos(a0) * outer, 100 + Math.sin(a0) * outer]);
    pts.push([100 + Math.cos(a1) * inner, 100 + Math.sin(a1) * inner]);
  }
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${n(p[0])} ${n(p[1])}`).join(' ') + ' Z';
  fs.writeFileSync(path.join(OUT, 'blast.svg'), wrap(`  <path d="${d}" fill="#000"/>`, 'Blast'));
}

// ---------------------------------------------------------------- 2. BRAIN (SAT Rush)
// Cortex profile + cerebellum + stem, then the folds cut back out as strokes so the
// silhouette still reads as a brain at 6% opacity instead of a potato.
{
  const body =
    '  <path fill="#000" d="M100 26c-16 0-27 7-31 17-13-1-24 7-26 19-10 4-16 13-15 24 1 10 8 18 17 21' +
    '-2 12 5 24 17 28 4 11 15 18 27 17 4 6 11 9 18 9V26z"/>\n' +
    '  <path fill="#000" d="M100 26c16 0 27 7 31 17 13-1 24 7 26 19 10 4 16 13 15 24-1 10-8 18-17 21' +
    '2 12-5 24-17 28-4 11-15 18-27 17-4 6-11 9-18 9V26z"/>\n' +
    // the stem, so it is a BRAIN and not a walnut
    '  <path fill="#000" d="M94 160h12c0 10 3 16 8 22H86c5-6 8-12 8-22z"/>\n' +
    // folds: cut back out of the body
    '  <g fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round">\n' +
    '    <path d="M100 34v126"/>\n' +
    '    <path d="M78 52c-12 4-16 14-10 22 6 8 2 16-8 19"/>\n' +
    '    <path d="M122 52c12 4 16 14 10 22-6 8-2 16 8 19"/>\n' +
    '    <path d="M74 104c-10 5-12 15-4 21 7 6 7 14-2 19"/>\n' +
    '    <path d="M126 104c10 5 12 15 4 21-7 6-7 14 2 19"/>\n' +
    '  </g>';
  fs.writeFileSync(path.join(OUT, 'brain.svg'), wrap(body, 'Brain'));
}

// ---------------------------------------------------------------- 3. GAVEL (Blitz)
// The judge's verdict. Head struck at an angle over its block, mid-swing, so the shape
// has direction instead of sitting flat.
{
  const body =
    '  <g transform="rotate(-24 100 92)">\n' +
    '    <rect x="52" y="58" width="96" height="44" rx="8" fill="#000"/>\n' +
    '    <rect x="44" y="50" width="18" height="60" rx="6" fill="#000"/>\n' +
    '    <rect x="138" y="50" width="18" height="60" rx="6" fill="#000"/>\n' +
    '    <rect x="92" y="100" width="16" height="74" rx="8" fill="#000"/>\n' +
    '    <rect x="82" y="166" width="36" height="20" rx="8" fill="#000"/>\n' +
    '  </g>\n' +
    '  <rect x="34" y="168" width="132" height="20" rx="8" fill="#000"/>';
  fs.writeFileSync(path.join(OUT, 'gavel.svg'), wrap(body, 'Gavel'));
}

// ---------------------------------------------------------------- 4. CHAIN (Chain)
// Three links on a diagonal, each one actually threaded through the last. Drawn as fat
// stroked rounded rects so the links have real metal weight rather than hairlines.
{
  const link = (x, y, rot) =>
    `  <rect x="${n(x - 30)}" y="${n(y - 17)}" width="60" height="34" rx="17" ` +
    `transform="rotate(${rot} ${n(x)} ${n(y)})" fill="none" stroke="#000" stroke-width="13"/>`;
  const body = [link(56, 144, -38), link(100, 100, -38), link(144, 56, -38)].join('\n');
  fs.writeFileSync(path.join(OUT, 'chain.svg'), wrap(body, 'Chain'));
}

// ---------------------------------------------------------------- 5. FUSE (Fuse)
// A cord burning back on itself, with the spark at the live end. The cord tapers by
// being drawn as two overlaid strokes, so it has some drawn weight rather than being a
// uniform pipe.
{
  const cord = 'M22 176c44 14 78-6 84-40 5-28-18-46-38-38-17 7-18 32 2 38 26 8 52-16 52-48 0-22-12-38-30-46';
  const r = rng(19);
  const spikes = [];
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2;
    const rad = 14 + r() * 16;
    spikes.push(`${i ? 'L' : 'M'}${n(92 + Math.cos(a) * rad)} ${n(42 + Math.sin(a) * rad)}`);
    const a2 = ((i + 0.5) / 11) * Math.PI * 2;
    spikes.push(`L${n(92 + Math.cos(a2) * 7)} ${n(42 + Math.sin(a2) * 7)}`);
  }
  const body =
    `  <path d="${cord}" fill="none" stroke="#000" stroke-width="15" stroke-linecap="round"/>\n` +
    `  <path d="${spikes.join(' ')} Z" fill="#000"/>`;
  fs.writeFileSync(path.join(OUT, 'fuse.svg'), wrap(body, 'Fuse cord'));
}

console.log('motifs ->', OUT);
for (const f of fs.readdirSync(OUT)) {
  console.log(' ', f, fs.statSync(path.join(OUT, f)).size + 'b');
}
