// MenuRooms.jsx — OPEN ROOMS on the menu (Andy nov2: "use the empty space on the RIGHT side of the desktop menu for a
// live list of the public rooms that are open right now").
//
// TIER 1 CONTRACT (CLAUDE.md): this file is PRESENTATIONAL. It never calls setView, never touches the socket and never
// reads the message queue. The list is App's existing `publicRooms` state (filled by the existing `public_rooms` drain
// branch); a refresh is the existing `list_public_rooms` request (useRoom.handleRefreshPublicRooms) on the ONE socket;
// JOIN is the existing `handleJoinPublicRoom` — the same join_room the JOIN ROOM screen sends, so entering the room
// goes through App's unchanged functional setView, and a failed join lands on the JOIN ROOM screen the way an invite
// link's failure already does (App 'error' + context join_room).
//
// Two shapes, both IN an existing layout home (NO ORPHAN FIXED UI):
//  - 'panel': the paged desktop's right column (≥1200px), a grid cell under CONTRACTS. 4 rows (5 on a tall screen),
//    minus one per running boost tile (the boost dock shares the column), then "+N MORE".
//  - 'chip':  everywhere else (phone row, <1200 desktop footer cluster) — "N OPEN" that opens the JOIN ROOM screen.
//    Hidden at zero rooms (Andy nov2).
// Motion: static at rest; a row's one-shot enter (transform/opacity) and hover/press only — no loops.
import { useEffect, useRef, useState } from 'react';
import { GAMES } from '../gameData';
import { isHeroId } from '../cast/mainFace.js';
import FitText from './kit/FitText.jsx';
import './MenuRooms.css';

export const MENU_ROOMS_POLL_MS = 8000;

const MODE = GAMES.reduce((acc, g) => {
  acc[g.id] = { label: g.name.replace('\n', ' '), color: g.baseColor, art: g.artLayers ? g.artLayers.hero : null };
  return acc;
}, {});
const modeOf = (type) => MODE[type] || { label: String(type || 'GAME').replace(/-/g, ' ').toUpperCase(), color: '#2EFFE0', art: null };

/**
 * Poll the public-room list while the menu is on screen: one request on start, then every MENU_ROOMS_POLL_MS — only
 * while `live` (socket open + the list is shown + nothing covers the menu) AND the tab is visible. The callback is
 * read through a ref: App re-renders ~1-2x/s with a fresh closure, and keying the timer on it would reset it forever.
 */
