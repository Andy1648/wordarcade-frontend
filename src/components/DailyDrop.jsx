// DailyDrop.jsx — THE DAILY FREE DROP, the top tile of the UPGRADES screen (ShopV2, season 2; Andy's approved
// prototype scratchpad/shop/daily-drop.html). Rules + store: progress/v3/dailyDrop.js, read through the V3 holder.
//
//   READY    the chest, a "TAP TO OPEN" stamp, FREE · ONCE A DAY, the printed odds on the tier row
//   OPENING  4 taps: the final tier was rolled on tap 1; each tap stays or steps up (the border + tier name take the
//            tier colour, the tier row fills), "TAP 2/4"
//   CLAIMED  the lid lifts, the reward line, "NEXT IN 13:42:07" to local midnight (the shop's own 1 s clock — `now`)
//   ⓘ        toggles the odds list (tier · % · what it pays) inline, in place of the tier row
//
// Motion: kit one-shots only (kit/motion.js kitPlay — transform/opacity, will-change on for the animation's life,
// skipped under REDUCE MOTION, where every state is instant). The burst is ONE pooled node, re-tinted per tier.
import { useEffect, useRef, useState } from 'react';
import './DailyDrop.css';
import { V3 } from '../progress/season';
import { kitPlay } from './kit/motion.js';
import { KitIcon } from './kit/index.js';
import { ready as sfxReady } from '../audio/gameSounds';
import { tone, pentFreq, NOTE } from '../audio/audioCore.js';

const BASE = '/art/drop/chest-base.svg';
const LID = '/art/drop/chest-lid.svg';
const BURST = '/art/drop/burst.svg#b';

// ---- Web Audio blips (the event-sound toggle + shared context; nothing plays before a gesture) ----
function sndTap(tier, up) {
  const ctx = sfxReady();
  if (!ctx) return;
  const t = ctx.currentTime;
  if (!up) {
    tone(t, { freq: pentFreq(NOTE.G3), type: 'triangle', dur: 0.06, gain: 0.14, attack: 0.004 });
    return;
  }
  tone(t, { freq: pentFreq(NOTE.C4 + tier * 2), type: 'square', dur: 0.12, gain: 0.08, attack: 0.004 });
  tone(t + 0.05, { freq: pentFreq(NOTE.G4 + tier * 2), type: 'triangle', dur: 0.14, gain: 0.14, attack: 0.004 });
}
function sndOpen(tier) {
  const ctx = sfxReady();
  if (!ctx) return;
  const t = ctx.currentTime;
  [0, 1, 2].forEach((k) => tone(t + k * 0.09, { freq: pentFreq(NOTE.C5 + tier + k * 2), type: 'triangle', dur: 0.16, gain: 0.16, attack: 0.005 }));
}

/** What tier `i` pays: the gem icon + "+15 GEMS", or the OVERDRIVE icon + "OVERDRIVE ×10 · 5 MIN" (`full`) / "×10 · 5 MIN". */
function PayLine({ i, full = false, size = 20 }) {
  const t = V3.drop.DROP_TIERS[i];
  if (t.pay.gems) {
    return (
      <span className="dd-pay is-gems">
        <KitIcon name="gems" size={size} shadow={1} extras={false} />
        <span className="dd-pay-n">+{t.pay.gems}</span>
        <span className="dd-pay-u">GEMS</span>
      </span>
    );
  }
  const o = t.pay.overdrive;
  return (
    <span className="dd-pay is-od">
      <KitIcon name="overdrive" size={size} shadow={1} extras={false} />
      {full ? <span className="dd-pay-u">OVERDRIVE</span> : null}
      <span className="dd-pay-n">×{o.mult}</span>
      <span className="dd-pay-u">· {o.min} MIN</span>
    </span>
  );
}

