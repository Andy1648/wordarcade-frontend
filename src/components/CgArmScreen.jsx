// CgArmScreen.jsx
// The ARM STATE for CrazyGames zero-click entry (?cg=1). Rendered the instant a
// cg session loads, BEFORE start_game fires, so the server's turn clock cannot
// start until the player engages (see App.jsx's cg wiring + cg/cgEntry.js).
//
// It presents the three play elements at full — the combo box (a placeholder
// until the real fragment arrives with the live round), the input, and the timer
// bar frozen at 100% — laid out identically whether or not the socket is up, so
// the WAKING overlay can appear/disappear over them with NO layout jump (spec 5).
//
// Arming:
//   • (pointer:fine) desktop — the input autofocuses on mount; the FIRST accepted
//     keystroke (a bare letter) arms. focus alone never arms; the key is discarded
//     (preventDefault) so the field is empty when the real combo renders.
//   • (pointer:coarse) mobile — a full-width 56px TAP TO START button whose
//     pointerup focuses the input SYNCHRONOUSLY inside the gesture (so iOS opens
//     the keyboard), then arms once the visualViewport resize settles (+150ms).
//
// Arming calls onArm(); App fires start_game (once the room+bot are provisioned)
// and swaps to the live GameScreen. This component owns none of the WS/game state
// — it's a cosmetic gate — so it never touches a Tier-1 handler.
import { useEffect, useRef } from 'react';
import { isArmingKey } from '../cg/cgEntry';
import './CgArmScreen.css';

export default function CgArmScreen({ wsStatus, coarse, onArm }) {
  const inputRef = useRef(null);
  const armedRef = useRef(false);
  // Live timers/listeners for the mobile arm handoff, torn down on unmount.
  const cleanupRef = useRef(null);

  // Fire the arm exactly once. Everything downstream (start_game, the view swap)
  // is App's job; here we just signal and lock so a second gesture is a no-op.
  const arm = () => {
    if (armedRef.current) return;
    armedRef.current = true;
    if (cleanupRef.current) cleanupRef.current();
    onArm();
  };

  // Desktop: drop focus into the input on mount so a keystroke starts play with
  // zero clicks. Focus does NOT arm — only a keystroke does (spec 3). On coarse
  // pointers we hold focus back so the soft keyboard doesn't spring up before the
  // player taps TAP TO START.
  useEffect(() => {
    if (!coarse && inputRef.current) inputRef.current.focus();
    return () => {
      if (cleanupRef.current) cleanupRef.current();
    };
  }, [coarse]);

  // First accepted keystroke arms (desktop, and mobile if the player taps the
  // field directly). The key is swallowed so nothing enters the field.
  const handleKeyDown = (e) => {
    if (armedRef.current) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (!isArmingKey(e.key)) return;
    e.preventDefault();
    arm();
  };

  // Mobile TAP TO START: focus SYNCHRONOUSLY inside the gesture (iOS opens the
  // keyboard only from a real user gesture), then arm once the visualViewport
  // settles after the keyboard slide (+150ms). A fallback fires if no resize
  // arrives (keyboard already up, or a device with no soft keyboard) so the
  // button always works.
  const handleTapStart = () => {
    if (armedRef.current) return;
    if (inputRef.current) inputRef.current.focus();
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    let settleTimer = null;
    let fallbackTimer = null;
    const finish = () => {
      arm(); // arm() runs cleanupRef, tearing the listeners/timers down
    };
    const onResize = () => {
      if (settleTimer) clearTimeout(settleTimer);
      settleTimer = setTimeout(finish, 150);
    };
    cleanupRef.current = () => {
      if (vv) vv.removeEventListener('resize', onResize);
      if (settleTimer) clearTimeout(settleTimer);
      if (fallbackTimer) clearTimeout(fallbackTimer);
      cleanupRef.current = null;
    };
    if (vv) vv.addEventListener('resize', onResize);
    fallbackTimer = setTimeout(finish, 600);
  };

  const waking = wsStatus !== 'open';

  return (
    <div className="cg-arm-wrap">
      <div className="cg-arm-card">
        <div className="cg-arm-title">WORD BOMB</div>
        <div className="cg-arm-sub">SOLO VS BOT</div>

        {/* Combo + input live in a positioned stack so the WAKING overlay can sit
            ON TOP of them without displacing anything (no layout jump on connect). */}
        <div className="cg-arm-stack">
          <div className="cg-arm-combo-box">
            <div className="cg-arm-combo-label">TYPE A WORD CONTAINING</div>
            <div className="cg-arm-combo">•••</div>
          </div>

          {/* Timer bar, frozen at full — the real one only moves once the round
              is live and the server clock ticks. */}
          <div className="cg-arm-timer" aria-hidden="true">
            <div className="cg-arm-timer-fill" />
          </div>

          <div className="cg-arm-input-row">
            <input
              ref={inputRef}
              className="game-input cg-arm-input"
              type="text"
              defaultValue=""
              onKeyDown={handleKeyDown}
              inputMode="text"
              aria-label="Type any letter to start"
              placeholder={coarse ? 'TAP TO START…' : 'TYPE ANY LETTER TO START'}
              maxLength={32}
              autoComplete="off"
              spellCheck="false"
            />
          </div>

          {waking && (
            <div className="cg-arm-waking" role="status">
              <span className="cg-arm-waking-dot" />
              WAKING THE SERVER…
            </div>
          )}
        </div>

        {coarse ? (
          <button
            type="button"
            className="cg-arm-tap"
            onPointerUp={handleTapStart}
          >
            TAP TO START
          </button>
        ) : (
          <div className="cg-arm-hint">first letter starts the round</div>
        )}
      </div>
    </div>
  );
}
