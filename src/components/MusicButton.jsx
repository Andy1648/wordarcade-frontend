// MusicButton.jsx
// The persistent background-music mute toggle. Lives in App (not per-screen) so
// it sits in the bottom-right corner across every view. Shows a music note,
// struck through when muted. The border colour is the current screen's accent.
import './MusicButton.css';

export default function MusicButton({ isMuted, onToggle, accent = '#FF2EC4' }) {
  return (
    <button
      className={`music-btn${isMuted ? ' muted' : ''}`}
      style={{ borderColor: accent, color: accent }}
      onClick={onToggle}
      title={isMuted ? 'Unmute music' : 'Mute music'}
      aria-label={isMuted ? 'Unmute music' : 'Mute music'}
    >
      ♫
    </button>
  );
}
