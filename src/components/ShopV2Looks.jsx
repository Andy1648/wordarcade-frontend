// ShopV2Looks — the season-1 shop shelves that season 2 had dropped (Andy oct8: "a lot of the features from before are
// gone … don't delete what worked really well"): POP STYLES and SOUND PACKS (cosmetics, priced in GEMS in season 2 —
// the v3 shop.buy swap charges gems and equips), and CODES (the redeem box). Same logic as the live shop — shop.js
// buy / equip / getOwned / getEquipped, RedeemCodes — re-laid on the v2 kit so they sit on the UPGRADES screen.
import { useEffect, useRef, useState } from 'react';
import { kitBarOf } from '../progress/kitArt.js';
import { POP_STYLES, SOUND_PACKS, getOwned, getEquipped, buy, equip, tryLooksOn, wearForSession, wornPopStyle } from '../progress/shop';
import { TRY_MS, tryStreak, tryGain, padLetter } from '../progress/tryOn';
import { TIER_SCALES, TIER_COLORS } from '../progress/useXpCapture';
import { isCreditableKey, getKeyTier } from '../progress/xp';
import { equippedPopColors } from '../theme/themes';
import { playClack, previewClack } from '../progress/clack';
import { V3 } from '../progress/season';
import { KitIcon } from './kit/index.js';
import { formatNum } from '../format';
import { sndPurchase } from '../audio/gameSounds';
import { LEADERBOARD_ENABLED } from '../leaderboard/client.js';
import RedeemCodes from './RedeemCodes';

// a pop style's XP multiplier as the card reads it (oct24: pops pay again): +5% … +95%, then ×2.2 … ×3
const xpTag = (m) => (m >= 2 ? `×${+m.toFixed(2)} XP` : `+${Math.round((m - 1) * 100)}% XP`);
const priceOf = (it) => (V3.hooks && typeof V3.hooks.itemGemPrice === 'function' ? V3.hooks.itemGemPrice(it.id) : it.price);

// The action a card offers: EQUIPPED / EQUIP / BUY — and, with the owner's ?trylooks=1, EQUIP on a locked pop style too
// (worn for this page load only: shop.wearForSession). Shared by the card and the TRYING bar.
function LookAct({ it, isOn, isOwned, can, price, owner, onBuy, onEquip, onWear }) {
  if (isOn) return <span className="sp2-look-act sp2-look-on">EQUIPPED</span>;
  if (isOwned) return <button type="button" className="sp2-look-act sp2-look-btn" onClick={() => onEquip(it.id)}>EQUIP</button>;
  return (
    <>
      <button type="button" className="sp2-look-act sp2-look-btn sp2-look-buy" disabled={!can} onClick={() => onBuy(it.id)}
        aria-label={`Buy ${it.name} for ${formatNum(price)} gems`}>
        <KitIcon name="gems" size={20} shadow={2} extras={false} />
        {formatNum(price)}
      </button>
      {owner && onWear ? <button type="button" className="sp2-look-act sp2-look-btn sp2-look-wear" data-testid={`wear-${it.id}`} onClick={() => onWear(it.id)}>EQUIP</button> : null}
    </>
  );
}

// the keycap presses down once per tap — one finite WAAPI run (transform only), none under REDUCE MOTION
const KEY_PRESS = [{ transform: 'translateY(0) scale(1)' }, { transform: 'translateY(6px) scale(.92, .86)', offset: 0.35 }, { transform: 'translateY(0) scale(1)' }];
function pressKey(el) {
  if (!el || !el.animate) return;
  try { if (matchMedia('(prefers-reduced-motion: reduce)').matches) return; } catch { /* no matchMedia */ }
  el.animate(KEY_PRESS, { duration: 260, easing: 'cubic-bezier(.3, 1.6, .5, 1)' });
}

// POP STYLE RARITY (nov2 design audit #15: "no rarity frames, even though prices run 75 → 154K"): each style's tier by its
// place on the price ladder — the shop's own rarity colours, the painted RARE / EPIC backplates and the EPIC gem; GOLD and
// up wear gold; LEGEND keeps its own. CLASSIC (free) stays plain: the ladder has a bottom.
const POP_TIER = { chrome: 'rare', inferno: 'rare', void: 'rare', prism: 'epic', toxic: 'epic', ember: 'epic', frost: 'epic', gold: 'legendary', plasma: 'legendary', nova: 'legendary', eclipse: 'legendary', legend: 'legend' };

