// ProfilePopup.jsx — YOUR PROFILE (Andy oct17: "change the area to 'profile' as a popup and move the whole avatar thing
// inside the profile … the most basic and important user stats (like time played) as well as a space for the profile
// description (the same that transfers to the leaderboard when others click)"). Left: your hero alive on its pedestal
// (signature idle + layered props; tap = WIN) and CHANGE HERO → the card picker in place. Right: your name + worn title,
// six stat tiles, the DESCRIPTION editor (ProfileCard's own Bio — what others see when they tap you on the board) and
// the title picker. Lazy (its own chunk); the card pops in once, nothing loops.
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { heroById, readMain, writeMain, CAST, castSrc, ALL_HEROES, ownsHero } from '../../cast/cast.js';
import HeroShowcase from '../../cast/HeroShowcase.jsx';
import { readKit } from '../../cast/kit.js';
import KitPicker from '../../cast/KitPicker.jsx';
import FramedCard from '../../cast/FramedCard.jsx';
import HeroPicker from '../../cast/HeroPicker.jsx';
import HeroUnlock from '../../cast/HeroUnlock.jsx';
import { unseenHeroes } from '../../cast/heroSeen.js';
import { rarityOf } from '../../cast/CastArt.jsx';
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
import { unlistedIndex } from '../../unlisted/unlisted.js';
import { KitRankPlate } from '../kit/KitRankPlate.jsx';
import { RANKS_V3, liveRankV3 } from '../../progress/v3/ranks.js';
import { shownPlateIndex } from '../../progress/platePick';
import './ProfilePopup.css';

// ALL TITLES (Andy oct21 "include title popup in the profile"): the TITLE row opens the ladder on top of the profile
const RankLadder = lazy(() => import('../RankLadder.jsx'));
// SAVE CODE (save-safety oct28): your short code + COPY under your name — lazy (the save-code chunk carries the codec)
const SaveCodeChip = lazy(() => import('../../save/SaveCodeNudge.jsx'));
function wornTitle() {
  try {
    const you = Math.max(0, RANKS_V3.indexOf(liveRankV3()));
    return RANKS_V3[shownPlateIndex(you)] || RANKS_V3[0];
  } catch {
    return RANKS_V3[0];
  }
}

const POP = [{ transform: 'scale(.9) translateY(12px)', opacity: 0 }, { transform: 'scale(1.02)', opacity: 1, offset: 0.6 }, { transform: 'scale(1)', opacity: 1 }];

function Stat({ icon, glyph, tone, value, label }) {
  return (
    <div className="pf-stat" style={{ '--pf-t': tone }}>
      {glyph ? <img className="pf-stat-g" src={`/ach/${glyph}.svg`} alt="" aria-hidden="true" /> : <KitIcon name={icon} size={44} shadow={2} extras={false} />}
      <FitText className="pf-stat-v">{value}</FitText>
      <span className="pf-stat-k">{label}</span>
    </div>
  );
}

