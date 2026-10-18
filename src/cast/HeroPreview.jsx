// HeroPreview.jsx — THE HERO PREVIEW (oct18, Andy: "more I WANT THAT … card previews … better hero menu presentation …
// larger proportions"). Tapping any card in the picker opens this: the hero BIG on its pedestal, alive (its signature
// idle + prop streams), cycling HERO → WIN → KO so you see every pose you'd get, on a stage in its own colour. A
// locked ELITE is shown for real here (the card keeps its silhouette — the preview is the tease). Beside it: the rarity,
// the name, the tag, the signature move, and exactly how you get it (a progress bar to the requirement, the gem price)
// with the one button that does it. ‹ › (or the arrow keys) flip through the whole roster.
// Motion: finite WAAPI one-shots re-armed on timers (nothing infinite), transform / opacity only, hidden tab skipped,
// reduce motion = still poses (kitPlay is a no-op).
import { useEffect, useRef, useState } from 'react';
import { CAST_IDLE, castIdleFrames, HERO_UNLOCK, ownsHero, goldProgress, hasPose, ALL_HEROES } from './cast.js';
import { rarityOf } from './CastArt.jsx';
import CastArt from './CastArt.jsx';
import { kitPlay } from '../components/kit/motion.js';
import { KitHoldButton, KitIcon } from '../components/kit/index.js';
import FitText from '../components/kit/FitText.jsx';
import { getRebirths, storedLevel } from '../progress/xp.js';
import { formatNum } from '../format';
import './HeroPreview.css';

// what each prop act is called on the preview ("SIGNATURE MOVE")
const MOVE = {
  spray: 'TAGS THE WALL', gum: 'BUBBLE POP', shout: 'HYPES THE ROOM', jab: 'THE ONE-TWO', magic: 'SPELLBOOK',
  rock: 'POWER CHORD', mvp: 'MEGAPHONE', champ: 'PRESS FLASH', arcane: 'ARCANE STAFF', glitch: 'CORRUPTED',
  snore: 'POWER NAP', eureka: 'WELL, ACTUALLY', haunt: 'HAUNTS YOU', mime: 'SILENT TREATMENT', sear: 'TOO HOT', boost: 'AFTERBURNER',
};
const TIER_NAME = { gold: 'GOLD', elite: 'ELITE', legend: 'LEGEND' };
const POSES = [['hero', 'HERO', 4200], ['win', 'WIN', 2400], ['ko', 'K.O.', 2400]];
const SWAP = [
  { transform: 'translateY(-14%) scale(.92, 1.08)', opacity: 0 },
  { transform: 'translateY(2%) scale(1.1, .9)', opacity: 1, offset: 0.55 },
  { transform: 'translateY(0) scale(1, 1)', opacity: 1 },
];

function onlineWins() {
  try { const o = JSON.parse(localStorage.getItem('taw.s2.count') || '{}'); return Math.max(0, Math.floor(Number(o && o.mp) || 0)); } catch { return 0; }
}
/** How far this save is toward an earnable hero: { have, need, label } — or null when it isn't earned through play. */
export function unlockProgress(h) {
  if (h.gold) { const p = goldProgress(h.id); return { have: p.have, need: p.need, label: `WINS WITH ${h.name.replace(/^GOLD /, '')}` }; }
  const u = HERO_UNLOCK[h.id];
  if (!u) return null;
  try {
    if (u.reb != null) return { have: Math.min(getRebirths() || 0, u.reb), need: u.reb, label: 'REBIRTHS' };
    if (u.lv != null) return { have: Math.min(storedLevel() || 1, u.lv), need: u.lv, label: 'LEVEL' };
    if (u.mp != null) return { have: Math.min(onlineWins(), u.mp), need: u.mp, label: 'ONLINE WINS' };
  } catch { /* a broken store reads as zero */ }
  return null;
}

/** NEXT HERO (the profile's goal): the not-yet-owned earnable hero this save is CLOSEST to (highest have / need), or null. */
export function nextHeroGoal() {
  let best = null;
  for (const h of ALL_HEROES) {
    if (ownsHero(h.id)) continue;
    const p = unlockProgress(h);
    if (!p || p.need <= 0) continue;
    const f = p.have / p.need;
    if (!best || f > best.f) best = { h, p, f };
  }
  return best;
}

/** The big stage: pedestal + the hero, alive, cycling its poses (a tapped tab holds that pose). */
function Stage({ h, pose, onTap }) {
  const artRef = useRef(null);
  useEffect(() => { kitPlay(artRef.current, SWAP, { duration: 380, easing: 'cubic-bezier(.2,1.2,.4,1)' }); }, [h.id, pose]);
  useEffect(() => {
    if (pose !== 'hero') return undefined;
    let t = 0;
    const loop = () => {
      const b = CAST_IDLE[h.id] || CAST_IDLE.hype;
      if (document.visibilityState !== 'hidden') kitPlay(artRef.current, castIdleFrames(b), { duration: b.ms, easing: 'ease-in-out' });
      t = setTimeout(loop, b.ms + (b.rest || 0));
    };
    t = setTimeout(loop, 420);
    return () => clearTimeout(t);
  }, [h.id, pose]);
  return (
    <button type="button" className="hpv-stage" onClick={onTap} aria-label={`${h.name}, ${pose} pose — tap for the next pose`}>
      <span className="hpv-floor" aria-hidden="true" />
      <img className="hpv-pedestal" src="/showcase/pedestal.webp" width="1234" height="590" alt="" aria-hidden="true" draggable="false" />
      <span className="hpv-hero">
        <CastArt artRef={artRef} key={`${h.id}-${pose}`} className="hpv-art" id={h.id} pose={pose} alt="" />
      </span>
    </button>
  );
}

