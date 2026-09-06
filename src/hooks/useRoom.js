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
  // Lobby life-signs block from the same `public_rooms` frame
  // ({ online, inGame, gamesInProgress, lastGameStartedAt }). null until the
  // server sends it — the FE reads it DEFENSIVELY (an older/undeployed backend
  // omits `stats`, so this stays null and the life-signs UI simply hides).
  const [publicRoomsStats, setPublicRoomsStats] = useState(null);
  // Lobby entry mode ('solo' | 'join' | a preselected game id) + whether Create defaults to PUBLIC.
  const [lobbyMode, setLobbyMode] = useState(null);
  const [lobbyPublicDefault, setLobbyPublicDefault] = useState(false);
  const [serverError, setServerError] = useState('');
  // Set when the SERVER closed our room (idle reap / contained error) — drives the ROOM CLOSED overlay.
  const [roomClosedNotice, setRoomClosedNotice] = useState(null);
  // Our own connection id (from the 'connected' frame) — used for "am I the host" checks. The ref is a
  // live mirror the drain reads for same-tick attribution (written alongside setMyId in the drain).
  const [myId, setMyId] = useState(null);
  const myIdRef = useRef(null);

  function goToLobby(mode, publicDefault = false) {
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
  const handleRefreshPublicRooms = useCallback(() => {
    send('list_public_rooms', {});
  }, [send]);

  // Join a specific public room from the browser — the SAME join-by-code path as the Join Room screen.
  function handleJoinPublicRoom(code, name) {
    setPlayerName(name);
    setServerError('');
    send('join_room', { code, name });
    track('room_joined', { mode: 'join' }); // fire-and-forget; no name/PII
  }

  // Browser empty-state "create public room": jump to the create lobby with PUBLIC pre-set.
  function handleCreatePublicFromBrowser() {
    goToLobby('solo', true);
  }

  // "START VS BOT" from the browser: the frictionless single-player-but-open loop.
  // Creates a PUBLIC Word Bomb room + seats a medium bot, then lands the host in
  // RoomScreen (via the room_update -> 'room' transition) with the bot already in
  // and START ready — while the room stays PUBLIC/joinable, so a real human can
  // drop in from the browser BEFORE the host starts. Reuses only existing server
  // frames (create_room / set_game_type / add_bot), processed in order on this
  // socket, exactly like the CrazyGames provision path. No new server messages.
  // KNOWN LIMITATION: a human can only join BEFORE start; joining mid-game is the
  // late-join case owned by feat/mp-grace (JOB 3 #5), not this flow.
  function handleStartPublicVsBot(name) {
    setPlayerName(name);
    setServerError('');
    // Lock the room into Word Bomb so RoomScreen treats it as a preselected game
    // (hides the mode picker) — the same lobbyMode contract the homepage uses.
    setLobbyMode('word-bomb');
    setLobbyPublicDefault(true);
    send('create_room', { name, isPublic: true });
    send('set_game_type', { gameType: 'word-bomb' });
    send('add_bot', { difficulty: 'medium' });
    track('room_created', { mode: 'public-vs-bot' });
  }

  function handleLeaveRoom() {
    send('leave_room', {});
    goHome();
  }

  return {
    publicRooms,
    setPublicRooms,
    publicRoomsStats,
    setPublicRoomsStats,
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
    goToLobby,
    handleOpenBrowser,
    handleRefreshPublicRooms,
    handleJoinPublicRoom,
    handleCreatePublicFromBrowser,
    handleStartPublicVsBot,
    handleLeaveRoom,
  };
}
