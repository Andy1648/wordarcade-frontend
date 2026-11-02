// ShopCosmetics.jsx — the shop's COSMETICS tab (Andy nov2: "idk why cosmetics screen on upgrades gives popup instead of just
// shop screen"): the ONE CUSTOMIZE menu (Customize.jsx — the same component PROFILE shows) laid INLINE on the shop's shelf,
// like BOOSTS and CODES. Same stores, so wearing / buying here is wearing / buying everywhere: your MAIN (cast.js), the
// worn kit (kit.js), the looks (shop.js). A hero bought here plays the same NEW HERO reveal the profile does. Lazy (its own
// chunk, shared with the profile's), so the idle-prefetched shop chunk doesn't carry the pickers.
import { useState } from 'react';
import Customize from './Customize.jsx';
import HeroUnlock from '../../cast/HeroUnlock.jsx';
import { readMain, writeMain } from '../../cast/cast.js';
import { readKit } from '../../cast/kit.js';
import { pushShowcaseNow } from '../../leaderboard/client.js';

export default function ShopCosmetics({ tab0 = 'pop' }) {
  const [hero, setHero] = useState(readMain);
  const [kit, setKit] = useState(readKit);
  const [reveal, setReveal] = useState(null); // { ids, equipped } — the NEW HERO reveal after a buy
  const equip = (id) => {
    writeMain(id);
    setHero(id);
    pushShowcaseNow(); // everyone's board shows your new hero
  };
  return (
    <>
      <Customize hero={hero} kit={kit} onKit={(slot, v) => setKit((k) => ({ ...k, [slot]: v }))} onEquip={equip}
        onBought={(id) => { equip(id); setReveal({ ids: [id], equipped: id }); }} tab0={tab0} />
      {reveal ? <HeroUnlock ids={reveal.ids} equipped={reveal.equipped} onEquip={(id) => { equip(id); setReveal((r) => (r ? { ...r, equipped: id } : r)); }} onClose={() => setReveal(null)} /> : null}
    </>
  );
}
