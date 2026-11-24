// mountLanguage.jsx — a LANGUAGE RUSH root: attach a language's words to its pack, make it the page's language
// (rushLang.js: board forms, 🔊 voice), name the tab, and render the shared French Rush screens in it.
// Each language's root file is two lines on top of this, so each word file is its own lazy chunk.
import { useEffect } from 'react';
import { PACKS } from '../packs';
import { setRushLang, RUSH_LANGS } from '../rushLang';
import FrenchRushGame from '../FrenchRushGame';

export function mountLanguage(id, words) {
  const L = RUSH_LANGS[id];
  PACKS[L.pack].words = words;
  setRushLang(id, words);
  return function LanguageRushApp() {
    useEffect(() => {
      document.title = L.docTitle;
      try {
        document.documentElement.lang = L.htmlLang;
      } catch {
        /* ignore */
      }
    }, []);
    return <FrenchRushGame lang={id} />;
  };
}
