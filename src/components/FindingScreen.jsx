// FindingScreen.jsx
// The brief interstitial shown after tapping QUICK PLAY: we've already fired the
// `quick_play` message and are waiting for the server to drop us into a room
// (the room_update handler in App flips the view to 'room' the moment it lands).
// This screen is purely presentational - it never sends anything. If the server
// bounces the request (rate limited / at capacity), `error` is shown with a way
// back out so the player is never stranded on a spinner.
import { useSound } from '../contexts/SoundContext';
import './FindingScreen.css';

export default function FindingScreen({ error, onBack }) {
  const { sound } = useSound();

  return (
    <div className="finding-wrap">
      <div className="finding-box">
        {error ? (
          <>
            <div className="finding-title finding-title-error">NO LUCK</div>
            <div className="finding-error" role="alert">{error}</div>
            <button
              className="finding-back-btn"
              onClick={() => {
                sound.click();
                onBack();
              }}
            >
              ← BACK
            </button>
          </>
        ) : (
          <>
            {/* Three bouncing bomb dots = the "searching" pulse. */}
            <div className="finding-dots" aria-hidden="true">
              <span>●</span><span>●</span><span>●</span>
            </div>
            <div className="finding-title">FINDING A GAME…</div>
            <div className="finding-sub">DROPPING YOU INTO THE NEAREST LOBBY</div>
          </>
        )}
      </div>
    </div>
  );
}
