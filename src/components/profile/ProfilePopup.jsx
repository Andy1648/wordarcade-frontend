// ProfilePopup.jsx — YOUR PROFILE (Andy oct17: "change the area to 'profile' as a popup and move the whole avatar thing
// inside the profile … the most basic and important user stats (like time played) as well as a space for the profile
// description (the same that transfers to the leaderboard when others click)"). Left: your hero alive on its pedestal
// (signature idle + layered props; tap = WIN) and ONE button, CUSTOMIZE → every cosmetic in one menu (Customize.jsx —
// hero, frame, WIN FX, pop style, sound; the shop's COSMETICS button opens the same menu). Right: your name + worn title,
// six stat tiles and the DESCRIPTION editor (ProfileCard's own Bio — what others see when they tap you on the board).
// oct28 (Andy "unecessarily cramped … reduced unecessary stuff"): the hero's tagline, CHANGE HERO and the YOUR HEROES
// strip are gone — the HERO tab of CUSTOMIZE is the one place to pick. Lazy (its own chunk); pops in once, nothing loops.
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { heroById, readMain, writeMain, CAST } from '../../cast/cast.js';
import HeroShowcase from '../../cast/HeroShowcase.jsx';
import { readKit } from '../../cast/kit.js';
import FramedCard from '../../cast/FramedCard.jsx';
import Customize from './Customize.jsx';
import HeroUnlock from '../../cast/HeroUnlock.jsx';
import { unseenHeroes } from '../../cast/heroSeen.js';
import { rarityOf } from '../../cast/CastArt.jsx';
import FitText from '../kit/FitText.jsx';
import KitIcon from '../kit/KitIcon.jsx';
import '../kit/kitIconData.js';
import { kitPlay } from '../kit/motion.js';
import { Bio, BadgeRow } from '../ProfileCard.jsx';
import { myBio, myShowcase } from '../../leaderboard/showcase.js';
import { getMyProfile, myStats, pushShowcaseNow } from '../../leaderboard/client.js';
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

/** A banner STAT MEDALLION (nov2 design audit #14 / research 5.1 — "a banner with fixed slots: 3 trackers"): the kit icon
 *  over a big Bungee number on a round tier-coloured plate (a circle — the one shape CSS may draw; the painted medallions
 *  hero-art is making replace the plate when they land), the label under it. */
function Medal({ icon, tone, value, label, id }) {
  return (
    <div className="pf-medal" style={{ '--pf-t': tone }} data-testid={`profile-medal-${id}`}>
      <span className="pf-medal-disc">
        <KitIcon name={icon} size={34} shadow={2} extras={false} />
        <FitText className="pf-medal-v fit-center">{value}</FitText>
      </span>
      <span className="pf-medal-k">{label}</span>
    </div>
  );
}
/** The 3 badge slots: your three highest claimed achievement tiers (the board card's own badge row). */
const top3 = (badges) => Object.fromEntries(Object.entries(badges || {}).sort((a, b) => b[1] - a[1]).slice(0, 3));

/** @param onClose · @param onMainChange(id) the menu re-reads your hero
 *  @param view0 'profile' | 'customize' (the shop's COSMETICS opens straight onto CUSTOMIZE) · @param tab0 CUSTOMIZE's first tab */
export default function ProfilePopup({ onClose, onMainChange, view0 = 'profile', tab0 = 'hero' }) {
  const [id, setId] = useState(readMain);
  const [view, setView] = useState(view0); // 'profile' | 'customize' (every cosmetic: Customize.jsx)
  const [kit, setKit] = useState(readKit); // the worn components { frame, fx }
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
  const play = readPlaySec();
  const show = myShowcase();
  // THE UNLISTED: still read once on open — it runs the back-fill (unlisted.js) — but nothing here shows it: no shelf,
  // no found-count on your profile (Andy oct19 "i still see how many unlisted ive found in profile - i dont want that")
  useState(() => unlistedIndex());

  useEffect(() => { kitPlay(cardRef.current, POP, { duration: 300, easing: 'cubic-bezier(.2,1.2,.4,1)' }); }, []);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape' || reveal || titles) return; // the reveal / the title ladder own Escape while up
      e.stopPropagation();
      if (view !== 'profile' && view0 === 'profile') setView('profile'); else onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [view, view0, onClose, reveal, titles]);

  const equip = (next) => {
    writeMain(next);
    setId(next);
    pushShowcaseNow(); // 053: everyone's board shows your new hero
    if (onMainChange) onMainChange(next);
  };
  const bought = (next) => { equip(next); setReveal({ ids: [next], equipped: next }); };
  const revealDone = () => { const was = reveal; setReveal(null); if (was && was.equipped) setTimeout(() => setCheer((n) => n + 1), 200); };

  return createPortal(
    <div className="pf-scrim" role="presentation" onClick={onClose}>
      <div ref={cardRef} className={`pf is-${view}`} role="dialog" aria-modal="true" aria-label="Your profile" data-testid="profile-popup"
        style={{ '--pf-c': h.color, '--pf-d': h.dark }} onClick={(e) => e.stopPropagation()}>
        <div className="pf-head">
          {view !== 'profile' ? <button type="button" className="pf-back" onClick={() => setView('profile')} aria-label="Back to your profile">←<span className="pf-back-w"> PROFILE</span></button> : null}
          <span className="pf-title">{view === 'customize' ? 'CUSTOMIZE' : 'PROFILE'}</span>
          <button type="button" className="pf-x" onClick={onClose} aria-label="Close profile">✕</button>
        </div>
        {view === 'customize' ? (
          <Customize hero={h.id} kit={kit} onKit={(slot, v) => setKit((k) => ({ ...k, [slot]: v }))} onEquip={equip} onBought={bought} tab0={tab0} />
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
              <button type="button" className="pf-kit" onClick={() => setView('customize')} data-testid="profile-kit">CUSTOMIZE</button>
            </div>
            <div className="pf-right">
              <div className="pf-id">
                <div className="pf-nameline">
                  {/* ONE name source (nov2 audit #14: "NO NAME YET" sat beside a KEYFIEND plate): no name yet → the plate
                      stands alone and the hint under it says how to get one */}
                  {me ? <FitText className="pf-name">{me.username}</FitText> : null}
                  {/* TITLE (oct28): the painted title sits ON your name, the way everyone else sees it; tap → TITLES */}
                  <button type="button" className="pf-titlerow" onClick={() => setTitles(true)} data-testid="profile-title" aria-label={`Title: ${title.name} — see all titles`}>
                    <KitRankPlate rank={title.req} fit className="pf-title-plate" />
                    <span className="pf-titlerow-go" aria-hidden="true">CHANGE ▸</span>
                  </button>
                </div>
                {!me ? <span className="pf-hint">CLAIM A NAME ON THE LEADERBOARD</span> : null}
                {me ? <Suspense fallback={null}><SaveCodeChip /></Suspense> : null}
              </div>
              {/* THE BANNER (nov2 design audit #14, research 5.1): three trackers, not a six-tile dashboard — the rest lives
                  in STATS — and up to three badges, your best */}
              <div className="pf-medals">
                <Medal id="time" icon="clock" tone="#2EFFE0" value={formatPlayTime(play)} label="TIME PLAYED" />
                <Medal id="level" icon="levels" tone="#B04BFF" value={formatNum(st.level)} label="LEVEL" />
                <Medal id="rebirths" icon="rebirth" tone="#FF6B3D" value={formatNum(st.rebirths)} label="REBIRTHS" />
              </div>
              <BadgeRow badges={top3(show.badges)} />
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
