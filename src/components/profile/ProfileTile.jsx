// ProfileTile.jsx — the menu's right column on the paged desktop (oct17: the YOUR MAIN showcase moved INTO the
// PROFILE popup). Your main as its collectible card + your name + PROFILE; the whole tile opens the popup. Still: no
// idle loop here (the popup's showcase owns the signature move); an ELITE card keeps its timed shine.
import { heroById, CAST } from '../../cast/cast.js';
import HeroCard from '../../cast/HeroCard.jsx';
import FitText from '../kit/FitText.jsx';
import { getMyProfile } from '../../leaderboard/client.js';
import './ProfileTile.css';

export default function ProfileTile({ heroId, onOpen }) {
  const h = heroById(heroId) || CAST[0];
  const me = getMyProfile();
  return (
    <button type="button" className="pt" onClick={onOpen} data-nav="profile" aria-label="Open your profile" style={{ '--pt-c': h.color, '--pt-d': h.dark }}>
      <span className="pt-k">PROFILE</span>
      <span className="pt-card"><HeroCard hero={h} /></span>
      <FitText className="pt-name fit-center">{me ? me.username : 'YOU'}</FitText>
      <span className="pt-go">VIEW PROFILE</span>
    </button>
  );
}
