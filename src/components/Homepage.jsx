// Homepage.jsx
import { useEffect, useState } from 'react';
import { GAMES } from '../gameData';
import { useSound } from '../contexts/SoundContext';
import { squash, flash, burst, sfx, setMuted as setJuiceMuted } from '../juice';
import GameCard from './GameCard';
import GraffitiTag from './decor/GraffitiTag';
import './wall-system.css';
import './Homepage.css';

// Palette pairs (fill + a darker shade of the same hue for the sprayed outline -
// never black, per the project's colored-outline rule).
const PINK = { fill: '#FF2EC4', line: '#991A75' };
const CYAN = { fill: '#2EFFE0', line: '#1A9985' };
const YELLOW = { fill: '#FFE94A', line: '#B8A020' };
const ORANGE = { fill: '#FF6B3D', line: '#B83D15' };
const PURPLE = { fill: '#9A1AFF', line: '#5A0EAA' };

// Floating word tags, kept over the quiet halftone dot field. The top/left
// values are the positions they were authored at (formerly scale-graded toward a
// vanishing point); they now read as scattered tags over the dots. Deterministic.
const RECEDING_TAGS = [
  // deep background - small + faint, clustered near the vanishing point
  { word: 'RIP',  c: PURPLE, size: 20, top: 31, left: 47, rot: -6,  op: 0.12, drip: 0 },
  { word: 'POW',  c: CYAN,   size: 24, top: 27, left: 57, rot: 9,   op: 0.13, drip: 0 },
  { word: 'EZ',   c: YELLOW, size: 22, top: 37, left: 39, rot: -10, op: 0.12, drip: 0 },
  // mid distance - moderate, out toward the sides
  { word: 'BOOM', c: ORANGE, size: 38, top: 13, left: 73, rot: 7,   op: 0.18, drip: 0 },
  { word: 'FIRE', c: PURPLE, size: 44, top: 55, left: 3,  rot: -8,  op: 0.20, drip: 28 },
  { word: 'ZAP',  c: CYAN,   size: 36, top: 60, left: 87, rot: 12,  op: 0.18, drip: 0 },
  // foreground - large + stronger in the lower corners, reads IN FRONT
  { word: 'WORD', c: PINK,   size: 56, top: 71, left: 1,  rot: 6,   op: 0.28, drip: 34 },
  { word: 'GG',   c: YELLOW, size: 50, top: 75, left: 85, rot: -8,  op: 0.26, drip: 0 },
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
      <div className="homepage-stage">
        {/* Floating word tags over the quiet halftone dot field (the dot field
            itself lives on .homepage-wrap::before in Homepage.css). */}
        <div className="homepage-depth" aria-hidden="true">
          {RECEDING_TAGS.map((t, i) => (
            <GraffitiTag
              key={`tag${i}`}
              word={t.word}
              fill={t.c.fill}
              line={t.c.line}
              size={t.size}
              top={t.top}
              left={t.left}
              rotation={t.rot}
              opacity={t.op}
              drip={t.drip}
            />
          ))}
        </div>

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

        {/* TAG PANEL: a fresh dark tag sprayed under the action buttons (rough
            torn edges + texture + cast shadow, NOT a flat box) so CREATE / JOIN
            stay crisp. It's a background sibling so the torn clip never bites a
            button. */}
        <div className="homepage-bottom-bar">
          <div className="homepage-tag-panel wall-tag-panel" aria-hidden="true" />
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