export function useMenuRoomsPoll(onRefresh, live) {
  const ref = useRef(onRefresh);
  ref.current = onRefresh;
  useEffect(() => {
    if (!live) return undefined;
    let id = null;
    const visible = () => typeof document === 'undefined' || document.visibilityState === 'visible';
    const tick = () => { if (visible() && ref.current) ref.current(); };
    const start = () => {
      if (id != null || !visible()) return;
      tick();
      id = setInterval(tick, MENU_ROOMS_POLL_MS);
    };
    const stop = () => {
      if (id == null) return;
      clearInterval(id);
      id = null;
    };
    const onVis = () => (visible() ? start() : stop());
    start();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [live]);
}

/** Fullest first (the same order Quick Play fills in), then the server's order. Pure. */
export function sortRooms(rooms) {
  return (Array.isArray(rooms) ? rooms : [])
    .filter((r) => r && r.code && !(r.maxPlayers && r.playerCount >= r.maxPlayers)) // the server never lists a full room; belt and braces
    .map((r, i) => ({ r, i }))
    .sort((a, b) => (b.r.playerCount || 0) - (a.r.playerCount || 0) || a.i - b.i)
    .map((x) => x.r);
}

function RoomRow({ room, joining, onJoin, delay }) {
  const mode = modeOf(room.gameType);
  const hero = room.hostHero && isHeroId(room.hostHero) ? room.hostHero : null;
  const who = room.hostName || mode.label;
  const busy = joining === room.code;
  return (
    <li className="mr-row" style={{ '--mr-accent': mode.color, '--mr-delay': `${delay}ms` }} data-testid="menu-room-row" data-code={room.code}>
      <span className={`mr-face${hero ? ' is-hero' : ' is-mode'}`} aria-hidden="true">
        {hero
          ? <img src={`/cast/${hero}-hero.webp`} alt="" width="512" height="512" decoding="async" draggable="false" />
          : mode.art
            ? <img src={mode.art} alt="" loading="lazy" decoding="async" draggable="false" />
            : <span className="mr-face-tag">{mode.label.slice(0, 2)}</span>}
      </span>
      <span className="mr-text">
        <FitText className="mr-host">{who}</FitText>
        <span className="mr-meta">
          {hero && mode.art ? <img className="mr-modeico" src={mode.art} alt="" loading="lazy" decoding="async" draggable="false" /> : null}
          <FitText className="mr-mode">{mode.label}</FitText>
          <span className="mr-count" aria-label={`${room.playerCount} of ${room.maxPlayers} players`}>{room.playerCount}/{room.maxPlayers}</span>
        </span>
      </span>
      <button
        type="button"
        className="mr-join"
        disabled={!!joining}
        onClick={() => onJoin(room.code)}
        aria-label={`Join ${who}'s ${mode.label} room, ${room.playerCount} of ${room.maxPlayers} players`}
      >
        {busy ? '…' : 'JOIN'}
      </button>
    </li>
  );
}

export default function MenuRooms({
  variant = 'panel',
  rooms,
  heard = true,
  maxRows = 4,
  name,
  onJoin,
  onCreate,
  onOpenAll,
  navigating = false,
  online = true,
  className = '',
}) {
  const [joining, setJoining] = useState(null);
  // a dropped socket can never answer the join — unlock the rows so a reconnect can try again
  useEffect(() => { if (!online) setJoining(null); }, [online]);
  const list = sortRooms(rooms);

  if (variant === 'chip') {
    if (!heard || list.length === 0) return null; // hides at zero (Andy nov2)
    return (
      <button type="button" className={`mr-chip ${className}`} onClick={onOpenAll} disabled={navigating} data-testid="menu-rooms-chip"
        aria-label={`${list.length} open public room${list.length === 1 ? '' : 's'} — open the room list`}>
        <span className="mr-chip-n">{list.length}</span>
        <span className="mr-chip-k">OPEN</span>
      </button>
    );
  }

  const handleJoin = (code) => {
    if (joining || navigating || !onJoin) return;
    const n = (name || '').trim();
    if (!n) { if (onOpenAll) onOpenAll(); return; } // no name yet: the JOIN ROOM screen asks for one
    setJoining(code);
    onJoin(code, n);
  };
  const shown = list.slice(0, Math.max(0, maxRows));
  const more = list.length - shown.length;

  return (
    <section className={`mr-panel ${className}`} aria-label="Open public rooms" data-testid="menu-rooms">
      <header className="mr-head">
        <span className="mr-title">OPEN ROOMS</span>
        {heard && list.length > 0 ? <span className="mr-total">{list.length}</span> : null}
      </header>
      {list.length === 0 ? (
        <p className={`mr-empty${heard ? '' : ' is-loading'}`} data-testid="menu-rooms-empty">
          <span>no open rooms ·</span>
          <button type="button" className="mr-create" onClick={onCreate} disabled={navigating || !heard}>CREATE ONE</button>
        </p>
      ) : (
        <>
          {shown.length > 0 && (
            <ul className="mr-list">
              {shown.map((room, i) => (
                <RoomRow key={room.code} room={room} joining={joining} onJoin={handleJoin} delay={i * 40} />
              ))}
            </ul>
          )}
          {more > 0 && (
            <button type="button" className="mr-more" onClick={onOpenAll} disabled={navigating} data-testid="menu-rooms-more">
              +{more} MORE →
            </button>
          )}
        </>
      )}
    </section>
  );
}
