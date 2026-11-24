// ChineseRushApp.jsx — the root for /chinese-rush (LANGUAGE RUSH; see mountLanguage.jsx).
import WORDS from '../../data/chineseRush/words.json';
import { mountLanguage } from './mountLanguage';

export default mountLanguage('zh', WORDS);
