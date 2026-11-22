// stickyRooms.js — keep the JOIN ROOM list STILL while it auto-refreshes (Andy nov18: "why was the join public room
// screen vibrating back and forth"). groupRooms() sorts every response from scratch (soonest, fullest, watchable…), so
// house rooms drifting 3/8 → 4/8 swapped rows back and forth every 5 s, and a room whose status flickered
// playing → waiting → playing hopped between the two groups. This sits on top of groupRooms and only decides ORDER:
//
//   * A room already on screen keeps its place in its group. A new room joins the END of its group (in groupRooms'
//     order among the newcomers); a room that vanished leaves. The very first list is groupRooms' order as-is.
//   * A room changes GROUP (lobby ↔ live) only once its new status has held for `holdMs` (default 10 s, two refreshes).
//     Until then it stays in its old slot and its row simply shows its current status in place. This works off plain
//     'playing' / 'waiting', so it also covers older servers that report a just-ended game as 'waiting'.
//   * A 'finished' room (its game ended, still joinable — newer servers) NEVER changes group: it stays in the slot it
//     was shown in (a brand-new one lands where groupRooms puts it, the lobbies). Its pending move, if any, is dropped.
//
// Pure: (previous state, this response's groups, now) → { lobbies, live, state }. No timers; the caller keeps `state`.

export const GROUP_HOLD_MS = 10000;

import { isFinished } from './roomList.js';

const EMPTY = { lobby: [], live: [], pending: {} };

/**
 * @param {{ lobby: string[], live: string[], pending: Object<string, { group: string, at: number }> } | null} prev
 * @param {{ lobbies: object[], live: object[] }} grouped  groupRooms() output for this response
 * @param {number} now
 * @returns {{ lobbies: object[], live: object[], state: object }}
 */
export function stickyGroups(prev, grouped, now, { holdMs = GROUP_HOLD_MS } = {}) {
  const p = prev || EMPTY;
  const byCode = new Map();
  const want = new Map(); // code -> the group groupRooms put it in now
  for (const r of grouped.lobbies) { byCode.set(r.code, r); want.set(r.code, 'lobby'); }
  for (const r of grouped.live) { byCode.set(r.code, r); want.set(r.code, 'live'); }

  const shownIn = new Map(); // code -> the group it was shown in last time
  for (const c of p.lobby) shownIn.set(c, 'lobby');
  for (const c of p.live) shownIn.set(c, 'live');

  // which group each present room is SHOWN in this time
  const pending = {};
  const place = new Map();
  for (const [code, g] of want) {
    const was = shownIn.get(code);
    if (!was || was === g) { place.set(code, g); continue; }
    if (isFinished(byCode.get(code))) { place.set(code, was); continue; }
    const pend = p.pending[code];
    const since = pend && pend.group === g ? pend.at : now;
    if (now - since >= holdMs) place.set(code, g);
    else { place.set(code, was); pending[code] = { group: g, at: since }; }
  }

  const build = (g, prevCodes) => {
    const kept = prevCodes.filter((c) => place.get(c) === g);
    const seen = new Set(kept);
    // newcomers + rooms that just moved INTO this group: at the end, in groupRooms' order
    const added = [...grouped.lobbies, ...grouped.live].map((r) => r.code).filter((c) => place.get(c) === g && !seen.has(c));
    return [...kept, ...added];
  };
  const lobby = build('lobby', p.lobby);
  const live = build('live', p.live);
  return {
    lobbies: lobby.map((c) => byCode.get(c)),
    live: live.map((c) => byCode.get(c)),
    state: { lobby, live, pending },
  };
}
