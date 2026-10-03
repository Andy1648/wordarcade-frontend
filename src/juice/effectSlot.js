// effectSlot.js — ONE LIGHT EFFECT PER WORD (next-passes-spec PASS 2 §2.3).
//
// Before this, one FUSE accept could fire RarityFlash, the LUCKY ring, ClutchBurst and a tier pop
// in the same frame. Now every accepted word gets exactly ONE light slot, by priority:
//
//     CLUTCH  >  LUCKY  >  RARE  >  TIER-UP  >  HYPE
//
// The winner plays its full effect. Every LOSER degrades to a small tag line under the word
// (>= 13px, --fs-label) instead of vanishing — so a lucky ×5 that happened on a clutch word is
// still SAID, never a silent number change (H5). HYPE is the default and never becomes a tag (it is
// the "nothing special" reaction; when something special happened, it simply does not show).
//
// Pure: no DOM, no React. The callers decide what "this word was lucky / rare / clutch" means for
// their mode and pass booleans in.

export const SLOT_PRIORITY = Object.freeze(['clutch', 'lucky', 'rare', 'tier', 'hype']);

/**
 * @param {{clutch?: boolean, lucky?: boolean, rare?: boolean, tierUp?: number|boolean}} flags
 * @returns {{ main: 'clutch'|'lucky'|'rare'|'tier'|'hype', tags: string[] }}
 *   `main` is the one effect that plays; `tags` are the outranked effects, highest first.
 */
export function pickEffect(flags = {}) {
  const live = [];
  if (flags.clutch) live.push('clutch');
  if (flags.lucky) live.push('lucky');
  if (flags.rare) live.push('rare');
  if (flags.tierUp) live.push('tier');
  return { main: live[0] || 'hype', tags: live.slice(1) };
}

/** Is `kind` outranked by anything in `flags`? (The tier slam asks this about itself.) */
export function isOutranked(kind, flags = {}) {
  const { main } = pickEffect({ ...flags, [kindFlag(kind)]: true });
  return main !== kind;
}

function kindFlag(kind) {
  return kind === 'tier' ? 'tierUp' : kind;
}

/** Bands that take the RARE slot. UNCOMMON is the quiet rung: it stands in for the hype word. */
export const RARE_BANDS = Object.freeze(['RARE', 'OBSCURE']);

/**
 * The light-slot decision for one SOLO word (CHAIN / FUSE), made when it lands.
 * @param {{ clutch?: boolean, luckyMult?: number, rarity?: {band?: string, announce?: boolean}|null,
 *           tierUp?: number }} w
 * @returns {{ main, tags, showRarity: boolean, labels: string[] }}
 *   showRarity — play the RarityFlash (the RARE slot's effect, or an UNCOMMON stand-in when nothing
 *   else owns the word); labels — the outranked effects as tag text. The tier's own tag is drawn by
 *   the tier slam itself, so it is not repeated here.
 */
export function soloWordSlot({ clutch = false, luckyMult = 1, rarity = null, tierUp = 0 } = {}) {
  const band = rarity && rarity.band ? String(rarity.band).toUpperCase() : '';
  const rare = RARE_BANDS.includes(band);
  const lucky = Number(luckyMult) > 1;
  const slot = pickEffect({ clutch, lucky, rare, tierUp });
  const announce = !!(rarity && rarity.announce);
  return {
    ...slot,
    showRarity: announce && (slot.main === 'rare' || slot.main === 'hype'),
    labels: slot.tags.filter((k) => k !== 'tier').map((k) => tagLabel(k, { luckyMult, band })),
  };
}

/**
 * The tag text for an outranked effect. `ctx` carries the specifics: { luckyMult, band, tierLabel }.
 * Every label is short caps so it fits a 13px line under the word.
 */
export function tagLabel(kind, ctx = {}) {
  switch (kind) {
    case 'clutch':
      return 'CLUTCH';
    case 'lucky':
      return `LUCKY ×${ctx.luckyMult || 5}`;
    case 'rare':
      return String(ctx.band || 'RARE').toUpperCase();
    case 'tier':
      return String(ctx.tierLabel || 'COMBO UP').toUpperCase();
    default:
      return '';
  }
}
