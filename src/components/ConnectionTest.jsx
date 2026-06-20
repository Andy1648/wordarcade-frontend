// ConnectionTest.jsx
// TEMPORARY debug screen - not part of the real app flow. Exists only to
// prove the WebSocket connection to the backend actually works before
// wiring it into LobbyScreen in the next piece. Safe to delete once
// that's confirmed.

import { useWebSocket } from '../hooks/useWebSocket';

const STATUS_COLORS = {
  connecting: '#FFE94A',
  open: '#2EFFE0',
  closed: '#888',
  error: '#FF5C5C',
};

export default function ConnectionTest() {
  const { status, lastMessage, error, send } = useWebSocket();

  function handlePing() {
    // create_room is a real message type the backend understands - using
    // it here both tests sending AND lets us see a real response come back
    // (room_created), which proves the full round trip works, not just
    // that the socket opened.
    send('create_room', { name: 'TestPlayer' });
  }

  return (
    <div
      style={{
        fontFamily: 'monospace',
        background: '#1a0b2e',
        color: '#fff',
        padding: 24,
        minHeight: '100vh',
      }}
    >
      <h2 style={{ color: '#FF2EC4' }}>WebSocket Connection Test</h2>

      <p>
        Status:{' '}
        <strong style={{ color: STATUS_COLORS[status] || '#fff' }}>{status}</strong>
      </p>

      {error && <p style={{ color: '#FF5C5C' }}>Error event fired - check browser console for details.</p>}

      <button
        onClick={handlePing}
        disabled={status !== 'open'}
        style={{
          padding: '10px 20px',
          fontFamily: 'monospace',
          fontWeight: 'bold',
          cursor: status === 'open' ? 'pointer' : 'not-allowed',
          marginBottom: 20,
        }}
      >
        Send test "create_room" message
      </button>

      <div>
        <p>Last message received from server:</p>
        <pre
          style={{
            background: '#0d0618',
            padding: 16,
            borderRadius: 4,
            border: '2px solid #2EFFE0',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}
        >
          {lastMessage ? JSON.stringify(lastMessage, null, 2) : '(nothing received yet)'}
        </pre>
      </div>
    </div>
  );
}