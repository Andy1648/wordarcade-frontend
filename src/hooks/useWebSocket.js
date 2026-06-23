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
 *   messages     - a FIFO queue of every parsed message received but not yet
 *                  consumed. Frames are APPENDED (never overwritten), so two that
 *                  arrive in the same tick can't collapse into one - the consumer
 *                  drains them in order and calls consumeMessages().
 *   consumeMessages(count) - drop the first `count` (already-processed) frames
 *                  from the queue. Uses a functional update so frames that landed
 *                  after the consumer's snapshot are preserved, never skipped.
 *   lastMessage  - shim: the most recently received frame (or null). Kept for any
 *                  consumer that only wants the latest; the queue is authoritative.
 *   send(type, payload) - sends a { type, payload } message to the server.
 *                  No-ops (and logs a warning) if the socket isn't open,
 *                  rather than throwing, since UI code calling this
 *                  shouldn't have to wrap every call in a try/catch.
 *   error        - the most recent error event, if any
 */
export function useWebSocket() {
  const [status, setStatus] = useState('connecting');
  // FIFO queue of received-but-unconsumed frames (see consumeMessages). A queue,
  // not a single slot, so batched/same-tick delivery can never drop a frame.
  const [messages, setMessages] = useState([]);
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
        // Append to the queue (functional update) so a burst of frames in one
        // tick all survive instead of the last clobbering the rest.
        setMessages((prev) => [...prev, parsed]);
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

  // Drop the first `count` already-processed frames. Functional update so any
  // frames appended after the consumer snapshotted the queue are kept (never
  // skipped); clearing the whole queue is just the count >= length case.
  const consumeMessages = useCallback((count) => {
    if (!count) return;
    setMessages((prev) => (count >= prev.length ? [] : prev.slice(count)));
  }, []);

  // Shim for any consumer that only wants the latest frame; the queue remains
  // the source of truth for ordered, lossless processing.
  const lastMessage = messages.length ? messages[messages.length - 1] : null;

  return { status, messages, consumeMessages, lastMessage, error, send };
}