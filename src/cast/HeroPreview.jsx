// HeroPreview.jsx — THE HERO PREVIEW (oct18, Andy: "more I WANT THAT … card previews … better hero menu presentation …
// larger proportions"). Tapping any card in the picker opens this: the hero BIG on its pedestal, alive (its signature
// idle + prop streams), cycling HERO → WIN → KO so you see every pose you'd get, on a stage in its own colour. A
// locked ELITE is shown for real here (the card keeps its silhouette — the preview is the tease). Beside it: the rarity,
// the name, the tag, the signature move, and exactly how you get it (a progress bar to the requirement, the gem price)
// with the one button that does it. ‹ › (or the arrow keys) flip through the whole roster.
// Motion: finite WAAPI one-shots re-armed on timers (nothing infinite), transform / opacity only, hidden tab skipped,
// reduce motion = still poses (kitPlay is a no-op).
import { useEffect, useRef, useState } from 'react';
import { HERO_UNLOCK, ownsHero, heroGateMet, goldProgress, hasPose, totalWins, castSrc } from './cast.js';
import { rarityOf } from './CastArt.jsx';
import CastArt from './CastArt.jsx';
import { kitPlay } from '../components/kit/motion.js';
import { KitHoldButton, KitIcon } from '../components/kit/index.js';
import FitText from '../components/kit/FitText.jsx';
import { getRebirths, storedLevel } from '../progress/xp.js';
import { formatNum } from '../format';
import './HeroPreview.css';

const TIER_NAME = { gold: 'GOLD', elite: 'ELITE', legend: 'LEGEND' };
const POSES = [['hero', 'HERO', 4200], ['win', 'WIN', 2400], ['ko', 'K.O.', 2400]];
const SWAP = [{ opacity: 0 }, { opacity: 1 }]; // oct18: pose swaps fade (no squash bounce)

/** How far this save is toward an earnable hero: { have, need, label } — or null when it isn't earned through play. A
 *  LEGEND's rebirth (a gate: the rebirth unlocks the BUY, it doesn't earn the hero) is reported the same way, with `gate`. */
export function unlockProgress(h) {
  if (h.gold) { const p = goldProgress(h.id); return { have: p.have, need: p.need, label: `WINS WITH ${h.name.replace(/^GOLD /, '')}` }; }
  const u = HERO_UNLOCK[h.id];
  if (!u || u.until != null) return null; // LIMITED: a sale window, not progress
  try {
    if (u.reb != null) return { have: Math.min(getRebirths() || 0, u.reb), need: u.reb, label: u.gate ? 'REBIRTHS TO UNLOCK' : 'REBIRTHS', gate: !!u.gate };
    if (u.lv != null) return { have: Math.min(storedLevel() || 1, u.lv), need: u.lv, label: 'LEVEL' };
    if (u.wins != null) return { have: Math.min(totalWins(), u.wins), need: u.wins, label: 'WINS' };
  } catch { /* a broken store reads as zero */ }
  return null;
}

/** VERSIONS (oct19, Andy: the HERO / WIN / K.O. preview "makes the options to click glitch, gold, and elite obsolete -
 *  put those buttons under the equip ... and make it not look exactly same design"): the member's versions as little
 *  painted THUMBNAILS under the call to action - the art itself is the button (the pattern every skin picker uses), the
 *  one on show lifted + full colour, the rest knocked back; a lock on the ones you don't own, GOLD's wins bar. */