function LookCard({ it, type, owned, equipped, gems, onBuy, onEquip, onTry, trying, owner, onWear }) {
  const tier = type === 'popStyle' ? POP_TIER[it.id] || null : null;
  const price = priceOf(it);
  const isOwned = owned.has(it.id) || price === 0;
  const isOn = equipped[type] === it.id;
  const can = gems >= price;
  const state = isOn ? 'on' : isOwned ? 'owned' : can ? 'buy' : 'locked';
  // TRY-ON (Andy oct26): a tap anywhere on a pop-style card that is not one of its buttons tries it on
  const onCard = onTry ? (e) => { if (!(e.target instanceof Element) || !e.target.closest('button')) onTry(it.id); } : undefined;
  return (
    <div className={`sp2-look is-${state}${type === 'popStyle' || type === 'soundPack' ? ' has-art' : ''}${it.id === 'legend' ? ' is-legend' : ''}${trying ? ' is-trying' : ''}${tier ? ` is-t-${tier}` : ''}`} data-look={it.id} data-tier={tier || 'common'} onClick={onCard}>
      {tier === 'epic' || tier === 'legendary' || tier === 'legend' ? <img className="sp2-look-gem" src="/shop/gem-epic-v1.webp" width="512" height="512" alt="" aria-hidden="true" draggable="false" /> : null}
      {/* POP STYLE ART (Andy oct16 "make cosmetics the best they can be" — the pop styles were text-only cards): a painted
          swatch of the burst, one per style (ChatGPT, one consistent letterform across the set; public/shop/pop/). The
          stage is the card's keyboard TRY button (oct26). */}
      {type === 'popStyle' ? (
        <button type="button" className="sp2-look-stage" aria-label={`Try ${it.name}`} aria-pressed={!!trying} onClick={() => onTry && onTry(it.id)}>
          {/* the style's painted BURST (oct24) — the same art that blasts behind every +N pop on the menu, under the swatch */}
          {it.id !== 'classic' ? <img className="sp2-look-burst" src={`/shop/pop/burst-${it.id}.webp`} width="256" height="256" alt="" aria-hidden="true" draggable="false" /> : null}
          <img className="sp2-look-art" src={`/shop/pop/${it.id}.webp`} width="256" height="256" alt="" aria-hidden="true" draggable="false" />
        </button>
      ) : null}
      {/* SOUND PACK ART (oct17 night): one painted keycap per pack, all 12 as one set (Gemini, public/shop/snd/). HEAR BEFORE
          YOU BUY (oct29): the keycap is the button — a tap plays the pack's own click (clack.js previewClack), any pack */}
      {type === 'soundPack' ? (
        <button type="button" className="sp2-look-stage sp2-hear" aria-label={it.id === 'silent' ? `${it.name} — no click to hear` : `Hear ${it.name}`} data-testid={`hear-${it.id}`}
          onClick={(e) => { if (previewClack(it.id)) pressKey(e.currentTarget.querySelector('.sp2-look-art')); }}>
          <img className="sp2-look-art" src={`/shop/snd/${it.id}.webp`} width="256" height="256" alt="" aria-hidden="true" draggable="false" />
          {it.id !== 'silent' ? <KitIcon name="sound-on" size={26} shadow={2} extras={false} className="sp2-hear-ico" /> : null}
        </button>
      ) : null}
      <span className="sp2-look-name">{it.name}</span>
      {type === 'popStyle' && it.xpMult > 1 ? <span className="sp2-look-xp" data-testid={`pop-xp-${it.id}`}>{xpTag(it.xpMult)}</span> : null}
      <LookAct it={it} isOn={isOn} isOwned={isOwned} can={can} price={price} owner={owner} onBuy={onBuy} onEquip={onEquip} onWear={type === 'popStyle' ? onWear : null} />
    </div>
  );
}

// the loadout as the cards read it: with the owner flag, the pop slot shows the session-worn style
const loadout = (owner) => (owner ? { ...getEquipped(), popStyle: wornPopStyle() } : getEquipped());

