// roomList.js — what a public-room row SAYS and in what ORDER (Andy nov9: "when multiple public rooms eventually stack
// up"). Pure, shared by the menu's OPEN ROOMS panel and the JOIN ROOM list, so the two never disagree.
//
//   * Two groups: lobbies you can JOIN, then live games you can SPECTATE.
//   * Lobbies: the one starting soonest first (a house room counting down: startsInMs), then fullest (where Quick Play
//     fills), then the server's order. A FULL lobby (it filled between the list and now) goes last, as a disabled FULL
//     row on the JOIN ROOM list ({ keepFull }), and is left out of the menu panel.
//   * Live games: watchable first, then the busiest, then the server's order.
//   * A live game that can't take a watcher says WHY (NO SPECTATE: the mode can't be watched on this server; WATCH FULL:
//     too many watching) and is never a pressable SPECTATE.

/** A live game (watch it) rather than a lobby (join it). */
export const isLive = (r) => !!r && r.status === 'playing';

/** 'open' | 'full' | 'unsupported' for a live room; null for a lobby. An older server sends only canSpectate. */
export function watchOf(r) {
  if (!isLive(r)) return null;
  if (r.watch === 'open' || r.watch === 'full' || r.watch === 'unsupported') return r.watch;
  return r.canSpectate === false ? 'unsupported' : 'open';
}

export const fullLobby = (r) => !isLive(r) && !!r.maxPlayers && r.playerCount >= r.maxPlayers;
const counting = (r) => !isLive(r) && Number.isFinite(r.startsInMs);

/** { lobbies, live }, each sorted (see the header). */
export function groupRooms(rooms, { keepFull = false } = {}) {
  const all = (Array.isArray(rooms) ? rooms : []).filter((r) => r && r.code && (keepFull || !fullLobby(r))).map((r, i) => ({ r, i }));
  const lobbies = all.filter((x) => !isLive(x.r)).sort((a, b) =>
    (fullLobby(a.r) - fullLobby(b.r))
    || (counting(b.r) - counting(a.r))
    || (counting(a.r) && counting(b.r) ? a.r.startsInMs - b.r.startsInMs : 0)
    || (b.r.playerCount || 0) - (a.r.playerCount || 0)
    || a.i - b.i);
  const live = all.filter((x) => isLive(x.r)).sort((a, b) =>
    ((watchOf(b.r) === 'open') - (watchOf(a.r) === 'open'))
    || (b.r.playerCount || 0) - (a.r.playerCount || 0)
    || a.i - b.i);
  return { lobbies: lobbies.map((x) => x.r), live: live.map((x) => x.r) };
}

/** Lobbies, then live games, in display order. */
export function sortRooms(rooms) {
  const { lobbies, live } = groupRooms(rooms);
  return [...lobbies, ...live];
}

/** Whole seconds until a counting-down lobby starts, from when the list arrived. Null when it isn't counting down. */
export function startsInSec(r, receivedAt, now) {
  if (!counting(r)) return null;
  return Math.max(0, Math.ceil((r.startsInMs - Math.max(0, now - receivedAt)) / 1000));
}

/**
 * What a row's action column says: a status line over a verb, and whether it can be pressed.
 * { status, verb, kind: 'join' | 'watch' | 'none' }
 */
export function rowAction(r, { receivedAt = 0, now = 0 } = {}) {
  if (!isLive(r)) {
    if (fullLobby(r)) return { status: 'IN LOBBY', verb: 'FULL', kind: 'none' };
    const s = startsInSec(r, receivedAt, now);
    return { status: s == null ? 'IN LOBBY' : s > 0 ? `STARTS IN ${s}s` : 'STARTING', verb: 'JOIN', kind: 'join' };
  }
  const w = watchOf(r);
  if (w === 'open') return { status: 'PLAYING', verb: 'SPECTATE', kind: 'watch' };
  return { status: 'PLAYING', verb: w === 'full' ? 'WATCH FULL' : 'NO SPECTATE', kind: 'none' };
}
