// wordsAcceptExt.js — the ACCEPTANCE-ONLY extension asset, pulled in as a ?raw string.
//
// This module is imported DYNAMICALLY (see words.js → loadSoloAcceptExt), and ONLY that
// path imports it, so Vite emits it as its OWN lazy chunk — separate from wordsData.js
// (recall+accept, loaded when a solo mode starts). It is fetched later still: only AFTER
// the first solo run ENDS, so the ~423KB brotli never delays the first game. Its words
// are merged into the live accept set to validate human input; generation never reads it.
//
// Regenerate src/solo/words.accept-ext.txt with: node scripts/build-accept-ext.mjs
import acceptExtRaw from './words.accept-ext.txt?raw';

export { acceptExtRaw };
