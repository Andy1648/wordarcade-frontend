// WordRaceLobby.jsx — the waiting room for a WORD RACE room. Two shapes of the same screen:
//   QUICK MATCH  the server launches it (full, or 10s after it opened). Shows who's in and the
//                bot-fill countdown; nobody has to press START.
//   PRIVATE      share the code; the host adds bots (up to 5 racers) and starts. Under 2 humans at
//                the start, the server tops the grid up to 3 with bots.
import { useEffect, useState } from 'react';
import LayeredWord from '../components/LayeredWord';
import Mascot from '../components/Mascot';
import './WordRace.css';

const MAX_RACERS = 5;

export default function WordRaceLobby({
  room,
  myId,
  race,
  audioSlot,
  serverError,
  startPending,
  botPending,
  onStart,
  onAddBot,
  onLeave,
}) {
  const isHost = room.hostId === myId;
  const queue = race && race.status === 'queue' ? race : null;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!queue) return undefined;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [queue]);
  const fillIn = queue ? Math.max(0, Math.ceil((queue.fillAt - now) / 1000)) : null;
  const players = room.players || [];
  const humans = players.filter((p) => !p.isBot).length;
  const full = players.length >= MAX_RACERS;

  return (
    <div className="wr-root wr-lobby wall-surface">
      <header className="wr-head">
        <span className="wr-chip">WORD RACE</span>
        <span className="wr-clock">{queue ? 'QUICK MATCH' : 'PRIVATE ROOM'}</span>
        <div className="wr-head-actions">
          {audioSlot}
          <button type="button" className="wr-btn wr-btn-ghost" onClick={onLeave}>
            LEAVE
          </button>
        </div>
      </header>

      {!queue && (
        <div className="wr-code" aria-label={`Room code ${room.code}`}>
          <span className="wr-code-label">ROOM CODE</span>
          <LayeredWord className="wr-code-face" text={room.code} accent="#FFE94A" />
        </div>
      )}

      <p className="wr-rules">
        SAME 12 FRAGMENTS FOR EVERYONE. TYPE A WORD WITH YOUR FRAGMENT TO MOVE UP. FIRST TO 12 — OR MOST
        WORDS AT 1:30 — WINS.
      </p>

      <ol className="wr-roster" aria-label="Racers">
        {players.map((p) => (
          <li key={p.id} className={p.id === myId ? 'is-me' : ''}>
            <Mascot pose="idle" size={32} className="wr-roster-mascot" />
            <span className="wr-roster-name">{p.name}</span>
            {p.id === myId && <span className="wr-tag wr-tag-me">YOU</span>}
            {p.isBot && <span className="wr-tag">BOT</span>}
            {p.id === room.hostId && !queue && <span className="wr-tag">HOST</span>}
          </li>
        ))}
        {Array.from({ length: Math.max(0, MAX_RACERS - players.length) }, (_, i) => (
          <li key={`open-${i}`} className="is-open">
            <span className="wr-roster-name">OPEN SEAT</span>
          </li>
        ))}
      </ol>

      {queue ? (
        <p className="wr-status" role="status">
          {fillIn > 0
            ? humans < 2
              ? `FINDING RACERS… BOTS FILL IN ${fillIn}s`
              : `STARTING IN ${fillIn}s`
            : 'STARTING…'}
        </p>
      ) : isHost ? (
        <div className="wr-lobby-actions">
          <button type="button" className="wr-btn wr-btn-ghost" onClick={onAddBot} disabled={full || botPending}>
            ADD BOT
          </button>
          <button type="button" className="wr-btn wr-btn-go" onClick={onStart} disabled={startPending}>
            START RACE
          </button>
          {humans < 2 && <p className="wr-status">UNDER 2 RACERS? BOTS FILL THE GRID TO 3.</p>}
        </div>
      ) : (
        <p className="wr-status" role="status">WAITING FOR THE HOST TO START…</p>
      )}
      {serverError && <p className="wr-toast is-reject">{serverError}</p>}
    </div>
  );
}
