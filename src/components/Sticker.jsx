// Sticker.jsx — the shared REVEAL STICKER shell (feat/shop-reveal-sticker).
//
// One cream sticker on a modal scrim, used by every "you just got something" moment:
//   ribbon → glyph band → name → one-line blurb → coin pill.
// It started as the menu-secret reveal; the shop's own reveal was a black box with a star,
// a banner and a lone glyph, so the shell is extracted here and both use it.
//
// It is a MODAL: the full-screen backdrop AND the sticker both swallow the dismiss click, so
// tapping it away can never fall through to whatever sits beneath (the old pointer-events:none
// secret stamp did exactly that and opened SAT RUSH). This is the one sanctioned position:fixed
// overlay in these components — a modal scrim, not an orphan control (CLAUDE.md NO ORPHAN FIXED UI).
//
// Motion: ONE finite punch-in (transform/opacity), none under reduced motion. Glyphs are real
// inline vector art (SVG), never CSS shapes (ART VS MOTION).
//
// `variant` adds a second, prefixed class to every element ('secret' → .secret-sticker,
// .secret-sticker-blurb, .secret-backdrop …) so each caller can style — and target — its own
// skin without the shell knowing anything about it.
import './Sticker.css';

/**
 * @param {{
 *   ribbon: import('react').ReactNode,   // the pink top bar, e.g. "★ UNLOCKED ★"
 *   glyph: import('react').ReactNode,    // the art in the band (an <svg>)
 *   name: import('react').ReactNode,     // the big Bungee line
 *   blurb: import('react').ReactNode,    // one line of what it does
 *   coin?: import('react').ReactNode,    // the pill, e.g. "◉ +250 WINS" / "−2,500 WINS"
 *   coinTone?: 'credit' | 'debit',       // debit = spent, rendered red
 *   variant?: string,                    // extra class prefix ('secret' | 'shop')
 *   onDismiss: () => void,
 * }} props
 */
export default function Sticker({
  ribbon,
  glyph,
  name,
  blurb,
  coin = null,
  coinTone = 'credit',
  variant = '',
  onDismiss,
}) {
  const v = (base) => (variant ? `${base} ${variant}-${base}` : base);
  return (
    <div
      className={variant ? `sticker-backdrop ${variant}-backdrop` : 'sticker-backdrop'}
      onClick={onDismiss}
      data-testid={variant ? `${variant}-backdrop` : 'sticker-backdrop'}
    >
      <div
        className={v('sticker')}
        role="status"
        aria-live="polite"
        onClick={(e) => {
          e.stopPropagation();
          onDismiss();
        }}
      >
        <div className={v('sticker-ribbon')}>{ribbon}</div>
        <div className={v('sticker-band')}>{glyph}</div>
        <div className={v('sticker-name')}>{name}</div>
        <div className={v('sticker-blurb')}>{blurb}</div>
        {coin ? (
          <div className={`${v('sticker-coin')}${coinTone === 'debit' ? ' is-debit' : ''}`}>{coin}</div>
        ) : null}
      </div>
    </div>
  );
}
