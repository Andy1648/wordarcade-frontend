// MenuXp.jsx — the menu/splash XP UI: a progress bar (MenuXpBar) and the feedback layer
// (MenuXpFx). All motion is finite, transform/opacity only, nothing animates at rest. The only
// will-change is set per-shard in spawnShards for its ~360ms flight and cleared on finish (never
// parked on the idle pool). The fx-layer size + XP bar box are measured on
// mount/resize and cached (never per keystroke); each pop then picks a continuous random
// position, kept off the layer edge and out of the bar box, so the readout is never covered.
import BoostPill from '../frenzy/BoostPill';
import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import './MenuXp.css';
import { formatNum, formatMultExact } from '../format';
import { createCountUp } from '../juice/countUp';
import { useCountUp } from '../hooks/useCountUp';
import { sndBarMilestone } from '../audio/gameSounds';
import { rankTitle } from '../progress/rank';
import MarkBadge from './MarkBadge';
import { markRank } from '../progress/marks';
import { mainMultOf } from '../progress/markRollsCore';
import { rarityClass, levelRarity } from '../lib/rarityStyle.js';
import RarityFx from './rarity/RarityFx';
import { tierFx, MILESTONE_FX } from '../progress/menuTier';
import { CARD_MS } from '../lib/menuMoments';
import { rebirthMult } from '../progress/xp';

// The mode the XP-bar hint is priced in (Homepage divides by this card's rate), one line.

// THE BAR IS THE DENSE ONE, and it is the only one. Two layouts were built and screenshotted so
// the choice could be made from frames; the FILL variant lost on its own preview — at 92px with
// three readings on one line it ran together as a single stream of text with the tick segments
// slicing through it ("20 / 52.3K WORD BOMB 770 WINS / WORD NEXT FRAME REBIRTH 1"). Its code is
// deleted rather than parked behind a constant: a losing variant left in the tree is a second
// thing to maintain and a second thing to read.
//
// AND THE BAR NOW CARRIES THE LEVEL AND THE PROGRESS, NOTHING ELSE. The per-word rate came out
// with it — all five cards print their own rate directly below, so the bar was repeating the
// screen's most-repeated number a sixth time. The next-unlock came out for the same reason it was
// cut as a row: it is not what a progress bar is for.

// The milestone tier a day-count belongs to (drives the escalating streak styling):
// 30+ is the capped apex, then 14 / 7 / 3, and 2 is the "just started showing" tier.
function streakTier(count) {
  const c = Number(count) || 0;
  if (c >= 30) return 30;
  if (c >= 14) return 14;
  if (c >= 7) return 7;
  if (c >= 3) return 3;
  return 2;
}
// "×1.05" style. THE SHARED EXACT FORMATTER, not a second local copy of it: the streak ladder is
// 1.05 / 1.10 / 1.20 / 1.25, so the one-decimal `formatMult` (the cards' combined-product
// formatter) would print ×1.05 as "×1.1" — a bonus the game does not pay.
const formatMult = (m) => `×${formatMultExact(m)}`;

// The progress bar: a LEVEL block welded to a track holding the fill, a leading-edge marker,
// and a readout spanning the track — XP into the level (left) and the level's cost (right). NO %
// READOUT (clutter pass, Andy oct3: "REMOVE the % on the progression bar") — the fill is the percent. The fill is scaleX (never width).
//
// EVERY NUMBER HERE COUNTS THROUGH THE ONE COUNT-UP (src/juice/countUp.js, Andy oct3 #4): the fill
// + its readout, the wins chip and the level numeral. 1.2–2 s scaled to the jump, a new gain
// mid-count RETARGETS the running count (no stacking), reduced motion lands instantly, and the
// loop schedules nothing at rest. The fill's frame writes one transform + three text nodes and
// reads no layout (the track width is cached on mount/resize).
// On a level-up the fill SNAPS to 0 (no backwards glide) and counts forward, flashing yellow for
// 180ms. Fill colour keys off the rebirth count (class/attr swap only).
//
// THE BAR MOVES ON EVERY WORD (Andy oct3 #5, LV175: "bar just isn't moving"). Under PROGRESSION v10
// a high level is hundreds of words long, so each gain is made visible by the counting XP numeral
// and the fill (the old "43.7%" readout and "+X.X%" pop were cut in the clutter pass), plus:
//   - a "+N LV" pop on a level-up — ONE pooled node, finite;
//   - a MILESTONE TICK every 10%: one pooled flash node on the crossed segment line + a soft
//     rising note (sndBarMilestone), fired as the COUNTED value crosses it. Nothing loops.
// SESSION MEMORY: what the bar last showed survives a remount (module scope, not storage), so the
// menu you return to from a game counts up FROM where you left it — the whole game's gain — instead of gliding up from zero as if nothing had happened.
// `variant="mini"` (splash) drops the readout, the pops and the ticks, and shrinks the track.
const seen = { level: null, frac: 0, wins: null };
/** Test hook: forget the session memory (a fresh tab). */
export function resetMenuXpSession() {
  seen.level = null;
  seen.frac = 0;
  seen.wins = null;
}

const GAINPOP_MS = 1400; // pop in · hold · rise-and-fade — the "+X.X%" over the fill
const GAINPOP_HOLD_END = 0.72; // a new credit before this point keeps the pop up (no re-punch)
const TICK_MS = 420; // the 10% milestone flash

