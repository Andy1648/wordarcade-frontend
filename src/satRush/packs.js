// packs.js — the WORD PACKS a Rush run can be built from.
//
// A pack is data, not a fork: its word rows ({word,pos,tier,gloss,context,root,alts,costMs}, plus an
// optional `category` for packs that group words by topic) and the few labels the poster prints. The
// engine, the run builder (runSpec.js) and the screens read a pack; nothing in them names "SAT". A
// special edition (FRENCH RUSH: AP French vocab with categories like la famille) is one more entry
// here plus its words file — the same RunSpec { pack, mode, difficulty, length } drives it.
//
// Pure module: no React, no DOM, no storage — and no JSON import, so node:test can load it. The word
// rows are attached by packWords.js (bundled by Vite) under the same ids.

export const PACKS = {
  sat: {
    id: 'sat',
    title: 'SAT RUSH',
    lang: 'en',
    words: [], // filled by packWords.js
    tierMax: 5,
    // the case id's part of speech (full on wide screens, the dictionary short form on phones)
    posLabels: { adj: 'adjective', n: 'noun', v: 'verb', adv: 'adverb' },
    posShort: { adj: 'adj.', n: 'noun', v: 'verb', adv: 'adv.' },
    // topic groups a pack may offer (FRENCH RUSH: famille, maison, ...); SAT has none
    categories: [],
  },
};

export const DEFAULT_PACK = 'sat';

/** The pack for an id; an unknown id falls back to the default pack (never throws). */
export function getPack(id) {
  return PACKS[id] || PACKS[DEFAULT_PACK];
}
