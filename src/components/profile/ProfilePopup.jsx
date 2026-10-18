// ProfilePopup.jsx — YOUR PROFILE (Andy oct17: "change the area to 'profile' as a popup and move the whole avatar thing
// inside the profile … the most basic and important user stats (like time played) as well as a space for the profile
// description (the same that transfers to the leaderboard when others click)"). Left: your hero alive on its pedestal
// (signature idle + layered props; tap = WIN) and CHANGE HERO → the card picker in place. Right: your name + worn title,
// six stat tiles, the DESCRIPTION editor (ProfileCard's own Bio — what others see when they tap you on the board) and
// the title picker. Lazy (its own chunk); the card pops in once, nothing loops.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { heroById, readMain, writeMain, CAST } from '../../cast/cast.js';
import HeroShowcase from '../../cast/HeroShowcase.jsx';
import HeroPicker from '../../cast/HeroPicker.jsx';
import FitText from '../kit/FitText.jsx';
import KitIcon from '../kit/KitIcon.jsx';
import '../kit/kitIconData.js';
import { kitPlay } from '../kit/motion.js';
import { Bio } from '../ProfileCard.jsx';
import { myBio, myShowcase } from '../../leaderboard/showcase.js';
import { getMyProfile, myStats, pushShowcaseNow } from '../../leaderboard/client.js';
import { readCounters } from '../../progress/v3/store.js';
import { readPlaySec, formatPlayTime } from '../../progress/playClock.js';
import { formatNum } from '../../format';
import UnlistedShelf from '../../unlisted/UnlistedShelf.jsx';
import { unlistedIndex } from '../../unlisted/unlisted.js';
import './ProfilePopup.css';

const POP = [{ transform: 'scale(.9) translateY(12px)', opacity: 0 }, { transform: 'scale(1.02)', opacity: 1, offset: 0.6 }, { transform: 'scale(1)', opacity: 1 }];

function Stat({ icon, glyph, tone, value, label }) {
  return (
    <div className="pf-stat" style={{ '--pf-t': tone }}>
      {glyph ? <img className="pf-stat-g" src={`/ach/${glyph}.svg`} alt="" aria-hidden="true" /> : <KitIcon name={icon} size={36} shadow={2} extras={false} />}
      <FitText className="pf-stat-v">{value}</FitText>
      <span className="pf-stat-k">{label}</span>
    </div>
  );
}

/** @param onClose · @param onMainChange(id) the menu re-reads your hero */
export default function ProfilePopup({ onClose, onMainChange }) {
  const [id, setId] = useState(readMain);
  const [view, setView] = useState('profile'); // 'profile' | 'pick'
  const [cheer, setCheer] = useState(0);
  const cardRef = useRef(null);
  const h = heroById(id) || CAST[0];
  const me = getMyProfile();
  const st = myStats();
  const c = readCounters();
  const play = readPlaySec();
  const show = myShowcase(); // the same numbers the leaderboard card shows others (gears found)
  const [unl] = useState(() => unlistedIndex()); // THE UNLISTED: your finds + serials (read once)

  useEffect(() => { kitPlay(cardRef.current, POP, { duration: 300, easing: 'cubic-bezier(.2,1.2,.4,1)' }); }, []);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      if (view === 'pick') setView('profile'); else onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [view, onClose]);

  const equip = (next) => {
    writeMain(next);
    setId(next);
    pushShowcaseNow(); // 053: everyone's board shows your new hero
    setView('profile');
    if (onMainChange) onMainChange(next);
  };
  const bought = (next) => { equip(next); setTimeout(() => setCheer((n) => n + 1), 480); };

  return createPortal(
    <div className="pf-scrim" role="presentation" onClick={onClose}>
      <div ref={cardRef} className={`pf is-${view}`} role="dialog" aria-modal="true" aria-label="Your profile" data-testid="profile-popup"
        style={{ '--pf-c': h.color, '--pf-d': h.dark }} onClick={(e) => e.stopPropagation()}>
        <div className="pf-head">
          {view === 'pick' ? <button type="button" className="pf-back" onClick={() => setView('profile')}>← BACK</button> : null}
          <span className="pf-title">{view === 'pick' ? 'CHOOSE YOUR MAIN' : 'PROFILE'}</span>
          <button type="button" className="pf-x" onClick={onClose} aria-label="Close profile">✕</button>
        </div>
        {view === 'pick' ? (
          <HeroPicker current={id} onEquip={equip} onBought={bought} />
        ) : (
          <div className="pf-body">
            <div className="pf-left">
              <HeroShowcase id={h.id} cheer={cheer} />
              <FitText className="pf-hero fit-center">{h.name}</FitText>
              <span className="pf-hero-tag">{h.elite ? `ELITE · ${h.tag}` : h.legend ? `LEGEND · ${h.tag}` : h.gold ? `GOLD · ${h.tag}` : h.tag}</span>
              <button type="button" className="pf-change" onClick={() => setView('pick')}>CHANGE HERO</button>
            </div>
            <div className="pf-right">
              <div className="pf-id">
                <FitText className="pf-name">{me ? me.username : 'NO NAME YET'}</FitText>
                {!me ? <span className="pf-hint">CLAIM A NAME ON THE LEADERBOARD</span> : null}
              </div>
              <div className="pf-stats">
                <Stat icon="clock" tone="#2EFFE0" value={formatPlayTime(play)} label="TIME PLAYED" />
                <Stat glyph="key" tone="#FFE94A" value={formatNum(st.lifetimeWords || c.words || 0)} label="WORDS TYPED" />
                <Stat glyph="cup" tone="#FF4FA3" value={formatNum((c.mp || 0) + (c.bots || 0))} label="GAMES WON" />
                <Stat icon="levels" tone="#B04BFF" value={formatNum(st.level)} label="LEVEL" />
                <Stat icon="rebirth" tone="#FF6B3D" value={formatNum(st.rebirths)} label="REBIRTHS" />
                <Stat icon="index" tone="#c9b8ff" value={show.gears_total ? `${formatNum(show.gears_found)}/${formatNum(show.gears_total)}` : '0'} label="GEARS FOUND" />
              </div>
              <UnlistedShelf tiles={unl.tiles.filter((t) => t.owned)} />
              {me ? <Bio text={myBio()} mine /> : null}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
