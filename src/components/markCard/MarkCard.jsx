// MarkCard — THE mark card (ROLL v1, Andy oct5 mockup claude/mockups/roll-v1/MarkCard.dc.html: "this is gold").
// One card everywhere a mark is shown big: the reel cells, the EPIC dim reveal, the LEGENDARY+ full reveal, the
// INDEX tiles and the INDEX detail sheet.
//
//   header   RARITY                    (the tier colour bar)
//   art      the COG (tier-coloured teeth; rainbow on SECRET) + the glyph (shade, highlight, extras, hard shadow);
//            a dupe shows as a small "×N" tag on the art (NIGHT oct8 #4: no ★ row — colour is for rarity only)
//   name     white, ink-stroked, BIG (sized by its length so it fits one line)
//   stat     NUMBERS FIRST — "×1.5" big, "WINS" small (markRolls.mainTag split, nothing new claimed), on a black band
//   perk     "+ LETTERS COUNT ×2" (LEGENDARY+ with a perk)
//   foot     1 IN X                    (the mark's REAL odds — markRolls.oneInX), in the tier colour
// (claude/mockups/v3/GearCard.dc.html — NIGHT oct8 #4.)
// LOCKED: the glyph as a black silhouette inside its tier-coloured cog, "???", and still the odds + the ★0 stat.
//
// The face is drawn at 180×260 and SCALED (transform) to the host's --mc-w / --mc-s (or the `w` prop), so every
// size is the same drawing. MOTION (MarkCard.css) — all finite one-shots, transform/opacity only: EPIC+ spins its
// cog once, sweeps its shine once and pulses its glow once when the card is REVEALED (`fx`) and again on hover /
// press; nothing loops at rest. Reduced motion: nothing moves.
//
// `parts` adds a screen's own class names to the header / tier / odds / name / stat nodes (the INDEX's .mx-tile-*
// hooks), so one card serves every screen's tests and styles.
import { memo } from 'react';
import MarkBadge, { CogRing, RANK_RIMS } from '../MarkBadge';
import ShinyBadge from '../rollScreen/ShinyBadge';
import { markEntry } from '../../progress/markRolls';
import { CARD_RAR, LOCKED, cardTier } from './palette.js';
import { cardModel } from './cardModel.js';
import './MarkCard.css';

const NONE = {};

function MarkCard({
  id, kind = 'roll', tier, name, locked = false, state = null, rank = 1, shiny = false, fx = false, w = null,
  parts = NONE, className = '', still = false,
}) {
  const c = cardModel({ id, kind, tier, name, locked, state });
  const pal = CARD_RAR[cardTier(c.tier)];
  const hi = c.hi && !locked;
  const style = { '--mc-line': pal.line, '--mc-fill': locked ? LOCKED.fill : pal.fill };
  if (w) {
    style['--mc-w'] = `${w}px`;
    style['--mc-s'] = w / 180;
  }
  const entry = markEntry(id) || (id ? { id, tier: c.tier } : null);
  const longKind = c.statNum.length + c.statKind.length > 10; // "+30S OVERDRIVE" must fit the band
  const nameLen = String(c.name || '').length;
  const nameFit = nameLen >= 10 ? ' is-xl' : nameLen >= 8 ? ' is-l' : '';
  return (
    <div
      className={`mc is-${c.tier}${locked ? ' is-locked' : ''}${hi ? ' is-hi' : ''}${fx ? ' is-fx' : ''}${still ? ' is-still' : ''}${c.perk ? ' has-perk' : ''}${className ? ` ${className}` : ''}`}
      style={style}
      data-tier={c.tier}
    >
      <div className="mc-face">
        <div className={`mc-head${parts.head ? ` ${parts.head}` : ''}`}>
          <span className={`mc-tier${parts.tier ? ` ${parts.tier}` : ''}`}>{c.rarityName}</span>
        </div>
        <div className="mc-art">
          {hi ? <span className="mc-glow" aria-hidden="true" /> : null}
          {/* the cog is its own HTML layer so its one-shot spin is a compositor transform, not an SVG repaint */}
          <span className="mc-cog" aria-hidden="true">
            <svg viewBox="0 0 120 120" width="100%" height="100%" style={{ overflow: 'visible' }}>
              <CogRing line={rank > 1 ? RANK_RIMS[Math.min(5, rank) - 1].fill : pal.line} rainbow={c.tier === 'secret' && rank <= 1} />
            </svg>
          </span>
          <MarkBadge mark={entry} rank={rank} size={132} silhouette={locked} permanent={kind === 'perm'} cog={false} className="mc-badge" />
          {shiny && !locked ? <ShinyBadge className="mc-shiny" /> : null}
          {c.copies > 1 && !locked ? <span className="mc-dupes" aria-label={`${c.copies} copies`}>×{c.copies}</span> : null}
        </div>
        <div className={`mc-name${nameFit}${locked ? ' is-q' : parts.name ? ` ${parts.name}` : ''}`}>{c.name}</div>
        <div className={`mc-stat${longKind ? ' is-long' : ''}${parts.stat ? ` ${parts.stat}` : ''}`}>
          <span className="mc-num">{c.statNum}</span>
          {c.statKind ? ' ' : null}
          {c.statKind ? <span className="mc-kind">{c.statKind}</span> : null}
        </div>
        {c.perk ? <div className={`mc-perk${c.perk.length > 16 ? ' is-long' : ''}`}>+ {c.perk}</div> : null}
        {c.odds ? <div className={`mc-foot${parts.odds ? ` ${parts.odds}` : ''}`}>{c.odds}</div> : null}
        {hi ? <span className="mc-shine" aria-hidden="true" /> : null}
      </div>
    </div>
  );
}

export default memo(MarkCard);
export { MarkCard };