export function MenuXpBar({ level, toNext, frac, variant = 'full', wins = null, intoLevel = 0, cost = 0, rebirths = 0, onWinsClick = null, onRankClick = null, streak = 0, freezes = 0, markSlot = false, mark = null, onMarkClick = null, markNew = false, lettersToNext = null, hintRight = null }) {
  const mini = variant === 'mini';
  const winsNum = Number.isFinite(wins) ? wins : 0;
  // The wins chip and the level numeral count from what this session last SHOWED.
  const winsCount = useCountUp(winsNum, { from: Number.isFinite(seen.wins) ? seen.wins : winsNum, holdMs: 900 });
  const lvCount = useCountUp(level, { from: Number.isFinite(seen.level) && seen.level <= level ? seen.level : level, maxMs: 1600 });
  const winsShown = winsCount.shown;
  const fillRef = useRef(null);
  const markerRef = useRef(null);
  const trackRef = useRef(null);
  const readoutNumRef = useRef(null);
  const gainPopRef = useRef(null);
  const gainAnimRef = useRef(null);
  const tickRef = useRef(null);
  const tickAnimRef = useRef(null);
  const trackWRef = useRef(0);
  const costRef = useRef(cost);
  const prevRef = useRef(null); // the last {level, frac} this instance was handed
  const tenthRef = useRef(null); // the 10% segment the COUNTED value is in (milestone ticks)
  const ticksArmedRef = useRef(false); // no ticks for the landing on mount
  const frameRef = useRef(() => {});
  const ctlRef = useRef(null);
  if (ctlRef.current === null) {
    ctlRef.current = createCountUp({ initial: 0, onFrame: (v) => frameRef.current(v) });
  }

  // Mirror `cost` so a frame can read it without a stale closure (the count outlives any single
  // render). Assigned during render — a plain mirror ref.
  costRef.current = cost;

  useEffect(() => {
    if (Number.isFinite(wins)) seen.wins = wins;
  }, [wins]);

  // Cache the track's pixel width so the leading-edge marker, the "+X.X%" pop and the milestone
  // tick ride the fill via a TRANSFORM (translateX), not a layout property. Mount + resize only.
  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return undefined;
    const measure = () => {
      trackWRef.current = track.clientWidth;
    };
    measure();
    let ro;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(measure);
      ro.observe(track);
      return () => ro.disconnect();
    }
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // The pooled one-shots: ONE gain pop + ONE tick flash, created idle (WAAPI), replayed per event.
  // A LAYOUT effect declared before the retarget below, so a remount's first gain (the whole game,
  // on the way back to the menu) already has its pop to play.
  useLayoutEffect(() => {
    if (mini) return undefined;
    const mk = (el, ms) => {
      if (!el || typeof el.animate !== 'function') return null;
      const a = el.animate([{ opacity: 0 }, { opacity: 0 }], { duration: ms, fill: 'both' });
      a.cancel();
      // will-change lives only while the node is in flight — never on the idle pooled node.
      a.onfinish = () => {
        el.style.willChange = '';
      };
      return a;
    };
    gainAnimRef.current = mk(gainPopRef.current, GAINPOP_MS);
    tickAnimRef.current = mk(tickRef.current, TICK_MS);
    return () => {
      if (gainAnimRef.current) gainAnimRef.current.cancel();
      if (tickAnimRef.current) tickAnimRef.current.cancel();
    };
  }, [mini]);

  // x (px) of a 0..1 position on the track, from the CACHED width.
  const xAt = (v) => {
    const w = trackWRef.current;
    return Math.max(0, Math.min(1, v)) * w;
  };

  // "+X.X%" beside the % readout. A credit while the pop is still holding RETARGETS it (new text,
  // hold restarted, no re-punch); otherwise it plays from the top. Pure writes.
  function popGain(text) {
    const el = gainPopRef.current;
    const a = gainAnimRef.current;
    if (!el || !text) return;
    el.textContent = text;
    if (!a || prefersReducedMotion()) return; // reduced motion: the readout says it; no flight
    a.effect.setKeyframes([
      { transform: 'translateY(-50%) scale(1.45)', opacity: 0, offset: 0, easing: 'cubic-bezier(.2,.8,.2,1)' },
      { transform: 'translateY(-50%) scale(1)', opacity: 1, offset: 0.12 },
      { transform: 'translateY(-50%) scale(1)', opacity: 1, offset: GAINPOP_HOLD_END },
      { transform: 'translateY(-85%) scale(0.92)', opacity: 0, offset: 1 },
    ]);
    const t = Number(a.currentTime) || 0;
    if (a.playState === 'running' && t < GAINPOP_MS * GAINPOP_HOLD_END) {
      a.currentTime = GAINPOP_MS * 0.12; // keep it up: back to the start of the hold
      return;
    }
    el.style.willChange = 'transform, opacity';
    a.cancel();
    a.play();
  }

  // The 10% milestone: flash the crossed segment line + a soft rising note.
  function milestone(tenth) {
    sndBarMilestone(tenth);
    const el = tickRef.current;
    const a = tickAnimRef.current;
    if (!el || !a || prefersReducedMotion()) return;
    const x = xAt(tenth / 10);
    a.effect.setKeyframes([
      { transform: `translateX(${x}px) translateX(-50%) scaleY(1.6)`, opacity: 0, offset: 0 },
      { transform: `translateX(${x}px) translateX(-50%) scaleY(1)`, opacity: 1, offset: 0.2 },
      { transform: `translateX(${x}px) translateX(-50%) scaleY(1)`, opacity: 0, offset: 1 },
    ]);
    el.style.willChange = 'transform, opacity';
    a.cancel();
    a.play();
  }

  // One count frame: the fill transform, the marker, the XP number and the %. Refs only, no reads.
  frameRef.current = (v) => {
    const w = trackWRef.current;
    // fix/visual-real item 5: floor the VISUAL fill (and its leading marker) to ~4px so ANY
    // nonzero progress is visible. The readouts still count off the TRUE value.
    const minFrac = w > 0 ? 4 / w : 0;
    const vis = v > 0 ? Math.max(v, minFrac) : 0;
    const fill = fillRef.current;
    if (fill) fill.style.transform = `scaleX(${vis})`;
    const marker = markerRef.current;
    if (marker) {
      marker.style.transform = `translateX(${vis * w - 2}px)`;
      marker.style.opacity = v > 0 ? '1' : '0';
    }
    const num = readoutNumRef.current;
    if (num) num.textContent = formatNum(Math.max(0, Math.round(v * costRef.current)));
    // MILESTONE: the counted value crossed a 10% line (10…90%; 100% is the level-up's moment).
    const tenth = Math.floor(Number((v * 10).toPrecision(12)));
    const prevTenth = tenthRef.current;
    tenthRef.current = tenth;
    if (!mini && ticksArmedRef.current && prevTenth != null && tenth > prevTenth && tenth >= 1 && tenth <= 9) milestone(tenth);
  };

  // Retarget on level/frac change. Gains count; drops (rebirth) land instantly.
  useLayoutEffect(() => {
    const fill = fillRef.current;
    const c = ctlRef.current;
    if (!fill || !c) return undefined;
    const f = Math.max(0, Math.min(1, Number.isFinite(frac) ? frac : 0));
    const prev = prevRef.current || (Number.isFinite(seen.level) ? { level: seen.level, frac: seen.frac } : null);
    prevRef.current = { level, frac: f };
    seen.level = level;
    seen.frac = f;

    if (!prev || level < prev.level || (level === prev.level && f < prev.frac)) {
      // first sight this session, a rebirth, or a reset: land — nothing was gained
      c.set(f);
      tenthRef.current = Math.floor(f * 10);
      ticksArmedRef.current = true;
      return undefined;
    }
    if (level === prev.level && f === prev.frac) {
      if (!c.running && c.value !== f) c.set(f); // a remount at rest: show it, no gain
      ticksArmedRef.current = true;
      return undefined;
    }
    ticksArmedRef.current = true;
    if (level > prev.level) {
      // Level-up: snap the fill to empty, then count forward into the new level.
      c.set(0);
      tenthRef.current = 0;
      fill.classList.add('is-levelflash');
      const flash = setTimeout(() => fill.classList.remove('is-levelflash'), 180);
      c.to(f);
      if (!mini) {
        const n = level - prev.level;
        popGain(`+${formatNum(n)} LV`);
      }
      return () => clearTimeout(flash);
    }
    // Same level, a gain. On a remount (prev from the session memory) start from what was shown.
    if (!c.running && c.value !== prev.frac) c.set(prev.frac);
    c.to(f);
    // CLUTTER PASS (Andy oct3): no "+X.X%" pop — the bar is never printed as a percent. The fill
    // and the XP numeral count the gain; the pooled pop is kept for "+N LV" only.
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, frac]);

  // Cancel any in-flight count on unmount.
  useEffect(() => () => ctlRef.current && ctlRef.current.cancel(), []);

  const reb = Math.min(3, Math.max(0, Math.floor(rebirths) || 0));

  // The mini (splash) bar is fully decorative → aria-hidden. The full bar exposes ONLY the
  // wins button (an interactive shop entry) to assistive tech; the LV/fill/readout stay
  // aria-hidden so the deliberately-decorative progress chrome isn't announced.
  return (
    <div
      className={`menu-xp-bar${variant === 'mini' ? ' is-mini' : ' is-loud'}`}
      aria-hidden={variant === 'mini' ? 'true' : undefined}
    >
      {/* R10: a live BOOST code's gold pill rides the wins chip (it multiplies what the chip counts). */}
      {variant !== 'mini' && <BoostPill className="menu-boost-pill" />}
      {variant !== 'mini' && wins != null && (
        onWinsClick ? (
          <button type="button" className="menu-wins-chip" data-wins={wins} onClick={onWinsClick} aria-label={`${formatNum(wins)} wins. Open shop`}>
            <span className="menu-wins-coin" aria-hidden="true" />
            {formatNum(Math.round(winsShown))}
            {/* CLUTTER PASS: no "WINS" caption — the coin + number already read as wins (aria-label keeps the word). */}
            {/* THE GAIN, BIG, beside the counting number (Andy oct3 #4) — only while it counts + a beat. */}
            {winsCount.showGain && winsCount.gain > 0 && <span key={winsCount.chain} className="menu-wins-gain" aria-hidden="true">+{formatNum(Math.round(winsCount.gain))}</span>}
          </button>
        ) : (
          <span className="menu-wins-chip" data-wins={wins} aria-label={`${formatNum(wins)} wins`}>
            <span className="menu-wins-coin" aria-hidden="true" />
            {formatNum(Math.round(winsShown))}
            {/* THE GAIN, BIG, beside the counting number (Andy oct3 #4) — only while it counts + a beat. */}
            {winsCount.showGain && winsCount.gain > 0 && <span key={winsCount.chain} className="menu-wins-gain" aria-hidden="true">+{formatNum(Math.round(winsCount.gain))}</span>}
          </span>
        )
      )}
      {/* DAILY STREAK — a real treatment from 2 days (Job 10), not a bare chip: a flame
          banner carrying the day count (a count only — no multiplier in Rebirth Rush) and any earned
          FREEZE tokens (❄) shown BEFORE they're needed. The milestone tier (2/3/7/14/30)
          escalates the styling via data-tier so 30 days looks nothing like 2. */}
      {variant !== 'mini' && Number(streak) >= 2 && (
        <span
          className="menu-streak"
          data-tier={streakTier(streak)}
          aria-label={`${streak} day streak${freezes > 0 ? `, ${freezes} freeze token${freezes === 1 ? '' : 's'}` : ''}`}
        >
          <span className="menu-streak-flame" aria-hidden="true">🔥</span>
          <span className="menu-streak-count">{formatNum(streak)}</span>
          {/* CLUTTER PASS: no "DAYS" — the flame + count is the streak (aria-label says "N day streak"). */}
          {/* Rebirth Rush: the streak is a COUNT only — it multiplies neither XP nor wins, so no "×" chip. */}
          {freezes > 0 && (
            <span className="menu-streak-freeze" aria-hidden="true" title={`${freezes} freeze token${freezes === 1 ? '' : 's'} — a missed day is forgiven`}>
              {/* H2d: a COUNT of tokens, not a multiplier — "❄2", never "❄×2". */}
              ❄{freezes > 1 ? freezes : ''}
            </span>
          )}
        </span>
      )}
      {/* Static "LEVEL" kicker so a newcomer reads the "LV n · into/cost" chrome as the
          leveling bar it is (the audit flagged it as unexplained). Full bar only. */}
      {/* ROW BREAK (loud variant only). The loud bar is TWO rows: the meta chips
          (wins / streak / mark / rank) on top, then the LEVEL block + the full-width
          track beneath. A flex-basis:100% break plus `order` on the siblings is used
          rather than a grid, because half these children are conditional (no streak, no
          mark slot, no rank on mini) and fixed grid cells would leave holes. */}
      {variant !== 'mini' && <span className="menu-xp-break" aria-hidden="true" />}
      {/* THE LEVEL IS THE HEADLINE. The kicker and the numeral are one stacked chip now, so the
          numeral can take display type (--fs-h2, ~3.8x the --fs-micro kicker) without the old
          inline row forcing both to data-strip size. Mini keeps the flat inline form. */}
      {variant === 'mini' && <span className="menu-xp-lv" aria-hidden="true">LV {formatNum(level)}</span>}
      {/* THE EQUIPPED MARK, beside the level - the one place a permanent, chosen bonus is worth
          carrying on the menu, because it is the only progression object the player picked rather
          than accumulated.
          THE EMPTY SLOT NO LONGER RENDERS (Andy's cut). It used to draw a dimmed "NO MARK" outline
          once any mark was unlocked, on the theory that an empty slot advertises itself. In
          practice it is a chip that says nothing, permanently parked next to the level on the
          screen that already feels crowded - a question with no answer. The slot now appears only
          when it has something in it; the marks picker is still reachable from Stats.
          Nothing here animates. */}
      {variant !== 'mini' && markSlot && mark && (
        onMarkClick ? (
          <button
            type="button"
            className={`menu-mark ${rarityClass(mark.tier)}`}
            onClick={onMarkClick}
            aria-label={`Mark equipped: ${mark.name}. ${mark.blurb}`}
            title={`${mark.name} - ${mark.blurb}`}
          >
            <MarkBadge mark={mark} rank={markRank(mark.id)} size={30} className="menu-mark-icon" />
            {/* STEP 49: the worn mark is the player's TITLE, and its MAIN bonus is said right here. */}
            <span className="menu-mark-name" aria-hidden="true">{mark.name}</span>
            {/* H6/M12: the same formatter the marks index and the receipt use (×3.18, not ×3.2); it carries the "×". */}
            <span className="menu-mark-mult" aria-hidden="true">{formatMult(mainMultOf(mark.id))}</span>
            {markNew && <span className="homepage-shop-dot" aria-hidden="true" />}
            {/* RARITY IDENTITY: the chip is filled in its tier (CSS); EPIC+ glow + shimmer, LEGENDARY+ sparks on top */}
            <RarityFx tier={mark.tier} />
          </button>
        ) : (
          <span className={`menu-mark ${rarityClass(mark.tier)}`} title={`${mark.name} - ${mark.blurb}`}>
            <MarkBadge mark={mark} rank={markRank(mark.id)} size={30} className="menu-mark-icon" />
            <span className="menu-mark-name" aria-hidden="true">{mark.name}</span>
            <RarityFx tier={mark.tier} />
          </span>
        )
      )}
      {/* NOTHING WORN → a MARKS button, ALWAYS (Andy oct2 A3). It used to render only while a new
          mark was unseen, so opening the picker without wearing one made the button vanish until
          the next unlock — "sometimes it shows, sometimes it doesn't". The dot says a mark is new. */}
      {variant !== 'mini' && markSlot && !mark && onMarkClick && (
        <button
          type="button"
          className={`menu-mark is-empty${markNew ? ' is-new' : ''}`}
          onClick={onMarkClick}
          aria-label={markNew ? 'New mark unlocked. Choose a mark to wear' : 'Marks. Choose a mark to wear'}
        >
          <span className="menu-mark-name">{markNew ? 'NEW MARK' : 'MARKS'}</span>
          {markNew && <span className="homepage-shop-dot" aria-hidden="true" />}
        </button>
      )}
      <BarRow loud={variant !== 'mini'} level={Math.round(lvCount.shown)}>
      <span className="menu-xp-track" ref={trackRef} aria-hidden="true">
        {/* The CLIP wraps only the fill + marker. The track itself must NOT clip: the
            readout sits centred over the track and is wider than the track whenever the
            row is tight (a 360px menu leaves the flexible track ~32px), so a clipping
            track cropped the numbers. Clipping the fill is the only thing overflow was
            ever for - the scaleX fill and the marker - so it moves in here. */}
        {/* The pooled 10% milestone flash (full bar only): ONE node, idle at rest (opacity 0, no
            will-change), replayed per crossing. Before the readout so the numbers paint over it. */}
        {variant !== 'mini' && <span className="menu-xp-tickflash" ref={tickRef} />}
        <span className="menu-xp-clip">
          <span className="menu-xp-fill" ref={fillRef} data-reb={reb} />
          <span className="menu-xp-marker" ref={markerRef} />
        </span>
        {/* THE NUMERALS SIT ON THE FILL, at its two ends — the XP you have hard left, the XP the
            level costs hard right. Centred, the pair read as one string ("1,240 / 2,281") that the
            fill's leading edge cut through at exactly the moment it mattered most. */}
        {variant !== 'mini' && (
          <span className="menu-xp-readout">
            <span className="menu-xp-readout-now" ref={readoutNumRef}>{formatNum(Math.max(0, Math.round(intoLevel)))}</span>
            {/* CLUTTER PASS (Andy oct3): the % readout is gone — the fill IS the percent. Only the
                pooled "+N LV" pop stays here (absolutely placed: an idle pop takes no width). */}
            <span className="menu-xp-readout-mid">
              <span className="menu-xp-gainpop" ref={gainPopRef} />
            </span>
            <span className="menu-xp-readout-need">/ {formatNum(Math.max(0, Math.round(cost)))}</span>
          </span>
        )}
      </span>
      </BarRow>
      {/* RANK TITLE (Job 5): the level band's name, sitting in the LV bar next to the level.
          Full bar only; static — no animation. fix/card-polish: clickable → the RANK LADDER
          overlay (all ten ranks, which you hold, which is next). Falls back to a static span
          when no handler is wired (e.g. tests / splash). */}
      {variant !== 'mini' && (
        onRankClick ? (
          <button
            type="button"
            className="menu-xp-rank menu-xp-rank--btn"
            onClick={onRankClick}
            aria-label={`Rank ${rankTitle(level)}. Open the rank ladder`}
          >
            {rankTitle(level)}
          </button>
        ) : (
          <span className="menu-xp-rank" aria-label={`rank ${rankTitle(level)}`}>{rankTitle(level)}</span>
        )
      )}
      {/* WHAT THE BAR MEANS IN WORDS. "1,240 / 2,281" is a ratio, not a plan; this is the same
          progress expressed in the only unit the player controls. LETTERS, not words (Andy A9):
          XP is linear in word length, so "283 WORDS" was a 5-letter-word fiction — a player
          typing long words got there in fewer. Letters is the unit XP is actually paid in.
          PROGRESSION v11: priced at a GAME letter (BASE 10 XP / LETTER × KEY × rebirth × mark — see Homepage); words pay wins,
          rather than being a constant dressed up as a measurement.
          On a first run it also carries where XP comes from, which used to be a SEPARATE caption
          line below the bar — two stacked lines of small type saying related things, on the one
          screen with no vertical room to spare. */}
      {variant !== 'mini' && (Number.isFinite(lettersToNext) || hintRight) && (
        <span className="menu-xp-hint">
          {Number.isFinite(lettersToNext) && lettersToNext > 0 && (
            <span className="menu-xp-hint-text" aria-hidden="true">
              {/* H6: the number is priced at the FEATURED card's rate (Homepage), so the line names
                  that mode. It used to lead with "TYPE ANYWHERE ·" — menu typing pays the menu's
                  ×1 rate, so "30 LETTERS" was off by the featured multiplier (60 at the menu). */}
              {formatNum(lettersToNext)} {lettersToNext === 1 ? 'LETTER' : 'LETTERS'}
              {/* "TO LEVEL" spelled out wherever it fits, abbreviated where it does not. At 320
                  the corner-nav gutter leaves the bar 131px and the full sentence is ~148px, so
                  it ellipsised to "12 WORDS TO …" — a line that costs its own height and then
                  withholds the number it exists to show. */}
              <span className="menu-xp-hint-to"> IN A GAME TO LEVEL </span>
              <span className="menu-xp-hint-to-short"> · LV </span>
              {formatNum(level + 1)}
            </span>
          )}
          {/* The live WPM rides the RIGHT end of this row rather than sitting on a line of its
              own under the bar. It is a readout about typing, the hint is a sentence about
              typing, and the row it used to occupy was 25px of the menu's tightest budget. */}
          {hintRight && <span className="menu-xp-hint-right">{hintRight}</span>}
        </span>
      )}
    </div>
  );
}