export default function DailyDrop({ now }) {
  const D = V3.drop;
  const TIERS = D.DROP_TIERS;
  const day = D.dayKey(now);
  // the stored row, re-read when the day turns (midnight while the shop is open = a fresh drop)
  const [saved, setSaved] = useState(() => D.readDrop(now));
  const [climb, setClimb] = useState(null); // { plan: [t1..t4], taps } while OPENING
  const [reward, setReward] = useState(null);
  const [odds, setOdds] = useState(false);
  const chestRef = useRef(null);
  const lidRef = useRef(null);
  const burstRef = useRef(null);
  const bigRef = useRef(null);
  const busy = useRef(false);
  useEffect(() => {
    if (saved.day !== day) {
      setSaved(D.readDrop(now));
      setClimb(null);
      setReward(null);
    }
  }, [day]); // eslint-disable-line react-hooks/exhaustive-deps

  const phase = saved.claimed ? 'claimed' : climb ? 'opening' : 'ready';
  const tier = phase === 'claimed' ? saved.tier ?? 0 : phase === 'opening' ? (climb.taps ? climb.plan[climb.taps - 1] : 0) : null;
  const T = tier == null ? null : TIERS[tier];

  const shake = (deg) => kitPlay(chestRef.current, [
    { transform: 'rotate(0deg) scale(1)' },
    { transform: `rotate(${-deg}deg) scale(1.05)` },
    { transform: `rotate(${deg}deg) scale(1.05)` },
    { transform: `rotate(${-deg / 2}deg) scale(1.02)` },
    { transform: 'rotate(0deg) scale(1)' },
  ], { duration: 260, easing: 'cubic-bezier(.3, 1.6, .5, 1)' });
  const burst = (i) => {
    const el = burstRef.current;
    if (!el) return;
    el.style.setProperty('--dd-burst', TIERS[i].color); // re-tint the ONE pooled node (a static write, not animated)
    kitPlay(el, [
      { opacity: 0, transform: 'scale(.35) rotate(0deg)' },
      { opacity: 1, transform: 'scale(1.05) rotate(18deg)', offset: 0.45 },
      { opacity: 0, transform: 'scale(1.3) rotate(30deg)' },
    ], { duration: 420, easing: 'ease-out' });
  };
  const land = () => kitPlay(bigRef.current, [{ transform: 'scale(1.25)' }, { transform: 'scale(1)' }], { duration: 220, easing: 'cubic-bezier(.3, 1.6, .5, 1)' });

  const onTap = () => {
    if (odds) {
      setOdds(false);
      return;
    }
    if (phase === 'claimed' || busy.current) return;
    let c = climb;
    if (!c) {
      const o = D.openDrop(now);
      if (!o.ok) {
        setSaved(D.readDrop(now));
        return;
      }
      c = { plan: D.planClimb(o.tier), taps: 0 };
    }
    const prev = c.taps ? c.plan[c.taps - 1] : 0;
    const taps = c.taps + 1;
    const cur = c.plan[taps - 1];
    const up = cur > prev;
    setClimb({ ...c, taps });
    if (up) {
      burst(cur);
      shake(6 + cur * 3);
      land();
    } else shake(3);
    sndTap(cur, up);
    if (taps < D.TAPS) return;
    // the 4th tap: pay + the lid lifts (CLAIMED's resting pose is the open lid; the animation plays INTO it)
    const r = D.claimDrop(now);
    setSaved(D.readDrop(now));
    setClimb(null);
    if (!r.ok) return;
    setReward(r);
    busy.current = true;
    setTimeout(() => {
      busy.current = false;
    }, 300);
    requestAnimationFrame(() => {
      kitPlay(lidRef.current, [
        { transform: 'translate(0, 0) rotate(0deg)' },
        { transform: 'translate(-6%, -16%) rotate(-30deg)', offset: 0.6 },
        { transform: 'translate(-4%, -12%) rotate(-24deg)' },
      ], { duration: 340, easing: 'cubic-bezier(.3, 1.4, .5, 1)' });
      burst(r.tier);
      sndOpen(r.tier);
    });
  };

  const lit = phase === 'claimed' ? -1 : tier ?? -1; // the tier row fills up to the climb; CLAIMED shows the reward
  const taps = climb ? climb.taps : 0;
  const msLeft = D.msToReset(now);
  const sub = phase === 'ready' ? 'FREE · ONCE A DAY' : phase === 'opening' ? (taps ? 'KEEP TAPPING' : 'TAP TO CLIMB') : 'COME BACK TOMORROW';
  const label = phase === 'ready'
    ? 'Daily free drop, ready. Tap to open'
    : phase === 'opening'
      ? `Daily free drop, ${T.name}, tap ${taps} of 4`
      : `Daily free drop claimed: ${T.name}, ${D.payText(saved.tier ?? 0)}. Next in ${D.formatCountdown(msLeft)}`;

  return (
    <section
      className={`dd is-${phase}${odds ? ' is-odds' : ''}`}
      style={T ? { '--dd-tier': T.color, '--dd-tier-d': T.line } : undefined}
      aria-label="Daily free drop"
      data-testid="daily-drop"
      data-phase={phase}
    >
      <button type="button" className="dd-tap" onClick={onTap} aria-label={odds ? 'Hide the drop odds' : label} aria-disabled={phase === 'claimed' && !odds ? 'true' : undefined}>
        <span className="dd-chest" aria-hidden="true">
          <svg className="dd-burst" ref={burstRef} viewBox="0 0 200 200" aria-hidden="true">
            <use href={BURST} />
          </svg>
          <span className="dd-chest-in" ref={chestRef}>
            <img className="dd-base" src={BASE} alt="" draggable="false" />
            <img className="dd-lid" ref={lidRef} src={LID} alt="" draggable="false" />
          </span>
        </span>
        {odds ? (
          <span className="dd-odds">
            <span className="dd-odds-h">DROP ODDS · WHAT EACH PAYS</span>
            <span className="dd-odds-list" role="list" aria-label="Drop odds">
              {TIERS.map((t, i) => (
                <span key={t.id} className="dd-odd" role="listitem" style={{ '--dd-c': t.color }}>
                  <span className="dd-odd-name">{t.name}</span>
                  <span className="dd-odd-p">{t.p}%</span>
                  <PayLine i={i} />
                </span>
              ))}
            </span>
          </span>
        ) : (
          <>
            <span className="dd-head">
              <span className="dd-big" ref={bigRef}>{phase === 'ready' ? 'DAILY DROP' : T.name}</span>
              <span className="dd-sub">{sub}</span>
            </span>
            {phase === 'claimed' ? (
              <span className="dd-reward" aria-live="polite">
                <PayLine i={saved.tier ?? 0} full size={26} />
              </span>
            ) : (
              <span className="dd-row" aria-hidden="true">
                {TIERS.map((t, i) => (
                  <span key={t.id} className={`dd-seg${i <= lit ? ' is-on' : ''}`} style={{ '--dd-c': t.color, '--dd-cd': t.line }} title={`${t.name} ${t.p}%`}>
                    {t.p}%
                  </span>
                ))}
              </span>
            )}
            <span className={`dd-stamp is-${phase}`}>
              {phase === 'ready' ? 'TAP TO OPEN' : phase === 'opening' ? `TAP ${taps}/4` : (
                <>
                  <span className="dd-stamp-k">NEXT IN</span>
                  <span className="dd-stamp-t" data-testid="daily-drop-next">{D.formatCountdown(msLeft)}</span>
                </>
              )}
            </span>
          </>
        )}
      </button>
      <button type="button" className={`dd-info${odds ? ' is-on' : ''}`} aria-pressed={odds} aria-label={odds ? 'Hide the drop odds' : 'Show the drop odds'} onClick={() => setOdds((v) => !v)}>
        i
      </button>
      {reward ? <span className="dd-sr" role="status">{`${TIERS[reward.tier].name}! ${D.payText(reward.tier)}`}</span> : null}
    </section>
  );
}
