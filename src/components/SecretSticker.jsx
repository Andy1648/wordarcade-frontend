// SecretSticker.jsx — the MENU SECRET reveal (Job 9). A thin wrapper around the shared
// Sticker shell (src/components/Sticker.jsx): it owns the secret-specific ART (the five
// glyphs) and COPY (ribbon / name / blurb / coin); the shell owns the modal scrim, the
// cream card, the punch-in and the dismiss behaviour. variant="secret" keeps the legacy
// .secret-sticker / .secret-sticker-blurb / .secret-backdrop class names on the markup.
import Sticker from './Sticker';

// 96×96 glyphs, flat fills + fat black strokes. Slightly off-axis on purpose.
const S = { fill: 'none', stroke: '#000', strokeWidth: 8, strokeLinecap: 'round', strokeLinejoin: 'round' };
const S9 = { ...S, strokeWidth: 9 };

function GlyphPalindrome() {
  // ↔ both ways: one fat double-headed arrow, pink, a hair tilted.
  return (
    <svg viewBox="0 0 96 96" className="sticker-glyph" aria-hidden="true">
      <g transform="rotate(-4 48 48)">
        <path d="M18 48 H78" {...S9} />
        <path d="M30 32 L14 48 L30 64 Z" fill="#FF4FA3" {...S} />
        <path d="M66 32 L82 48 L66 64 Z" fill="#FF4FA3" {...S} />
      </g>
    </svg>
  );
}
function GlyphWish() {
  // a clock reading 11:11 — hour hand at 11, minute hand at 11 past.
  return (
    <svg viewBox="0 0 96 96" className="sticker-glyph" aria-hidden="true">
      <circle cx="48" cy="48" r="34" fill="#2EFFE0" {...S9} />
      <path d="M48 48 L33 22" {...S9} />
      <path d="M48 48 L60 20" {...S} />
      <circle cx="48" cy="48" r="4" fill="#000" stroke="none" />
      <path d="M48 16 v5 M80 48 h-5 M48 80 v-5 M16 48 h5" stroke="#000" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}
function GlyphTypewriter() {
  // a row of keys, one of them mashed lower than the rest.
  return (
    <svg viewBox="0 0 96 96" className="sticker-glyph" aria-hidden="true">
      <rect x="8" y="34" width="22" height="22" rx="5" fill="#FFE94A" {...S} />
      <rect x="37" y="40" width="22" height="22" rx="5" fill="#FF6B3D" {...S} />
      <rect x="66" y="34" width="22" height="22" rx="5" fill="#FFE94A" {...S} />
      <rect x="22" y="66" width="52" height="14" rx="5" fill="#9A1AFF" {...S} />
      <path d="M48 20 v10" {...S} />
    </svg>
  );
}
function GlyphMidas() {
  // the golden coin — a coin with its inner ring and a wedge cut, tipped.
  return (
    <svg viewBox="0 0 96 96" className="sticker-glyph" aria-hidden="true">
      <g transform="rotate(8 48 48)">
        <circle cx="48" cy="48" r="34" fill="#FFE94A" {...S9} />
        <circle cx="48" cy="48" r="20" fill="#FF6B3D" {...S} />
        <path d="M48 36 v24 M40 44 h16 M40 52 h16" {...S} />
      </g>
    </svg>
  );
}
function GlyphNewgrounds() {
  // the orange TANK tile: body, turret, barrel, tread, on a cream card.
  return (
    <svg viewBox="0 0 96 96" className="sticker-glyph" aria-hidden="true">
      <rect x="10" y="10" width="76" height="76" rx="12" fill="#FF6B3D" {...S9} />
      <rect x="24" y="48" width="48" height="18" rx="6" fill="#FFE94A" {...S} />
      <rect x="36" y="32" width="24" height="16" rx="5" fill="#FFE94A" {...S} />
      <path d="M60 40 H80" {...S9} />
      <circle cx="32" cy="66" r="6" fill="#000" stroke="none" />
      <circle cx="48" cy="66" r="6" fill="#000" stroke="none" />
      <circle cx="64" cy="66" r="6" fill="#000" stroke="none" />
    </svg>
  );
}

const GLYPHS = {
  palindrome: GlyphPalindrome,
  wish: GlyphWish,
  typewriter: GlyphTypewriter,
  midas: GlyphMidas,
  newgrounds: GlyphNewgrounds,
};

// "{d}" in a blurb is the matched word — rendered bold. No detail → the marker drops out.
// Returns the inline spans only: the shell's blurb element is what carries the class, so the
// bolded word still resolves as `.secret-sticker-blurb b`.
function Blurb({ text, detail }) {
  const parts = String(text || '').split('{d}');
  return (
    <>
      {parts.map((p, i) => (
        <span key={i}>
          {p}
          {i < parts.length - 1 && detail ? <b>{detail}</b> : null}
        </span>
      ))}
    </>
  );
}

/**
 * @param {{ hit: { id, stamp, wins, blurb, detail, found, total }, onDismiss: () => void }} props
 */
export default function SecretSticker({ hit, onDismiss }) {
  if (!hit) return null;
  const Glyph = GLYPHS[hit.id] || GlyphMidas;
  return (
    <Sticker
      variant="secret"
      onDismiss={onDismiss}
      ribbon={`★ SECRET FOUND · ${hit.found} / ${hit.total} ★`}
      glyph={<Glyph />}
      name={hit.stamp}
      blurb={<Blurb text={hit.blurb} detail={hit.detail} />}
      coin={`◉ +${hit.wins} WINS`}
    />
  );
}
