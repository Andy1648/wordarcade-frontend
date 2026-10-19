// RoomHeroButton.jsx — CHANGE YOUR HERO FROM THE ROOM (oct18, Andy: "not a bad idea to be able to change hero avatar while
// inside a multiplayer room … no need for text for hero - maybe just the hero as a clickable icon"). Your own seat chip
// shows your hero's face as a button; tapping it opens the hero picker in a popup. Picking (or buying) equips it, tells
// the board (pushShowcaseNow — the leaderboard shows everyone's equipped hero) and closes. Local only: no room / WS
// message changes, so the other seats keep their dots. The face is a storage read (mainFace.js); the picker is lazy.
import { lazy, Suspense, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { mainFaceSrc } from './mainFace.js';
import './RoomHeroButton.css';

const RoomHeroPicker = lazy(() => import('./RoomHeroPicker.jsx'));

export default function RoomHeroButton() {
  const [open, setOpen] = useState(false);
  const [face, setFace] = useState(() => mainFaceSrc());
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open]);
  const picked = (id) => { setFace(mainFaceSrc(id)); setOpen(false); };
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