function Versions({ vs, cur, onPick }) {
  return (
    <div className="hpv-vers">
      <span className="hpv-vers-k">VERSIONS</span>
      <div className="hpv-vers-row" role="tablist" aria-label="Versions">
        {vs.map((v) => {
          const own = ownsHero(v.id);
          const kind = v.gold ? 'gold' : v.elite ? 'elite' : 'base';
          const gp = v.gold && !own ? goldProgress(v.id) : null;
          return (
            <button key={v.id} type="button" role="tab" aria-selected={v.id === cur} className={`hpv-ver is-${kind}${v.id === cur ? ' is-on' : ''}${own ? '' : ' is-locked'}`}
              onClick={() => onPick(v.id)} aria-label={`${kind === 'base' ? 'CLASSIC' : kind.toUpperCase()} · ${v.name}${own ? '' : ', locked'}`}>
              <span className="hpv-ver-art">
                <img src={castSrc(v.id, 'hero')} width="512" height="512" alt="" aria-hidden="true" draggable="false" />
                {!own ? <span className="hpv-ver-lock"><KitIcon name="lock" size={20} shadow={1} extras={false} /></span> : null}
              </span>
              <span className="hpv-ver-n">{kind === 'base' ? 'CLASSIC' : kind.toUpperCase()}</span>
              {gp ? <span className="hpv-ver-bar" aria-hidden="true"><span className="hpv-ver-fill" style={{ transform: `scaleX(${Math.min(1, gp.have / gp.need)})` }} /></span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** The big stage: pedestal + the hero (still; its prop streams move), cycling its poses (a tapped tab holds that pose). */
function Stage({ h, pose, onTap }) {
  const artRef = useRef(null);
  useEffect(() => { kitPlay(artRef.current, SWAP, { duration: 220, easing: 'ease-out' }); }, [h.id, pose]);
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
export default function HeroPreview({ h, variants = null, onVariant = null, current, gems, onEquip, onBuy, onStep, onClose }) {
  const [poseIx, setPoseIx] = useState(0);
  const [held, setHeld] = useState(false); // a tapped tab stops the auto-cycle
  const poses = POSES.filter(([p]) => p === 'hero' || hasPose(h.id, p)); // only the poses this exact hero has painted
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
  const vs = variants && variants.length > 1 ? variants : null; // oct18 one-card picker: a member's RIOT / GOLD / ELITE tabs
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
          {r.tier ? <span className={`hpv-tier is-${tier}`}>{TIER_NAME[r.tier]}</span> : null}
          <FitText className="hpv-name">{h.name}</FitText>
          <span className="hpv-tag">{h.tag}</span>
          {/* honest (Andy's bar): a hero is a look — it never changes how a game plays or what it pays */}
          <span className="hpv-note">LOOKS ONLY · NO GAMEPLAY EDGE</span>
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
                {prog && !prog.gate ? <span className="hpv-or">OR SKIP THE WAIT</span> : null}
                {h.price && !h.gold && !heroGateMet(h.id) ? (
                  <div className="hpv-buy">
                    <span className="hpv-locked"><KitIcon name="lock" size={26} shadow={1} extras={false} />{HERO_UNLOCK[h.id].until != null ? 'GONE FOREVER · OCTOBER 2026 ONLY' : `${HERO_UNLOCK[h.id].label}, THEN ${formatNum(h.price)} GEMS`}</span>
                    <span className="hpv-gems"><KitIcon name="gems" size={22} shadow={2} extras={false} />{formatNum(gems)}</span>
                  </div>
                ) : h.price && !h.gold ? (
                  <div className="hpv-buy">
                    <KitHoldButton tone="gold" width={300} labelSize={gems >= h.price ? 30 : 24} label={gems >= h.price ? 'HOLD TO BUY' : 'NOT ENOUGH GEMS'}
                      sub={gems >= h.price ? `${formatNum(h.price)} GEMS` : `NEED ${formatNum(h.price - gems)} MORE`}
                      disabled={gems < h.price} confirmText="UNLOCKED!" onConfirm={() => onBuy(h.id)}
                      ariaLabel={`Hold to buy ${h.name} for ${formatNum(h.price)} gems`} />
                    <span className="hpv-gems"><KitIcon name="gems" size={22} shadow={2} extras={false} />{formatNum(gems)}</span>
                  </div>
                ) : null}
              </>
            )}
          </div>
          {vs ? <Versions vs={vs} cur={h.id} onPick={(id) => onVariant && onVariant(id)} /> : null}
        </div>
      </div>
    </div>
  );
}
