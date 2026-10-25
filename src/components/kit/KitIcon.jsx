// KitIcon — the 21 v2 UI icons as ONE component (claude/mockups/v2/KitIcons.dc.html).
//
//   <KitIcon name="gems" size={48} />
//
// Sizes follow the sheet: the hard DROP is 4px at ≥72, 3px at ≥36, 2px below; the EXTRAS (sparkles,
// speed lines — class "x" in the data) drop out under 32px ("AT 24PX THE EXTRAS DROP OUT"). Pass
// `title` to make it an image with a name; without it the icon is decorative (aria-hidden).
import { KIT_ICONS } from './kitIconsCore.js'; // the full set once kitIconData.js is imported (kit barrel)
import './tokens.css';
import './KitIcon.css';

// PAINTED ICONS (ART PIPELINE, Andy oct11): an icon with a painted webp in /public/icons draws that instead of its vector
// body — same <svg> box, size, data-icon and hard drop, so every host and animation keeps working. The art is already
// tilted and its extras are painted in, so `rot` and the extras switch don't apply.
export const ICON_ART = Object.freeze({
  shop: '/icons/upgrades.webp',
  wins: '/icons/wins.webp',
  stats: '/icons/stats.webp',
  rebirth: '/icons/rebirth.webp',
  gears: '/icons/gears.webp',
  gems: '/icons/gems.webp',
  leaderboard: '/icons/leaderboard.webp',
  achievements: '/icons/achievements.webp',
  settings: '/icons/settings.webp',
  lock: '/icons/lock.webp',
  news: '/icons/news.webp',
  roll: '/rolls/vessel-icon.svg', // the COG-LOCKED GEAR CANISTER (Andy oct24: no dice) — placeholder until the painted webp lands
});

export function dropFor(size) {
  return size >= 72 ? 4 : size >= 36 ? 3 : 2;
}

export default function KitIcon({ name, size = 48, extras, shadow, title, className = '', style }) {
  const d = KIT_ICONS[name];
  if (!d) return null;
  const drop = Number.isFinite(shadow) ? shadow : dropFor(size);
  const showExtras = typeof extras === 'boolean' ? extras : size >= 32;
  return (
    <svg
      className={`kit-icon${showExtras ? '' : ' kit-icon--bare'}${className ? ` ${className}` : ''}`}
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role={title ? 'img' : undefined}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
      data-icon={name}
      style={{ '--ki-drop': `${drop}px`, ...style }}
    >
      {ICON_ART[name] ? <image href={ICON_ART[name]} x="0" y="0" width="100" height="100" preserveAspectRatio="xMidYMid meet" /> : <g
        transform={`rotate(${d.rot} 50 50)`}
        stroke="#0d0618"
        strokeWidth="6"
        strokeLinejoin="round"
        strokeLinecap="round"
        dangerouslySetInnerHTML={{ __html: d.body }}
      />}
    </svg>
  );
}
