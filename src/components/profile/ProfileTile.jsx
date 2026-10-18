// ProfileTile.jsx — the PROFILE entry on the wide paged menu (≥ 1200px; under that the face sits in the icon cluster).
// oct17 night (Andy "still dont like the menu interface (with the profile thing there (also off center))"; research:
// the teen-game lobbies put identity in ONE thin CORNER CHIP — avatar + name + level — never a mid-size portrait card in
// a side column). Two variants for Andy to compare:
//   chip (default) — a chip under the icon cluster, the SAME width and right edge as the icons: your hero's face, your
//                    name, LV · PROFILE. The column below stays clear (boost timers, CREDITS).
//   slab (?menu=slab) — the right column as the left rail's twin: one framed box, your hero card sized by height.
// Both open the PROFILE popup. Static at rest (an ELITE card keeps its timed shine in the slab).
import { heroById, readMain, castSrc, CAST } from '../../cast/cast.js';
import HeroCard from '../../cast/HeroCard.jsx';
import FitText from '../kit/FitText.jsx';
import { getMyProfile } from '../../leaderboard/client.js';
import { peekUnseen } from '../../cast/heroSeen.js';
import { formatNum } from '../../format';
import './ProfileTile.css';

export default function ProfileTile({ heroId, onOpen, variant = 'chip', level = 1 }) {
  const h = heroById(heroId || readMain()) || CAST[0];
  const me = getMyProfile();
  const style = { '--pt-c': h.color, '--pt-d': h.dark };
  const fresh = peekUnseen().length; // heroes earned since your last look — their reveal waits in the profile (oct18)
  if (variant === 'chip') {
    return (
      <button type="button" className="pchip" onClick={onOpen} data-nav="profile" aria-label="Open your profile" style={style}>
        <span className="pchip-face" aria-hidden="true"><img src={castSrc(h.id, 'hero')} alt="" aria-hidden="true" draggable="false" /></span>
        <span className="pchip-text">
          <FitText className="pchip-name">{me ? me.username : 'YOU'}</FitText>
          {fresh ? <span className="pchip-sub is-new">NEW HERO!</span> : <span className="pchip-sub">LV {formatNum(level)} · PROFILE</span>}
        </span>
      </button>
    );
  }
  return (
    <button type="button" className="pt" onClick={onOpen} data-nav="profile" aria-label="Open your profile" style={style}>
      <span className="pt-k">PROFILE</span>
      <span className="pt-card"><HeroCard hero={h} /></span>
      <FitText className="pt-name fit-center">{me ? me.username : 'YOU'}</FitText>
      <span className={`pt-go${fresh ? ' is-new' : ''}`}>{fresh ? 'NEW HERO!' : 'VIEW PROFILE'}</span>
    </button>
  );
}
