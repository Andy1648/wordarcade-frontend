// packWords.js — attaches each pack's word rows (JSON, bundled by Vite) to its packs.js entry.
// Kept apart from packs.js so the pure modules and their node:test suites never import JSON.
import SAT_WORDS from '../data/satRush/words.json';
import { PACKS, getPack } from './packs.js';

PACKS.sat.words = SAT_WORDS;

/** The pack (with its words) for an id. */
export function loadPack(id) {
  return getPack(id);
}
