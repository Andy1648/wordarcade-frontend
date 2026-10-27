// KitPicker.jsx — CUSTOMIZE inside the PROFILE popup (kit.js): two tabs, FRAME and WIN FX. Left: YOUR hero with the
// piece you're looking at already on it (your hero as a card in that frame, or the burst behind its WIN) — you try it on
// before you wear it, with whatever you wear in the other slot. Right: the pieces as painted tiles (the art is the
// button), and under them exactly how you get the one you're looking at: WEAR, its WINS bar, its MASTERY ROAD, or HOLD
// TO BUY with gems (never a loot box — you see what you buy). TAKE OFF clears the slot.
import { useEffect, useRef, useState } from 'react';
import { FRAMES, WIN_FX, kitById, kitSrc, ownsKit, kitGateMet, kitProgress, buyKit, wearKit } from './kit.js';
import HeroShowcase from './HeroShowcase.jsx';
import CastArt from './CastArt.jsx';
import { kitPlay } from '../components/kit/motion.js';
import FramedCard from './FramedCard.jsx';
import AvatarFrame from './AvatarFrame.jsx';
import { heroById, CAST, castSrc } from './cast.js';
import { KitHoldButton, KitIcon } from '../components/kit/index.js';
import FitText from '../components/kit/FitText.jsx';
import { getGems, subscribeGems } from '../progress/gemsCore';
import { formatNum } from '../format';
import { sndPurchase } from '../audio/gameSounds';
import './KitPicker.css';

const TABS = [['frame', 'FRAME', FRAMES], ['fx', 'WIN FX', WIN_FX]];
// the WIN FX try-on: the burst slams out behind your WIN pose each time you pick one (the results card's KIT_BURST)
const FX_BURST = [{ transform: 'scale(.2) rotate(-30deg)', opacity: 1 }, { transform: 'scale(1.12) rotate(4deg)', opacity: 1, offset: 0.16 }, { transform: 'scale(1) rotate(0deg)', opacity: 1, offset: 0.26 }, { transform: 'scale(1.04) rotate(8deg)', opacity: 1, offset: 0.8 }, { transform: 'scale(1) rotate(0deg)', opacity: 1 }];
function FxStage({ hero, fx }) {
  const ref = useRef(null);
  useEffect(() => { kitPlay(ref.current, FX_BURST, { duration: 1500, easing: 'cubic-bezier(.2,.9,.3,1)' }); }, [fx]);
  return (
    <div className="skp-fx" data-fx={fx}>
      <img ref={ref} className="skp-fx-burst" src={`/fx/win/${fx}.webp`} alt="" aria-hidden="true" draggable="false" />
      <CastArt className="skp-fx-hero" id={hero} pose="win" />
    </div>
  );
}

/** @param hero your MAIN's id · @param kit { frame, fx } worn · @param onKit(slot, id|null) a slot changed
 *  @param slot0 the tab to open on */
