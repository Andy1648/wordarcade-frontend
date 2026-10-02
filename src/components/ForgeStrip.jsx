// ForgeStrip — the LETTER FORGE's state, drawn: 26 letter tiles A–Z, each at its forge level.
// An unforged letter is a dim outline; a forged one is filled, the fill stepping through the house
// palette every few levels so a long-played forge reads as visibly richer, and its level sits in the
// corner. The letter the NEXT buy forges wears the yellow ring. Static — no animation at rest.
import './ForgeStrip.css';

const ALPHA = 'abcdefghijklmnopqrstuvwxyz'.split('');
// Level bands → fill / outline (outline = a darker shade of the fill, CLAUDE.md).
const BANDS = [
  { min: 1, fill: '#2EFFE0', line: '#13a593' },
  { min: 3, fill: '#FFE94A', line: '#b8a400' },
  { min: 6, fill: '#FF6B3D', line: '#a8381a' },
  { min: 10, fill: '#FF4FA3', line: '#a3175f' },
  { min: 16, fill: '#C58BFF', line: '#6a2bb0' },
];
function bandFor(lv) {
  let b = null;
  for (const x of BANDS) if (lv >= x.min) b = x;
  return b;
}

export default function ForgeStrip({ levels = {}, next = null }) {
  return (
    <div className="forge-strip" role="img" aria-label={`Letter forge: ${ALPHA.filter((c) => levels[c]).length} of 26 letters forged`}>
      {ALPHA.map((ch) => {
        const lv = levels[ch] || 0;
        const b = bandFor(lv);
        return (
          <span
            key={ch}
            className={`forge-tile${lv ? ' is-forged' : ''}${ch === next ? ' is-next' : ''}`}
            style={b ? { background: b.fill, borderColor: b.line } : undefined}
          >
            {ch.toUpperCase()}
            {lv > 0 && <i className="forge-lv">{lv}</i>}
          </span>
        );
      })}
    </div>
  );
}
