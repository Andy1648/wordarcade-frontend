// KitPicker.jsx — CUSTOMIZE → FRAME (kit.js, Andy "still gotta rework that interface"). Left: you, trying on the frame you're
// looking at: your hero as a card in it, and your menu PROFILE plate wearing it, exactly as the menu will draw it. Right: every
// frame ON YOUR FACE, split by tier (the art's own structure, avatarFrame.js), and how you get the one you're looking at.
// One tap: a frame you own goes on at once; TAKE OFF clears it. A frame you don't own shows its WINS bar, its MASTERY ROAD, or
// HOLD TO BUY with gems (never a loot box — you see what you buy). Static at rest; JACKPOT's coins play in the try-on only.
import { useEffect, useState } from 'react';
import { FRAMES, kitById, ownsKit, kitGateMet, kitProgress, buyKit, wearKit } from './kit.js';
import HeroShowcase from './HeroShowcase.jsx';
import FramedCard from './FramedCard.jsx';
import AvatarFrame from './AvatarFrame.jsx';
import { heroById, CAST, castSrc } from './cast.js';
import { KitHoldButton, KitIcon } from '../components/kit/index.js';
import FitText from '../components/kit/FitText.jsx';
import { getLastRank } from '../leaderboard/client.js';
import { leagueOf, LEAGUE_ART } from '../leaderboard/leagues.js';
import { getGems, subscribeGems } from '../progress/gemsCore';
import { formatNum } from '../format';
import { sndPurchase } from '../audio/gameSounds';
import './KitPicker.css';

// the tiers differ in STRUCTURE, not just colour (avatarFrame.js): plain band < band + corner brackets < the art breaks the frame
const TIERS = [
  ['STARTER', ['frost', 'graffiti', 'flame']],
  ['MASTERY', ['bomb', 'bolt', 'scholar', 'chain', 'defuser']],
  ['RARE', ['arcade', 'jackpot']],
];

/** @param hero your MAIN's id · @param kit { frame } worn · @param onKit('frame', id|null) what you wear changed */
export default function KitPicker({ hero, kit, onKit }) {
  const [look, setLook] = useState(kit.frame || FRAMES[0].id);
  const [gems, setGems] = useState(getGems);
  const [, bump] = useState(0);
  const [league] = useState(() => leagueOf(getLastRank()));
  const [holdW] = useState(() => (typeof window !== 'undefined' && window.innerWidth <= 380 ? 250 : 300)); // the small phone's panel is 280 wide
  useEffect(() => subscribeGems(setGems), []);
  const s = kitById(look) || FRAMES[0];
  const worn = kit.frame;
  const own = ownsKit(s.id);
  const prog = own ? null : kitProgress(s.id);
  const h = heroById(hero) || CAST[0];
  const face = castSrc(h.id, 'hero');
  const wear = (id) => { if (wearKit('frame', id)) onKit('frame', id); };
  const pick = (id) => {
    setLook(id);
    if (ownsKit(id) && id !== worn) wear(id); // a frame you own goes on at once: no second tap
  };
  const buy = () => {
    const r = buyKit(s.id);
    if (r.ok) { try { sndPurchase(); } catch { /* audio blocked */ } onKit('frame', s.id); bump((n) => n + 1); }
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
      <KitHoldButton tone="gold" width={holdW} labelSize={gems >= s.price ? 28 : 22} label={gems >= s.price ? 'HOLD TO BUY' : 'NOT ENOUGH GEMS'}
        sub={gems >= s.price ? `${formatNum(s.price)} GEMS` : `NEED ${formatNum(s.price - gems)} MORE`}
        disabled={gems < s.price} confirmText="YOURS!" onConfirm={buy} ariaLabel={`Hold to buy ${s.name} for ${formatNum(s.price)} gems`} />
    );
  }
  return (
    <div className="skp is-frame" style={{ '--sk-c': s.color }} data-testid="kit-picker">
      <div className="skp-stage">
        <FramedCard frame={s.id} hero={h} className="skp-card"><HeroShowcase id={hero} /></FramedCard>
        <span className="skp-plate" data-testid="kit-plate-preview" aria-label={`Your menu profile plate wearing ${s.name}`}>
          <AvatarFrame preview={s.id} src={face} bg={h.color} className="skp-plate-face" />
          <span className="skp-plate-t" aria-hidden="true">
            <span className="skp-plate-k">PROFILE</span>
            <span className="skp-plate-n">
              {league ? <img className="skp-plate-league" src={LEAGUE_ART[league.key]} width="512" height="512" alt="" draggable="false" /> : null}
              {league ? league.name : 'UNRANKED'}
            </span>
          </span>
        </span>
      </div>
      <div className="skp-side">
        <div className="skp-info">
          <FitText className="skp-name">{s.name}</FitText>
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
        <div className="skp-tiers" role="radiogroup" aria-label="Frames">
          {TIERS.map(([label, ids]) => (
            <div key={label} className="skp-tier" data-tier={label}>
              <span className="skp-tier-k">{label}</span>
              <div className="skp-tier-row">
                {ids.map((id) => {
                  const k = kitById(id);
                  const mine = ownsKit(id);
                  return (
                    <button key={id} type="button" role="radio" aria-checked={id === s.id}
                      className={`skp-tile${id === s.id ? ' is-look' : ''}${id === worn ? ' is-worn' : ''}${mine ? '' : ' is-locked'}`}
                      style={{ '--t-c': k.color }} onClick={() => pick(id)} data-frame-tile={id} aria-label={`${k.name}${id === worn ? ', worn' : mine ? '' : ', locked'}`}>
                      <AvatarFrame preview={id} src={face} bg={h.color} className="skp-tile-face" grow={1} still />
                      {!mine ? <span className="skp-lock"><KitIcon name="lock" size={18} shadow={1} extras={false} /></span> : null}
                      {id === worn ? <span className="skp-worn">WORN</span> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
