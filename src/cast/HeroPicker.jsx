// HeroPicker.jsx — CHOOSE YOUR MAIN. oct18 (Andy: "merge the basic and gold and elite versions into one card … no need
// to separate them individually … a tag underneath to show the progress"): ONE card per member — the crew, then the
// LEGENDs. A card shows the variant you wear (or your best owned one); under it one status pill (EQUIPPED / the
// requirement / the price) and the member's VARIANT chips (GOLD fills with its wins, ELITE shows owned or locked).
// Tapping a card opens HeroPreview on that variant, where the variant tabs (RIOT / GOLD / ELITE) preview the ones you
// don't own — with their requirement or gem price and the one button that gets them. ‹ › flip members.
import { useEffect, useState } from 'react';
import { CAST, NEW_CREW, LEGEND, ELITE, GOLD, HERO_UNLOCK, heroById, ownsHero, heroGateMet, goldProgress, limitedDaysLeft } from './cast.js';
import { buyHero } from './heroShop.js';
import HeroCard from './HeroCard.jsx';
import FitText from '../components/kit/FitText.jsx';
import { KitIcon } from '../components/kit/index.js';
import HeroPreview from './HeroPreview.jsx';
import { getGems, subscribeGems } from '../progress/gemsCore';
import { formatNum } from '../format';
import { sndPurchase } from '../audio/gameSounds';
import './HeroPicker.css';

// one card each, the grid's (and ‹ ›'s) order — a LIMITED hero still on sale leads the grid (its clock is the point)
const ON_SALE = LEGEND.filter((h) => h.limited && limitedDaysLeft(h.id));
const MEMBERS = [...ON_SALE, ...CAST, ...NEW_CREW, ...LEGEND.filter((h) => !ON_SALE.includes(h))];
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

/** oct19 (Andy: "write the win requirement on the icon and the place used for win requirement can be shown gem
 *  requirement"): the requirement rides the card art (cardReq), and the pill under the card is always the gem price. */
function Status({ m, current }) {
  const vs = variantsOf(m);
  if (vs.some((v) => v.id === current)) return <span className="hp2-act is-on">EQUIPPED</span>;
  if (ownsHero(m.id)) return null; // owned, not worn: the card itself is the button
  return <span className="hp2-act is-price"><KitIcon name="gems" size={20} shadow={2} extras={false} />{formatNum(m.price)}</span>;
}
/** The requirement printed on a card's art: the earn (60 WINS / LEVEL 20 / REBIRTH 1) of a crew member you don't own
 *  yet, or a LEGEND's rebirth gate with the lock until you reach it (then only its price stands between you and it). */
function cardReq(m) {
  const u = HERO_UNLOCK[m.id];
  if (!u || ownsHero(m.id)) return null;
  // LIMITED (HOLLOW): the clock while it's on sale, then gone for good
  if (u.until != null) { const d = limitedDaysLeft(m.id); return d ? { icon: 'clock', label: `ENDS IN ${d}D` } : { lock: true, label: 'GONE FOREVER' }; }
  if (u.gate) return heroGateMet(m.id) ? null : { lock: true, label: u.label };
  return { icon: u.icon, label: u.label };
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
            <FitText className="hp2-var-t fit-center">{v.gold ? (own ? 'GOLD' : `GOLD ${gp.have}/${gp.need}`) : 'ELITE'}</FitText>
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
  const [hot, setHot] = useState(null); // the card under the pointer / focus plays its flipbook (the equipped one always does)
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
      <div className="hp2-grid" onPointerOver={(e) => { const c = e.target.closest && e.target.closest('[data-hero]'); setHot(c ? c.getAttribute('data-hero') : null); }}
        onPointerLeave={() => setHot(null)} onFocus={(e) => { const c = e.target.closest && e.target.closest('[data-hero]'); if (c) setHot(c.getAttribute('data-hero')); }}>
        {MEMBERS.map((m, k) => {
          const v = shownVariant(m, current);
          return (
            <HeroCard key={m.id} hero={v} dim={!ownsHero(m.id)} req={v === m ? cardReq(m) : null} on={variantsOf(m).some((x) => x.id === current)} live={hot === v.id || v.id === current} delay={k * 520} onClick={() => setPeek(v.id)}>
              <Status m={m} current={current} />
              <Variants m={m} />
            </HeroCard>
          );
        })}
      </div>
    </div>
  );
}
