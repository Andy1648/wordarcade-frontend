// FrenchRushApp.jsx — the root for /french-rush (main.jsx mounts this instead of <App/> on that
// path, lazily, so the arcade never downloads the French words). It attaches the French pack's
// words, names the tab, and leaves to the arcade home on exit. The other LANGUAGE RUSH roots
// (rushApps/) do the same for their language.
import { useEffect } from 'react';
import FR_WORDS from '../data/frenchRush/words.json';
import { PACKS } from './packs';
import { setRushLang, RUSH_LANGS } from './rushLang';
import FrenchRushGame from './FrenchRushGame';

PACKS.fr.words = FR_WORDS;
setRushLang('fr', FR_WORDS);

export default function FrenchRushApp() {
  useEffect(() => {
    document.title = RUSH_LANGS.fr.docTitle;
  }, []);
  return <FrenchRushGame lang="fr" />;
}
