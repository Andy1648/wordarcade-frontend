// HeroPicker.jsx — CHOOSE YOUR MAIN as collectible cards: THE CREW (free / earnable / gem-priced members, incl. DUD +
// LEXI), then the rarer rows by rarity — GOLD (earned with 100 wins), ELITE (2,500 gems, silhouettes until bought),
// LEGEND (BOO). Tap an owned card → equip; tap a priced one → the HOLD TO BUY bar (KitHoldButton) → bought + equipped;
// an unearned GOLD does nothing (never for sale). Reusable anywhere a hero is picked (the profile today, the lobby later).
import { useEffect, useState } from 'react';
import { CAST, NEW_CREW, LEGEND, ELITE, GOLD, HERO_UNLOCK, heroById, ownsHero, goldProgress } from './cast.js';
import { buyHero } from './heroShop.js';
import HeroCard from './HeroCard.jsx';
import { KitHoldButton, KitIcon } from '../components/kit/index.js';
import { getGems, subscribeGems } from '../progress/gemsCore';
import { formatNum } from '../format';
import { sndPurchase } from '../audio/gameSounds';
import './HeroPicker.css';

function Act({ h, current }) {
  if (h.gold && !ownsHero(h.id)) {
    const p = goldProgress(h.id);
    return <span className="hp2-act is-earn">{p.need - p.have} WINS TO GO</span>;
  }
  if (ownsHero(h.id)) return <span className={`hp2-act${h.id === current ? ' is-on' : ''}`}>{h.id === current ? 'EQUIPPED' : 'EQUIP'}</span>;
  return <span className="hp2-act is-price">{HERO_UNLOCK[h.id] ? 'SKIP · ' : ''}<KitIcon name="gems" size={18} shadow={2} extras={false} />{formatNum(h.price)}</span>;
}

/** @param current the equipped id · @param onEquip(id) an owned hero was picked · @param onBought(id) a purchase landed */
export default function HeroPicker({ current, onEquip, onBought }) {
  const [buying, setBuying] = useState(null);
  const [gems, setGems] = useState(getGems);
  useEffect(() => subscribeGems((v) => setGems(typeof v === 'number' ? v : getGems())), []);
  // a GOLD not earned yet does nothing (it's never for sale — its card already shows the wins to go)
  const pick = (h) => (ownsHero(h.id) ? onEquip(h.id) : h.gold ? null : setBuying(h.id === buying ? null : h.id));
  const buy = () => {
    const r = buyHero(buying);
    if (!r.ok) return;
    sndPurchase();
    const id = buying;
    setBuying(null);
    onBought(id);
  };
  const want = buying ? heroById(buying) : null;
  /** One card: GOLD shows its wins-to-go, an earnable crew member its requirement, a priced ELITE its silhouette. */
  const card = (x, k = 0) => {
    const gp = x.gold ? goldProgress(x.id) : null;
    const req = gp ? (gp.done ? null : { icon: 'achievements', label: `${gp.have}/${gp.need}` }) : !ownsHero(x.id) ? HERO_UNLOCK[x.id] || null : null;
    return (
      <HeroCard key={x.id} hero={x} req={req} locked={!!x.elite && !ownsHero(x.id)} on={x.id === current} sel={x.id === buying} delay={k * 520} onClick={() => pick(x)}>
        <span className="hp2-tag">{x.tag}</span>
        <Act h={x} current={current} />
      </HeroCard>
    );
  };
  return (
    <div className="hp2">
      <div className="hp2-bar">
        <span className="hp2-sec">THE CREW</span>
        <span className="hp2-gems"><KitIcon name="gems" size={22} shadow={2} extras={false} />{formatNum(gems)}</span>
      </div>
      <div className="hp2-grid">
        {[...CAST, ...NEW_CREW].map((x) => card(x))}
      </div>
      {/* rarer rows, rarest last; the frames + chips explain themselves (Andy oct18: "no need for new faces or earned
          never sold") so a row is only its tier name and how many you hold */}
      {[['is-gold', 'GOLD', GOLD], ['is-elite', 'ELITE', ELITE], ['is-legend', 'LEGEND', LEGEND]].map(([cls, name, list]) => (
        <div key={name} className="hp2-tier">
          <span className={`hp2-sec ${cls}`}>{name} · {list.filter((x) => ownsHero(x.id)).length}/{list.length}</span>
          <div className="hp2-grid">{list.map((x, k) => card(x, k))}</div>
        </div>
      ))}
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
