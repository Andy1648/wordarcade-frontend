// Homepage.jsx
import { useEffect, useState } from 'react';
import { GAMES } from '../gameData';
import { useSound } from '../contexts/SoundContext';
import { squash, flash, burst, sfx, setMuted as setJuiceMuted } from '../juice';
import GameCard from './GameCard';
import GraffitiTag from './decor/GraffitiTag';
import {
  PaintSplatter1,
  PaintSplatter2,
  PaintSplatter3,
  PaintSplatter4,
} from './decor/PaintSplatters';
import './wall-system.css';
import './Homepage.css';

// WALL DEPTH: oversized graffiti throw-ups layered behind the menu so the wall
// reads as a real, lived-in place - not a blank panel. Built from the existing
// hand-sprayed GraffitiTag (drips + overspray + per-letter rotation), reused
// here at large scale and higher opacity. Positioned so the opaque cards crop
// them, leaving each piece "half-visible behind" like a packed alley wall.
// Deterministic config (no randomness) so the layout is stable across renders.
const WALL_DEPTH_PIECES = [
  { word: 'WORDS', fill: '#FF2EC4', line: '#991A75', size: 92,  top: 30, left: 2,  rot: -10, op: 0.5,  drip: 30 },
  { word: 'BOMB',  fill: '#9A1AFF', line: '#5A0EAA', size: 104, top: 40, left: 64, rot: 8,   op: 0.46, drip: 36 },
  { word: 'GG',    fill: '#FFE94A', line: '#B8A020', size: 80,  top: 6,  left: 44, rot: -6,  op: 0.42, drip: 0 },
];

/**
 * The lobby/homepage screen. Clicking a card or an action button calls the
 * matching passed-in handler from App (which owns the create/join room flow and
 * WebSocket wiring). The handlers are guarded so a missing one is simply a no-op.
 */
