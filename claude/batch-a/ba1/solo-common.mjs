// solo-common.mjs — shared loader + median-human model for the BA1 CHAIN / FUSE sims.
//
// SOURCE: the REAL engines are imported from BA1_SRC (default: the origin/main worktree at
// ../ba1-wt/src next to this checkout; falls back to this checkout's src/). Word data is loaded
// exactly as src/solo/words.js loadSoloWords() builds it (recall ∪ accept ∪ famous ∪ common).
//
// HUMAN MODEL — reused from the calibrated sims (claude/fuseThroughput.mjs:11, claude/winsmin-sim.mjs:85,
// claude/econ-oct2/frenzy-sim.mjs:62):
//   produce = 1600 + U(0,4600) + 300*len + scarcity,   scarcity = (6 - cands)*300 when < 6 candidates
// candidates = the first 30 UNUSED words the human knows for the prompt, in frequency order.
// BA1 additions (documented, small):
//   * vocab = top VOCAB of words.recall.txt (15k per the BA1 brief; 9k = the calibrated value, run as
//     a sensitivity row);
//   * DEPLETION: once the easiest remaining candidate is past rank 3000, +500 ms per doubling of its
//     rank (recall slows as the easy words for this prompt are used up);
//   * TYPOS: 4% of submissions carry a typo → rejected (NOT_IN_LIST), the input is NOT cleared
//     (useSoloGame.js:214-221) so the fix costs +900 ms, then resubmit;
//   * ARM: the clock does not start until the first typed char of word 1 (useSoloGame.js:166-178),
//     so word 1's think time is free; only its typing (300*len) runs on the clock.
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CANDIDATES = [process.env.BA1_SRC, path.resolve(HERE, '../../../../ba1-wt/src'), path.resolve(HERE, '../../../src')].filter(Boolean);
export const SRC = CANDIDATES.find((p) => existsSync(path.join(p, 'solo/fuse.js')));
export const imp = (rel) => import(pathToFileURL(path.join(SRC, rel)).href);

export function loadWords() {
  const rd = (f) => readFileSync(path.join(SRC, 'solo', f), 'utf8');
  const recall = rd('words.recall.txt').split(' ');
  const accept = new Set(recall);
  for (const w of rd('words.accept.txt').split(' ')) accept.add(w);
  for (const w of rd('words.famous.txt').split(/\s+/)) if (w) accept.add(w.toLowerCase());
  for (const w of rd('words.common.txt').split(/\s+/)) if (w) accept.add(w.toLowerCase());
  const rank = new Map();
  recall.forEach((w, i) => { if (!rank.has(w)) rank.set(w, i); });
  const raw = JSON.parse(rd('fragmentPools.json'));
  const pools = { e: raw.e.split(' '), m: raw.m.split(' '), h: raw.h.split(' '), b: raw.b.split(' ') };
  return { recall, accept, rank, pools, topCommon: recall.slice(0, 3000) };
}

export const TYPO_P = 0.04;
export const TYPO_FIX_MS = 900;

export function produceMs(rng, word, cands, rank) {
  const scarcity = cands.length < 6 ? (6 - cands.length) * 300 : 0;
  const r0 = rank.get(cands[0]) ?? 30000;
  const depletion = r0 > 3000 ? 500 * Math.log2(r0 / 3000) : 0;
  const think = 1600 + rng() * 4600 + scarcity + depletion;
  const type = 300 * word.length;
  const typo = rng() < TYPO_P ? TYPO_FIX_MS : 0;
  return { think, type, typo, total: think + type + typo };
}

export const pct = (n, d) => (d ? +((100 * n) / d).toFixed(1) : 0);
export const quant = (arr, q) => { const a = [...arr].sort((x, y) => x - y); return a.length ? a[Math.min(a.length - 1, Math.floor(q * a.length))] : null; };
export const mean = (a) => (a.length ? +(a.reduce((s, x) => s + x, 0) / a.length).toFixed(2) : 0);
