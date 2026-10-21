// useClassRoom.js — FRENCH RUSH CLASS ROOM's connection to the backend (chain-reaction-backend
// classRoom.js). Mounted ONLY while the player is in the class flow, so solo study never opens a socket.
//
// The server sends a full SNAPSHOT per recipient (class_state) on every change; this hook keeps the
// latest one and the screens render straight off it — there is no lagging copy of "where the class
// is". The rows ride only the first snapshot after a join/rejoin, so they are kept separately.
//
// FIFO: useWebSocket buffers every frame in a queue; the effect below drains ALL of them in arrival
// order and then consumes exactly that many (the documented trap — never read only the latest frame).
//
// RECONNECT: the socket reconnects on its own (useWebSocket's backoff). Every time it (re)opens while
// we hold a class seat, we send class_rejoin with our token and the server re-binds the seat and
// replies with a fresh snapshot. The seat lives in sessionStorage (per tab) — and, for the teacher,
// in localStorage too, so a reload or a laptop waking from sleep gets the console back.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useWebSocket } from '../../hooks/useWebSocket';

const SEAT_KEY = 'fr.class.seat'; // { code, token, role }
const TAB_KEY = 'fr.class.tab'; // this tab's student token

function store(kind) {
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}
function readSeat() {
  for (const kind of ['session', 'local']) {
    try {
      const raw = store(kind) && store(kind).getItem(SEAT_KEY);
      const seat = raw ? JSON.parse(raw) : null;
      if (seat && seat.code && seat.token && (kind === 'session' || seat.role === 'host')) return seat;
    } catch {
      /* a bad blob is no seat */
    }
  }
  return null;
}
function writeSeat(seat) {
  for (const kind of ['session', 'local']) {
    try {
      const s = store(kind);
      if (!s) continue;
      if (seat && (kind === 'session' || seat.role === 'host')) s.setItem(SEAT_KEY, JSON.stringify(seat));
      else s.removeItem(SEAT_KEY);
    } catch {
      /* storage blocked: the seat lasts as long as the socket */
    }
  }
}
function tabToken() {
  const s = store('session');
  try {
    const have = s && s.getItem(TAB_KEY);
    if (have) return have;
  } catch {
    /* fall through */
  }
  const bytes = new Uint8Array(12);
  (window.crypto || {}).getRandomValues ? window.crypto.getRandomValues(bytes) : bytes.forEach((_, i) => (bytes[i] = Math.floor(Math.random() * 256)));
  const tok = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  try {
    if (s) s.setItem(TAB_KEY, tok);
  } catch {
    /* fine */
  }
  return tok;
}

/** Is there a class seat to get back to (a reload mid-class)? Read once, before mounting. */
export function hasClassSeat() {
  return !!readSeat();
}

export function useClassRoom() {
  const { status, messages, consumeMessages, send } = useWebSocket();
  const [snap, setSnap] = useState(null); // the latest class_state (rows merged in)
  const [tally, setTally] = useState(null); // host: the live class_tally for the current word
  const [error, setError] = useState(null); // { code, message, context }
  const [closed, setClosed] = useState(null); // reason, once the class is over for us
  const rowsRef = useRef(null);
  const seatRef = useRef(readSeat());
  const [hasSeat, setHasSeat] = useState(!!seatRef.current);

  // Drain the FIFO queue: every frame, in order, then consume exactly what was processed.
  useEffect(() => {
    if (!messages.length) return;
    const batch = messages;
    for (const msg of batch) {
      const p = (msg && msg.payload) || {};
      switch (msg && msg.type) {
        case 'class_created': {
          seatRef.current = { code: p.code, token: p.hostToken, role: 'host' };
          writeSeat(seatRef.current);
          setHasSeat(true);
          setClosed(null);
          setError(null);
          break;
        }
        case 'class_joined': {
          setClosed(null);
          setError(null);
          break;
        }
        case 'class_state': {
          if (Array.isArray(p.rows)) rowsRef.current = p.rows;
          const rows = rowsRef.current;
          setSnap(() => ({ ...p, rows }));
          if (p.tally) setTally(p.tally);
          else if (p.phase !== 'word' && p.phase !== 'review') setTally(null);
          break;
        }
        case 'class_tally': {
          setTally((prev) => (prev && prev.index > p.index ? prev : p));
          break;
        }
        case 'class_closed': {
          seatRef.current = null;
          writeSeat(null);
          setHasSeat(false);
          setClosed(p.reason || 'ended');
          break;
        }
        case 'class_error': {
          // A failed rejoin means the seat is gone (class closed, or we were away too long).
          if (p.code === 'class_rejoin_failed' || p.code === 'class_kicked') {
            seatRef.current = null;
            writeSeat(null);
            setHasSeat(false);
            setSnap(null);
            rowsRef.current = null;
          }
          setError(p);
          break;
        }
        default:
          break;
      }
    }
    consumeMessages(batch.length);
  }, [messages, consumeMessages]);

  // Every (re)open with a seat → rejoin it.
  useEffect(() => {
    if (status !== 'open') return;
    const seat = seatRef.current;
    if (seat) send('class_rejoin', { code: seat.code, token: seat.token });
  }, [status, send]);

  const create = useCallback(
    ({ set, rows, name }) => {
      setError(null);
      setClosed(null);
      rowsRef.current = null;
      send('class_create', { name, set, rows });
    },
    [send]
  );

  const join = useCallback(
    ({ code, name }) => {
      const token = tabToken();
      const clean = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      seatRef.current = { code: clean, token, role: 'student' };
      writeSeat(seatRef.current);
      setHasSeat(true);
      setError(null);
      setClosed(null);
      rowsRef.current = null;
      send('class_join', { code: clean, name, token });
    },
    [send]
  );

  const leave = useCallback(() => {
    // class_leave: a student gives up the seat; the teacher closes the class for everyone
    if (seatRef.current) send('class_leave', {});
    seatRef.current = null;
    writeSeat(null);
    setHasSeat(false);
    setSnap(null);
    setTally(null);
    rowsRef.current = null;
  }, [send]);

  const host = {
    start: useCallback(() => send('class_start', {}), [send]),
    reveal: useCallback(() => send('class_reveal', {}), [send]),
    next: useCallback(() => send('class_next', {}), [send]),
    end: useCallback(() => send('class_end', {}), [send]),
    kick: useCallback((studentId) => send('class_kick', { studentId }), [send]),
    // a new set in the same class (replay the missed words, or a fresh set): students keep their seats
    restart: useCallback(({ set, rows }) => send('class_restart', { set, rows }), [send]),
  };

  const result = useCallback((index, outcome, hints) => send('class_result', { index, outcome, hints }), [send]);

  return { status, snap, tally, error, closed, hasSeat, create, join, leave, host, result, clearError: () => setError(null) };
}
