// MarkCard — THE gear card (ROLL v1, Andy oct5 mockup claude/mockups/roll-v1/MarkCard.dc.html: "this is gold"; GEAR
// TILE v2, Andy oct9). One card everywhere a gear is shown big: the reel cells, the EPIC dim reveal, the LEGENDARY+
// full reveal, the INDEX tiles and the INDEX detail sheet.
//
// GEAR TILE v2 (Andy oct9: "it might be hard to cram multiple stats into one card that size… have the main stat on
// display and have the user click for more substats"; research gear-card-research.md §3 — the Genshin / HSR /
// Diablo / Clash tile: rarity + identity + ONE number; everything else behind the tap). Fewer things, bigger:
//
//   frame    CardFrame.jsx: vector art — the tier-colour frame outlined in its darker shade, the rarity plate, the
//            rosette behind the cog, the name ribbon, the hero band, the pip plate, LEGENDARY+ pins, the shadow
//   header   RARITY                    (on the rarity plate)
//   art      the COG + the glyph; a dupe shows as a small "×N" tag on the art
//   name     white, ink-stroked, BIG (sized by its length so it fits one line)
//   HERO     the MAIN STAT — the value huge in Bungee ("×1.25"), its label under it ("XP", "BASE WINS/WORD")
//   pips     a quiet row on the bottom band: a dot per extra stat (crit rate / crit power), ✦ per perk, ★ per dupe
//            pip. The crit and perk VALUES and the odds are in the detail sheet (MarksIndex), not on the tile.
// LOCKED — a HIDDEN design (Andy oct9: "including stats"): the rarity plate + frame keep their FULL tier colour, the
//   glyph is a flat black silhouette, the name is "???", the HERO slot says the ODDS ("1 IN 90"; an EARNED gear: a
//   lock + ACHIEVEMENT) and NO pip row (Andy oct9: the "?" pips confused). No stat value anywhere (cardModel holds none).
//
// The face is drawn at 180×260 and SCALED (transform) to the host's --mc-w / --mc-s (or the `w` prop), so every
// size is the same drawing. MOTION (MarkCard.css), transform/opacity only: EPIC+ spins its cog once and pulses its
// glow once when the card is REVEALED (`fx`). GEAR TURN (Andy oct11, an explicit exception to "nothing loops at
// rest"): every live card's cog turns slowly and its glyph bobs + tilts a little; hovered, the cog turns fast and the
// glyph rocks (less than the cog). Reel cells passing by (`still`) stay still. The ONLY sheen is the `sheen` slot (the wide band asset, swept by the roll reveal / the INDEX's one shared
// timer) — the old CSS shine stripe is gone (its skewed rest position leaked a thin line onto every EPIC+ card).
// Reduced motion: nothing moves.
//
// `parts` adds a screen's own class names to the header / tier / odds / name / stat nodes (the INDEX's .mx-tile-*
// hooks), so one card serves every screen's tests and styles. `odds` lands on the locked hero (the only odds a tile
// prints).
import { memo, useEffect, useRef } from 'react';
import MarkBadge, { CogRing, RANK_RIMS } from '../MarkBadge';
import ShinyBadge from '../rollScreen/ShinyBadge';
import { markEntry } from '../../progress/markRolls';
import { CARD_RAR, LOCKED, cardTier } from './palette.js';
import CardFrame from './CardFrame.jsx';
import { cardModel, MASKED_ODDS } from './cardModel.js';
import { shineNow, shineHost, shineSrc } from './cardShine.js';
import { useReduceMotion } from '../../lib/useReduceMotion';
import './MarkCard.css';

const NONE = {};
const FRAME_X = { mythic: '/fx/frame-mythic.svg', secret: '/fx/frame-secret.svg' };
const cls = (base, extra) => (extra ? `${base} ${extra}` : base);

const Lock = () => (
  <svg className="mc-lock" viewBox="0 0 16 18" width="22" height="25" aria-hidden="true" focusable="false">
    <path d="M4 8 V5.5 a4 4 0 0 1 8 0 V8" fill="none" stroke="currentColor" strokeWidth="2.4" />
    <rect x="1.5" y="8" width="13" height="9" rx="2" fill="currentColor" stroke="#000" strokeWidth="1.5" />
  </svg>
);

