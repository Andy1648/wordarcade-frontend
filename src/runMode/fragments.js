// fragments.js — the FUSE round's fragment POOL + the per-round fragment STREAM (fix/run-round-modes).
//
// The old draw reseeded mulberry32 from `p.words × <constant>`, so after the first word EVERY run
// saw the same fragment sequence (word 2 was always the same fragment, word 3 the same, …). Now a
// round owns ONE stream, seeded from the round seed XOR a salt — the salt keeps it disjoint from the
// lucky oracle, which is seeded from the bare round seed — and every fragment (the opening one and
// each re-roll after an accepted word) is drawn from that stream. Different runs → different
// sequences; the same seed reproduces (the `?seed=` dev override stays deterministic).
import { mulberry32 } from '../progress/luck.js';

export const FRAGMENT_SALT = 0x5f3759df;

// The 40 most common 2–3 letter fragments in src/solo/words.recall.txt (by containing-word count;
// every entry ≥ 1,115 containing words in the full list, ≥ 2.7% of the top-3,000 vocabulary —
// fragments.test.js re-derives the ≥200 floor from the shipped list so the pool can't rot).
// Widened from 13 (fix/run-round-modes): the old pool's floor was 'ck' (715 words, 1.3% of the
// top-3,000) and 'ent' (560), and with the identical-every-run sequence those hard deals recurred
// at fixed positions. Mean coverage of this pool in the top-3,000 (5.4%) equals a CHAIN start-letter
// constraint's (5.4%), so a FUSE round is now as solvable as a CHAIN round on the vocabulary data.
export const FRAGMENTS = [
  'in', 'er', 'es', 'ed', 're', 'ng', 'te', 'ing', 'le', 'ar', 'an', 'en', 'st', 'on', 'al', 'ra', 'ti', 'or', 'at', 'ri',
  'de', 'li', 'se', 'ne', 'ro', 'la', 'nt', 'is', 'rs', 'co', 'ea', 'ic', 'it', 've', 'el', 'ta', 'ma', 'he', 'as', 'me',
];

export function makeFragmentStream(roundSeed) {
  const rnd = mulberry32(((roundSeed >>> 0) ^ FRAGMENT_SALT) >>> 0);
  return { next: () => FRAGMENTS[Math.floor(rnd() * FRAGMENTS.length)] };
}

// The first `n` fragments a round with this seed will deal — for tests / tooling.
export function fragmentSequence(roundSeed, n) {
  const s = makeFragmentStream(roundSeed);
  return Array.from({ length: n }, () => s.next());
}
