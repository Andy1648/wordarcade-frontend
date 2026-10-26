// VesselArt.jsx — the SEALED ROLL vessel (065; Andy oct24 "i don't want dice"): a COG-LOCKED GEAR CANISTER, painted PER
// PART so the reveal can take it apart — the cog spins and pops, the lid blasts off, light + shards burst from the top.
// LEAF (no roll code): the SHOP card, the roll screen's OPEN button and SealedRollReveal all draw this.
//
// Every part is a real PAINTED asset in /public/rolls, registered by the tier's own vessel-<tier>.json: each box is
// { x, y, w } in % of the 512 base canvas (x,y = top-left, w = width; the height follows the image's own aspect). The
// cog turns about its OWN centre. The BADGE is blank: the tier is set over its plate in Bungee (SVG text, 512 canvas),
// FITTED INSIDE THE PLATE'S SAFE WINDOW — `plate` in vessel-<tier>.json, measured off the painted badge: the flat face
// between the rivets, ≥ 8% in from its painted border each side (Andy oct25: "LEGENDARY is taking out borders").
// The text is sized DOWN to that window (FitText: the height cap, then the width with at most a 14% squeeze) and centred
// on it, so it never touches the border or the ribbon ends. EPIC white on purple, LEGENDARY dark ink on gold. The GLOW is
// a painted ray fan converging at 50% / 74.4% of its canvas (seated on the open rim).
import './VesselArt.css';
import EPIC_OFF from '../../../public/rolls/vessel-epic.json';
import LEG_OFF from '../../../public/rolls/vessel-legendary.json';
import { fitLabel } from './vesselLabel.js';

const part = (src, box) => Object.freeze({ src, x: box.x, y: box.y, w: box.w });
const vessel = (OFF, src, label) => Object.freeze({
  base: part(src.base, OFF.base),
  lid: part(src.lid, OFF.lid),
  cog: part(src.cog, OFF.cog),
  badge: part(src.badge, OFF.badge),
  glow: Object.freeze({ src: src.glow }),
  label: Object.freeze({ ...label, ...fitLabel(label.text, OFF.plate, label.stroke ? 6 : 0) }),
});
export const VESSEL_ART = Object.freeze({
  epic: vessel(EPIC_OFF, {
    base: '/rolls/vessel-epic-base.webp', lid: '/rolls/vessel-epic-lid.webp', cog: '/rolls/vessel-epic-cog.webp',
    badge: '/rolls/vessel-epic-badge.webp', glow: '/rolls/vessel-glow-epic.webp',
  }, { text: 'EPIC+', ink: '#fff', stroke: '#2a0a4a' }),
  legendary: vessel(LEG_OFF, {
    base: '/rolls/vessel-legendary-base.webp', lid: '/rolls/vessel-legendary-lid.webp', cog: '/rolls/vessel-legendary-cog.webp',
    badge: '/rolls/vessel-legendary-badge.webp', glow: '/rolls/vessel-glow-legendary.webp',
  }, { text: 'LEGENDARY+', ink: '#3a2200', stroke: null }),
});
export const SHARD_ART = Object.freeze(['/rolls/vessel-shard-1.webp', '/rolls/vessel-shard-2.webp', '/rolls/vessel-shard-3.webp']);
const RANK = { rare: 0, epic: 1, legendary: 2, mythic: 3, secret: 4 };
export const vesselArt = (tier) => VESSEL_ART[tier] || ((RANK[tier] ?? 1) >= 2 ? VESSEL_ART.legendary : VESSEL_ART.epic);

const boxStyle = (p) => ({ left: `${p.x}%`, top: `${p.y}%`, width: `${p.w}%`, height: 'auto', transformOrigin: '50% 50%' });
const FULL_BOX = Object.freeze({ left: 0, top: 0, width: '100%', height: '100%' });

/**
 * The vessel for `tier`, closed, `size` px square (null: the host CSS sizes it). `refs` (optional) = { lid, cog, badge, base } ref objects the reveal
 * animates; `label={false}` drops the badge text (tiny icons).
 */
export default function VesselArt({ tier = 'epic', size = 256, label = true, refs = {}, className = '' }) {
  const a = vesselArt(tier);
  const L = a.label;
  const img = (k) => (
    <img ref={refs[k]} className={`va-part va-${k}`} src={a[k].src} alt="" draggable="false" style={boxStyle(a[k])} />
  );
  return (
    <span className={`va${className ? ` ${className}` : ''}`} style={size ? { width: size, height: size } : undefined} data-tier={tier} aria-hidden="true">
      {img('base')}
      <span ref={refs.badgeWrap} className="va-part va-badge-wrap" style={FULL_BOX}>
        <img className="va-part va-badge" src={a.badge.src} alt="" draggable="false" style={boxStyle(a.badge)} />
        {label ? (
          <svg className="va-part va-label" viewBox="0 0 512 512" focusable="false">
            <text x={L.x} y={L.y} textAnchor="middle" fontFamily="Bungee, Impact, sans-serif" fontSize={L.size}
              textLength={L.fit || undefined} lengthAdjust="spacingAndGlyphs" fill={L.ink} stroke={L.stroke || undefined}
              strokeWidth={L.stroke ? 6 : undefined} strokeLinejoin="round" paintOrder="stroke fill">{L.text}</text>
          </svg>
        ) : null}
      </span>
      {img('lid')}
      {img('cog')}
    </span>
  );
}
