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
//  - 'panel': the paged desktop's right column (≥1200px), a grid cell under CONTRACTS. 3 rows (4 from 880px tall),
//    minus one per running boost tile (the boost dock shares the column), then "+N MORE".
//  - 'chip':  everywhere else (phone row, <1200 desktop footer cluster) — "N OPEN" that opens the JOIN ROOM screen.
//    Hidden at zero rooms (Andy nov2).
// LAZY (payload ratchet): Homepage loads this chunk only after the first public_rooms reply; the poll lives in
// menuRoomsPoll.js (eager, tiny).
// SPECTATE (nov4): a live public game stays listed (list_public_rooms { withLive }) as PLAYING → SPECTATE (App's
// handleWatchPublicRoom, the read-only watch); a waiting room is IN LOBBY → JOIN. Lobbies first, then live games.
// Motion: static at rest; a row's one-shot enter (transform/opacity) and hover/press only — no loops.
import { useEffect, useState } from 'react';
import { GAMES } from '../gameData';
import { isHeroId } from '../cast/mainFace.js';
import { activeBoosts } from '../progress/liveBoost.js';
import { useSound } from '../contexts/SoundContext';
import { isLive, sortRooms, rowAction } from '../lib/roomList.js';
import useRoomsClock from '../hooks/useRoomsClock.js';
import './MenuRooms.css';
import FitText from './kit/FitText.jsx';

// the order + what a row says live in lib/roomList.js (shared with the JOIN ROOM list); re-exported for older imports
export { isLive, sortRooms };

const MODE = GAMES.reduce((acc, g) => {
  acc[g.id] = { label: g.name.replace('\n', ' '), color: g.baseColor, art: g.artLayers ? g.artLayers.hero : null };
  return acc;
}, {});
const modeOf = (type) => MODE[type] || { label: String(type || 'GAME').replace(/-/g, ' ').toUpperCase(), color: '#2EFFE0', art: null };

function RoomRow({ room, joining, onJoin, delay, clock }) {
  const mode = modeOf(room.gameType);
  const hero = room.hostHero && isHeroId(room.hostHero) ? room.hostHero : null;
  const who = room.hostName || mode.label;
  const busy = joining === room.code;
  const live = isLive(room);
  const act = rowAction(room, clock);
  const action = act.verb;
  return (
    <li className={`mr-row${live ? ' is-live' : ''}`} style={{ '--mr-accent': mode.color, '--mr-delay': `${delay}ms` }} data-testid="menu-room-row" data-code={room.code}>
      <span className={`mr-face${hero ? ' is-hero' : ' is-mode'}`} aria-hidden="true">
        {hero
          ? <img src={`/cast/${hero}-hero.webp`} alt="" width="512" height="512" decoding="async" draggable="false" />
          : mode.art
            ? <img src={mode.art} alt="" loading="lazy" decoding="async" draggable="false" />
            : <span className="mr-face-tag">{mode.label.slice(0, 2)}</span>}
      </span>
      <FitText className="mr-host" data-col="name" translate="no">{who}</FitText>
      {/* line 2 (nov9): the mode (its art when the face is a hero) + the x/max, wrapping under each other in the space the
          fixed-width button leaves - never squeezed into a chip that can't hold its name */}
      <span className="mr-meta">
        <span className="mr-mode">{mode.label}</span>{' '}
        <span className="mr-count" aria-label={`${room.playerCount} of ${room.maxPlayers} players`}>{room.playerCount}/{room.maxPlayers}</span>
      </span>
      <button
        type="button"
        className={`mr-join is-${act.kind}${live ? ' is-watch' : ''}`}
        data-col="action"
        disabled={!!joining || act.kind === 'none'}
        onClick={() => onJoin(room)}
        aria-label={`${act.kind === 'none' ? `${action}:` : live ? 'Spectate' : 'Join'} ${who}'s ${mode.label} ${live ? 'game' : 'room'}, ${room.playerCount} of ${room.maxPlayers} players`}
      >
        {/* the row's state rides in the button (no third line: the panel's height is the column's budget) */}
        <span className="mr-status" data-testid="menu-room-status">{act.status.replace('STARTS IN ', 'STARTS ')}</span>
        <span className={`mr-action${act.kind === 'none' ? ' is-why' : ''}`}>{busy ? '…' : action}</span>
      </button>
    </li>
  );
}

export default function MenuRooms({
  variant = 'panel',
  rooms,
  heard = true,
  maxRows = null, // null = by screen height (below); a number pins it (tests)
  name,
  onJoin,
  onWatch,
  onCreate,
  onNavigate,
  onOpenAll,
  navigating = false,
  online = true,
  className = '',
}) {
  const [joining, setJoining] = useState(null);
  const { sound } = useSound();
  // rows by screen height (a row is two readable lines — name + JOIN over the mode chip + x/max): 3, or 4 from 880px
  // tall — the right column's free cell is ~420px at 720 tall (e2e/menu-rooms.spec.js asserts no overlap at 5 sizes).
  // A media query, not measurement: nothing here reads layout.
  const [tall, setTall] = useState(() => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(min-height: 880px)').matches);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia('(min-height: 880px)');
    const on = () => setTall(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  // a dropped socket can never answer the join — unlock the rows so a reconnect can try again
  useEffect(() => { if (!online) setJoining(null); }, [online]);
  const list = sortRooms(rooms);
  const clock = useRoomsClock(rooms);

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

  // only App's EXISTING handlers (the ones JOIN ROOM uses); App owns every view change
  const handleJoin = (room) => {
    const live = isLive(room);
    const go = live ? onWatch : onJoin;
    if (joining || navigating || !go) return;
    const n = (name || '').trim();
    if (!n) { if (onOpenAll) onOpenAll(); return; } // no name yet: the JOIN ROOM screen asks for one
    sound.click();
    setJoining(room.code);
    // join_room → App's room_update path (functional setView) / spectate_room → App's watch path; a failure of
    // either lands on the JOIN ROOM screen
    go(room.code, n);
  };
  const handleCreate = () => {
    if (navigating || !onCreate) return;
    sound.click();
    if (onNavigate) onNavigate();
    onCreate();
  };
  // the boost dock shares the right column (bottom-aligned): one row fewer per running boost tile so they never meet
  const rows = maxRows != null ? maxRows : (tall ? 4 : 3) - activeBoosts().length;
  const shown = list.slice(0, Math.max(0, rows));
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
          <button type="button" className="mr-create" onClick={handleCreate} disabled={navigating || !heard}>CREATE ONE</button>
        </p>
      ) : (
        <>
          {shown.length > 0 && (
            <ul className="mr-list">
              {shown.map((room, i) => (
                <RoomRow key={room.code} room={room} joining={joining} onJoin={handleJoin} delay={i * 40} clock={clock} />
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
