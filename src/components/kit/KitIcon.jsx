// KitIcon — the 21 v2 UI icons as ONE component (claude/mockups/v2/KitIcons.dc.html).
//
//   <KitIcon name="gems" size={48} />
//
// Sizes follow the sheet: the hard DROP is 4px at ≥72, 3px at ≥36, 2px below; the EXTRAS (sparkles,
// speed lines — class "x" in the data) drop out under 32px ("AT 24PX THE EXTRAS DROP OUT"). Pass
// `title` to make it an image with a name; without it the icon is decorative (aria-hidden).
import { KIT_ICONS } from './kitIconData.js';
import './tokens.css';
import './KitIcon.css';

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
      <g
        transform={`rotate(${d.rot} 50 50)`}
        stroke="#0d0618"
        strokeWidth="6"
        strokeLinejoin="round"
        strokeLinecap="round"
        dangerouslySetInnerHTML={{ __html: d.body }}
      />
    </svg>
  );
}