export default function KitPicker({ hero, kit, onKit, slot0 = 'frame' }) {
  const [slot, setSlot] = useState(TABS.some((t) => t[0] === slot0) ? slot0 : 'frame');
  const list = (TABS.find((t) => t[0] === slot) || TABS[0])[2];
  const [look, setLook] = useState({ frame: kit.frame || FRAMES[0].id, fx: kit.fx || WIN_FX[0].id });
  const [gems, setGems] = useState(getGems);
  const [, bump] = useState(0);
  useEffect(() => subscribeGems(setGems), []);
  const s = kitById(look[slot]) || list[0];
  const worn = kit[slot];
  const own = ownsKit(s.id);
  const prog = own ? null : kitProgress(s.id);
  const h = heroById(hero) || CAST[0];
  const wear = (id) => { if (wearKit(slot, id)) onKit(slot, id); };
  const buy = () => {
    const r = buyKit(s.id);
    if (r.ok) { try { sndPurchase(); } catch { /* audio blocked */ } onKit(slot, s.id); bump((n) => n + 1); }
  };
  let cta;
  if (own) {
    cta = s.id === worn
      ? <button type="button" className="skp-cta is-off" onClick={() => wear(null)}>TAKE OFF</button>
      : <button type="button" className="skp-cta" onClick={() => wear(s.id)}>WEAR {s.name}</button>;
  } else if (s.wheel) {
    cta = <span className="skp-locked"><KitIcon name="lock" size={24} shadow={1} extras={false} />WON ON THE DAILY WHEEL</span>;
  } else if (s.road) {
    cta = <span className="skp-locked"><KitIcon name="lock" size={24} shadow={1} extras={false} />ON THE {s.tag.replace(/ MASTERY$/, '')} MASTERY ROAD</span>;
  } else if (!kitGateMet(s.id)) {
    cta = <span className="skp-locked"><KitIcon name="lock" size={24} shadow={1} extras={false} />REBIRTH {s.reb}, THEN {formatNum(s.price)} GEMS</span>;
  } else {
    cta = (
      <KitHoldButton tone="gold" width={300} labelSize={gems >= s.price ? 28 : 22} label={gems >= s.price ? 'HOLD TO BUY' : 'NOT ENOUGH GEMS'}
        sub={gems >= s.price ? `${formatNum(s.price)} GEMS` : `NEED ${formatNum(s.price - gems)} MORE`}
        disabled={gems < s.price} confirmText="YOURS!" onConfirm={buy} ariaLabel={`Hold to buy ${s.name} for ${formatNum(s.price)} gems`} />
    );
  }
  // the try-on: the piece you're looking at, plus whatever you wear in the other slot
  const frame = slot === 'frame' ? s.id : kit.frame;
  const stage = <HeroShowcase id={hero} />;
  return (
    <div className={`skp is-${slot}`} style={{ '--sk-c': s.color }} data-testid="kit-picker">
      <div className="skp-stage">
        {slot === 'fx' ? <FxStage hero={hero} fx={s.id} />
          : frame ? <FramedCard frame={frame} hero={h} className="skp-card">{stage}</FramedCard> : stage}
        {/* oct26: the same frame as your round PORTRAIT (menu profile plate, your results row) */}
        {slot === 'frame' ? <AvatarFrame preview={s.id} src={castSrc(h.id, 'hero')} bg={h.color} className="skp-avatar" /> : null}
      </div>
      <div className="skp-side">
        <div className="skp-tabs" role="tablist" aria-label="Customize">
          {TABS.map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={k === slot} className={`skp-tab${k === slot ? ' is-on' : ''}`} onClick={() => setSlot(k)}>{label}</button>
          ))}
        </div>
        <div className={`skp-grid${slot === 'frame' ? ' is-frames' : ''}`} role="radiogroup" aria-label={slot === 'frame' ? 'Frames' : 'Win effects'}>
          {list.map((k) => {
            const mine = ownsKit(k.id);
            return (
              <button key={k.id} type="button" role="radio" aria-checked={k.id === s.id}
                className={`skp-tile${k.id === s.id ? ' is-look' : ''}${k.id === worn ? ' is-worn' : ''}${mine ? '' : ' is-locked'}${k.rare ? ' is-rare' : ''}`}
                style={{ '--t-c': k.color }} onClick={() => setLook((l) => ({ ...l, [slot]: k.id }))} aria-label={`${k.name}${k.id === worn ? ', worn' : mine ? '' : ', locked'}`}>
                <img src={kitSrc(k.id)} alt="" aria-hidden="true" draggable="false" />
                {!mine ? <span className="skp-lock"><KitIcon name="lock" size={18} shadow={1} extras={false} /></span> : null}
                {k.id === worn ? <span className="skp-worn">WORN</span> : null}
              </button>
            );
          })}
        </div>
        <div className="skp-info">
          <FitText className="skp-name">{s.name}</FitText>
          <span className="skp-tag">{s.rare ? `RARE · ${s.tag}` : s.tag}</span>
          {prog ? (
            <span className="skp-prog" aria-label={`${prog.have} of ${prog.need} ${prog.label.toLowerCase()}`}>
              <span className="skp-prog-bar"><span className="skp-prog-fill" style={{ transform: `scaleX(${Math.min(1, prog.have / prog.need)})` }} /></span>
              <span className="skp-prog-n">{formatNum(prog.have)} / {formatNum(prog.need)} {prog.label}{prog.gate ? '' : ' · FREE'}</span>
            </span>
          ) : null}
          <div className="skp-act">
            {cta}
            {!own && !s.road && !s.wheel ? <span className="skp-gems"><KitIcon name="gems" size={22} shadow={2} extras={false} />{formatNum(gems)}</span> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
