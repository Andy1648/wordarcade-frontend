import { need } from './src/progress/xp.js';
import { masteryWordsToReach, MASTERY_MODES, MASTERY_MAX } from './src/progress/mastery.js';
import { ACHIEVEMENTS } from './src/progress/achievements.js';
import { THEMES } from './src/theme/themes.js';
import { POP_STYLES, SOUND_PACKS } from './src/progress/shop.js';
import { COLLECTION_MILESTONES, COLLECTION_VERSION } from './src/progress/collection.js';
import { writeFileSync } from 'fs';

let cum = 0;
for (let n = 1; n < 100; n++) cum += need(n);
console.error('Cumulative XP to LV100:', cum);

const masteryWords = masteryWordsToReach(MASTERY_MAX);
console.error('Mastery words to M20 (per mode):', masteryWords);
const mastery = {};
for (const m of MASTERY_MODES) mastery[m] = masteryWords;

const achievements = ACHIEVEMENTS.map((a) => a.id);
const themesOwned = THEMES.map((t) => t.id);
const owned = [...POP_STYLES.map((i) => i.id), ...SOUND_PACKS.map((i) => i.id)];
const equipped = { popStyle: 'prism', soundPack: 'silent' };

const w = {};
const today = Math.floor(Date.now() / 86400000);
for (let i = 0; i < 5000; i++) w['word' + i] = [3, 0, today, i + 1];
const collection = { v: COLLECTION_VERSION, seq: 5000, w, ms: COLLECTION_MILESTONES.map((m) => m.n) };

const save = {
  'taw.xp': JSON.stringify({ lv: 100, into: 0 }),
  'taw.wins': '999999999999',
  'taw.winsLifetime': '999999999999',
  'taw.rebirths': '5',
  'taw.keytier': '8',
  'taw.wordsense': '5',
  'taw.momentum': '200',
  'taw.themesOwned': JSON.stringify(themesOwned),
  'taw.theme': 'prism',
  'taw.owned': JSON.stringify(owned),
  'taw.equipped': JSON.stringify(equipped),
  'taw.achievements': JSON.stringify(achievements),
  'taw.mastery': JSON.stringify(mastery),
  'taw.collection': JSON.stringify(collection),
  'taw.streak': JSON.stringify({ count: 365, lastDay: today, freezes: 52 }),
  'taw.rounds': JSON.stringify({ wordBomb: 5000, blitz: 5000, satRush: 5000 }),
  'taw.seenWinsHint': '1',
  'wa_has_played': '1',
  'wa_last_seen': String(Date.now()),
  'wa_intro_seen': '1',
};
writeFileSync('save.json', JSON.stringify(save));
console.error('themesOwned:', themesOwned);
console.error('owned cosmetics:', owned);
console.error('achievements count:', achievements.length);
console.error('WROTE save.json size', JSON.stringify(save).length);
