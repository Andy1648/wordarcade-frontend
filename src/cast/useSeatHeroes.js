// useSeatHeroes.js — WHICH HERO A PLAYER WEARS, for every game screen that draws a face (Andy nov12: "for miner idk why
// the avatar is the miner avatar instead of the actual player's avatar"). YOU wear your equipped hero (read locally, the
// same value Word Bomb's seats use); everyone else wears the hero their room_update carries (set_hero); a player with
// none (a mode's own bot) gets a stable pick from the cast, keyed on their id, so they never change mid-game.
import { useMemo } from 'react';
import { castFor, heroById, readMain } from './cast.js';

/** Returns heroOf(id) -> a hero id. Pure lookup, built once per roster. */
export default function useSeatHeroes(roomPlayers, myId) {
  const mine = useMemo(() => readMain(), []);
  return useMemo(() => {
    const worn = new Map();
    for (const p of roomPlayers || []) if (p && p.hero && heroById(p.hero)) worn.set(p.id, p.hero);
    return (id) => {
      if (id && id === myId && heroById(mine)) return mine;
      return worn.get(id) || castFor(id || '', false).id;
    };
  }, [roomPlayers, myId, mine]);
}
