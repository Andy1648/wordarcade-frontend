// DeepLandScreen.jsx
// The boot state for a ROOM-MODE deep link (/word-bomb/play, /category-blitz/play).
//
// WHY IT EXISTS: CHAIN, FUSE and SAT RUSH are solo — a deep link opens the mode on mount, with no
// socket to wait for. Word Bomb and Category Blitz need a ROOM and an OPPONENT before there is
// anything to land in, and provisioning those takes a socket round-trip (longer on a cold Render
// dyno). Without this screen a deep-link visitor would sit on the MENU while that happened, which is
// precisely the failure this whole branch is fixing: the mode they asked for, behind the front door
// they did not ask for.
//
// So the wait has its own screen that says the mode's name and what is happening. It is COSMETIC —
// it owns no WebSocket, room or game state (App does all of that, reusing the four frames the
// CrazyGames zero-click entry already uses) and it is replaced by the live GameScreen the moment
// game_started lands. It never gates, delays or blocks which screen is shown.
//
// IT MUST NOT BE A DEAD END. Two ways this screen could strand a stranger forever, both real:
//   • the server answers with an `error` frame (create_room / add_bot failed) — App records it in
//     `serverError` and nothing here would have shown it;
//   • the socket drops mid-provision. Auto-reconnect opens a NEW connection that is in no room, and
//     the provisioning once-ref means it is never re-sent, so the screen waits on a room that will
//     never exist.
// Neither is hypothetical on a cold Render dyno with a phone that backgrounds. So this screen owns
// its own DEADLINE: if the game has not started by then, it stops pretending and offers TRY AGAIN
// (a reload, which re-runs the whole deep link cleanly) and the way out. The ← MENU exit is here for
// the same reason it is in the solo modes: a stranger who arrived on a link and changed their mind
// must have a labelled, >=44x44 way out at every step.
import { useEffect, useState } from 'react';
import ConnectingContent from './ConnectingContent';
import './DeepLandScreen.css';

// After this long still waiting on the socket, say WAKING THE SERVER… instead of CONNECTING… —
// a cold Render dyno takes ~30s and silence reads as a dead link. Same two-phase hint the menu's
// CTAs use (Homepage.jsx coldStartHintMs); owned here so this screen needs nothing from App.
const COLD_START_HINT_MS = 2500;

// The deadline. Comfortably past a cold Render start (~30s, the figure the menu's own copy quotes)
// so a slow-but-working boot is never interrupted, and short enough that a genuinely stuck session
// gets a way forward rather than an indefinite wait.
const STALL_MS = 40000;

// Display name + accent per mode, matching each card on the menu.
const MODES = {
  'word-bomb': { name: 'WORD BOMB', accent: '#FF4FA3' },
  'category-blitz': { name: 'CATEGORY BLITZ', accent: '#2EFFE0' },
};

export default function DeepLandScreen({ mode, wsStatus, serverError, onExit }) {
  const meta = MODES[mode] || MODES['word-bomb'];
  const [coldStart, setColdStart] = useState(false);
  const [stalled, setStalled] = useState(false);
  useEffect(() => {
    const cold = setTimeout(() => setColdStart(true), COLD_START_HINT_MS);
    const stall = setTimeout(() => setStalled(true), STALL_MS);
    return () => {
      clearTimeout(cold);
      clearTimeout(stall);
    };
  }, []);

  // Failed = the server said no, or we ran out of patience. Either way the honest thing is to stop
  // claiming a game is coming and hand back the two controls that can actually resolve it.
  const failed = !!serverError || stalled;
  // Two honest waiting states, and they are genuinely different waits: the socket is still coming
  // up (possibly a cold server), or it is up and we are seating the room + bot.
  const connecting = wsStatus !== 'open';

  return (
    <div className="deepland" style={{ '--deepland-accent': meta.accent }}>
      <button type="button" className="deepland-exit" onClick={onExit}>
        <span className="deepland-exit-arrow" aria-hidden="true">←</span>
        <span className="deepland-exit-label">MENU</span>
      </button>

      <div className="deepland-card">
        <p className="deepland-kicker">{failed ? "COULDN'T START" : 'STARTING'}</p>
        <h1 className="deepland-title">{meta.name}</h1>
        {failed ? (
          <>
            <p className="deepland-sub deepland-sub-failed" role="alert">
              {serverError || 'THE SERVER DIDN’T ANSWER.'}
            </p>
            <button
              type="button"
              className="deepland-retry"
              onClick={() => window.location.reload()}
            >
              TRY AGAIN
            </button>
          </>
        ) : (
          <p className="deepland-sub" aria-live="polite">
            {connecting ? <ConnectingContent cold={!!coldStart} /> : 'SEATING YOUR OPPONENT…'}
          </p>
        )}
      </div>
    </div>
  );
}
