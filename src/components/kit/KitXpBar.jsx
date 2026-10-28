// KitXpBar.jsx — 01 MENU XP BAR (claude/mockups/v2/KitBars.dc.html), "FILL = SCALEX", "WRAP CAP 1S".
//
//   <KitXpBar level={lv} frac={0.69} need={35000} />
//
// ANDY (oct6, "smooth and clean"): THREE layers — a dark track, ONE solid yellow fill with a single
// thin top highlight, a black ink outline. SEASON 2 list item 5: EVERY gain GLIDES ~600 ms ease-out
// (kit/climb.js — one continuous position, retargeted mid-glide from the position AND speed on screen,
// so typing fast is one slow continuous climb, never steps). A LEVEL WRAP is the same glide crossing
// full: a soft 280 ms white SWEEP crosses the bar (one pooled node, transform/opacity only), the fill
// carries on from 0; the LV numeral BUMPS and a "+N LEVELS" chip counts them. Big climbs compress
// (600 ms + 200 ms a level, ≤ 1 s whole). The fill is a scaleX write on one rAF loop that sleeps at
// rest (no React render per frame, no layout reads).
// REDUCE MOTION lands instantly.
//
// The root carries data-state ('climb' | 'rest'), data-climb-ms (the last climb's duration) and
// data-level (the level SHOWN right now) for tests and the gallery.
//
// P9a (KitLevelUp.dc.html 01 "D · MULTI = CHIP"): a gain that crosses MORE than one level shows a "+N LV" chip that
// slides out from UNDER the bar's left end and counts the levels; a single level is the sweep + LV bump alone.
//
// NIGHT oct8 #1b: `lvInside` puts the LV numeral INSIDE the bar, on the bar's own plate at its left edge (the fill
// starts after the plate), and `lead` takes the old LV slot left of the bar (the menu's RANK plate).
//
// NIGHT oct8 #3 (with `lvInside` — the season-2 menu): a GHOST fill (a pale layer under the real fill) JUMPS to the
// target the instant XP lands, and the real fill follows on the 600 ms glide. A ONE-level wrap is a beat of its own:
// the fill runs to 100 % fast (WRAP_FILL_MS), the LV plate POPS, the fill snaps to 0 and carries on to the target (keys that
// land during the hold queue; a bigger climb keeps the compressed sweep). Writes only (no layout reads), finite.
import { useEffect, useRef } from 'react';
import { createClimbPlayer } from './climb.js';
import { FX, fx, kitHold, kitStop, kitPlay } from './motion.js';
import { reduceMotion } from '../../lib/reduceMotion.js';
import { formatNum } from '../../format.js';
import './tokens.css';
import './KitXpBar.css';

export const GAIN_HIDE_MS = 1400;
// NO WAIT AT A LEVEL-UP (Andy oct11: "when the first bar reaches the end, it waits for the actual bar to follow. there
// cant be a delay"): the ghost jumps to full at once, so the real fill now runs there in WRAP_FILL_MS (was the 600 ms
// glide) and snaps straight to the next level (was a 200 ms hold).
export const WRAP_FILL_MS = 180;
// (oct19 Andy: the crit's orange piece on the bar was "so unsmooth … the color also is lame" — removed. A crit shows
// on the key pop only.)
export const WRAP_HOLD_MS = 0;
// the plate's content rests counter-skewed (skewX 12deg — KitXpBar.css), so the pop keeps the skew in every frame
const PLATE_POP = [{ transform: 'skewX(12deg) scale(1)' }, { transform: 'skewX(12deg) scale(1.28) rotate(-3deg)', offset: 0.45 }, { transform: 'skewX(12deg) scale(1)' }];
const CHIP_IN = [{ transform: 'translateY(-30px) skewX(-10deg)', opacity: 0 }, { transform: 'translateY(4px) skewX(-10deg)', opacity: 1, offset: 0.6 }, { transform: 'translateY(0) skewX(-10deg)', opacity: 1 }];

// JUICE P1 (goal-gradient): `goal` = { lv, chest } puts the NEXT reward on a plate at the bar's RIGHT end — the next
// level's number (Andy oct21: never the REBIRTH icon — it sat off-centre on the plate). In the last NEAR_FRAC of a level
// the plate turns yellow (a static class, not a loop) and every gain BUMPS it (one finite 280 ms play) — the "almost
// there" pull. A level wrap SLAMS the new number in.
export const NEAR_FRAC = 0.9;