/** tab = 'looks' | 'codes'. tryFxRef = the MenuXpFx layer ShopV2 mounts over the shelf for the TRY-ON. */
/** `only` ('pop' | 'sound'): one shelf section — the profile's CUSTOMIZE menu shows each under its own tab. */
export default function ShopV2Looks({ tab, gems, onNote, tryFxRef, only = null }) {
  const [owner] = useState(() => tryLooksOn());
  const [owned, setOwned] = useState(() => new Set(getOwned()));
  const [equipped, setEquipped] = useState(() => loadout(owner));
  const refresh = () => {
    setOwned(new Set(getOwned()));
    setEquipped(loadout(owner));
  };
  // TRY-ON (Andy oct26 "i want to playtest all the key looks"): tap a pop style → for TRY_MS every key (or TYPE-pad tap)
  // throws THAT style's real menu pop through the pooled MenuXpFx (letterPop + its look) — nothing is credited. Ends on
  // the timer, on another pick, on leaving the LOOKS tab or the screen. `n` restarts the window on a re-tap.
  const [trying, setTrying] = useState(null); // { id, n } | null
  const tryRef = useRef({ id: null, look: null, gain: 1, st: { count: 0, lastTime: 0 }, colors: TIER_COLORS, feel: 0, pad: 0 });
  const onTry = (id) => {
    const t = tryRef.current;
    t.id = id;
    t.look = null;
    t.gain = tryGain(id);
    t.st = { count: 0, lastTime: 0 };
    t.colors = equippedPopColors() || TIER_COLORS;
    t.feel = Math.min(5, getKeyTier());
    if (id !== 'classic') {
      import('../progress/popLooks.js').then((m) => { if (tryRef.current.id === id) tryRef.current.look = m.popLookOf(id); }, () => {});
    }
    setTrying((p) => ({ id, n: p ? p.n + 1 : 1 }));
  };
  // one key / pad tap → the menu's pop, exactly: the streak tier scales it, the tier colour + KEY feel tier dress it, the look paints it
  const fire = (letter) => {
    const t = tryRef.current;
    const fx = tryFxRef && tryFxRef.current;
    if (!t.id || !fx) return;
    const tier = tryStreak(t.st, performance.now());
    playClack(t.st.count - 1);
    // THE KIT (oct27): every 5th try key is a CRIT, so the try shows the look's crit too (the menu crits on gear / luck)
    if (t.look && t.st.count % 5 === 0 && fx.critPop) fx.critPop(letter, `CRIT +${formatNum(t.gain * 2)}`, TIER_SCALES[tier], t.look);
    else fx.letterPop(letter, `+${formatNum(t.gain)}`, TIER_SCALES[tier], t.colors[tier], t.feel, t.look);
  };
  const fireRef = useRef(fire);
  fireRef.current = fire;
  const live = trying && tab === 'looks' ? trying : null;
  useEffect(() => {
    if (tab !== 'looks') setTrying(null); // leaving the LOOKS shelf ends the try (coming back never resumes it)
  }, [tab]);
  useEffect(() => {
    if (!live) {
      tryRef.current.id = null;
      return undefined;
    }
    const end = setTimeout(() => setTrying(null), TRY_MS);
    const onKey = (e) => {
      if (!isCreditableKey(e)) return;
      const tg = e.target;
      if (tg && tg.closest && tg.closest('input, textarea, select, [contenteditable="true"]')) return;
      fireRef.current(String(e.key).toUpperCase());
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(end);
      window.removeEventListener('keydown', onKey);
    };
  }, [live]);
  const onPad = (e) => {
    e.preventDefault(); // a pad tap never focuses, zooms or starts a selection
    fire(padLetter(tryRef.current.pad++));
  };
  const onWear = (id) => {
    if (wearForSession(id)) refresh();
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
        {LEADERBOARD_ENABLED ? <RedeemCodes /> : <p className="sp2-codes-what">CODES NEED YOU ONLINE</p>}
      </div>
    );
  }
  const tried = live ? POP_STYLES.find((x) => x.id === live.id) : null;
  const triedPrice = tried ? priceOf(tried) : 0;
  return (
    <div className="sp2-looks">
      {only !== 'sound' ? (
        <>
          <h3 className="sp2-looks-h">POP STYLES</h3>
          <div className="sp2-looks-grid">
            {POP_STYLES.map((it) => <LookCard key={it.id} it={it} type="popStyle" owned={owned} equipped={equipped} gems={gems} onBuy={onBuy} onEquip={onEquip} onTry={onTry} trying={!!live && live.id === it.id} owner={owner} onWear={onWear} />)}
          </div>
        </>
      ) : null}
      {only !== 'pop' ? (
        <>
          <h3 className="sp2-looks-h">SOUND PACKS</h3>
          <div className="sp2-looks-grid">
            {SOUND_PACKS.map((it) => <LookCard key={it.id} it={it} type="soundPack" owned={owned} equipped={equipped} gems={gems} onBuy={onBuy} onEquip={onEquip} />)}
          </div>
        </>
      ) : null}
      {tried ? (
        // the TRYING bar sticks to the foot of the shelf's view, so the chip, the BUY and (phone) the TYPE pad stay in sight
        <div className="sp2-try" data-testid="sp2-try" data-try={tried.id} key={live.n}>
          <span className="sp2-try-chip">TRYING · {tried.name}</span>
          {/* THE KIT's BAR (oct27): the menu XP bar's fill while this look is worn */}
          {kitBarOf(tried.id) ? <span className="sp2-try-bar" data-testid="sp2-try-bar" aria-hidden="true" style={{ backgroundImage: `url(${kitBarOf(tried.id)})` }} /> : null}
          <LookAct it={tried} isOn={equipped.popStyle === tried.id} isOwned={owned.has(tried.id) || triedPrice === 0} can={gems >= triedPrice} price={triedPrice}
            owner={owner} onBuy={onBuy} onEquip={onEquip} onWear={onWear} />
          <button type="button" className="sp2-try-pad" data-testid="sp2-try-pad" onPointerDown={onPad}>TYPE</button>
        </div>
      ) : null}
    </div>
  );
}
