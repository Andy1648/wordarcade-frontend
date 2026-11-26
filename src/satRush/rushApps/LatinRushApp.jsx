// LatinRushApp.jsx — the root for /latin-rush (LANGUAGE RUSH; see mountLanguage.jsx).
import WORDS from '../../data/latinRush/words.json';
import { mountLanguage } from './mountLanguage';

export default mountLanguage('la', WORDS);
