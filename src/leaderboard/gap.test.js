import { describe, expect, it } from 'vitest';
import { gapTo } from './gap.js';

describe('gapTo', () => {
  it('names the level gap when stars and rebirths tie', () => {
    expect(gapTo({ stars: 0, rebirths: 3, level: 12 }, { stars: 0, rebirths: 3, level: 50 })).toEqual({ text: '+38 LV', fill: 12 / 50 });
  });
  it('a rebirth ahead outranks any level gap', () => {
    expect(gapTo({ rebirths: 2, level: 90 }, { rebirths: 3, level: 1 }).text).toBe('+1 R');
  });
  it('stars decide first', () => {
    expect(gapTo({ stars: 1, rebirths: 9 }, { stars: 2, rebirths: 0 }).text).toBe('+1 ★');
  });
  it('a full tie needs one more level', () => {
    expect(gapTo({ rebirths: 1, level: 5 }, { rebirths: 1, level: 5 }).text).toBe('+1 LV');
  });
  it('says nothing when the order disagrees or a row is missing', () => {
    expect(gapTo({ rebirths: 4 }, { rebirths: 3 })).toBeNull();
    expect(gapTo(null, { level: 1 })).toBeNull();
  });
  it('THIS WEEK reads the gains columns, the old weekly view words', () => {
    expect(gapTo({ week_rebirths: 0, week_levels: 3 }, { week_rebirths: 0, week_levels: 10 }, 'week', true).text).toBe('+7 LV');
    expect(gapTo({ week_words: 100 }, { week_words: 1340 }, 'week', false).text).toBe('+1,240 WORDS');
  });
});
