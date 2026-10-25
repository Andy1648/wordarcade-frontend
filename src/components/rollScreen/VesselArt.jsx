// VesselArt.jsx — the SEALED ROLL vessel (065; Andy oct24 "i don't want dice"): a COG-LOCKED GEAR CANISTER, painted PER
// PART so the reveal can take it apart — the cog spins and pops, the lid blasts off, light + shards burst from the top.
// LEAF (no roll code): the SHOP card, the roll screen's OPEN button and SealedRollReveal all draw this.
//
// Every part is a real asset in /public/rolls (placeholder SVGs from claude/rolls-art/make-vessels.py until the painted
// webp set lands — then swap `ext` and the measured % boxes, nothing else). A part's box is { x, y, w, h } in % of the
// vessel square; the placeholders are all registered on one 512 canvas (0 0 100 100). `o` = the part's pivot (the cog's
// hub) as a transform-origin inside its own box. The BADGE is blank: the tier is set over it in Bungee (SVG text).
import './VesselArt.css';

const ext = 'svg';
const FULL = Object.freeze({ x: 0, y: 0, w: 100, h: 100 });
const part = (src, box = FULL, o = '50% 50%') => Object.freeze({ src, ...box, o });
const vessel = (tier, label, ink) => Object.freeze({
  base: part(`/rolls/vessel-${tier}-base.${ext}`),
  lid: part(`/rolls/vessel-${tier}-lid.${ext}`),
  cog: part(`/rolls/vessel-${tier}-cog.${ext}`, FULL, '50% 46.5%'),
  badge: part(`/rolls/vessel-${tier}-badge.${ext}`),
  glow: part(`/rolls/vessel-glow-${tier}.${ext}`),
  // the badge's text line, in the 512 canvas: centre + turn (the plate is ~x166–346, y330–394, turned −3°)
  label: Object.freeze({ text: label, x: 256, y: 376, rot: -3, size: 40, fit: label.length > 6 ? 156 : null, ink }),
});
export const VESSEL_ART = Object.freeze({
  epic: vessel('epic', 'EPIC+', '#3a0f66'),
  legendary: vessel('legendary', 'LEGENDARY+', '#5a3a00'),
});
export const SHARD_ART = Object.freeze([1, 2, 3].map((i) => `/rolls/vessel-shard-${i}.${ext}`));
const RANK = { rare: 0, epic: 1, legendary: 2, mythic: 3, secret: 4 };
export const vesselArt = (tier) => VESSEL_ART[tier] || ((RANK[tier] ?? 1) >= 2 ? VESSEL_ART.legendary : VESSEL_ART.epic);

const boxStyle = (p) => ({ left: `${p.x}%`, top: `${p.y}%`, width: `${p.w}%`, height: `${p.h}%`, transformOrigin: p.o });

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
      <span ref={refs.badgeWrap} className="va-part va-badge-wrap" style={boxStyle(FULL)}>
        <img className="va-part va-badge" src={a.badge.src} alt="" draggable="false" style={boxStyle(a.badge)} />
        {label ? (
          <svg className="va-part va-label" viewBox="0 0 512 512" focusable="false">
            <text x={L.x} y={L.y} transform={`rotate(${L.rot} ${L.x} ${L.y - 14})`} textAnchor="middle" fontFamily="Bungee, Impact, sans-serif"
              fontSize={L.size} textLength={L.fit || undefined} lengthAdjust="spacingAndGlyphs" fill={L.ink}>{L.text}</text>
          </svg>
        ) : null}
      </span>
      {img('lid')}
      {img('cog')}
    </span>
  );
}
