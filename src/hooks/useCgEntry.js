// useCgEntry.js — the CrazyGames zero-click entry (?cg=1) extracted from App.jsx (refactor/app-split-6).
// PURE refactor: the provision effect, the arm handler + its ready-latch effect, the cg-embed body
// class effect, and the coarse-pointer memo, all moved verbatim. Inert unless CG_ENTRY (every effect
// early-returns when the flag is off), so the default (no-flag) build is byte-for-byte unchanged.
// It fires WS SENDS (create_room/set_game_type/set_difficulty/add_bot/start_game) but never touches
// the WS drain, the functional-setView room guard, the live-`view` render, or the FIFO queue — those
// stay in useGameSocket/App. Takes the socket + room wiring; returns { handleCgArm, cgCoarse }.
import { useRef, useEffect, useCallback, useMemo } from 'react';
import { CG_ENTRY, cgRoomReady, isCoarsePointer } from '../cg/cgEntry';
import { hasPlayedBefore } from '../visitHistory';
import { resolvePlayerName } from '../playerName';
import { track } from '../lib/analytics';

export function useCgEntry({ send, wsStatus, room, playerName, setPlayerName, setLobbyMode }) {
  // Provision the solo-vs-bot room the moment the socket opens: the same
  // create_room / set_game_type / set_difficulty / add_bot frames, MINUS start_game
  // (held until the player arms). The
  // server processes them in order on this socket, so by the time the player
  // engages the room + bot are seated and start_game is instant. Fires once.
  const cgProvisionFiredRef = useRef(false);
  useEffect(() => {
    if (!CG_ENTRY) return;
    if (wsStatus !== 'open') return;
    if (cgProvisionFiredRef.current) return;
    cgProvisionFiredRef.current = true;
    const name = playerName || resolvePlayerName();
    setPlayerName(name);
    setLobbyMode('word-bomb');
    send('create_room', { name, isPublic: false });
    send('set_game_type', { gameType: 'word-bomb' });
    // Difficulty = the current menu default (first-timers get the gentler CHILL,
    // returning players CRAZY... i.e. medium).
    send('set_difficulty', { difficultyKey: hasPlayedBefore() ? 'medium' : 'chill' });
    send('add_bot', { difficulty: 'medium' });
    // setPlayerName is stable-enough; this effect fires once (guarded by the ref).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsStatus, send]);

  // The arm gesture (first keystroke on desktop / TAP TO START on mobile). Fire
  // start_game ONLY once the room + bot are provisioned; if the player armed
  // during the wake/spin-up, remember it (cgArmPendingRef) and the effect below
  // starts the instant the roster is ready. game_started then swaps us to the
  // live GameScreen (view 'game'), which mounts fresh — so the input is empty
  // when the real combo first renders (the arming key was discarded, never seeded).
  const cgArmedRef = useRef(false);
  const cgArmPendingRef = useRef(false);
  const handleCgArm = useCallback(() => {
    if (cgArmedRef.current) return;
    if (cgRoomReady(room)) {
      cgArmedRef.current = true;
      send('start_game', {});
      track('cg_direct_entry', {});
    } else {
      cgArmPendingRef.current = true;
    }
  }, [room, send]);
  useEffect(() => {
    if (!CG_ENTRY) return;
    if (cgArmedRef.current || !cgArmPendingRef.current) return;
    if (!cgRoomReady(room)) return;
    cgArmedRef.current = true;
    cgArmPendingRef.current = false;
    send('start_game', {});
    track('cg_direct_entry', {});
  }, [room, send]);

  // CrazyGames compliance (cg path only): user-select:none on the body. Scoped by
  // the html.cg-embed class (see index.css) so the default entry is untouched.
  useEffect(() => {
    if (!CG_ENTRY) return;
    document.documentElement.classList.add('cg-embed');
    return () => document.documentElement.classList.remove('cg-embed');
  }, []);

  // Touch vs mouse for the arm screen — computed once (fine=autofocus, coarse=tap).
  const cgCoarse = useMemo(() => isCoarsePointer(), []);

  return { handleCgArm, cgCoarse };
}
