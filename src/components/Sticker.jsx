// Sticker.jsx — the shared REVEAL STICKER shell (feat/shop-reveal-sticker).
//
// One cream sticker on a modal scrim, used by every "you just got something" moment:
//   ribbon → glyph band → name → one-line blurb → coin pill → GOT IT.
// It started as the menu-secret reveal; the shop's own reveal was a black box with a star,
// a banner and a lone glyph, so the shell is extracted here and both use it.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// WHY THIS ONE STAYS A MODAL (fix/overlay-inplace). Everything informational in the app is
// being converted to an in-place reaction, and this is the one that must not be. It carries
// no choice, so by the rule it should react in place — but the surface it would react on is
// the SHOP GRID, and `ShopScreen.jsx`'s HoldBuy commits a purchase on a SINGLE click. Give
// the scrim `pointer-events: none` and the dismiss tap lands on whatever card is underneath
// and buys it: the identical failure to the old pointer-events:none secret stamp that opened
// SAT RUSH, except here it costs up to 2,500 wins. `e2e/overlay-inplace.spec.js` (2a) pins
// that the scrim eats a click aimed straight at a BUY button. So: modal, on purpose.
//
// WHAT WAS ACTUALLY BROKEN. That scrim only ever swallowed the MOUSE. Two leaks, both proven
// red before they were fixed:
//   - KEYBOARD BUY-THROUGH. After a keyboard purchase, focus was still on the .shop-buy
//     button BEHIND the reveal, so a second Enter re-fired the buy straight through the
//     "modal" — measured going from TIER 1 to TIER 2 with the sticker on screen.
//   - ESCAPE FELL THROUGH. ShopScreen binds Escape on `window` to close the whole shop, so
//     Escape on the reveal closed the layer BEHIND it and the reveal had no keyboard
//     dismissal at all — you could only wait out the 4.2s timer.
// The fix is a REAL CONTROL: a focusable GOT IT button inside the sticker that takes focus on
// mount (so Enter/Space can only reach the dismissal, never the buy) and a capture-phase
// Escape handler that consumes the key before ShopScreen's window listener sees it. Focus is
// restored to whatever had it, if that element still exists.
//
// EFFECTS RUN ONCE. `onDismiss` is an inline arrow recreated on every ShopScreen render, and
// ShopScreen re-renders whenever App does (~1-2×/sec of unmemoized-prop churn). Listing it as
// a dep would re-steal focus on every one of those renders — the same trap that once stopped
// the reveal's auto-dismiss timer from ever firing. It is read through a ref instead.
// ─────────────────────────────────────────────────────────────────────────────────────────
//
// Motion: ONE finite punch-in (transform/opacity), none under reduced motion. Glyphs are real
// inline vector art (SVG), never CSS shapes (ART VS MOTION).
//
// `variant` adds a second, prefixed class to every element ('secret' → .secret-sticker,
// .secret-sticker-blurb, .secret-backdrop …) so each caller can style — and target — its own
// skin without the shell knowing anything about it.
import { useEffect, useRef } from 'react';
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
  const dismissRef = useRef(null);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    // Take focus off whatever fired the purchase. preventScroll so claiming focus can never
    // jerk the panel behind the sticker.
    const previous = document.activeElement;
    dismissRef.current?.focus({ preventScroll: true });

    // CAPTURE PHASE, and it consumes the key. ShopScreen listens for Escape on `window` in the
    // bubble phase to close the whole shop; a capture listener on `window` runs first, and
    // stopping propagation there is what keeps the top layer's Escape from closing the layer
    // beneath it.
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      onDismissRef.current();
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      // Hand focus back — but only if that element is still on the page. A rebirth reveal
      // closes the entire shop on dismiss, so the button that opened it is long gone.
      if (previous && previous !== document.body && previous.isConnected) {
        try { previous.focus({ preventScroll: true }); } catch { /* detached mid-teardown */ }
      }
    };
    // Once, for the life of one reveal — see the EFFECTS RUN ONCE note above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        <button
          type="button"
          ref={dismissRef}
          className={v('sticker-dismiss')}
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
        >
          GOT IT
        </button>
      </div>
    </div>
  );
}