/* THE BADGE IS WELDED TO THE TRACK, not parked beside it. One 4px border around the pair, with
   the badge's right edge as the internal rule — so the level and the progress read as one object
   instead of a chip that happens to be near a bar. The mini (splash) bar keeps the bare track. */
function BarRow({ loud, level, children }) {
  if (!loud) return children;
  // TIER IDENTITY (Andy oct5): the level badge keeps the theme's fill and wears its LEVEL rung (LEVEL_RAMP) as a
  // stripe + inner glow; crossing into a new rung replays its shimmer once (RarityFx keyed on the rung).
  const lr = levelRarity(level);
  return (
    <span className="menu-xp-barrow">
      <span className={`menu-xp-lvblock rarity-edge is-${lr}`} aria-hidden="true">
        <span className="menu-xp-label">LEVEL</span>
        <span className="menu-xp-lv">{formatNum(level)}</span>
        <RarityFx key={lr} tier={lr} />
      </span>
      {children}
    </span>
  );
}

const CENTER = 'translate(-50%,-50%) ';

// ONE combined pop per keystroke: "[LETTER] [+N]". Single pool of 20, cap 18 running.
// At 30 keys/sec × 0.6s = 18 concurrent, so the cap sits exactly there (Economy v3 slows
// pops to 600ms for a longer, floatier read).
const POP_MS = 600;
const POP_POOL = 20;
const POP_CAP = 18; // pool sizing (NOT the retired concurrent-count budget — see CLAUDE.md
// ANIMATION BUDGET): caps live pops so a mash REUSES pooled nodes instead of growing the pool.
const POP_HALF = 30; // keep a pop this far off the fx-layer edge and the bar box
const POP_MIN_GAP = 90; // reject a candidate within this many px of the last few spawns
const RECENT_POS = 6; // ring buffer: reject against the last N accepted positions
const POP_TRIES = 12; // random attempts before accepting the last candidate anyway

