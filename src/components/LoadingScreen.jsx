// LoadingScreen.jsx
// The pre-connection gate shown before the WebSocket is open. While connecting it
// shows an animated "CONNECTING..." wave (reusing WaveText's per-letter bounce);
// on a failed/closed connection it shows "CONNECTION FAILED" with a RETRY button.
import WaveText from './WaveText';
import './LoadingScreen.css';

export default function LoadingScreen({ status, onRetry }) {
  const failed = status === 'error' || status === 'closed';
  return (
    <div className="loading-wrap">
      <div className="loading-box">
        {failed ? (
          <>
            <div className="loading-failed">CONNECTION FAILED</div>
            <button className="loading-retry" onClick={onRetry}>
              RETRY
            </button>
          </>
        ) : (
          <div className="loading-text">
            <WaveText text="CONNECTING..." />
          </div>
        )}
      </div>
    </div>
  );
}
