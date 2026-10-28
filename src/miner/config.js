// miner/config.js — MINER ids + the ore table (mirrors the backend's miner.js ORES).
//
// MINER (Andy oct26) replaced DAILY BLITZ as the rare-answer game: endless easy Blitz lists, one answer each,
// the rarer the answer the deeper you dig. The server judges everything; this table is display + the payout
// weight (an ore's `weight` is the per-answer rarity weight banked through the Blitz wins pipeline).

export const MINER_ID = 'miner';
export const MINER_TARGET = 500;
export const MINER_LIVES = 3;
export const MINER_MAX = 6;

export const ORES = {
  dirt: { id: 'dirt', name: 'DIRT', depth: 10, weight: 1, color: '#B07A4A', art: '/miner/ore-dirt.webp' },
  coal: { id: 'coal', name: 'COAL', depth: 25, weight: 2, color: '#9BA3B5', art: '/miner/ore-coal.webp' },
  gold: { id: 'gold', name: 'GOLD', depth: 50, weight: 4, color: '#FFD23F', art: '/miner/ore-gold.webp' },
  diamond: { id: 'diamond', name: 'DIAMOND', depth: 100, weight: 8, color: '#2EFFE0', art: '/miner/ore-diamond.webp' },
};
export const ORE_ORDER = ['dirt', 'coal', 'gold', 'diamond'];

export const MINER_REASON_COPY = {
  not_on_list: 'NOT ON THE LIST',
  safe_item: 'THAT ONE IS FINE',
  too_short: 'TYPE AN ANSWER',
  already_locked: 'ALREADY LOCKED IN',
  round_over: 'TOO LATE',
  caved_in: 'CAVED IN',
  not_a_miner: 'NOT IN THIS MINE',
};
