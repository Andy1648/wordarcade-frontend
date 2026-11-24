// SpanishRushApp.jsx — the root for /spanish-rush (LANGUAGE RUSH; see mountLanguage.jsx).
import WORDS from '../../data/spanishRush/words.json';
import { mountLanguage } from './mountLanguage';

export default mountLanguage('es', WORDS);
