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
 *
 * Reconnect: on an unexpected close/error the hook re-opens the socket with
 * exponential backoff (1s -> 2s -> 4s, cap 8s, small jitter), rewiring the same
 * handlers. The OPTIONAL `canReconnectRef` lets the caller gate this: while
 * `canReconnectRef.current === false` the hook does NOT open a new socket - it
 * leaves status 'closed'/'error' for the caller to surface and just re-checks
 * shortly, so it reconnects on its own the instant reconnect is re-allowed.
 * This matters because the backend treats each connection as a fresh player
 * (new id, no resume): silently reconnecting mid room/game would NOT restore the
 * lost seat, so the app blocks reconnect while in an active room/game. When the
 * ref is absent, reconnect is always allowed (e.g. boot / menu).
 */
export function useWebSocket(canReconnectRef) {
  const [status, setStatus] = useState('connecting');
  // FIFO queue of received-but-unconsumed frames (see consumeMessages). A queue,
  // not a single slot, so batched/same-tick delivery can never drop a frame.
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState(null);
  const socketRef = useRef(null);
  // Reconnect bookkeeping. `attemptRef` drives the backoff (reset on a healthy
  // open); `timerRef` holds the single pending (re)connect/poll timer;
  // `unmountedRef` flips true on teardown so a cleanup close never reconnects.
  const timerRef = useRef(null);
  const attemptRef = useRef(0);
  const unmountedRef = useRef(false);

  useEffect(() => {
    unmountedRef.current = false;

    // Reconnect is allowed unless the caller's ref explicitly forbids it.
    const reconnectAllowed = () =>
      !canReconnectRef || canReconnectRef.current !== false;

    const clearTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    // Schedule the next (re)connect. While reconnect is currently disallowed we
    // do NOT open a socket - we just re-poll, so the connection comes back on
    // its own the instant the caller re-allows it (status meanwhile stays
    // 'closed'/'error', set by the close/error handlers, for the caller to show).
    const scheduleReconnect = () => {
      if (unmountedRef.current) return;
      clearTimer();
      if (!reconnectAllowed()) {
        timerRef.current = setTimeout(scheduleReconnect, 500);
        return;
      }
      const n = attemptRef.current;
      const base = Math.min(8000, 1000 * 2 ** n); // 1s -> 2s -> 4s -> cap 8s
      const delay = base + Math.floor(Math.random() * 250); // small jitter
      attemptRef.current = n + 1;
      setStatus('connecting');
      timerRef.current = setTimeout(connect, delay);
    };

    function connect() {
      if (unmountedRef.current) return;
      // Re-check at the moment of opening (not just when scheduled): if the app
      // entered a session during the backoff delay, don't open - poll instead.
      // This makes "never reconnect while in an active session" hold regardless
      // of timing.
      if (!reconnectAllowed()) {
        scheduleReconnect();
        return;
      }
      const socket = new WebSocket(BACKEND_WS_URL);
      socketRef.current = socket;

      // `socketRef.current !== socket` means a newer socket has superseded this
      // one (a reconnect, or a StrictMode remount); its late events are stale, so
      // ignore them - never let an abandoned socket drive status or reconnects.
      const isCurrent = () => socketRef.current === socket;

      socket.onopen = () => {
        if (!isCurrent()) return;
        attemptRef.current = 0; // healthy connection - reset the backoff
        setStatus('open');
        setError(null);
      };

      socket.onmessage = (event) => {
        if (!isCurrent()) return;
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
        if (!isCurrent()) return;
        setError(event);
        if (unmountedRef.current) return;
        // Only surface 'error' when we won't immediately retry; when reconnect is
        // allowed we go straight to 'connecting' (no error flash during boot).
        if (!reconnectAllowed()) setStatus('error');
        scheduleReconnect();
      };

      socket.onclose = () => {
        if (!isCurrent() || unmountedRef.current) return;
        if (!reconnectAllowed()) setStatus('closed');
        scheduleReconnect();
      };
    }

    connect();

    // Cleanup: close the socket and cancel any pending reconnect when the
    // component using this hook unmounts, so we never leak a connection or
    // resurrect one after navigating away.
    return () => {
      unmountedRef.current = true;
      clearTimer();
      if (socketRef.current) socketRef.current.close();
    };
    // canReconnectRef is a stable ref; the socket is managed for the hook's
    // whole lifetime (reconnects are internal), so this runs once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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