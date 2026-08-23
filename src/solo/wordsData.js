// wordsData.js — the raw solo word assets, pulled in as ?raw strings.
//
// This module is imported DYNAMICALLY (see words.js → loadSoloWords), so Vite emits
// it as its own chunk. The ~357KB gzip of recall+accept therefore rides a lazy chunk
// that only downloads when a solo mode starts — it never touches the menu's first
// paint, and it's shared between CHAIN and FUSE.
import recallRaw from './words.recall.txt?raw';
import acceptExtraRaw from './words.accept.txt?raw';

export { recallRaw, acceptExtraRaw };
