// Homepage.jsx — Flat-Pop / Sticker-Bomb direction.
// Layered, slightly-rotated die-cut stickers (Sticker primitive) on a FLAT palette
// field. All menu LOGIC is unchanged from the previous direction: the CREATE/JOIN/
// mode-select handlers, their bespoke juice (data-juice-self stays), and routing.
import { useEffect, useState } from 'react';
import { GAMES } from '../gameData';
import { useSound } from '../contexts/SoundContext';
import { squash, flash, burst, sfx, setMuted as setJuiceMuted } from '../juice';
import GameCard from './GameCard';
import Sticker from './Sticker';
import './Homepage.css';

// Decorative "sticker-bomb" scatter: small flat word-stickers slapped around the
// field BEHIND the content. Organized density — faint + clipped so the interactive
// stickers stay the focus and every label stays legible (outlines do the
// separating). Each reuses the Sticker primitive, just decorative (no handlers).
const SCATTER = [
  { t: 'POW', cls: 'hp-scatter-1', color: '#FFE94A', rot: -13 },
  { t: 'GG', cls: 'hp-scatter-2', color: '#2EFFE0', rot: 12 },
  { t: 'BOOM', cls: 'hp-scatter-3', color: '#FF6B3D', rot: -7 },
  { t: 'WOW', cls: 'hp-scatter-4', color: '#9A1AFF', rot: 10 },
  { t: 'ZAP', cls: 'hp-scatter-5', color: '#FF2EC4', rot: -17 },
  { t: 'NICE', cls: 'hp-scatter-6', color: '#2EFFE0', rot: 9 },
  { t: 'EPIC', cls: 'hp-scatter-7', color: '#FFE94A', rot: 15 },
  { t: 'OOF', cls: 'hp-scatter-8', color: '#FF6B3D', rot: -10 },
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
        {/* Flat-pop sticker-bomb scatter behind the content (decorative + faint). */}
        <div className="homepage-scatter" aria-hidden="true">
          {SCATTER.map((s) => (
            <Sticker key={s.cls} className={`hp-scatter ${s.cls}`} color={s.color} rotate={s.rot}>
              {s.t}
            </Sticker>
          ))}
        </div>

        {/* Title: the wordmark as a die-cut sticker word. data-text drives the
            beat-synced RGB-split (kept from before — it's juice, not decoration). */}
        <div className="homepage-logo-wrap">
          <div
            className="homepage-logo"
            data-text={'TYPE A WORD'}
            role="img"
            aria-label="Type a Word"
          >
            {'TYPE A WORD'}
          </div>
        </div>

        {/* Tagline sticker. */}
        <Sticker className="homepage-tagline sticker--cyan" rotate={-3}>
          INSERT BRAIN TO CONTINUE
        </Sticker>

        <div className="homepage-section-label">// SELECT YOUR GAME //</div>

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

        {/* CREATE / JOIN as interactive stickers. Logic + bespoke juice unchanged:
            the handlers, data-juice-self (so the global press-juice skips them and
            their richer pressJuice runs), onMouseEnter hover sfx, and disabled
            state all pass straight through the Sticker primitive. */}
        <div className="homepage-bottom-bar">
          <Sticker
            as="button"
            className={`homepage-btn sticker--btn sticker--pink${navigating ? ' disabled' : ''}`}
            rotate={-2}
            onClick={handleCreateRoom}
            onMouseEnter={() => sfx('hover')}
            disabled={navigating}
            data-juice-self
          >
            CREATE ROOM
          </Sticker>
          <Sticker
            as="button"
            className={`homepage-btn sticker--btn sticker--cyan${navigating ? ' disabled' : ''}`}
            rotate={2}
            onClick={handleJoinRoom}
            onMouseEnter={() => sfx('hover')}
            disabled={navigating}
            data-juice-self
          >
            JOIN ROOM
          </Sticker>
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
