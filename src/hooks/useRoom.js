// useRoom.js — the room/lobby concern extracted from App.jsx (refactor/app-split step 2).
// PURE refactor: state slices + handlers moved verbatim. App still owns `room` (read by the
// playerColors memo BEFORE this hook's call site), `serverEventId` (feeds the one-shot guards
// declared before this hook) and `linkJoinPending` (coupled to App's LAUNCH_INTENT); everything
// else room-shaped lives here. The WS drain (still in App until step 4) calls the returned setters
// and writes the returned myIdRef — unchanged. Receives send/setView/setPlayerName/goHome.
import { useState, useRef, useCallback } from 'react';
import { track } from '../lib/analytics';

export function useRoom({ send, setView, setPlayerName, goHome }) {
  // Public-room browser list (from `public_rooms`).
  const [publicRooms, setPublicRooms] = useState([]);
  // Lobby entry mode ('solo' | 'join' | a preselected game id) + whether Create defaults to PUBLIC.
  const [lobbyMode, setLobbyMode] = useState(null);
  const [lobbyPublicDefault, setLobbyPublicDefault] = useState(true);
  const [serverError, setServerError] = useState('');
  // Set when the SERVER closed our room (idle reap / contained error) — drives the ROOM CLOSED overlay.
  const [roomClosedNotice, setRoomClosedNotice] = useState(null);
  // Our own connection id (from the 'connected' frame) — used for "am I the host" checks. The ref is a
  // live mirror the drain reads for same-tick attribution (written alongside setMyId in the drain).
  const [myId, setMyId] = useState(null);
  const myIdRef = useRef(null);
  // SPECTATE (nov4): the live public game we are WATCHING ({ code, name }) or null. A watcher is never a player: the
  // server keeps it out of the room's players and refuses its game actions. The ref is the drain's live copy.
  const [watching, setWatching] = useState(null);
  const watchingRef = useRef(null);

  // PUBLIC by default (Andy nov6 "lobbies should feel alive"): lobby bots only join a public room, and the toggle sat on
  // PRIVATE, so a player who just clicked through waited alone. PRIVATE stays one tap away.
  function goToLobby(mode, publicDefault = true) {
    setLobbyMode(mode);
    setLobbyPublicDefault(publicDefault);
    setServerError('');
    setView('lobby');
  }

  // Open the unified JOIN ROOM screen (code entry + public-room list). Clear any stale list so we
  // don't flash an old snapshot; the screen's mount effect immediately re-requests a fresh one.
  function handleOpenBrowser() {
    setServerError('');
    setPublicRooms([]);
    setView('browse');
  }

  // (Re)request the public-room list. Stable so the browser screen can call it on mount + on its
  // auto-refresh interval without re-subscribing every render.
  // withLive: live public games stay listed as 'playing' (SPECTATE); an older server ignores the flag.
  const handleRefreshPublicRooms = useCallback(() => {
    send('list_public_rooms', { withLive: true });
  }, [send]);

  // Join a specific public room from the browser — the SAME join-by-code path as the Join Room screen.
  function handleJoinPublicRoom(code, name) {
    setPlayerName(name);
    setServerError('');
    send('join_room', { code, name });
    track('room_joined', { mode: 'join' }); // fire-and-forget; no name/PII
  }

  // SPECTATE a live public game from the browser / the menu panel. The server answers room_spectating, the roster,
  // a watchOnly game_started and a snapshot - App's drain turns those into the read-only game view.
  function handleWatchPublicRoom(code, name) {
    setPlayerName(name);
    setServerError('');
    watchingRef.current = { code, name }; // the name re-used to take a seat on a rematch; `watching` is set on room_spectating
    send('spectate_room', { code, name });
    track('room_watched', {}); // fire-and-forget; no name/PII
  }

  // Browser empty-state "create public room": jump to the create lobby with PUBLIC pre-set.
  function handleCreatePublicFromBrowser() {
    goToLobby('solo', true);
  }

  function handleLeaveRoom() {
    if (watchingRef.current) {
      // a watcher holds no seat: leave_room would be a no-op, stop_spectating drops it from the audience
      send('stop_spectating', {});
      watchingRef.current = null;
      setWatching(null);
    } else {
      send('leave_room', {});
    }
    goHome();
  }

  return {
    publicRooms,
    setPublicRooms,
    lobbyMode,
    setLobbyMode,
    lobbyPublicDefault,
    setLobbyPublicDefault,
    serverError,
    setServerError,
    roomClosedNotice,
    setRoomClosedNotice,
    myId,
    setMyId,
    myIdRef,
    watching,
    setWatching,
    watchingRef,
    goToLobby,
    handleOpenBrowser,
    handleRefreshPublicRooms,
    handleJoinPublicRoom,
    handleWatchPublicRoom,
    handleCreatePublicFromBrowser,
    handleLeaveRoom,
  };
}
