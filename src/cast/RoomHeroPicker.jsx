// RoomHeroPicker.jsx — the lazy half of RoomHeroButton: the full HeroPicker (cards, previews, buy) wired to equip.
import { useState } from 'react';
import HeroPicker from './HeroPicker.jsx';
import { readMain, writeMain } from './cast.js';
import { pushShowcaseNow } from '../leaderboard/client.js';

export default function RoomHeroPicker({ onPicked }) {
  const [current, setCurrent] = useState(readMain);
  const equip = (id) => {
    writeMain(id);
    setCurrent(id);
    pushShowcaseNow(); // the board shows your new hero to everyone
    onPicked(id);
  };
  return <HeroPicker current={current} onEquip={equip} onBought={equip} />;
}
