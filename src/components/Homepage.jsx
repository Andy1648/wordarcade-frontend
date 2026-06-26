// Homepage.jsx
import { useEffect, useRef, useState } from 'react';
import { GAMES } from '../gameData';
import { useSound } from '../contexts/SoundContext';
import { squash, flash, burst, sfx, setMuted as setJuiceMuted } from '../juice';
import GameCard from './GameCard';
import './wall-system.css';
import './Homepage.css';

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

  // Cursor-parallax for the dim background shapes. The pointer sets a target
  // offset (-1..1 from screen centre); a rAF loop LERPS the live value toward it
  // each frame (never snaps) and writes --px/--py on the wrap. Each shape in CSS
  // multiplies those by its own depth factor, so nearer layers travel more. When
  // the cursor is still the target stops changing and the lerp settles, so the
  // field reads clean. Disabled entirely under reduced-motion.
  const wrapRef = useRef(null);
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const target = { x: 0, y: 0 };
    const cur = { x: 0, y: 0 };
    let raf = 0;
    const onMove = (e) => {
      target.x = (e.clientX / window.innerWidth) * 2 - 1;
      target.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    const tick = () => {
      cur.x += (target.x - cur.x) * 0.06; // lerp factor = smooth settle
      cur.y += (target.y - cur.y) * 0.06;
      wrap.style.setProperty('--px', cur.x.toFixed(4));
      wrap.style.setProperty('--py', cur.y.toFixed(4));
      raf = requestAnimationFrame(tick);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

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
    <div className="homepage-wrap" ref={wrapRef}>
      {/* Dim cursor-parallax depth shapes (behind everything). Near-invisible at
          rest; they drift as the pointer moves (rAF-lerped --px/--py from the
          effect above), nearer layers travelling more. Decorative, inert. */}
      <div className="homepage-parallax" aria-hidden="true">
        <span className="hp-shape hp-shape-1" />
        <span className="hp-shape hp-shape-2" />
        <span className="hp-shape hp-shape-3" />
      </div>
      <div className="homepage-stage">
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
