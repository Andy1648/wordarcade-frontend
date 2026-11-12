// useAnnounceHero.js — tell the room which hero I wear (set_hero → room_update.players[].hero), from ANY mode's lobby
// (nov12, Andy: "for miner idk why the avatar is the miner avatar instead of the actual player's avatar" - only the Word
// Bomb / Blitz lobby announced it, so in MINER and WORD RACE every other player drew a stand-in for me). Once per room
// (and per hero), as soon as the roster holds me; never re-sent on a room_update storm. Cosmetic: no game state.
// Lives in the lazy lobby chunks (never App's first paint).
import { useEffect, useMemo, useRef } from 'react';
import { readMain } from './cast.js';

export default function useAnnounceHero(room, myId, onSetHero) {
  const mine = useMemo(() => readMain(), []);
  const sentRef = useRef(null);
  const meInRoom = room && myId ? room.players.find((p) => p.id === myId) : null;
  const roomHero = meInRoom ? meInRoom.hero : undefined;
  const code = room ? room.code : null;
  useEffect(() => {
    if (!onSetHero || !meInRoom || !mine) return;
    const key = `${code}:${mine}`; // per room: a new room always hears your hero
    if (roomHero === mine || sentRef.current === key) return;
    sentRef.current = key;
    onSetHero(mine);
    // meInRoom is read for presence only; code / roomHero / mine decide
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!meInRoom, code, roomHero, mine, onSetHero]);
}
