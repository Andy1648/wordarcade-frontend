// HeroPicker.jsx — CHOOSE YOUR MAIN as collectible cards: THE CREW (free / earnable / gem-priced members, incl. DUD +
// LEXI), then the rarer rows by rarity — GOLD (earned with 100 wins), ELITE (2,500 gems, silhouettes until bought),
// LEGEND (BOO). Tap an owned card → equip; tap a priced one → the HOLD TO BUY bar (KitHoldButton) → bought + equipped;
// an unearned GOLD does nothing (never for sale). Reusable anywhere a hero is picked (the profile today, the lobby later).
// oct18 HERO PREVIEW (Andy "card previews … better hero menu presentation … larger proportions"): every card opens
// HeroPreview — the hero big, alive, cycling its poses, with how you get it and the one button that does it (EQUIP /
// HOLD TO BUY); ‹ › flip through the roster. A COLLECTION meter heads the grid, and the cards are 4 to a row.
import { useEffect, useState } from 'react';
import { CAST, NEW_CREW, LEGEND, ELITE, GOLD, HERO_UNLOCK, heroById, ownsHero, goldProgress } from './cast.js';
import { buyHero } from './heroShop.js';
import HeroCard from './HeroCard.jsx';
import { KitIcon } from '../components/kit/index.js';
import HeroPreview from './HeroPreview.jsx';
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
const ROWS = [['is-gold', 'GOLD', GOLD], ['is-elite', 'ELITE', ELITE], ['is-legend', 'LEGEND', LEGEND]];
const ROSTER = [...CAST, ...NEW_CREW, ...GOLD, ...ELITE, ...LEGEND]; // the preview's ‹ › order = the grid's order

/** @param peekId open straight onto this hero's preview (the profile's NEXT HERO goal) */
export default function HeroPicker({ current, onEquip, onBought, peekId = null }) {
  const [peek, setPeek] = useState(peekId); // the hero being previewed (null = the grid)
  const [gems, setGems] = useState(getGems);
  useEffect(() => subscribeGems((v) => setGems(typeof v === 'number' ? v : getGems())), []);
  const buy = (id) => {
    const r = buyHero(id);
    if (!r.ok) return;
    sndPurchase();
    onBought(id);
  };
  const step = (d) => setPeek((cur) => {
    const i = ROSTER.findIndex((x) => x.id === cur);
    return ROSTER[(i + d + ROSTER.length) % ROSTER.length].id;
  });
  if (peek) {
    const h = heroById(peek);
    if (h) return <HeroPreview h={h} current={current} gems={gems} onEquip={onEquip} onBuy={buy} onStep={step} onClose={() => setPeek(null)} />;
  }
  const have = ROSTER.filter((x) => ownsHero(x.id)).length;
  /** One card: GOLD shows its wins-to-go, an earnable crew member its requirement, a priced ELITE its silhouette. */
  const card = (x, k = 0) => {
    const gp = x.gold ? goldProgress(x.id) : null;
    const req = gp ? (gp.done ? null : { icon: 'achievements', label: `${gp.have}/${gp.need}` }) : !ownsHero(x.id) ? HERO_UNLOCK[x.id] || null : null;
    return (
      <HeroCard key={x.id} hero={x} req={req} locked={!!x.elite && !ownsHero(x.id)} on={x.id === current} delay={k * 520} onClick={() => setPeek(x.id)}>
        <span className="hp2-tag">{x.tag}</span>
        <Act h={x} current={current} />
      </HeroCard>
    );
  };
  return (
    <div className="hp2">
      <div className="hp2-bar">
        <span className="hp2-coll">
          <span className="hp2-coll-k">COLLECTION</span>
          <span className="hp2-coll-bar"><span className="hp2-coll-fill" style={{ transform: `scaleX(${have / ROSTER.length})` }} /></span>
          <span className="hp2-coll-n">{have}/{ROSTER.length}</span>
        </span>
        <span className="hp2-gems"><KitIcon name="gems" size={24} shadow={2} extras={false} />{formatNum(gems)}</span>
      </div>
      <span className="hp2-sec">THE CREW</span>
      <div className="hp2-grid">
        {[...CAST, ...NEW_CREW].map((x) => card(x))}
      </div>
      {/* rarer rows, rarest last; the frames + chips explain themselves (Andy oct18: "no need for new faces or earned
          never sold") so a row is only its tier name and how many you hold */}
      {ROWS.map(([cls, name, list]) => (
        <div key={name} className="hp2-tier">
          <span className={`hp2-sec ${cls}`}>{name} · {list.filter((x) => ownsHero(x.id)).length}/{list.length}</span>
          <div className="hp2-grid">{list.map((x, k) => card(x, k))}</div>
        </div>
      ))}
    </div>
  );
}