export default function Homepage({ onSelectGame, onCreateRoom, onJoinRoom, onCredits }) {
  // Once any navigation action fires we're about to transition away; lock the
  // buttons so a rapid second click can't double-fire. State resets naturally
  // because the component unmounts on the screen change.
  const [navigating, setNavigating] = useState(false);
  // The card currently hovered (drives the mascot's reaction pose).
  const [hoverGame, setHoverGame] = useState(null);
  const { sound, muted } = useSound();

  // Keep the juice layer's sound flag in sync with the app-wide SFX mute, so the
  // existing mute toggle silences the new press cues too (default on, honored).
  useEffect(() => {
    setJuiceMuted(muted);
  }, [muted]);

  // Fire the shared game-feel on a menu action button press: squash + color
  // flash + a small spark burst from the button's center + a tap tick. The juice
  // module self-gates on reduced-motion and the mute flag, so this stays
  // unconditional here. `accent` tints the flash/sparks to the button's color.
  function pressJuice(e, accent) {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    squash(el);
    flash(el, accent);
    burst(r.left + r.width / 2, r.top + r.height / 2, { count: 16, colors: [accent], speed: 240 });
    sfx('tap');
  }

  // Hovering a card plays a subtle blip - but only when moving onto a NEW card,
  // so it never machine-guns while you sit on one card. (hoverGame is kept just
  // for that dedup now; the card art reveal is pure CSS :hover.)
  function handleHover(id) {
    if (id && id !== hoverGame) sound.menuHover();
    setHoverGame(id);
  }

  function handleSelectGame(gameId) {
    if (navigating) return;
    sound.click();
    setNavigating(true);
    if (onSelectGame) onSelectGame(gameId);
  }

  function handleCreateRoom(e) {
    if (navigating) return;
    pressJuice(e, '#FF2EC4'); // pink accent juice (squash + spark + tick)
    sound.click(); // the whoosh follows from the screen transition in App
    setNavigating(true);
    if (onCreateRoom) onCreateRoom();
  }

  function handleJoinRoom(e) {
    if (navigating) return;
    pressJuice(e, '#2EFFE0'); // cyan accent juice
    sound.click(); // the whoosh follows from the screen transition in App
    setNavigating(true);
    if (onJoinRoom) onJoinRoom();
  }

  function handleCredits() {
    if (navigating) return;
    sound.click();
    setNavigating(true);
    if (onCredits) onCredits();
  }

  return (
    <div className="homepage-wrap">
      <div className="homepage-stage wall-surface">
        {/* WALL DEPTH: oversized graffiti throw-ups behind everything, cropped by
            the opaque cards so they read as half-visible pieces on a packed wall.
            Reuses the hand-sprayed GraffitiTag vocabulary at large scale. */}
        <div className="homepage-wall-depth" aria-hidden="true">
          {WALL_DEPTH_PIECES.map((p, i) => (
            <GraffitiTag
              key={`depth${i}`}
              word={p.word}
              fill={p.fill}
              line={p.line}
              size={p.size}
              top={p.top}
              left={p.left}
              rotation={p.rot}
              opacity={p.op}
              drip={p.drip}
            />
          ))}
        </div>

        {/* The mascot as a faint graffiti stencil sprayed on the wall - ambient
            brand presence, part of the texture, NOT a character in the scene. */}
        <img className="homepage-graffiti" src="/mascot-idle.png" alt="" aria-hidden="true" draggable="false" />

        <PaintSplatter1 className="homepage-splatter homepage-splatter-1" color="#FF2EC4" />
        <PaintSplatter2 className="homepage-splatter homepage-splatter-2" color="#2EFFE0" />
        <PaintSplatter3 className="homepage-splatter homepage-splatter-3" color="#FFE94A" />
        <PaintSplatter4 className="homepage-splatter homepage-splatter-4" color="#9A1AFF" />

        {/* Title: the wordmark with a handstyle 3D extrude (.wall-handstyle) and
            paint dripping off the letters - hand-painted on the wall, not set. */}
        <div className="homepage-logo-wrap">
          {/* "TYPE A WORD": the non-breaking space keeps "TYPE A" together
              so the title only ever wraps before "WORD" on narrow screens. The
              data-text must match exactly so the RGB-split clones line up. */}
          <div
            className="homepage-logo wall-handstyle"
            data-text={'TYPE A WORD'}
            role="img"
            aria-label="Type a Word"
          >
            {'TYPE A WORD'}
          </div>
          {/* Paint running off the wordmark. */}
          <div className="homepage-logo-drip" aria-hidden="true">
            <span style={{ left: '17%', '--len': '20px' }} />
            <span style={{ left: '49%', '--len': '34px' }} />
            <span style={{ left: '78%', '--len': '16px' }} />
          </div>
        </div>
        <div className="homepage-tagline">INSERT BRAIN TO CONTINUE</div>

        <div className="homepage-section-label wall-handstyle">// SELECT YOUR GAME //</div>

        <div className="homepage-cards-grid">
          {GAMES.map((game) => (
            <GameCard
              key={game.id}
              game={game}
              onSelect={handleSelectGame}
              onHover={handleHover}
            />
          ))}
        </div>

        {/* CLEAN ZONE: a knocked-back sprayed patch under the action buttons so
            CREATE / JOIN stay crisp against the grimy wall. */}
        <div className="homepage-bottom-bar wall-clean-zone">
          <button
            className={`homepage-btn homepage-btn-create${navigating ? ' disabled' : ''}`}
            onClick={handleCreateRoom}
            onMouseEnter={() => sfx('hover')}
            disabled={navigating}
            data-juice-self
          >
            CREATE ROOM
          </button>
          <button
            className={`homepage-btn homepage-btn-join${navigating ? ' disabled' : ''}`}
            onClick={handleJoinRoom}
            onMouseEnter={() => sfx('hover')}
            disabled={navigating}
            data-juice-self
          >
            JOIN ROOM
          </button>
        </div>

        {/* Link to the standalone credits page (holds music attribution etc.). */}
        <button
          className={`homepage-credits-link${navigating ? ' disabled' : ''}`}
          onClick={handleCredits}
          disabled={navigating}
        >
          CREDITS
        </button>
      </div>
    </div>
  );
}
