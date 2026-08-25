// OverlaySkeleton.jsx — the panel CHROME shown while a lazy overlay chunk (Stats/Shop) is
// still downloading, so an open never flashes an empty box. Same panel shell as the real
// overlays (dark #1a0b2e panel, thick black border, hard offset shadow) with a title and a
// few placeholder rows. Static + aria-busy; no data, no interactivity.
import './OverlaySkeleton.css';

export default function OverlaySkeleton({ title = '' }) {
  return (
    <div className="ovsk-overlay" role="status" aria-busy="true" aria-label={`Loading ${title}`}>
      <div className="ovsk-panel">
        <div className="ovsk-title">{title}</div>
        <div className="ovsk-rows">
          {Array.from({ length: 6 }, (_, i) => (
            <div className="ovsk-row" key={i}>
              <span className="ovsk-bar ovsk-bar-k" />
              <span className="ovsk-bar ovsk-bar-v" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
