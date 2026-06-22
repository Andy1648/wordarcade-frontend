// CreditsScreen.jsx
// A standalone credits / attribution page reached from the homepage. For now it
// just carries the background-music attribution (required by CC BY-SA 4.0), but
// it's the place to list any future third-party assets too.
import './CreditsScreen.css';

export default function CreditsScreen({ onBack }) {
  return (
    <div className="credits-wrap">
      <div className="credits-box">
        <button className="credits-back-btn" onClick={onBack}>
          ← BACK
        </button>

        <div className="credits-title">CREDITS</div>

        <div className="credits-section">
          <div className="credits-section-label">// CREATED BY //</div>
          <div className="credits-creator">NOBUFFCOOKIES</div>
          <div className="credits-creator-name">Andy Wang</div>
        </div>

        <div className="credits-section">
          <div className="credits-section-label">// MUSIC //</div>
          <a
            className="credits-link"
            href="https://www.youtube.com/watch?v=ulfoU2MziOc"
            target="_blank"
            rel="noopener noreferrer"
          >
            LEMMiNO — Firecracker
          </a>
          <div className="credits-detail">CC BY-SA 4.0</div>
        </div>
      </div>
    </div>
  );
}