// Screen-edge pulse on a streak-tier crossing. Pool 2 (crossings never overlap). 260ms.
const EDGE_MS = 260;
const EDGE_POOL = 2;

// KEY POWER tier feedback (feat/purchase-feel item 1). Per-keystroke escalation the
// player BUYS: T2+ throws pooled particle shards on each pop. transform/opacity only,
// finite (<=400ms), pooled — zero new infinite animations.
const SHARD_MS = 360; // 300-400ms per spec
const SHARD_PER_POP = 4; // <=6 per spec
const SHARD_POOL = 32; // SHARD_PER_POP × ~8 concurrent pops
// Feel-tier colours: T1-T4 teal, T5+ gold. (T0 keeps the streak colour it's given.)
const TIER_TEAL = '#2EFFE0';
const TIER_GOLD = '#FFD54A';
const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Level-up: 1500ms total — scale 1.7→1 over 260ms (overshoot to 1.06 at 200ms, settle by
// 320ms), hold 900ms, fade 280ms. Offsets below are ÷1500.
const LEVELUP_MS = CARD_MS; // 1500 — lib/menuMoments.js (the moments queue releases on it)
// The punch-in curve, applied PER KEYFRAME. It used to sit on the whole effect, which eases the
// entire 1500ms timeline — so the "900ms hold" was actually crossing its fade keyframe ~500ms in
// and the level-up flashed by. Linear effect timing + an eased entry keeps the hold a hold.
const EASE_OUT = 'cubic-bezier(.2,.8,.2,1)';
const WINSSTAMP_MS = 700; // wins stamp keeps its own shorter envelope
const WINSHINT_MS = 3000; // one-time "WINS BUY UPGRADES IN THE SHOP" explainer — a full 3s read
const LEVEL_PHRASES = ['WARMING UP', 'PICKING UP SPEED', 'COOKING', 'UNREAL', 'MENACE'];
// The level-up card's timeline (shared by every card that reuses the element).
const LEVELUP_FRAMES = [
  // STEP 50 / Andy N2 ("bigger text includes animated text: level-ups"): the card now SETTLES
  // at ×1.2 (was ×1) — bigger for the whole hold — and slams in from ×2.
  { transform: `${CENTER}rotate(-3deg) scale(2)`, opacity: 0, offset: 0, easing: EASE_OUT }, // 0ms
  { transform: `${CENTER}rotate(-3deg) scale(1.4)`, opacity: 1, offset: 0.1 }, // 150ms — in
  { transform: `${CENTER}rotate(-3deg) scale(1.26)`, opacity: 1, offset: 0.1333 }, // 200ms — overshoot
  { transform: `${CENTER}rotate(-3deg) scale(1.2)`, opacity: 1, offset: 0.2133 }, // 320ms — settle
  { transform: `${CENTER}rotate(-3deg) scale(1.2)`, opacity: 1, offset: 0.8133 }, // 1220ms — hold end
  // ends back at ×1: `fill: both` HOLDS this frame, and a held ×1.2 box (invisible, but still
  // laid out) overhung the fx layer at 360px (viewport-integrity).
  { transform: `${CENTER}rotate(-3deg) scale(1)`, opacity: 0, offset: 1 }, // 1500ms — fade out
];
// MILESTONE MOMENTS (dormant, ?milestones=1): the SAME card, slammed harder (peak × size) and held
// longer, then settling to the everyday ×1.2 — so a peak never sits over the 360px fx layer for the
// hold. Built once per size; transform/opacity only, finite.
const MILESTONE_CARD = Object.fromEntries(
  Object.entries(MILESTONE_FX).map(([size, m]) => {
    const ms = LEVELUP_MS + m.holdMs;
    const at = (t) => t / ms;
    const k = m.peak;
    return [
      size,
      {
        ms,
        frames: [
          { transform: `${CENTER}rotate(-3deg) scale(${2 * k})`, opacity: 0, offset: 0, easing: EASE_OUT },
          { transform: `${CENTER}rotate(-3deg) scale(${1.4 * k})`, opacity: 1, offset: at(150) }, // in
          { transform: `${CENTER}rotate(-3deg) scale(${1.26 * k})`, opacity: 1, offset: at(200) }, // the bigger punch
          { transform: `${CENTER}rotate(-3deg) scale(1.2)`, opacity: 1, offset: at(420), easing: EASE_OUT }, // settle
          { transform: `${CENTER}rotate(-3deg) scale(1.2)`, opacity: 1, offset: at(1220 + m.holdMs) }, // longer hold
          { transform: `${CENTER}rotate(-3deg) scale(1)`, opacity: 0, offset: 1 },
        ],
      },
    ];
  })
);

// Pick a CONTINUOUS random spawn position inside the fx layer (inset by POP_HALF),
// rejecting a candidate that overlaps the XP bar box (expanded by POP_HALF) or lands
// within POP_MIN_GAP of any of the last RECENT_POS accepted positions — so pops read as
// scattered, never as marching rows. Up to POP_TRIES attempts; if all fail the last
// candidate is accepted. Records the accepted position in the `recent` ring buffer.
function pickPosition(w, h, box, recent) {
  const minX = POP_HALF;
  const minY = POP_HALF;
  const spanX = Math.max(0, w - POP_HALF * 2);
  const spanY = Math.max(0, h - POP_HALF * 2);
  const gap2 = POP_MIN_GAP * POP_MIN_GAP;
  let cand = { x: minX + spanX / 2, y: minY + spanY / 2 };
  for (let tries = 0; tries < POP_TRIES; tries++) {
    const x = minX + Math.random() * spanX;
    const y = minY + Math.random() * spanY;
    cand = { x, y };
    if (box && x > box.l - POP_HALF && x < box.r + POP_HALF && y > box.t - POP_HALF && y < box.bt + POP_HALF) {
      continue; // over the bar box
    }
    let tooClose = false;
    for (let n = 0; n < recent.length; n++) {
      const dx = x - recent[n].x;
      const dy = y - recent[n].y;
      if (dx * dx + dy * dy < gap2) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) continue;
    break; // accepted
  }
  recent.push(cand);
  if (recent.length > RECENT_POS) recent.shift();
  return cand;
}

function pickIndex(anims, poolSize, cap, nextRef) {
  const running = [];
  let free = -1;
  for (let n = 0; n < anims.length; n++) {
    if (anims[n].playState === 'running') running.push(n);
    else if (free === -1) free = n;
  }
  let i;
  if (running.length >= cap) {
    i = running.reduce((oldest, n) => ((anims[n].startTime ?? 0) < (anims[oldest].startTime ?? 0) ? n : oldest), running[0]);
  } else {
    i = free !== -1 ? free : nextRef.current % poolSize;
  }
  nextRef.current = (i + 1) % poolSize;
  return i;
}

// MenuXpFx — imperative: letterPop(char, "+N", scale, colour), edgePulse(colour) per
// keystroke, celebrate(level) on a level-up.
export const MenuXpFx = forwardRef(function MenuXpFx({ menuTier = 0 }, ref) {
  const layerRef = useRef(null);
  // STEP 22 / A1: the MENU TIER (level + rebirth) lengthens and enriches every pop. Read through
  // a ref so a level-up mid-typing re-tiers the very next keystroke without re-creating the pool.
  const tierRef = useRef(tierFx(menuTier));
  tierRef.current = tierFx(menuTier);
  const burstRef = useRef(null);
  // Only a LEVEL-UP / REBIRTH owns the pop budget while it plays; the tier-up name card (which
  // can fire on menu open) must never mute the player's first keystrokes.
  const popCapRef = useRef(true);
  const burstAnimRef = useRef(null);
  const popElsRef = useRef([]);
  const edgeElsRef = useRef([]);
  const levelupRef = useRef(null);
  const levelTitleRef = useRef(null);
  const levelSubRef = useRef(null);
  const levelDetailRef = useRef(null);
  const winsStampRef = useRef(null);
  const winsHintRef = useRef(null);
  const popAnimsRef = useRef([]);
  const edgeAnimsRef = useRef([]);
  const levelupAnimRef = useRef(null);
  // MILESTONE MOMENTS: set only by a milestone celebrate() (flag on), so with the flag off the card's
  // keyframes, attributes and timing are never touched.
  const milestoneCardRef = useRef(false); // the card currently carries milestone keyframes / data-milestone
  const milestoneEndsAtRef = useRef(0); // performance.now() when the milestone card finishes
  const winsStampAnimRef = useRef(null);
  const winsHintAnimRef = useRef(null);
  const layerSizeRef = useRef({ w: 0, h: 0 }); // fx-layer px size (mount/resize only)
  const recentPosRef = useRef([]); // ring buffer of the last few accepted {x,y} (anti-repeat)
  const popNextRef = useRef(0);
  const edgeNextRef = useRef(0);
  // Pooled particle shards (KEY POWER tier T2+).
  const shardElsRef = useRef([]);
  const shardAnimsRef = useRef([]);
  const shardNextRef = useRef(0);
  const layerRectRef = useRef({ left: 0, top: 0 }); // for converting tap client coords
  const barBoxRef = useRef(null); // XP bar box (layer-local) — taps must not cover it

  // Cache the fx-layer's pixel size and the XP bar's box (layer-local), so per-keystroke
  // pop placement is a pure random pick with no layout reads. On mount + resize only —
  // never per keystroke.
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return undefined;
    const measure = () => {
      const wrap = layer.getBoundingClientRect();
      layerRectRef.current = { left: wrap.left, top: wrap.top };
      layerSizeRef.current = { w: wrap.width, h: wrap.height };
      const bar = document.querySelector('.menu-xp-bar');
      let box = null;
      if (bar) {
        const b = bar.getBoundingClientRect();
        box = { l: b.left - wrap.left, t: b.top - wrap.top, r: b.right - wrap.left, bt: b.bottom - wrap.top };
      }
      barBoxRef.current = box;
    };
    measure();
    const raf = requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', measure);
    };
  }, []);

  // Create the pooled WAAPI animations ONCE (idle at rest).
  useEffect(() => {
    const popOpts = { duration: POP_MS, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'both' };
    popAnimsRef.current = popElsRef.current.map((el) => {
      const a = el.animate(
        [
          { transform: `${CENTER}translateY(8.96px)`, opacity: 0, offset: 0 },
          { transform: `${CENTER}translateY(-8.96px)`, opacity: 1, offset: 0.25 },
          { transform: `${CENTER}translateY(-49.28px)`, opacity: 0, offset: 1 },
        ],
        popOpts
      );
      a.cancel();
      return a;
    });

    const edgeOpts = { duration: EDGE_MS, easing: 'ease-out', fill: 'both' };
    edgeAnimsRef.current = edgeElsRef.current.map((el) => {
      const a = el.animate(
        [
          { opacity: 0, offset: 0 },
          { opacity: 0.35, offset: 0.4 },
          { opacity: 0, offset: 1 },
        ],
        edgeOpts
      );
      a.cancel();
      return a;
    });

    // Pooled particle shards — keyframes are re-set per spawn (direction varies), so
    // create them idle. transform/opacity only, finite SHARD_MS, fill:both.
    shardAnimsRef.current = shardElsRef.current.map((el) => {
      const a = el.animate(
        [
          { transform: 'translate(0,0) scale(1)', opacity: 1, offset: 0 },
          { transform: 'translate(0,-20px) scale(0)', opacity: 0, offset: 1 },
        ],
        { duration: SHARD_MS, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'both' }
      );
      a.cancel();
      // Drop the compositor hint once the shard lands — will-change lives only for the
      // airborne window (set in spawnShards), never on the idle pooled node.
      a.onfinish = () => {
        el.style.willChange = '';
      };
      return a;
    });

    if (levelupRef.current) {
      const a = levelupRef.current.animate(
        LEVELUP_FRAMES,
        { duration: LEVELUP_MS, easing: 'linear', fill: 'both' } // ease per-keyframe (below), NOT per-effect
      );
      a.cancel();
      levelupAnimRef.current = a;
    }

    // LEVEL-UP STARBURST (STEP 22): the comic burst asset spins up behind LEVEL N, once.
    if (burstRef.current) {
      const a = burstRef.current.animate(
        [
          { transform: `${CENTER}rotate(-20deg) scale(0.2)`, opacity: 0, offset: 0, easing: EASE_OUT },
          { transform: `${CENTER}rotate(4deg) scale(1.15)`, opacity: 1, offset: 0.3 },
          { transform: `${CENTER}rotate(12deg) scale(1)`, opacity: 1, offset: 0.7 },
          { transform: `${CENTER}rotate(18deg) scale(1.1)`, opacity: 0, offset: 1 },
        ],
        { duration: LEVELUP_MS, easing: 'linear', fill: 'both' } // ease per-keyframe (below), NOT per-effect
      );
      a.cancel();
      burstAnimRef.current = a;
    }

    // Wins stamp — same pooled-element pattern as the level-up (finite, ≤700ms, one node).
    if (winsStampRef.current) {
      const a = winsStampRef.current.animate(
        [
          { transform: `${CENTER}rotate(-4deg) scale(1.5)`, opacity: 0, offset: 0, easing: EASE_OUT },
          { transform: `${CENTER}rotate(-4deg) scale(1)`, opacity: 1, offset: 0.16 },
          { transform: `${CENTER}rotate(-4deg) scale(1)`, opacity: 1, offset: 0.7 },
          { transform: `${CENTER}rotate(-4deg) scale(1)`, opacity: 0, offset: 1 },
        ],
        { duration: WINSSTAMP_MS, easing: 'linear', fill: 'both' }
      );
      a.cancel();
      winsStampAnimRef.current = a;
    }

    // Wins EXPLAINER — the one-time "WINS BUY UPGRADES IN THE SHOP" banner. 3s envelope
    // (pop in 0-0.08, hold, fade out over the last 0.15) so a newcomer can actually read it.
    if (winsHintRef.current) {
      const a = winsHintRef.current.animate(
        [
          { transform: `${CENTER}rotate(-2deg) scale(1.35)`, opacity: 0, offset: 0, easing: EASE_OUT },
          { transform: `${CENTER}rotate(-2deg) scale(1)`, opacity: 1, offset: 0.08 },
          { transform: `${CENTER}rotate(-2deg) scale(1)`, opacity: 1, offset: 0.85 },
          { transform: `${CENTER}rotate(-2deg) scale(1)`, opacity: 0, offset: 1 },
        ],
        { duration: WINSHINT_MS, easing: 'linear', fill: 'both' }
      );
      a.cancel();
      winsHintAnimRef.current = a;
    }
    return undefined;
  }, []);

  // Throw SHARD_PER_POP pooled shards from (x,y) — KEY POWER tier T2+ (item 1).
  function spawnShards(x, y, colour, count = SHARD_PER_POP, reach = 1) {
    const anims = shardAnimsRef.current;
    if (!anims.length) return;
    for (let k = 0; k < count; k += 1) {
      const i = shardNextRef.current % SHARD_POOL;
      shardNextRef.current = (i + 1) % SHARD_POOL;
      const el = shardElsRef.current[i];
      const anim = anims[i];
      if (!el || !anim) continue;
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      el.style.background = colour;
      el.style.willChange = 'transform, opacity'; // promote for the airborne window only
      const ang = (k / count) * Math.PI * 2 + Math.random() * 0.8;
      const dist = (18 + Math.random() * 16) * reach;
      const dx = Math.cos(ang) * dist;
      const dy = Math.sin(ang) * dist - 6; // slight upward bias
      const rot = Math.random() * 180 - 90;
      anim.effect.setKeyframes([
        { transform: `${CENTER}translate(0,0) scale(1) rotate(0deg)`, opacity: 1, offset: 0 },
        { transform: `${CENTER}translate(${dx}px,${dy}px) scale(0.2) rotate(${rot}deg)`, opacity: 0, offset: 1 },
      ]);
      anim.cancel();
      anim.play();
    }
  }

  // The level-up's finite starburst + a gold shard ring, for the rebirth cards (pooled nodes; no layout read).
  function bigBurst() {
    if (prefersReducedMotion()) return;
    if (burstAnimRef.current) {
      burstAnimRef.current.cancel();
      burstAnimRef.current.play();
    }
    const { w, h } = layerSizeRef.current;
    if (w && h) spawnShards(w / 2, h * 0.46, TIER_GOLD, SHARD_POOL, 4);
  }

  // Put the shared card back to its everyday timeline after a milestone played on it. A no-op until a
  // milestone has (so with the flag off nothing here ever runs).
  function resetMilestoneCard() {
    if (!milestoneCardRef.current) return;
    milestoneCardRef.current = false;
    if (levelupRef.current) delete levelupRef.current.dataset.milestone;
    const a = levelupAnimRef.current;
    if (a && a.effect && a.effect.setKeyframes) {
      a.effect.setKeyframes(LEVELUP_FRAMES);
      a.effect.updateTiming({ duration: LEVELUP_MS });
    }
  }

  useImperativeHandle(ref, () => ({
    letterPop(letter, plusText, scale = 1, colour = '#2EFFE0', feelTier = 0) {
      const { w, h } = layerSizeRef.current;
      const anims = popAnimsRef.current;
      if (!w || !h || !anims.length) return; // not measured yet, or no pool
      const levelup = popCapRef.current && levelupAnimRef.current && levelupAnimRef.current.playState === 'running';
      const i = pickIndex(anims, POP_POOL, levelup ? 1 : POP_CAP, popNextRef);
      const el = popElsRef.current[i];
      const anim = anims[i];
      if (!el || !anim) return;
      const pos = pickPosition(w, h, barBoxRef.current, recentPosRef.current);
      el.classList.remove('is-tap'); // reset if this node was last used for a tap
      // KEY POWER tier (item 1) drives the visible/audible escalation the player BOUGHT:
      // T1-T4 teal, T5+ gold (overrides the streak colour); T3+ a hard offset shadow;
      // T2+ particle shards. All finite/pooled; particles skip under reduced motion.
      const tierColour = feelTier >= 5 ? TIER_GOLD : feelTier >= 1 ? TIER_TEAL : colour;
      // children: [0] = letter (tier colour), [1] = "+N" (always yellow, via CSS)
      el.children[0].textContent = letter;
      el.children[0].style.color = tierColour;
      el.children[0].style.textShadow = feelTier >= 3 ? '2px 2px 0 #000' : '';
      el.children[1].textContent = plusText;
      el.children[1].style.color = ''; // back to CSS yellow
      el.style.left = `${pos.x}px`;
      el.style.top = `${pos.y}px`;
      // Shards: KEY POWER T2+ throws its 4; the MENU TIER throws its own from T2 — whichever
      // is richer wins, so neither purchase nor progress is ever invisible.
      const tfx = tierRef.current;
      const shardN = Math.max(feelTier >= 2 ? SHARD_PER_POP : 0, tfx.shards);
      if (shardN > 0 && !prefersReducedMotion()) spawnShards(pos.x, pos.y, tierColour, shardN, 1 + tfx.tier * 0.12);
      // Streak tier scales the pop via the TRANSFORM (not font-size); per-pop variance adds a
      // small random rotation + scale multiplier on top so no two pops read identical.
      const rot = Math.random() * 20 - 10; // [-10°, +10°]
      const s = scale * (0.92 + Math.random() * 0.16); // ×[0.92, 1.08]
      // LONGER at higher menu tiers (Andy A1): the pop lives 600ms at T0 up to ~1.2s, rises
      // further, and lands with a punch (overshoot) before it floats off.
      const tf = tierRef.current;
      anim.effect.updateTiming({ duration: tf.popMs });
      anim.effect.setKeyframes([
        { transform: `${CENTER}rotate(${rot}deg) scale(${s}) translateY(8.96px)`, opacity: 0, offset: 0 },
        { transform: `${CENTER}rotate(${rot}deg) scale(${s * (1 + tf.tier * 0.05)}) translateY(-8.96px)`, opacity: 1, offset: 0.18 },
        { transform: `${CENTER}rotate(${rot}deg) scale(${s}) translateY(-14px)`, opacity: 1, offset: 0.3 },
        { transform: `${CENTER}rotate(${rot}deg) scale(${s}) translateY(-${tf.popRise}px)`, opacity: 0, offset: 1 },
      ]);
      anim.cancel();
      anim.play();
    },
    // Tap pop: no letter — the "+N" ALONE, at the letter's size (via .is-tap CSS), in the
    // tier colour, spawned AT the tap client coords (converted to layer-local), still kept
    // out of the XP bar's box.
    tapPop(plusText, scale = 1, colour = '#2EFFE0', clientX = 0, clientY = 0) {
      const anims = popAnimsRef.current;
      if (!anims.length) return;
      const lr = layerRectRef.current;
      let x = clientX - lr.left;
      let y = clientY - lr.top;
      const box = barBoxRef.current;
      if (box && x > box.l && x < box.r && y > box.t && y < box.bt) {
        // tap landed on the readout → nudge the pop just clear of it (above, else below)
        y = box.t - POP_HALF > 0 ? box.t - POP_HALF : box.bt + POP_HALF;
      }
      const levelup = popCapRef.current && levelupAnimRef.current && levelupAnimRef.current.playState === 'running';
      const i = pickIndex(anims, POP_POOL, levelup ? 1 : POP_CAP, popNextRef);
      const el = popElsRef.current[i];
      const anim = anims[i];
      if (!el || !anim) return;
      el.classList.add('is-tap'); // hides the letter span, upsizes the "+N" (CSS)
      el.children[1].textContent = plusText;
      el.children[1].style.color = colour; // tier colour for the tap
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      const rot = Math.random() * 20 - 10; // [-10°, +10°]
      const s = scale * (0.92 + Math.random() * 0.16); // ×[0.92, 1.08]
      // LONGER at higher menu tiers (Andy A1): the pop lives 600ms at T0 up to ~1.2s, rises
      // further, and lands with a punch (overshoot) before it floats off.
      const tf = tierRef.current;
      anim.effect.updateTiming({ duration: tf.popMs });
      anim.effect.setKeyframes([
        { transform: `${CENTER}rotate(${rot}deg) scale(${s}) translateY(8.96px)`, opacity: 0, offset: 0 },
        { transform: `${CENTER}rotate(${rot}deg) scale(${s * (1 + tf.tier * 0.05)}) translateY(-8.96px)`, opacity: 1, offset: 0.18 },
        { transform: `${CENTER}rotate(${rot}deg) scale(${s}) translateY(-14px)`, opacity: 1, offset: 0.3 },
        { transform: `${CENTER}rotate(${rot}deg) scale(${s}) translateY(-${tf.popRise}px)`, opacity: 0, offset: 1 },
      ]);
      anim.cancel();
      anim.play();
    },
    edgePulse(colour) {
      const anims = edgeAnimsRef.current;
      if (!anims.length) return;
      const i = edgeNextRef.current % EDGE_POOL;
      edgeNextRef.current = (i + 1) % EDGE_POOL;
      const el = edgeElsRef.current[i];
      const anim = anims[i];
      if (!el || !anim) return;
      el.style.boxShadow = `inset 0 0 64px 14px ${colour}`;
      anim.cancel();
      anim.play();
    },
    // `size` ('S' | 'M' | 'L' | 'XL', MILESTONE MOMENTS) is only ever passed with the flag on.
    celebrate(level, size) {
      const a = levelupAnimRef.current;
      if (!a) return;
      for (const p of popAnimsRef.current) p.cancel(); // celebration owns the budget
      popCapRef.current = true;
      const m = size ? MILESTONE_FX[size] : null;
      if (m) {
        // Same card, same copy (the title and LV line stay); the kicker reads MILESTONE. Reduced
        // motion keeps the copy but not the bigger slam / longer hold.
        const card = !prefersReducedMotion() && MILESTONE_CARD[size];
        if (levelupRef.current) levelupRef.current.dataset.milestone = size;
        if (a.effect && a.effect.setKeyframes) {
          a.effect.setKeyframes(card ? card.frames : LEVELUP_FRAMES);
          a.effect.updateTiming({ duration: card ? card.ms : LEVELUP_MS });
        }
        milestoneCardRef.current = true;
        milestoneEndsAtRef.current = performance.now() + (card ? card.ms : LEVELUP_MS);
      } else {
        resetMilestoneCard();
      }
      if (levelTitleRef.current) levelTitleRef.current.textContent = `LEVEL ${level}`;
      if (levelSubRef.current) {
        levelSubRef.current.textContent = m ? 'MILESTONE' : LEVEL_PHRASES[(Math.max(1, level) - 1) % LEVEL_PHRASES.length];
      }
      // Economy v3: level-ups no longer pay wins, so there is no "+N WINS" reward line here.
      // CLUTTER PASS (Andy oct3): no "LV n-1 → LV n" — the LEVEL n title right above it says it (:empty hides the row).
      if (levelDetailRef.current) levelDetailRef.current.textContent = '';
      a.cancel();
      a.play();
      // BIGGER at higher tiers: the starburst from T1, and a ring of shards that grows per tier.
      const tf = tierRef.current;
      if (!prefersReducedMotion()) {
        if (tf.levelUpBurst && burstAnimRef.current) {
          burstAnimRef.current.cancel();
          burstAnimRef.current.play();
        }
        const { w, h } = layerSizeRef.current;
        if (w && h) spawnShards(w / 2, h * 0.46, tf.tier >= 5 ? TIER_GOLD : TIER_TEAL, Math.min(SHARD_POOL, tf.levelUpShards + (m ? m.shards : 0)), 3 + tf.tier * 0.6);
      }
    },
    // MILESTONE MOMENTS: ms left on a milestone card (0 otherwise) — the tier-up card waits it out
    // instead of overwriting the bigger LEVEL N on the shared element. A clock read, not a layout read.
    milestoneBusyMs() {
      return milestoneCardRef.current ? Math.max(0, milestoneEndsAtRef.current - performance.now()) : 0;
    },
    // STEP 21: a generic one-shot name card on the level-up element (mark rank-ups). Same finite
    // play + starburst as tierUp; never mutes typing.
    announce(title, sub = '', detail = '') {
      const a = levelupAnimRef.current;
      if (!a) return;
      popCapRef.current = false;
      resetMilestoneCard();
      if (levelTitleRef.current) levelTitleRef.current.textContent = title;
      if (levelSubRef.current) levelSubRef.current.textContent = sub;
      if (levelDetailRef.current) levelDetailRef.current.textContent = detail;
      a.cancel();
      a.play();
      if (burstAnimRef.current && !prefersReducedMotion()) {
        burstAnimRef.current.cancel();
        burstAnimRef.current.play();
      }
    },
    // STEP 22: crossing into a new MENU TIER names the frame the player just earned. Reuses
    // the level-up element + starburst (one finite play each).
    tierUp(name) {
      const a = levelupAnimRef.current;
      if (!a) return;
      popCapRef.current = false;
      resetMilestoneCard();
      // The tier NAME is the headline (≤6 letters, like "LEVEL 9" it fits a 320px menu); "NEW
      // FRAME" rides the sub line. "STEEL FRAME" as the title overflowed the fx layer at 360px.
      if (levelTitleRef.current) levelTitleRef.current.textContent = name;
      if (levelSubRef.current) levelSubRef.current.textContent = 'NEW FRAME UNLOCKED';
      if (levelDetailRef.current) levelDetailRef.current.textContent = '';
      a.cancel();
      a.play();
      if (burstAnimRef.current && !prefersReducedMotion()) {
        burstAnimRef.current.cancel();
        burstAnimRef.current.play();
      }
    },
    // One finite "REBIRTH N" celebration, reusing the level-up pooled element (1500ms). Rebirth Rush (Andy:
    // "Big moment"): it says the ×5 jump plainly with the new total (5^R), and its last line is the ONE
    // rebuy-spree cue — the KEY went back to T0 and the wins were kept. Same finite starburst + gold shard
    // ring the level-up throws (pooled; skipped under reduced motion).
    rebirthCelebration(n) {
      const a = levelupAnimRef.current;
      if (!a) return;
      for (const p of popAnimsRef.current) p.cancel();
      popCapRef.current = true;
      resetMilestoneCard();
      const total = rebirthMult(n);
      if (levelTitleRef.current) levelTitleRef.current.textContent = `REBIRTH ${formatNum(n)}`;
      if (levelSubRef.current) levelSubRef.current.textContent = n > 1 ? `×5 XP & WINS · NOW ×${formatNum(total)}` : '×5 XP & WINS';
      if (levelDetailRef.current) levelDetailRef.current.textContent = '';
      a.cancel();
      a.play();
      bigBurst();
    },
    // Rebirth Rush one-time conversion: "YOUR LEVELS BECAME +N REBIRTHS" (econMigrate rebirthRushNotice).
    // The new rebirth count is the headline; Andy's line rides the sub (it wraps on a phone).
    rebirthRush(added, rebirths) {
      const a = levelupAnimRef.current;
      if (!a) return;
      for (const p of popAnimsRef.current) p.cancel();
      popCapRef.current = true;
      resetMilestoneCard();
      if (levelTitleRef.current) levelTitleRef.current.textContent = `REBIRTH ${formatNum(rebirths)}`;
      if (levelSubRef.current) levelSubRef.current.textContent = `YOUR LEVELS BECAME +${formatNum(added)} REBIRTHS`;
      if (levelDetailRef.current) levelDetailRef.current.textContent = `×${formatNum(rebirthMult(rebirths))} XP & WINS`;
      a.cancel();
      a.play();
      bigBurst();
    },
    // One finite "+N WINS" stamp (menu return after a paying round). Same pooled pattern.
    winsStamp(amount) {
      const a = winsStampAnimRef.current;
      if (!a || !winsStampRef.current) return;
      winsStampRef.current.textContent = `+${formatNum(amount)} WINS`;
      a.cancel();
      a.play();
    },
    // One-time WINS explainer — shown the first time the player earns any wins (3s). Copy is
    // fixed; the caller owns the "only once" gate (a localStorage flag).
    winsHint() {
      const a = winsHintAnimRef.current;
      if (!a || !winsHintRef.current) return;
      winsHintRef.current.textContent = 'WINS BUY UPGRADES IN THE SHOP';
      a.cancel();
      a.play();
    },
  }));

  return (
    <div className="menu-xp-fx" ref={layerRef} aria-hidden="true">
      {Array.from({ length: POP_POOL }, (_, i) => (
        <span
          key={`p${i}`}
          className="menu-xp-pop"
          ref={(n) => {
            popElsRef.current[i] = n;
          }}
        >
          <span className="menu-xp-pop-letter" />
          <span className="menu-xp-pop-plus" />
        </span>
      ))}
      {Array.from({ length: EDGE_POOL }, (_, i) => (
        <div
          key={`e${i}`}
          className="menu-xp-edge"
          ref={(n) => {
            edgeElsRef.current[i] = n;
          }}
        />
      ))}
      {Array.from({ length: SHARD_POOL }, (_, i) => (
        <span
          key={`s${i}`}
          className="menu-xp-shard"
          ref={(n) => {
            shardElsRef.current[i] = n;
          }}
        />
      ))}
      <div className="menu-xp-levelburst" ref={burstRef} />
      <div className="menu-xp-levelup" ref={levelupRef}>
        <span className="menu-xp-levelup-title" ref={levelTitleRef}>
          LEVEL UP
        </span>
        <span className="menu-xp-levelup-sub" ref={levelSubRef} />
        <span className="menu-xp-levelup-detail" ref={levelDetailRef} />
      </div>
      <div className="menu-xp-winsstamp" ref={winsStampRef} />
      <div className="menu-xp-winshint" ref={winsHintRef} />
    </div>
  );
});
