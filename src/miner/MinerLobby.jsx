// MinerLobby.jsx — the waiting room for a MINER room. Two shapes of the same screen:
//   QUICK MATCH  the server launches it (6 miners, or 8 s after it opened); bots fill a mine with < 2 humans.
//   PRIVATE      share the code; the host adds bots and starts.
// Art + names + one number. No rules paragraph: the first prompt teaches the game.
import { useEffect, useState } from 'react';
import { MINER_MAX } from './config';
import FitText from '../components/kit/FitText.jsx';
import './Miner.css';

const HERO = '/cards/miner-hero.webp';

export default function MinerLobby({ room, myId, miner, audioSlot, serverError, startPending, botPending, onStart, onAddBot, onLeave }) {
  const isHost = room.hostId === myId;
  const queue = miner && miner.status === 'queue' && miner.code === room.code ? miner : null;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!queue) return undefined;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [queue]);
  const fillIn = queue ? Math.max(0, Math.ceil((queue.fillAt - now) / 1000)) : null;
  const players = room.players || [];
  const full = players.length >= MINER_MAX;

  return (
    <div className="mn-root mn-lobby" data-testid="miner-lobby">
      <header className="mn-head">
        <span className="mn-chip">MINER</span>
        <span className="mn-code" aria-label={`Room code ${room.code}`}>{room.code}</span>
        <div className="mn-head-actions">
          {audioSlot}
          <button type="button" className="mn-btn mn-btn-ghost" onClick={onLeave}>
            LEAVE
          </button>
        </div>
      </header>

      <img className="mn-lobby-wall" src="/cards/miner-bg.webp" alt="" aria-hidden="true" draggable="false" />

      <ol className="mn-seats" aria-label="Miners">
        {Array.from({ length: MINER_MAX }, (_, i) => {
          const p = players[i];
          return p ? (
            <li key={p.id} className={`mn-seat${p.id === myId ? ' is-me' : ''}`}>
              <img className="mn-seat-digger" src={HERO} alt="" draggable="false" />
              <FitText className="mn-seat-name">{p.id === myId ? 'YOU' : p.name}</FitText>
            </li>
          ) : (
            <li key={`open-${i}`} className="mn-seat is-open" aria-label="Open seat" />
          );
        })}
      </ol>

      {queue ? (
        <p className="mn-lobby-status" role="status" data-testid="miner-fill">
          {fillIn > 0 ? fillIn : 'GO'}
        </p>
      ) : isHost ? (
        <div className="mn-lobby-actions">
          <button type="button" className="mn-btn mn-btn-ghost" onClick={onAddBot} disabled={full || botPending}>
            + BOT
          </button>
          <button type="button" className="mn-btn mn-btn-go" onClick={onStart} disabled={startPending}>
            START
          </button>
        </div>
      ) : (
        <p className="mn-lobby-status is-wait" role="status">WAITING FOR HOST</p>
      )}
      {serverError && <p className="mn-toast is-reject">{serverError}</p>}
    </div>
  );
}