/**
 * @param h the hero · @param current the equipped id · @param gems your balance
 * @param onEquip(id) · @param onBuy(id) → { ok } · @param onStep(-1|+1) flip to the neighbour · @param onClose back to the grid
 */
export default function HeroPreview({ h, current, gems, onEquip, onBuy, onStep, onClose }) {
  const [poseIx, setPoseIx] = useState(0);
  const [held, setHeld] = useState(false); // a tapped tab stops the auto-cycle
  const poses = POSES.filter(([p]) => p === 'hero' || hasPose(h.id, p) || hasPose(h.base || '', p));
  const [pose, , hold] = poses[poseIx % poses.length];
  useEffect(() => { setPoseIx(0); setHeld(false); }, [h.id]);
  useEffect(() => {
    if (held) return undefined;
    const t = setTimeout(() => setPoseIx((i) => (i + 1) % poses.length), hold);
    return () => clearTimeout(t);
  }, [poseIx, held, hold, poses.length]);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); onStep(-1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); onStep(1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onStep]);

  const r = rarityOf(h);
  const tier = r.tier || 'crew';
  const owned = ownsHero(h.id);
  const prog = owned ? null : unlockProgress(h);
  const move = MOVE[moveOf(h)] || null;
  return (
    <div className={`hpv is-${tier}`} style={{ '--hpv-c': h.color, '--hpv-d': h.dark }} data-testid="hero-preview" data-hero={h.id}>
      <div className="hpv-top">
        <button type="button" className="hpv-back" onClick={onClose}>‹ ALL HEROES</button>
        <span className="hpv-nav">
          <button type="button" className="hpv-arrow" onClick={() => onStep(-1)} aria-label="Previous hero">‹</button>
          <button type="button" className="hpv-arrow" onClick={() => onStep(1)} aria-label="Next hero">›</button>
        </span>
      </div>
      <div className="hpv-body">
        <div className="hpv-left">
          <Stage h={h} pose={pose} onTap={() => { setHeld(true); setPoseIx((i) => (i + 1) % poses.length); }} />
          <div className="hpv-poses" role="tablist" aria-label="Poses">
            {poses.map(([p, label], i) => (
              <button key={p} type="button" role="tab" aria-selected={pose === p} className={`hpv-pose${pose === p ? ' is-on' : ''}`}
                onClick={() => { setHeld(true); setPoseIx(i); }}>{label}</button>
            ))}
          </div>
        </div>
        <div className="hpv-right">
          <span className={`hpv-tier is-${tier}`}>{TIER_NAME[r.tier] || 'THE CREW'}</span>
          <FitText className="hpv-name">{h.name}</FitText>
          <span className="hpv-tag">{h.tag}</span>
          {move ? (
            <span className="hpv-move"><span className="hpv-move-k">SIGNATURE MOVE</span><span className="hpv-move-v">{move}</span></span>
          ) : null}
          <div className="hpv-get">
            {owned ? (
              h.id === current
                ? <span className="hpv-cta is-on">EQUIPPED</span>
                : <button type="button" className="hpv-cta" onClick={() => onEquip(h.id)}>EQUIP {h.name}</button>
            ) : (
              <>
                {prog ? (
                  <div className="hpv-prog">
                    <span className="hpv-prog-k">{prog.label}</span>
                    <span className="hpv-prog-bar"><span className="hpv-prog-fill" style={{ transform: `scaleX(${Math.min(1, prog.have / prog.need)})` }} /></span>
                    <span className="hpv-prog-n">{formatNum(prog.have)} / {formatNum(prog.need)}</span>
                  </div>
                ) : null}
                {h.gold ? (
                  <span className="hpv-note">EARNED ONLY. NEVER SOLD.</span>
                ) : h.price ? (
                  <div className="hpv-buy">
                    {prog ? <span className="hpv-note">OR SKIP THE WAIT</span> : null}
                    <KitHoldButton tone="gold" width={300} labelSize={24} label={gems >= h.price ? 'HOLD TO BUY' : 'NOT ENOUGH GEMS'}
                      sub={gems >= h.price ? `${formatNum(h.price)} GEMS` : `NEED ${formatNum(h.price - gems)} MORE`}
                      disabled={gems < h.price} confirmText="UNLOCKED!" onConfirm={() => onBuy(h.id)}
                      ariaLabel={`Hold to buy ${h.name} for ${formatNum(h.price)} gems`} />
                    <span className="hpv-gems"><KitIcon name="gems" size={22} shadow={2} extras={false} />{formatNum(gems)}</span>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** The prop act a hero plays (GOLD / ELITE fall back to their member's). */
function moveOf(h) {
  const byId = {
    riot: 'spray', glitch: 'gum', hype: 'shout', brawl: 'jab', hex: 'magic', dud: 'snore', lexi: 'eureka', boo: 'haunt',
    shh: 'mime', sizzle: 'sear', mecha: 'boost', 'riot-elite': 'rock', 'hype-elite': 'mvp', 'brawl-elite': 'champ',
    'hex-elite': 'arcane', 'glitch-elite': 'glitch',
  };
  return byId[h.id] || byId[h.base] || null;
}
