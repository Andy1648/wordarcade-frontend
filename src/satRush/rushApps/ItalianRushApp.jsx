// ItalianRushApp.jsx — the root for /italian-rush (LANGUAGE RUSH; see mountLanguage.jsx).
import WORDS from '../../data/italianRush/words.json';
import { mountLanguage } from './mountLanguage';

export default mountLanguage('it', WORDS);
