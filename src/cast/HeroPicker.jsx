// HeroPicker.jsx — CHOOSE YOUR MAIN as collectible cards (oct17): THE CREW (three free, HEX + GLITCH for gems) and the
// NEW FACES (DUD earned at LEVEL 35, LEXI for gems), LEGEND (BOO: REBIRTH 5 or 5,000 gems), the ELITE row (2,500 gems each, silhouettes until bought). Tap an owned card → equip; tap a priced one → the HOLD TO BUY
// bar (KitHoldButton) → bought + equipped. Reusable anywhere a hero is picked (the profile today, the lobby later).
import { useEffect, useState } from 'react';
import { CAST, NEW_CREW, LEGEND, ELITE, HERO_UNLOCK, heroById, ownsHero } from './cast.js';
import { buyHero } from './heroShop.js';
import HeroCard from './HeroCard.jsx';
import { KitHoldButton, KitIcon } from '../components/kit/index.js';
import { getGems, subscribeGems } from '../progress/gemsCore';
import { formatNum } from '../format';
import { sndPurchase } from '../audio/gameSounds';
import './HeroPicker.css';

function Act({ h, current }) {
  if (ownsHero(h.id)) return <span className={`hp2-act${h.id === current ? ' is-on' : ''}`}>{h.id === current ? 'EQUIPPED' : 'EQUIP'}</span>;
  return <span className="hp2-act is-price">{HERO_UNLOCK[h.id] ? 'SKIP · ' : ''}<KitIcon name="gems" size={18} shadow={2} extras={false} />{formatNum(h.price)}</span>;
}

/** @param current the equipped id · @param onEquip(id) an owned hero was picked · @param onBought(id) a purchase landed */
export default function HeroPicker({ current, onEquip, onBought }) {
  const [buying, setBuying] = useState(null);
  const [gems, setGems] = useState(getGems);
  useEffect(() => subscribeGems((v) => setGems(typeof v === 'number' ? v : getGems())), []);
  const pick = (h) => (ownsHero(h.id) ? onEquip(h.id) : setBuying(h.id === buying ? null : h.id));
  const buy = () => {
    const r = buyHero(buying);
    if (!r.ok) return;
    sndPurchase();
    const id = buying;
    setBuying(null);
    onBought(id);
  };
  const want = buying ? heroById(buying) : null;
  const owned = ELITE.filter((x) => ownsHero(x.id)).length;
  return (
    <div className="hp2">
      <div className="hp2-bar">
        <span className="hp2-sec">THE CREW</span>
        <span className="hp2-gems"><KitIcon name="gems" size={22} shadow={2} extras={false} />{formatNum(gems)}</span>
      </div>
      <div className="hp2-grid">
        {CAST.map((x) => (
          <HeroCard key={x.id} hero={x} req={!ownsHero(x.id) ? HERO_UNLOCK[x.id] || null : null} on={x.id === current} sel={x.id === buying} onClick={() => pick(x)}>
            <span className="hp2-tag">{x.tag}</span>
            <Act h={x} current={current} />
          </HeroCard>
        ))}
      </div>
      <span className="hp2-sec is-new">NEW FACES</span>
      <div className="hp2-grid">
        {NEW_CREW.map((x) => (
          <HeroCard key={x.id} hero={x} req={!ownsHero(x.id) ? HERO_UNLOCK[x.id] || null : null} on={x.id === current} sel={x.id === buying} onClick={() => pick(x)}>
            <span className="hp2-tag">{x.tag}</span>
            <Act h={x} current={current} />
          </HeroCard>
        ))}
      </div>
      <span className="hp2-sec is-legend">LEGEND · {LEGEND.filter((x) => ownsHero(x.id)).length}/{LEGEND.length} OWNED</span>
      <div className="hp2-grid">
        {LEGEND.map((x) => (
          <HeroCard key={x.id} hero={x} req={!ownsHero(x.id) ? HERO_UNLOCK[x.id] || null : null} on={x.id === current} sel={x.id === buying} delay={260} onClick={() => pick(x)}>
            <span className="hp2-tag">{x.tag}</span>
            <Act h={x} current={current} />
          </HeroCard>
        ))}
      </div>
      <span className="hp2-sec is-elite">ELITE · {owned}/{ELITE.length} OWNED</span>
      <div className="hp2-grid">
        {ELITE.map((x, k) => (
          <HeroCard key={x.id} hero={x} locked={!ownsHero(x.id)} on={x.id === current} sel={x.id === buying} delay={k * 520} onClick={() => pick(x)}>
            <span className="hp2-tag">{x.tag}</span>
            <Act h={x} current={current} />
          </HeroCard>
        ))}
      </div>
      {want ? (
        <div className="hp2-buy">
          <span className="hp2-buy-t">{want.name}</span>
          <KitHoldButton tone="gold" width={260} labelSize={22} label={gems >= want.price ? 'HOLD TO BUY' : 'NOT ENOUGH GEMS'}
            sub={gems >= want.price ? `${formatNum(want.price)} GEMS` : `NEED ${formatNum(want.price - gems)} MORE`}
            disabled={gems < want.price} confirmText="UNLOCKED!" onConfirm={buy} ariaLabel={`Hold to buy ${want.name} for ${formatNum(want.price)} gems`} />
        </div>
      ) : null}
    </div>
  );
}