function MarkCard({
  id, kind = 'roll', tier, name, locked = false, state = null, rank = 1, shiny = false, fx = false, w = null,
  parts = NONE, className = '', still = false, sheen,
}) {
  const c = cardModel({ id, kind, tier, name, locked, state });
  // THE CARD SHINE (Andy oct11): every live card carries its tier's shine band unless told otherwise (`sheen={false}`);
  // a still card (a reel cell passing by) carries none. The shared scheduler (cardShine.js) sweeps it.
  const shine = sheen === undefined ? !still : !!sheen;
  const shineTier = cardTier(c.tier);
  const clipRef = useRef(null);
  const bandRef = useRef(null);
  const reduced = useReduceMotion();
  useEffect(() => {
    if (!shine || still || reduced) return undefined;
    return shineHost(clipRef.current, bandRef.current, shineTier);
  }, [shine, still, reduced, shineTier]);
  const pal = CARD_RAR[cardTier(c.tier)];
  const hi = c.hi && !locked;
  const style = { '--mc-line': pal.line, '--mc-edge': pal.edge, '--mc-fill': locked ? LOCKED.fill : pal.fill };
  if (w) {
    style['--mc-w'] = `${w}px`;
    style['--mc-s'] = w / 180;
  }
  const entry = markEntry(id) || (id ? { id, tier: c.tier } : null);
  const nameLen = String(c.name || '').length;
  const nameFit = nameLen >= 13 ? ' is-xxl' : nameLen >= 10 ? ' is-xl' : nameLen >= 8 ? ' is-l' : '';
  const numFit = c.statNum.length >= 5 ? ' is-l' : '';
  let hero;
  if (!locked) {
    hero = (
      <div className={cls(`mc-hero${numFit}`, parts.stat)}>
        <span className="mc-num">{c.statNum}</span>
        {c.statKind ? ' ' : null}
        {c.statKind ? <span className="mc-kind">{c.statKind}</span> : null}
      </div>
    );
  } else if (c.earned || c.unlisted) {
    hero = (
      <div className="mc-hero is-locked is-ach">
        <Lock />
        <span className={cls('mc-kind', parts.odds)}>{c.unlisted ? 'FIND IT' : 'ACHIEVEMENT'}</span>
      </div>
    );
  } else {
    hero = (
      <div className="mc-hero is-locked">
        {c.oddsNum === MASKED_ODDS
          ? <span className={cls('mc-num mc-odds is-masked', parts.odds)}>{MASKED_ODDS}</span>
          : <span className={cls('mc-num mc-odds', parts.odds)}><span className="mc-pre">1 IN</span> {c.oddsNum}</span>}
      </div>
    );
  }
  return (
    <div
      className={`mc is-${c.tier}${locked ? ' is-locked' : ''}${hi ? ' is-hi' : ''}${fx ? ' is-fx' : ''}${still ? ' is-still' : ''}${className ? ` ${className}` : ''}`}
      style={style}
      data-tier={c.tier}
      onPointerEnter={shine && !still && !reduced ? () => shineNow(clipRef.current) : undefined}
    >
      <div className="mc-face">
        {/* the frame is vector art (CardFrame) — the plates the text sits on, the rosette behind the cog, the shadow */}
        <CardFrame line={pal.line} edge={pal.edge} fill={locked ? LOCKED.fill : pal.fill} tier={c.tier} locked={locked} />
        {/* MYTHIC / SECRET: the frame VARIANT asset over the whole card (horns + crest / off-register glitch brackets +
            crown) — a different class of card, owned or locked */}
        {FRAME_X[c.tier] ? <img className="mc-frame-x" src={FRAME_X[c.tier]} alt="" draggable="false" /> : null}
        <div className={cls('mc-head', parts.head)}>
          <span className={cls('mc-tier', parts.tier)}>{c.rarityName}</span>
        </div>
        <div className="mc-art">
          {hi ? <span className="mc-glow" aria-hidden="true" /> : null}
          {/* the cog is its own HTML layer so its one-shot spin is a compositor transform, not an SVG repaint */}
          <span className="mc-cog" aria-hidden="true">
            {/* GEAR TURN (Andy oct11): -idle turns the cog slowly at rest, -fast adds a quick turn while hovered */}
            <span className="mc-cog-idle"><span className="mc-cog-fast">
              <svg viewBox="0 0 120 120" width="100%" height="100%" style={{ overflow: 'visible' }}>
                <CogRing line={rank > 1 ? RANK_RIMS[Math.min(5, rank) - 1].fill : pal.line} rainbow={c.tier === 'secret' && rank <= 1} />
              </svg>
            </span></span>
          </span>
          <MarkBadge mark={entry} rank={rank} size={132} permanent={kind === 'perm'} cog={false} className="mc-badge" />
          {shiny && !locked ? <ShinyBadge className="mc-shiny" /> : null}
          {c.copies > 1 && !locked ? <span className="mc-dupes" aria-label={`${c.copies} copies`}>×{c.copies}</span> : null}
        </div>
        <div className={`mc-name${nameFit}${parts.name ? ` ${parts.name}` : ''}`}>{c.name}</div>
        {hero}
        {/* GEAR CARD v4: the SUBSTATS — 4 lines on the bottom plate ("?" hidden on a locked card, "—" unused) */}
        <ul className="mc-subs" data-testid="mc-subs" aria-label={c.subs.filter((x) => x !== '—').join(', ') || 'No substats'}>
          {c.subs.map((t, i) => <li key={i} className={`mc-sub${t === '—' ? ' is-none' : t === '?' ? ' is-q' : ''}`}>{t}</li>)}
        </ul>
        {/* THE CARD SHINE: the tier's shine band (an asset, /fx/shine-<tier>.svg) parked off the card in a clip the size
            of the face; the reveal and the shared shine scheduler sweep it across ONCE at a time by transform (WAAPI). */}
        {shine ? <span className="mc-sheen" aria-hidden="true" ref={clipRef}><img className="mc-sheen-band" ref={bandRef} src={shineSrc(shineTier)} alt="" draggable="false" /></span> : null}
      </div>
    </div>
  );
}

export default memo(MarkCard);
export { MarkCard };
