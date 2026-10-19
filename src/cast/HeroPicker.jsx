// HeroPicker.jsx — CHOOSE YOUR MAIN. oct18 (Andy: "merge the basic and gold and elite versions into one card … no need
// to separate them individually … a tag underneath to show the progress"): ONE card per member — the crew, then the
// LEGENDs. A card shows the variant you wear (or your best owned one); under it one status pill (EQUIPPED / the
// requirement / the price) and the member's VARIANT chips (GOLD fills with its wins, ELITE shows owned or locked).
// Tapping a card opens HeroPreview on that variant, where the variant tabs (RIOT / GOLD / ELITE) preview the ones you
// don't own — with their requirement or gem price and the one button that gets them. ‹ › flip members.
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

const MEMBERS = [...CAST, ...NEW_CREW, ...LEGEND]; // one card each, the grid's (and ‹ ›'s) order
const ALL = [...MEMBERS, ...GOLD, ...ELITE];
/** A member's variants, base first: [base, GOLD?, ELITE?]. */
export const variantsOf = (m) => [m, GOLD.find((g) => g.base === m.id), ELITE.find((e) => e.base === m.id)].filter(Boolean);
const memberOf = (id) => { const h = heroById(id); return h ? heroById(h.base || h.id) || h : null; };
/** Which variant a member's card shows: the one you wear, else your best owned (ELITE > GOLD > base), else the base. */
function shownVariant(m, current) {
  const vs = variantsOf(m);
  const worn = vs.find((v) => v.id === current);
  if (worn) return worn;
  for (const v of [...vs].reverse()) if (ownsHero(v.id)) return v;
  return m;
}

function Status({ m, current }) {
  const vs = variantsOf(m);
  if (vs.some((v) => v.id === current)) return <span className="hp2-act is-on">EQUIPPED</span>;
  if (ownsHero(m.id)) return null; // owned, not worn: the card itself is the button
  const u = HERO_UNLOCK[m.id];
  if (u) return <span className="hp2-act is-req"><KitIcon name={u.icon} size={20} shadow={1} extras={false} />{u.label}</span>;
  return <span className="hp2-act is-price"><KitIcon name="gems" size={20} shadow={2} extras={false} />{formatNum(m.price)}</span>;
}

function Variants({ m }) {
  const vs = variantsOf(m).slice(1);
  if (!vs.length) return null;
  return (
    <span className="hp2-vars">
      {vs.map((v) => {
        const own = ownsHero(v.id);
        const gp = v.gold && !own ? goldProgress(v.id) : null;
        return (
          <span key={v.id} className={`hp2-var is-${v.gold ? 'gold' : 'elite'}${own ? ' is-own' : ''}`}>
            {gp ? <span className="hp2-var-fill" style={{ transform: `scaleX(${gp.have / gp.need})` }} /> : null}
            <span className="hp2-var-t">{v.gold ? (own ? 'GOLD' : `GOLD ${gp.have}/${gp.need}`) : 'ELITE'}</span>
          </span>
        );
      })}
    </span>
  );
}

/** @param current the equipped id · @param onEquip(id) · @param onBought(id) · @param peekId open straight onto this hero's preview */
export default function HeroPicker({ current, onEquip, onBought, peekId = null }) {
  const [peek, setPeek] = useState(peekId); // the variant being previewed (null = the grid)
  const [gems, setGems] = useState(getGems);
  useEffect(() => subscribeGems((v) => setGems(typeof v === 'number' ? v : getGems())), []);
  const buy = (id) => {
    const r = buyHero(id);
    if (!r.ok) return;
    sndPurchase();
    onBought(id);
  };
  const step = (d) => setPeek((cur) => {
    const i = MEMBERS.findIndex((x) => x.id === (memberOf(cur) || {}).id);
    return shownVariant(MEMBERS[(i + d + MEMBERS.length) % MEMBERS.length], current).id;
  });
  if (peek) {
    const h = heroById(peek);
    const m = h && memberOf(peek);
    if (h && m) return <HeroPreview h={h} variants={variantsOf(m)} onVariant={setPeek} current={current} gems={gems} onEquip={onEquip} onBuy={buy} onStep={step} onClose={() => setPeek(null)} />;
  }
  const have = ALL.filter((x) => ownsHero(x.id)).length;
  return (
    <div className="hp2">
      <div className="hp2-bar">
        <span className="hp2-coll">
          <span className="hp2-coll-k">COLLECTION</span>
          <span className="hp2-coll-bar"><span className="hp2-coll-fill" style={{ transform: `scaleX(${have / ALL.length})` }} /></span>
          <span className="hp2-coll-n">{have}/{ALL.length}</span>
        </span>
        <span className="hp2-gems"><KitIcon name="gems" size={26} shadow={2} extras={false} />{formatNum(gems)}</span>
      </div>
      <div className="hp2-grid">
        {MEMBERS.map((m, k) => {
          const v = shownVariant(m, current);
          return (
            <HeroCard key={m.id} hero={v} dim={!ownsHero(m.id)} on={variantsOf(m).some((x) => x.id === current)} delay={k * 520} onClick={() => setPeek(v.id)}>
              <Status m={m} current={current} />
              <Variants m={m} />
            </HeroCard>
          );
        })}
      </div>
    </div>
  );
}
