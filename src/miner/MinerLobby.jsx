// MinerLobby.jsx — the waiting room for a MINER room: share the code (or a public room others browse to), the host
// adds bots and starts; a mine with < 2 humans is topped up with bots at START, shown as BOT seats until then.
// (The QUICK MATCH queue shape below stays for an older tab's miner_queue; Andy oct28 removed quick match.)
// Art + names + one number. No rules paragraph: the first prompt teaches the game.
import { useEffect, useState } from 'react';
import { MINER_MAX } from './config';
import FitText from '../components/kit/FitText.jsx';
import CastArt from '../cast/CastArt.jsx';
import { castFor, heroById } from '../cast/cast.js';
import useAnnounceHero from '../cast/useAnnounceHero.js';
import './Miner.css';
import useAutoStartSec from '../hooks/useAutoStartSec.js';

// EACH MINER IS THEIR HERO (design audit 10: every seat wore the same miner sprite): the hero the player has on (the
// room carries it, as in every other mode), else the cast member their id gives them - YOU get your own pick
const heroOf = (p, me) => (p && heroById(p.hero) ? p.hero : castFor(p ? p.id : '', me).id);
const BOT_FILL_TO = 3; // mirrors the backend minerMode.js BOT_FILL_TO

export default function MinerLobby({ room, myId, miner, audioSlot, serverError, startPending, botPending, onStart, onAddBot, onLeave, onSetHero }) {
  useAnnounceHero(room, myId, onSetHero); // the other miners draw ME as my hero (nov12)
  const isHost = room.hostId === myId;
  const autoSec = useAutoStartSec(room); // a public lobby starts on its own (server clock)
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
  // THE BOTS THE SERVER WILL SEAT (minerMode.js start: a mine with < 2 humans is topped up to 3 miners). Shown as
  // BOT seats before START so a solo host sees who they'll dig against (Andy oct28: "where are the bots").
  const humans = players.filter((p) => !p.isBot).length;
  const bots = players.length - humans;
  const botFill = humans < 2 ? Math.max(0, BOT_FILL_TO - humans - bots) : 0;

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

      {/* the seats that matter: the miners, the bots START adds, and ONE open seat to invite into (not a grid of dashed
          boxes - design audit 10) */}
      <ol className="mn-seats" aria-label="Miners" style={{ '--mn-seat-n': Math.min(4, players.length + botFill + (full ? 0 : 1)) }}>
        {players.map((p) => (
          <li key={p.id} className={`mn-seat${p.id === myId ? ' is-me' : ''}`}>
            <span className="mn-seat-hero"><CastArt className="mn-seat-digger" id={heroOf(p, p.id === myId)} data-hero={heroOf(p, p.id === myId)} live /></span>
            <FitText className="mn-seat-name">{p.id === myId ? 'YOU' : p.name}</FitText>
          </li>
        ))}
        {Array.from({ length: botFill }, (_, i) => (
          <li key={`bot-${i}`} className="mn-seat is-bot-fill" aria-label="A bot joins at start">
            <span className="mn-seat-hero"><CastArt className="mn-seat-digger" id={castFor(`${room.code}-bot-${i}`).id} live={false} /></span>
            <span className="mn-seat-name">BOT</span>
          </li>
        ))}
        {!full && (
          <li className="mn-seat is-open" aria-label={`Open seat. Room code ${room.code}`}>
            <span className="mn-seat-plus" aria-hidden="true">+</span>
            <span className="mn-seat-name">OPEN</span>
            <span className="mn-seat-code">{room.code}</span>
          </li>
        )}
      </ol>

      {!queue && autoSec != null ? (
        <p className="mn-lobby-status" role="status" data-testid="room-autostart">{autoSec > 0 ? <>STARTS IN <b>{autoSec}</b></> : 'STARTING…'}</p>
      ) : null}
      {queue ? (
        <p className="mn-lobby-status" role="status" data-testid="miner-fill">
          {fillIn > 0 ? fillIn : 'GO'}
        </p>
      ) : isHost ? (
        <div className="mn-lobby-actions">
          <button type="button" className="mn-btn mn-btn-ghost mn-btn-big" onClick={onAddBot} disabled={full || botPending}>
            + BOT
          </button>
          <button type="button" className="mn-btn mn-btn-go mn-btn-big mn-btn-start" onClick={onStart} disabled={startPending}>
            START
          </button>
        </div>
      ) : autoSec != null ? null : (
        <p className="mn-lobby-status is-wait" role="status">WAITING FOR HOST</p>
      )}
      {serverError && <p className="mn-toast is-reject">{serverError}</p>}
    </div>
  );
}
