// useWebSocket.js
import { useEffect, useRef, useState, useCallback } from 'react';
import { BACKEND_WS_URL } from '../config';

/**
 * Opens and manages a single WebSocket connection to the Chain Reaction
 * backend for the lifetime of the component that uses this hook.
 *
 * This is intentionally minimal for this first piece - it proves the
 * connection itself works (status tracking, sending, receiving) without
 * any game-specific logic layered on top. Room/game message handling
 * gets built in the next piece, on top of this.
 *
 * Returns:
 *   status       - 'connecting' | 'open' | 'closed' | 'error'
 *   lastMessage  - the most recently received parsed message ({ type, payload }),
 *                  or null if nothing has been received yet
 *   send(type, payload) - sends a { type, payload } message to the server.
 *                  No-ops (and logs a warning) if the socket isn't open,
 *                  rather than throwing, since UI code calling this
 *                  shouldn't have to wrap every call in a try/catch.
 *   error        - the most recent error event, if any
 */
export function useWebSocket() {
  const [status, setStatus] = useState('connecting');
  const [lastMessage, setLastMessage] = useState(null);
  const [error, setError] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    const socket = new WebSocket(BACKEND_WS_URL);
    socketRef.current = socket;

    socket.onopen = () => {
      setStatus('open');
      setError(null);
    };

    socket.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        setLastMessage(parsed);
      } catch (parseError) {
        // A malformed message from the server shouldn't crash the UI -
        // log it so it's visible during development and move on.
        console.error('Received malformed WebSocket message:', event.data, parseError);
      }
    };

    socket.onerror = (event) => {
      setStatus('error');
      setError(event);
    };

    socket.onclose = () => {
      setStatus('closed');
    };

    // Cleanup: close the socket when the component using this hook
    // unmounts, so we never leak an open connection after navigating away.
    return () => {
      socket.close();
    };
  }, []);

  const send = useCallback((type, payload) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      console.warn(`Cannot send "${type}" - socket is not open (current state: ${socket?.readyState}).`);
      return;
    }
    socket.send(JSON.stringify({ type, payload }));
  }, []);

  return { status, lastMessage, error, send };
}