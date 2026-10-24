// SidekickPicker.jsx — the SIDEKICKS screen inside the PROFILE popup (kit.js). Left: YOUR hero on its pedestal with the
// sidekick you're looking at standing beside it — you try it on before you wear it. Right: the six sidekicks as painted
// tiles (the art is the button), and under them exactly how you get the one you're looking at: EQUIP, its WINS bar,
// or HOLD TO BUY with gems (never a loot box — you see what you buy). TAKE OFF clears the slot.
import { useEffect, useState } from 'react';
import { SIDEKICKS, kitById, kitSrc, ownsKit, kitGateMet, kitProgress, buyKit, equipPet } from './kit.js';
import HeroShowcase from './HeroShowcase.jsx';
import { KitHoldButton, KitIcon } from '../components/kit/index.js';
import FitText from '../components/kit/FitText.jsx';
import { getGems, subscribeGems } from '../progress/gemsCore';
import { formatNum } from '../format';
import { sndPurchase } from '../audio/gameSounds';
import './SidekickPicker.css';

/** @param hero your MAIN's id · @param pet the worn sidekick (null = none) · @param onPet(id|null) it changed */
export default function SidekickPicker({ hero, pet, onPet }) {
  const [look, setLook] = useState(pet || SIDEKICKS[0].id);
  const [gems, setGems] = useState(getGems);
  const [, bump] = useState(0);
  useEffect(() => subscribeGems(setGems), []);
  const s = kitById(look) || SIDEKICKS[0];
  const own = ownsKit(s.id);
  const prog = own ? null : kitProgress(s.id);
  const wear = (id) => { if (equipPet(id)) onPet(id); };
  const buy = () => {
    const r = buyKit(s.id);
    if (r.ok) { try { sndPurchase(); } catch { /* audio blocked */ } onPet(s.id); bump((n) => n + 1); }
  };
  let cta;
  if (own) {
    cta = s.id === pet
      ? <button type="button" className="skp-cta is-off" onClick={() => wear(null)}>TAKE OFF</button>
      : <button type="button" className="skp-cta" onClick={() => wear(s.id)}>WEAR {s.name}</button>;
  } else if (!kitGateMet(s.id)) {
    cta = <span className="skp-locked"><KitIcon name="lock" size={24} shadow={1} extras={false} />REBIRTH {s.reb}, THEN {formatNum(s.price)} GEMS</span>;
  } else {
    cta = (
      <KitHoldButton tone="gold" width={300} labelSize={gems >= s.price ? 28 : 22} label={gems >= s.price ? 'HOLD TO BUY' : 'NOT ENOUGH GEMS'}
        sub={gems >= s.price ? `${formatNum(s.price)} GEMS` : `NEED ${formatNum(s.price - gems)} MORE`}
        disabled={gems < s.price} confirmText="YOURS!" onConfirm={buy} ariaLabel={`Hold to buy ${s.name} for ${formatNum(s.price)} gems`} />
    );
  }
  return (
    <div className="skp" style={{ '--sk-c': s.color }} data-testid="sidekick-picker">
      <div className="skp-stage">
        <HeroShowcase id={hero} pet={s.id} />
      </div>
      <div className="skp-side">
        <div className="skp-grid" role="radiogroup" aria-label="Sidekicks">
          {SIDEKICKS.map((k) => {
            const mine = ownsKit(k.id);
            return (
              <button key={k.id} type="button" role="radio" aria-checked={k.id === look}
                className={`skp-tile${k.id === look ? ' is-look' : ''}${k.id === pet ? ' is-worn' : ''}${mine ? '' : ' is-locked'}${k.rare ? ' is-rare' : ''}`}
                style={{ '--t-c': k.color }} onClick={() => setLook(k.id)} aria-label={`${k.name}${k.id === pet ? ', worn' : mine ? '' : ', locked'}`}>
                <img src={kitSrc(k.id, 0)} width="256" height="256" alt="" aria-hidden="true" draggable="false" />
                {!mine ? <span className="skp-lock"><KitIcon name="lock" size={18} shadow={1} extras={false} /></span> : null}
                {k.id === pet ? <span className="skp-worn">WORN</span> : null}
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
            {!own ? <span className="skp-gems"><KitIcon name="gems" size={22} shadow={2} extras={false} />{formatNum(gems)}</span> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