/** @param onClose · @param onMainChange(id) the menu re-reads your hero */
export default function ProfilePopup({ onClose, onMainChange }) {
  const [id, setId] = useState(readMain);
  const [view, setView] = useState('profile'); // 'profile' | 'pick' | 'kit' (CUSTOMIZE: frame + WIN FX)
  const [kit, setKit] = useState(readKit); // the worn components { frame, fx }
  const [peekId, setPeekId] = useState(null); // the picker can open straight onto one hero's preview
  const [cheer, setCheer] = useState(0);
  const [titles, setTitles] = useState(false); // ALL TITLES open over the profile
  const [title, setTitle] = useState(wornTitle); // re-read when the ladder closes (a new title may be worn)
  // NEW HERO! (oct18): heroes earned by playing since the last look reveal on open (rarest last); a purchase reveals too
  const [reveal, setReveal] = useState(() => {
    const ids = unseenHeroes();
    const rank = { gold: 1, elite: 2, legend: 3 };
    ids.sort((a, b) => (rank[rarityOf(heroById(a)).tier] || 0) - (rank[rarityOf(heroById(b)).tier] || 0));
    return ids.length ? { ids, equipped: null } : null;
  });
  const cardRef = useRef(null);
  const h = heroById(id) || CAST[0];
  const me = getMyProfile();
  const st = myStats();
  const c = readCounters();
  const play = readPlaySec();
  const show = myShowcase();
  const mine = ALL_HEROES.filter((x) => ownsHero(x.id)); // YOUR HEROES: what you've got (oct19: no 'next hero' nag)
  // THE UNLISTED: still read once on open — it runs the back-fill (unlisted.js) — but nothing here shows it: no shelf,
  // no found-count on your profile (Andy oct19 "i still see how many unlisted ive found in profile - i dont want that")
  useState(() => unlistedIndex());

  useEffect(() => { kitPlay(cardRef.current, POP, { duration: 300, easing: 'cubic-bezier(.2,1.2,.4,1)' }); }, []);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape' || reveal || titles) return; // the reveal / the title ladder own Escape while up
      e.stopPropagation();
      if (view !== 'profile') setView('profile'); else onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [view, onClose, reveal, titles]);

  const equip = (next) => {
    writeMain(next);
    setId(next);
    pushShowcaseNow(); // 053: everyone's board shows your new hero
    setView('profile');
    if (onMainChange) onMainChange(next);
  };
  const bought = (next) => { equip(next); setReveal({ ids: [next], equipped: next }); };
  const revealDone = () => { const was = reveal; setReveal(null); if (was && was.equipped) setTimeout(() => setCheer((n) => n + 1), 200); };

  return createPortal(
    <div className="pf-scrim" role="presentation" onClick={onClose}>
      <div ref={cardRef} className={`pf is-${view}`} role="dialog" aria-modal="true" aria-label="Your profile" data-testid="profile-popup"
        style={{ '--pf-c': h.color, '--pf-d': h.dark }} onClick={(e) => e.stopPropagation()}>
        <div className="pf-head">
          {view !== 'profile' ? <button type="button" className="pf-back" onClick={() => setView('profile')}>← BACK</button> : null}
          <span className="pf-title">{view === 'pick' ? 'CHOOSE YOUR MAIN' : view === 'kit' ? 'CUSTOMIZE' : 'PROFILE'}</span>
          <button type="button" className="pf-x" onClick={onClose} aria-label="Close profile">✕</button>
        </div>
        {view === 'pick' ? (
          <HeroPicker current={id} onEquip={equip} onBought={bought} peekId={peekId} />
        ) : view === 'kit' ? (
          <KitPicker hero={h.id} kit={kit} onKit={(slot, v) => setKit((k) => ({ ...k, [slot]: v }))} />
        ) : (
          <div className="pf-body">
            <div className="pf-left">
              {kit.frame ? (
                // a worn FRAME (kit.js) makes your hero a CARD: the frame carries the name on its plate
                <FramedCard frame={kit.frame} hero={h} className="pf-card"><HeroShowcase id={h.id} cheer={cheer} /></FramedCard>
              ) : (
                <>
                  <HeroShowcase id={h.id} cheer={cheer} />
                  <FitText className="pf-hero fit-center">{h.name}</FitText>
                </>
              )}
              <span className="pf-hero-tag">{h.elite ? `ELITE · ${h.tag}` : h.legend ? `LEGEND · ${h.tag}` : h.gold ? `GOLD · ${h.tag}` : h.tag}</span>
              <div className="pf-change-row">
                <button type="button" className="pf-change" onClick={() => { setPeekId(null); setView('pick'); }}>CHANGE HERO</button>
                <button type="button" className="pf-kit" onClick={() => setView('kit')} data-testid="profile-kit">CUSTOMIZE</button>
              </div>
            </div>
            <div className="pf-right">
              <div className="pf-id">
                <div className="pf-nameline">
                  <FitText className="pf-name">{me ? me.username : 'NO NAME YET'}</FitText>
                  {/* TITLE (oct28): the painted title sits ON your name, the way everyone else sees it; tap → TITLES */}
                  <button type="button" className="pf-titlerow" onClick={() => setTitles(true)} data-testid="profile-title" aria-label={`Title: ${title.name} — see all titles`}>
                    <KitRankPlate rank={title.req} fit className="pf-title-plate" />
                    <span className="pf-titlerow-go" aria-hidden="true">CHANGE ▸</span>
                  </button>
                </div>
                {!me ? <span className="pf-hint">CLAIM A NAME ON THE LEADERBOARD</span> : null}
                {me ? <Suspense fallback={null}><SaveCodeChip /></Suspense> : null}
              </div>
              <div className="pf-stats">
                <Stat icon="clock" tone="#2EFFE0" value={formatPlayTime(play)} label="TIME PLAYED" />
                <Stat glyph="key" tone="#FFE94A" value={formatNum(st.lifetimeWords || c.words || 0)} label="WORDS TYPED" />
                <Stat glyph="cup" tone="#FF4FA3" value={formatNum((c.mp || 0) + (c.bots || 0))} label="GAMES WON" />
                <Stat icon="levels" tone="#B04BFF" value={formatNum(st.level)} label="LEVEL" />
                <Stat icon="rebirth" tone="#FF6B3D" value={formatNum(st.rebirths)} label="REBIRTHS" />
                <Stat icon="index" tone="#c9b8ff" value={show.gears_total ? `${formatNum(show.gears_found)}/${formatNum(show.gears_total)}` : '0'} label="GEARS FOUND" />
              </div>
              <section className="pf-crew" aria-label="Your heroes">
                <header className="pf-crew-head"><span className="pf-crew-k">YOUR HEROES</span><span className="pf-crew-n">{mine.length}/{ALL_HEROES.length}</span></header>
                <div className="pf-crew-row">
                  {mine.map((x) => (
                    <button key={x.id} type="button" className={`pf-crew-face${x.id === h.id ? ' is-on' : ''}${x.gold ? ' is-gold' : x.elite ? ' is-elite' : x.legend ? ' is-legend' : ''}`}
                      style={{ '--cf-d': x.dark || h.dark }} onClick={() => { if (x.id !== h.id) equip(x.id); }}
                      aria-label={x.id === h.id ? `${x.name}, equipped` : `Equip ${x.name}`} aria-pressed={x.id === h.id}>
                      <img src={castSrc(x.id, 'hero')} width="512" height="512" alt="" aria-hidden="true" draggable="false" />
                    </button>
                  ))}
                </div>
              </section>
              {me ? <Bio text={myBio()} mine /> : null}
            </div>
          </div>
        )}
      </div>
      {titles ? <Suspense fallback={null}><RankLadder onClose={() => { setTitles(false); setTitle(wornTitle()); }} /></Suspense> : null}
      {reveal ? <HeroUnlock ids={reveal.ids} equipped={reveal.equipped} onEquip={(next) => { equip(next); setReveal((r) => (r ? { ...r, equipped: next } : r)); }} onClose={revealDone} /> : null}
    </div>,
    document.body,
  );
}
