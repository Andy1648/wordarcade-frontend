// ShopV2Looks — the season-1 shop shelves that season 2 had dropped (Andy oct8: "a lot of the features from before are
// gone … don't delete what worked really well"): POP STYLES and SOUND PACKS (cosmetics, priced in GEMS in season 2 —
// the v3 shop.buy swap charges gems and equips), and CODES (the redeem box). Same logic as the live shop — shop.js
// buy / equip / getOwned / getEquipped, RedeemCodes — re-laid on the v2 kit so they sit on the UPGRADES screen.
import { useState } from 'react';
import { POP_STYLES, SOUND_PACKS, getOwned, getEquipped, buy, equip } from '../progress/shop';
import { V3 } from '../progress/season';
import { KitIcon } from './kit/index.js';
import { formatNum } from '../format';
import { sndPurchase } from '../audio/gameSounds';
import { LEADERBOARD_ENABLED } from '../leaderboard/client.js';
import RedeemCodes from './RedeemCodes';

const priceOf = (it) => (V3.hooks && typeof V3.hooks.itemGemPrice === 'function' ? V3.hooks.itemGemPrice(it.id) : it.price);

function LookCard({ it, type, owned, equipped, gems, onBuy, onEquip }) {
  const price = priceOf(it);
  const isOwned = owned.has(it.id) || price === 0;
  const isOn = equipped[type] === it.id;
  const can = gems >= price;
  const state = isOn ? 'on' : isOwned ? 'owned' : can ? 'buy' : 'locked';
  return (
    <div className={`sp2-look is-${state}`} data-look={it.id}>
      <span className="sp2-look-name">{it.name}</span>
      <span className="sp2-look-what">{it.blurb}</span>
      {isOn ? (
        <span className="sp2-look-act sp2-look-on">EQUIPPED</span>
      ) : isOwned ? (
        <button type="button" className="sp2-look-act sp2-look-btn" onClick={() => onEquip(it.id)}>EQUIP</button>
      ) : (
        <button type="button" className="sp2-look-act sp2-look-btn sp2-look-buy" disabled={!can} onClick={() => onBuy(it.id)}
          aria-label={`Buy ${it.name} for ${formatNum(price)} gems`}>
          <KitIcon name="gems" size={20} shadow={2} extras={false} />
          {formatNum(price)}
        </button>
      )}
    </div>
  );
}

/** tab = 'looks' | 'codes' */
export default function ShopV2Looks({ tab, gems, onNote }) {
  const [owned, setOwned] = useState(() => new Set(getOwned()));
  const [equipped, setEquipped] = useState(() => getEquipped());
  const refresh = () => {
    setOwned(new Set(getOwned()));
    setEquipped(getEquipped());
  };
  const onBuy = (id) => {
    const r = buy(id);
    if (r.ok) {
      sndPurchase();
      refresh();
      onNote(`BOUGHT + EQUIPPED ${(POP_STYLES.find((x) => x.id === id) || SOUND_PACKS.find((x) => x.id === id) || {}).name || ''}`);
    } else if (r.reason === 'unaffordable') onNote('NOT ENOUGH GEMS');
  };
  const onEquip = (id) => {
    if (equip(id)) refresh();
  };
  if (tab === 'codes') {
    return (
      <div className="sp2-codes">
        <p className="sp2-codes-what">TYPE A CODE FROM THE DEV — IT PAYS WINS, GEMS OR STARTS A BOOST.</p>
        {LEADERBOARD_ENABLED ? <RedeemCodes /> : <p className="sp2-codes-what">CODES NEED THE ONLINE BOARD — NOT AVAILABLE HERE.</p>}
      </div>
    );
  }
  return (
    <div className="sp2-looks">
      <h3 className="sp2-looks-h">POP STYLES <span>— HOW YOUR LETTERS BURST WHEN YOU TYPE</span></h3>
      <div className="sp2-looks-grid">
        {POP_STYLES.map((it) => <LookCard key={it.id} it={it} type="popStyle" owned={owned} equipped={equipped} gems={gems} onBuy={onBuy} onEquip={onEquip} />)}
      </div>
      <h3 className="sp2-looks-h">SOUND PACKS <span>— THE CLICK EVERY KEY MAKES</span></h3>
      <div className="sp2-looks-grid">
        {SOUND_PACKS.map((it) => <LookCard key={it.id} it={it} type="soundPack" owned={owned} equipped={equipped} gems={gems} onBuy={onBuy} onEquip={onEquip} />)}
      </div>
    </div>
  );
}
