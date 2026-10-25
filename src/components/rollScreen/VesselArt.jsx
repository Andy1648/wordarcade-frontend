// VesselArt.jsx — the SEALED ROLL vessel (065; Andy oct24 "i don't want dice"): a COG-LOCKED GEAR CANISTER, painted PER
// PART so the reveal can take it apart — the cog spins and pops, the lid blasts off, light + shards burst from the top.
// LEAF (no roll code): the SHOP card, the roll screen's OPEN button and SealedRollReveal all draw this.
//
// Every part is a real PAINTED asset in /public/rolls. The parts are registered by vessel-epic.json: each box is
// { x, y, w } in % of the 512 base canvas (x,y = top-left, w = width; the height follows the image's own aspect).
// LEGENDARY wears the gold base under the epic lid / cog / badge until its own painted parts land; the glow + shards
// stay SVG. The cog turns about its OWN centre. The BADGE is blank: the tier is set over it in Bungee (SVG text).
import './VesselArt.css';
import OFF from '../../../public/rolls/vessel-epic.json';

const part = (src, box, o = '50% 50%') => Object.freeze({ src, x: box.x, y: box.y, w: box.w, o });
const vessel = (tier, label, partsTier) => Object.freeze({
  base: part(`/rolls/vessel-${tier}-base.webp`, OFF.base),
  lid: part(`/rolls/vessel-${partsTier}-lid.webp`, OFF.lid),
  cog: part(`/rolls/vessel-${partsTier}-cog.webp`, OFF.cog),
  badge: part(`/rolls/vessel-${partsTier}-badge.webp`, OFF.badge),
  glow: part(`/rolls/vessel-glow-${tier}.svg`, OFF.base),
  // the badge's text line, in the 512 canvas: centred on the badge plate
  label: Object.freeze({ text: label, x: 512 * (OFF.badge.x + OFF.badge.w / 2) / 100, y: 512 * (OFF.badge.y / 100) + 44, size: 32, fit: label.length > 6 ? 168 : null }),
});
export const VESSEL_ART = Object.freeze({
  epic: vessel('epic', 'EPIC+', 'epic'),
  legendary: vessel('legendary', 'LEGENDARY+', 'epic'),
});
export const SHARD_ART = Object.freeze([1, 2, 3].map((i) => `/rolls/vessel-shard-${i}.svg`));
const RANK = { rare: 0, epic: 1, legendary: 2, mythic: 3, secret: 4 };
export const vesselArt = (tier) => VESSEL_ART[tier] || ((RANK[tier] ?? 1) >= 2 ? VESSEL_ART.legendary : VESSEL_ART.epic);

const boxStyle = (p) => ({ left: `${p.x}%`, top: `${p.y}%`, width: `${p.w}%`, height: 'auto', transformOrigin: p.o });
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
              textLength={L.fit || undefined} lengthAdjust="spacingAndGlyphs" fill="#fff" stroke="#000" strokeWidth="6"
              strokeLinejoin="round" paintOrder="stroke fill">{L.text}</text>
          </svg>
        ) : null}
      </span>
      {img('lid')}
      {img('cog')}
    </span>
  );
}
