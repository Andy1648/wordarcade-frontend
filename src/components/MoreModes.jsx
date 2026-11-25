// MoreModes.jsx — the MORE GAMES panel (feat/menu-six-grid). The desktop menu shows six cards; the modes past
// six (progress/menuModes.js — the ones this browser opens least) live here, as the SAME painted GameCards, so a
// mode under MORE looks and behaves exactly like one on the grid: a pick opens its mode dialog (or, locked, the
// read-only preview), and the panel closes. Scrim / ✕ / Escape close it.
//
// MOTION: one finite pop-in on open (transform/opacity, Homepage motion law) — nothing loops.
import { useCallback, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import GameCard from './GameCard';
import './MoreModes.css';

export default function MoreModes({ games = [], level = 0, isLocked, onSelect, onLockedSelect, onHover, onClose }) {
  const panelRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const close = useCallback(() => onCloseRef.current && onCloseRef.current(), []);

  // Focus + Escape from the commit that shows the panel (a plain effect runs after paint and can drop a fast Escape).
  // The locked plaque sits above the card's name off --bar-text-h, which the menu's fit-math publishes for the grid
  // cards — measured here ONCE on mount for these (never per frame).
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (panel) {
      panel.focus();
      for (const card of panel.getElementsByClassName('game-card')) {
        const bar = card.querySelector('.game-card-titlebar');
        if (!bar) continue;
        const padT = parseFloat(getComputedStyle(bar).paddingTop) || 0;
        card.style.setProperty('--bar-text-h', `${Math.ceil(bar.offsetHeight - padT)}px`);
      }
    }
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  return createPortal(
    <div className="mm-overlay" role="presentation">
      <div className="mm-scrim" onClick={close} />
      <div className="mm-panel" ref={panelRef} role="dialog" aria-modal="true" aria-label="More games" tabIndex={-1}>
        <div className="mm-head">
          <h2 className="mm-title">MORE GAMES</h2>
          <button type="button" className="mm-close" onClick={close} aria-label="Close">✕</button>
        </div>
        <div className="mm-cards" data-count={games.length}>
          {games.map((game) => (
            <GameCard
              key={game.id}
              game={game}
              priority
              onSelect={onSelect}
              onLockedSelect={onLockedSelect}
              onHover={onHover}
              locked={isLocked ? isLocked(game) : false}
              playerLevel={level}
            />
          ))}
        </div>
        <p className="mm-note">THE 6 GAMES YOU OPEN MOST SIT ON THE MENU</p>
      </div>
    </div>,
    document.body,
  );
}
