// RoomHeroButton.jsx — CHANGE YOUR HERO FROM THE ROOM (oct18, Andy: "not a bad idea to be able to change hero avatar while
// inside a multiplayer room … no need for text for hero - maybe just the hero as a clickable icon"). Your own seat chip
// shows your hero's face as a button; tapping it opens the hero picker in a popup. Picking (or buying) equips it, tells
// the board (pushShowcaseNow — the leaderboard shows everyone's equipped hero) and closes. HEROES IN EVERY SEAT (oct21):
// `onPicked(id)` lets the lobby tell the room (set_hero), and SeatHero draws everyone else's hero from room_update.
// The face is a storage read (mainFace.js); the picker is lazy.
import { lazy, Suspense, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { mainFaceSrc } from './mainFace.js';
import './RoomHeroButton.css';

const RoomHeroPicker = lazy(() => import('./RoomHeroPicker.jsx'));

export default function RoomHeroButton({ onPicked }) {
  const [open, setOpen] = useState(false);
  const [face, setFace] = useState(() => mainFaceSrc());
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open]);
  const picked = (id) => { setFace(mainFaceSrc(id)); setOpen(false); if (onPicked) onPicked(id); };
  return (
    <>
      <button type="button" className="rh-btn" onClick={() => setOpen(true)} aria-label="Change your hero" data-testid="room-hero">
        <img src={face} alt="" aria-hidden="true" draggable="false" />
      </button>
      {open ? createPortal(
        <div className="rh-scrim" role="presentation" onClick={() => setOpen(false)}>
          <div className="rh-pop" role="dialog" aria-modal="true" aria-label="Choose your hero" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="rh-x" onClick={() => setOpen(false)} aria-label="Close">✕</button>
            <Suspense fallback={null}><RoomHeroPicker onPicked={picked} /></Suspense>
          </div>
        </div>,
        document.body,
      ) : null}
    </>
  );
}

/** Another player's hero in their seat (not a button). An id the client doesn't know falls back to a cast hero. */
export function SeatHero({ id }) {
  return (
    <span className="rh-btn is-static" aria-hidden="true">
      <img src={mainFaceSrc(id || 'riot')} alt="" draggable="false" />
    </span>
  );
}
