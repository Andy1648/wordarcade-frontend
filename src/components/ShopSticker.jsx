// ShopSticker.jsx — the SHOP reveal (feat/shop-reveal-sticker).
//
// The old ShopReveal was a black box with a generic star, an "INFERNO UNLOCKED" banner and one
// floating glyph — the same laziness the menu secret stamp had, on a moment that can cost 2,500
// wins. It now uses the shared Sticker shell and shows the ITEM'S OWN ART:
//   theme      → its four-colour swatch strip
//   pop style  → the pop letter in that style's colour
//   key power  → the tier number on a key cap
//   word sense → the tier number on a lens
//   momentum   → the momentum mark
//   rebirth    → the multiplier arrow
// Ribbon "★ UNLOCKED ★", the item's name, one line of what it actually does, and the PRICE as a
// red debit pill (money left your pocket — it must never read like a payout).
//
// Art is inline vector (ART VS MOTION); the shell owns the single finite punch-in. The
// auto-dismiss timer stays in ShopScreen, which also owns reveal.onClose (the rebirth close).
import Sticker from './Sticker';

// The pop STYLES have no colour in the data (shop.js carries only name/price/xpMult), so their
// look lives here with the rest of the art. Sound packs have no colour at all — they fall back
// to the house pink.
const POP_COLOURS = {
  classic: '#2EFFE0',
  chrome: '#C9D6E8',
  inferno: '#FF6B3D',
  void: '#9A1AFF',
  prism: '#FFE94A',
};

const S = { fill: 'none', stroke: '#000', strokeWidth: 8, strokeLinecap: 'round', strokeLinejoin: 'round' };
const S9 = { ...S, strokeWidth: 9 };

// THEME → the palette itself: four flat bars on a card, tipped like a paint chip.
function GlyphSwatch({ colours = [] }) {
  const cols = colours.length ? colours.slice(0, 4) : ['#0d0618', '#ff4fa3', '#2EFFE0', '#FFE94A'];
  const w = 76 / cols.length;
  return (
    <svg viewBox="0 0 96 96" className="sticker-glyph" aria-hidden="true">
      <g transform="rotate(-5 48 48)">
        <rect x="10" y="18" width="76" height="60" rx="8" fill="#F0EAD9" {...S9} />
        {cols.map((c, i) => (
          <rect key={i} x={10 + i * w} y="18" width={w} height="60" fill={c} stroke="none" />
        ))}
        <rect x="10" y="18" width="76" height="60" rx="8" {...S9} />
      </g>
    </svg>
  );
}

// POP STYLE / SOUND PACK → the pop letter itself, in the thing you just bought.
function GlyphPop({ colour = '#2EFFE0', char = 'A' }) {
  return (
    <svg viewBox="0 0 96 96" className="sticker-glyph" aria-hidden="true">
      <g transform="rotate(-6 48 48)">
        <path d="M48 6 L58 30 L84 30 L62 46 L70 74 L48 58 L26 74 L34 46 L12 30 L38 30 Z" fill={colour} {...S} />
        <text
          x="48"
          y="56"
          textAnchor="middle"
          fontFamily="Bungee, system-ui, sans-serif"
          fontSize="30"
          fill="#000"
        >
          {char}
        </text>
      </g>
    </svg>
  );
}

// KEY POWER → the tier number stamped on a key cap.
function GlyphKeyTier({ tier = 1, colour = '#2EFFE0' }) {
  return (
    <svg viewBox="0 0 96 96" className="sticker-glyph" aria-hidden="true">
      <g transform="rotate(-4 48 48)">
        <rect x="12" y="12" width="72" height="72" rx="14" fill={colour} {...S9} />
        <rect x="22" y="22" width="52" height="52" rx="9" fill="#F0EAD9" {...S} />
        <text
          x="48"
          y="63"
          textAnchor="middle"
          fontFamily="Bungee, system-ui, sans-serif"
          fontSize="34"
          fill="#0d0618"
        >
          {tier}
        </text>
      </g>
    </svg>
  );
}

// WORD SENSE → the tier number read through a lens.
function GlyphLens({ tier = 1, colour = '#FFD54A' }) {
  return (
    <svg viewBox="0 0 96 96" className="sticker-glyph" aria-hidden="true">
      <g transform="rotate(-8 48 48)">
        <path d="M62 62 L84 84" {...S9} />
        <circle cx="42" cy="42" r="30" fill={colour} {...S9} />
        <text
          x="42"
          y="54"
          textAnchor="middle"
          fontFamily="Bungee, system-ui, sans-serif"
          fontSize="28"
          fill="#0d0618"
        >
          {tier}
        </text>
      </g>
    </svg>
  );
}

// MOMENTUM → the mark that lands on the menu rail, with its running count.
function GlyphMomentum({ count = 1, colour = '#FF6B3D' }) {
  return (
    <svg viewBox="0 0 96 96" className="sticker-glyph" aria-hidden="true">
      <g transform="rotate(6 48 48)">
        <path d="M48 8 L72 48 L48 88 L24 48 Z" fill={colour} {...S9} />
        <text
          x="48"
          y="58"
          textAnchor="middle"
          fontFamily="Bungee, system-ui, sans-serif"
          fontSize="24"
          fill="#0d0618"
        >
          {count}
        </text>
      </g>
    </svg>
  );
}

// REBIRTH → everything you earn, multiplied.
function GlyphRebirth({ colour = '#9A1AFF' }) {
  return (
    <svg viewBox="0 0 96 96" className="sticker-glyph" aria-hidden="true">
      <g transform="rotate(-3 48 48)">
        <circle cx="48" cy="48" r="34" fill={colour} {...S9} />
        <path d="M48 68 V30" {...S9} />
        <path d="M32 44 L48 26 L64 44 Z" fill="#FFE94A" {...S} />
      </g>
    </svg>
  );
}

function glyphFor(reveal) {
  switch (reveal.kind) {
    case 'theme':
      return <GlyphSwatch colours={reveal.swatch} />;
    case 'keypower':
      return <GlyphKeyTier tier={reveal.tier} colour={reveal.colour} />;
    case 'wordsense':
      return <GlyphLens tier={reveal.tier} colour={reveal.colour} />;
    case 'momentum':
      return <GlyphMomentum count={reveal.tier} colour={reveal.colour} />;
    case 'rebirth':
      return <GlyphRebirth colour={reveal.colour} />;
    default:
      return (
        <GlyphPop
          colour={POP_COLOURS[reveal.itemId] || reveal.colour || '#ff4fa3'}
          char={reveal.previewChar || 'A'}
        />
      );
  }
}

/**
 * @param {{
 *   reveal: { kind, name, blurb, coin, colour?, tier?, swatch?, itemId?, previewChar? },
 *   onDismiss: () => void,
 * }} props
 */
export default function ShopSticker({ reveal, onDismiss }) {
  if (!reveal) return null;
  return (
    <Sticker
      variant="shop"
      onDismiss={onDismiss}
      ribbon="★ UNLOCKED ★"
      glyph={glyphFor(reveal)}
      name={reveal.name}
      blurb={reveal.blurb}
      coin={reveal.coin}
      coinTone="debit"
    />
  );
}