// NEAR MISS (Andy oct22, the goal-gradient pull): `nearText` = { k: '38 KEYS', to: 'TO LV 8' } replaces the readout in the last NEAR_FRAC of
// a level — an honest countdown in keys, the unit the menu actually pays in. Static swap + one finite pop-in, nothing loops.
// THE KIT's BAR (oct27, Andy: "the progress bar still doesnt fit with the theme … i want the keys to be more special"):
// `kit` = a worn POP STYLE's whole bar (progress/kitArt.js kitOf) — the bar reads as THAT style end to end:
//  · FILL — its painted texture, on a child that counter-scales by 1/f so the art is revealed, never stretched;
//  · FRAME + CHANNEL + PLATES — its coloured outline, dark well and numeral colour (CSS vars on the root, static);
//  · LEADING EDGE — its painted cap rides the fill's edge (a translateX write on the same climb frame; the track's
//    offset + width are measured on mount / resize only) and bumps once per gain;
//  · THE MOMENT IT FILLS — a level wrap slams the look's crit art on the goal plate and flares the cap.
// Every motion is a finite WAAPI transform / opacity one-shot; nothing moves at rest.
const CAP_BUMP = [{ transform: 'scale(1) rotate(0deg)' }, { transform: 'scale(1.32) rotate(-14deg)', offset: 0.3 }, { transform: 'scale(1) rotate(0deg)' }];
const CAP_FLARE = [{ transform: 'scale(1) rotate(0deg)' }, { transform: 'scale(2.1) rotate(40deg)', offset: 0.25 }, { transform: 'scale(1) rotate(90deg)' }];
const KIT_SLAM = [
  { transform: 'translate(-50%,-50%) scale(.3) rotate(-30deg)', opacity: 0, easing: 'cubic-bezier(.2,1.5,.4,1)' },
  { transform: 'translate(-50%,-50%) scale(1.25) rotate(4deg)', opacity: 1, offset: 0.22, easing: 'ease-out' },
  { transform: 'translate(-50%,-50%) scale(1) rotate(10deg)', opacity: 1, offset: 0.5, easing: 'ease-in' },
  { transform: 'translate(-50%,-50%) scale(1.15) rotate(18deg)', opacity: 0 },
];
export function KitXpBar({ level = 1, frac = 0, need = 1000, unit = 'XP', className, onClimbDone, lvInside = false, lead = null, goal = null, nearText = null, kit = null }) {
  const rootRef = useRef(null);
  const lvRef = useRef(null);
  const gainRef = useRef(null);
  const fillRef = useRef(null);
  const skinRef = useRef(null);
  const barRef = useRef(null);
  const trackRef = useRef(null);
  const capRef = useRef(null);
  const capArtRef = useRef(null);
  const slamRef = useRef(null);
  const capBox = useRef({ x: 0, w: 0, f: 0 });
  const sweepRef = useRef(null);
  const curRef = useRef(null);
  const ghostRef = useRef(null);
  const plateRef = useRef(null);
  const goalRef = useRef(null);
  // the one-level wrap beat: { phase: 'idle' | 'fill' | 'hold', next: { l, f }, t }
  const wrap = useRef({ phase: 'idle', next: null, t: 0 });
  const needRef = useRef(need);
  needRef.current = need;
  const doneCb = useRef(onClimbDone);
  doneCb.current = onClimbDone;
  const gain = useRef({ n: 0, t: 0 });
  const climbN = useRef(0); // levels the current climb crosses (the chip is for a MULTI-level gain only)
  const initial = useRef({ lvRaw: String(Math.max(1, Math.floor(level))), lv: formatNum(Math.max(1, Math.floor(level))), cur: formatNum((frac > 0 ? Math.min(1, frac) : 0) * need) }).current;

  // the fill is promoted for the life of a glide only (never at rest); the sweep promotes itself per play
  const promote = (on) => {
    if (fillRef.current) fillRef.current.style.willChange = on ? 'transform' : '';
    if (capRef.current) capRef.current.style.willChange = on ? 'transform' : '';
    kitHold([lvRef.current, gainRef.current], on);
  };
  // one pooled sweep: a wrap that lands while the last sweep is still crossing rides on it (a 30-level
  // climb wraps every ~33 ms — restarting would strobe)
  const sweep = () => {
    const el = sweepRef.current;
    if (el && !el.__kitAnim) fx(el, FX.barSweep);
  };

  const player = useRef(null);
  if (!player.current) {
    player.current = createClimbPlayer({
      level,
      frac,
      onFrame: (l, f) => {
        if (fillRef.current) fillRef.current.style.transform = `scaleX(${f})`;
        if (skinRef.current) skinRef.current.style.transform = `scaleX(${1 / Math.max(f, 0.002)})`;
        if (capRef.current) {
          const b = capBox.current;
          b.f = f;
          capRef.current.style.transform = `translate(${b.x + f * b.w}px,-50%)`;
        }
        const cur = curRef.current;
        if (cur) {
          const t = formatNum(f * needRef.current);
          if (cur.textContent !== t) cur.textContent = t; // a text write only when the figure changes
        }
      },
      onLevel: (l, prev) => {
        if (rootRef.current) rootRef.current.dataset.level = String(l); // the SHOWN level, exact (the numeral is compacted past 1K)
        if (lvRef.current) {
          const t = formatNum(l);
          if (lvRef.current.textContent !== t) lvRef.current.textContent = t;
          fx(lvRef.current, FX.barBump);
        }
        if (l > prev) {
          sweep();
          if (slamRef.current) kitPlay(slamRef.current, KIT_SLAM, { duration: 760 });
          if (capArtRef.current) kitPlay(capArtRef.current, CAP_FLARE, { duration: 420, easing: 'cubic-bezier(.2,1.3,.4,1)' });
          if (goalRef.current) fx(goalRef.current, FX.slamSmall);
          const g = gain.current;
          clearTimeout(g.t);
          g.n += l - prev;
          const chip = gainRef.current;
          if (chip && (g.n > 1 || climbN.current > 1)) {
            const t = chip.firstChild;
            if (t) t.textContent = `+${formatNum(g.n)} LV`;
            if (!chip.classList.contains('is-on')) {
              chip.classList.add('is-on');
              kitPlay(chip, CHIP_IN, { duration: 280, easing: 'cubic-bezier(.2,1.2,.4,1)' });
            } else fx(t, FX.barBump);
          }
        }
      },
      onDone: (l, f, ms) => {
        const w = wrap.current;
        if (w.phase === 'fill') {
          // full: hold 200 ms, pop the plate, snap to 0 of the next level, carry on to the (latest) target
          w.phase = 'hold';
          w.t = setTimeout(() => {
            w.phase = 'idle';
            const p = player.current;
            const nx = w.next;
            w.next = null;
            if (plateRef.current) kitPlay(plateRef.current, PLATE_POP, { duration: 260, easing: 'cubic-bezier(.2,1.5,.4,1)' });
            p.set(l + 1, 0);
            if (nx) {
              if (ghostRef.current) ghostRef.current.style.transform = `scaleX(${nx.l > l + 1 ? 1 : nx.f})`;
              promote(true);
              if (rootRef.current) rootRef.current.dataset.state = 'climb';
              p.to(nx.l, nx.f);
            }
          }, WRAP_HOLD_MS);
          return;
        }
        promote(false);
        const root = rootRef.current;
        if (root) {
          root.dataset.state = 'rest';
          root.dataset.climbMs = String(Math.round(ms));
        }
        if (lvRef.current && lvRef.current.textContent !== formatNum(l)) lvRef.current.textContent = formatNum(l);
        const g = gain.current;
        clearTimeout(g.t);
        g.t = setTimeout(() => {
          g.n = 0;
          if (gainRef.current) gainRef.current.classList.remove('is-on');
        }, GAIN_HIDE_MS);
        if (doneCb.current) doneCb.current(l, f, ms);
      },
    });
  }

  useEffect(() => {
    const p = player.current;
    const root = rootRef.current;
    const tl = Math.max(1, Math.floor(level));
    const tf = frac > 0 ? Math.min(1, frac) : 0;
    // the GHOST jumps now (a level ahead = full); the real fill follows on the glide below
    const ghost = ghostRef.current;
    if (ghost && lvInside) ghost.style.transform = `scaleX(${tl > p.level ? 1 : tf})`;
    const w = wrap.current;
    if (lvInside && w.phase !== 'idle') {
      // mid-wrap: queue the newest target; the hold carries on to it
      w.next = { l: tl, f: tf };
      return;
    }
    if (lvInside && tl === p.level + 1 && p.target.level === p.level && !reduceMotion()) {
      // a ONE-level wrap: run to full first (the hold + snap happen in onDone)
      w.phase = 'fill';
      w.next = { l: tl, f: tf };
      climbN.current = 0;
      if (root) root.dataset.state = 'climb';
      promote(true);
      p.to(p.level, 1, { maxMs: Math.max(40, WRAP_FILL_MS * (1 - p.frac)) }); // the run to full scales with the distance left
      return;
    }
    const climbing = tl > p.level || (tl === p.level && tf > p.frac);
    if (climbing && capArtRef.current && !reduceMotion()) kitPlay(capArtRef.current, CAP_BUMP, { duration: 300, easing: 'cubic-bezier(.2,1.4,.4,1)' });
    climbN.current = tl > p.level ? tl - p.level + gain.current.n : 0;
    if (root && climbing) root.dataset.state = 'climb';
    if (climbing) promote(true);
    // the "almost there" pull: a gain inside the last stretch of a level bumps the goal plate (once per gain)
    if (climbing && tl === p.level && tf >= NEAR_FRAC && goalRef.current) fx(goalRef.current, FX.barBump);
    p.to(level, frac);
  }, [level, frac, lvInside]);

  // the cap rides the track: its offset + width, measured on mount and on resize only (offset* ignore the bar's skew)
  useEffect(() => {
    if (!kit) return undefined;
    const measure = () => {
      const bar = barRef.current;
      const tr = trackRef.current;
      if (!bar || !tr) return;
      const b = capBox.current;
      b.x = bar.offsetLeft + bar.clientLeft + tr.offsetLeft;
      b.w = tr.offsetWidth;
      if (capRef.current) capRef.current.style.transform = `translate(${b.x + b.f * b.w}px,-50%)`;
    };
    capBox.current.f = player.current.frac;
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(barRef.current);
    return () => ro.disconnect();
  }, [kit]);

  useEffect(() => {
    const p = player.current;
    // first paint: the bar already shows where it is
    p.set(p.target.level, p.target.frac);
    const g = gain.current;
    const sw = sweepRef.current;
    const w = wrap.current;
    return () => {
      p.cancel();
      kitStop(sw);
      clearTimeout(g.t);
      clearTimeout(w.t);
    };
  }, []);


  const lvText = (
    <>
      <span className="kx-lv-k">LV</span>
      <span ref={lvRef} className="kx-lv-n">
        {initial.lv}
      </span>
    </>
  );
  // inside the bar the numeral sits on a counter-skewed wrapper, so the LV bump (a transform) never fights the skew
  const lvNode = lvInside ? (
    <div className="kx-lvplate">
      <span ref={plateRef} className="kx-lvplate-in">{lvText}</span>
    </div>
  ) : (
    <div className="kx-lv">{lvText}</div>
  );
  const near = goal && (frac > 0 ? frac : 0) >= NEAR_FRAC;
  const goalNode = goal ? (
    <div className="kx-goal" data-testid="xp-goal" aria-hidden="true">
      <span ref={goalRef} className="kx-goal-in">
        <span className="kx-lv-k">LV</span>
        <span className="kx-goal-n">{formatNum(goal.lv)}</span>
      </span>
    </div>
  ) : null;
  return (
    <div ref={rootRef} style={kit ? { '--kit-edge': kit.edge, '--kit-well': kit.well, '--kit-hi': kit.hi } : undefined} data-kit={kit ? kit.id : undefined} className={`kx${kit ? ' is-kit' : ''}${lvInside ? ' is-lvin' : ''}${goal ? ' is-goal' : ''}${near ? ' is-near' : ''}${near && nearText ? ' has-near' : ''}${className ? ` ${className}` : ''}`} data-state="rest" data-level={initial.lvRaw}>
      {lvInside ? lead : <>{lead}{lvNode}</>}
      <div className="kx-barwrap">
        {/* LEVEL CHEST (oct22): the painted gem + what the next level pays, pinned over the goal plate's corner (outside the
            bar, which clips) — the LV number stays centred */}
        {goal && goal.chest > 0 ? (<span className="kx-goal-chest" data-testid="xp-goal-chest"><img src="/icons/gems.webp" width="64" height="64" alt="" draggable="false" />+{formatNum(goal.chest)}</span>) : null}
        <span ref={gainRef} className="kx-gain" aria-hidden="true">
          <span className="kx-gain-t" />
        </span>
        {kit ? (
          <>
            <span ref={capRef} className="kx-cap" aria-hidden="true"><img ref={capArtRef} src={kit.cap} alt="" draggable="false" /></span>
            <img ref={slamRef} className="kx-slam" src={kit.crit} alt="" aria-hidden="true" draggable="false" />
          </>
        ) : null}
        <div ref={barRef} className="kx-bar" role="progressbar" aria-label={`Level ${formatNum(level)} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((frac > 0 ? Math.min(1, frac) : 0) * 100)}>
          <div ref={trackRef} className="kx-track" aria-hidden="true">
            {lvInside && <div ref={ghostRef} className="kx-ghost" />}
            <div ref={fillRef} className={`kx-fill${kit ? ' is-skin' : ''}`}>
              {kit ? <div ref={skinRef} className="kx-fill-skin" style={{ backgroundImage: `url(${kit.fill})`, transform: `scaleX(${1 / Math.max(frac, 0.002)})` }} /> : null}
              <div className="kx-fill-hi" />
            </div>
            {/* ABOVE the fill (Andy oct18: "keep it visible inside the bar … not hidden under the yellow"), then it fades */}
            <div ref={sweepRef} className="kx-sweep" />
          </div>
          {lvInside && lvNode}
          {goalNode}
          <div className="kx-read" aria-hidden="true">
            <span ref={curRef} className="kx-read-n">
              {initial.cur}
            </span>
            <span className="kx-read-s">/</span>
            <span className="kx-read-n">{formatNum(need)}</span>
            <span className="kx-read-u">{unit}</span>
          </div>
          {near && nearText ? <div className="kx-near" aria-hidden="true">{nearText.k}<span className="kx-near-to">{nearText.to}</span></div> : null}
        </div>
      </div>
    </div>
  );
}
