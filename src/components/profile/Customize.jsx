// Customize.jsx — THE ONE CUSTOMIZE MENU (Andy oct28: "i want all cosmetics to be from profile … you'd have a menu to
// customize all of those. be simplistic here"). Every cosmetic you wear, one tab strip: HERO (one grid — tap an owned
// hero to wear it), FRAME + WIN FX (KitPicker: try it on your hero, wear / buy), POP STYLE + SOUND (the shop's LOOKS
// cards, try-on included). Reached from PROFILE and from the shop's COSMETICS button — the shop has no cosmetics screen
// of its own any more. No new cosmetic types: this only gathers the existing ones in one place.
import { useEffect, useRef, useState } from 'react';
import HeroPicker from '../../cast/HeroPicker.jsx';
import KitPicker from '../../cast/KitPicker.jsx';
import ShopV2Looks from '../ShopV2Looks.jsx';
import { MenuXpFx } from '../MenuXp';
import { menuTier } from '../../progress/menuTier';
import { loadProgress, getRebirths } from '../../progress/xp';
import { getGems, subscribeGems } from '../../progress/gemsCore';
import { V3 } from '../../progress/season';
import '../ShopV2.css';
import './Customize.css';

export const CZ_TABS = [['hero', 'HERO'], ['frame', 'FRAME'], ['fx', 'WIN FX'], ['pop', 'POP STYLE'], ['sound', 'SOUND']];

/** @param hero your MAIN · @param kit { frame, fx } worn · @param onKit(slot, id) · @param onEquip(heroId) · @param onBought(heroId)
 *  @param tab0 the tab to open on */
export default function Customize({ hero, kit, onKit, onEquip, onBought, tab0 = 'hero' }) {
  const [tab, setTab] = useState(CZ_TABS.some((t) => t[0] === tab0) ? tab0 : 'hero');
  const [gems, setGems] = useState(getGems);
  const [note, setNote] = useState(null);
  const tryFxRef = useRef(null); // the POP STYLE try-on's pop layer (the menu's own MenuXpFx)
  const [tryTier] = useState(() => menuTier(loadProgress().level, getRebirths()));
  useEffect(() => subscribeGems((v) => setGems(typeof v === 'number' ? v : getGems())), []);
  useEffect(() => setNote(null), [tab]);
  const looks = tab === 'pop' || tab === 'sound';
  // the shop's COSMETICS dot (v3/shopDots.js): the looks you can now afford are SEEN once this shelf shows them
  useEffect(() => { if (looks && V3.dots) V3.dots.markLooksSeen(gems); }, [looks, gems]);
  return (
    <div className={`cz is-${tab}`} data-testid="customize">
      <div className="cz-tabs" role="tablist" aria-label="Customize">
        {CZ_TABS.map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={k === tab} className={`cz-tab${k === tab ? ' is-on' : ''}`} data-cz={k} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>
      <div className="cz-body">
        {tab === 'hero' ? <HeroPicker current={hero} onEquip={onEquip} onBought={onBought} tapEquips /> : null}
        {tab === 'frame' || tab === 'fx' ? <KitPicker key={tab} hero={hero} kit={kit} onKit={onKit} slot0={tab} bare /> : null}
        {looks ? (
          <div className="cz-looks">
            {tab === 'pop' ? <div className="sp2-tryfx" aria-hidden="true"><MenuXpFx ref={tryFxRef} menuTier={tryTier} /></div> : null}
            <ShopV2Looks key={tab} tab="looks" only={tab} gems={gems} onNote={setNote} tryFxRef={tryFxRef} />
            <div className="cz-note" role="status" aria-live="polite">{note}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
