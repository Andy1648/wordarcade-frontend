// RollScreen.jsx — THE ROLL SCREEN (ROLL v1 — Andy oct5 mockup claude/mockups/roll-v1/Main.dc.html: "this is gold,
// before was ass"). The MARKS button opens this; its INDEX button opens the MARKS INDEX (MarksIndex.jsx) as a layer of
// the same overlay slot.
//
//   top      INDEX n/N · ROLL · the GEMS pill (+ ✕)
//   middle   THE REEL: a full-width band of mark cards under a yellow pointer (Reel.jsx), and the result LINE under
//            it (name · stat number · what it touches · ★ pips)
//   bottom   the PITY bars (EPIC+ IN n, big, + its bar · LEGENDARY+ IN n) · ROLL (gem price) · AUTO (one button that
//            cycles OFF → RARE+ → EPIC+ → LEGENDARY+, "TAP TO SET TARGET") + SKIP < tier
//
// ROLL vs INDEX are TWO screens, never mixed (Andy oct5): this one is ROLL, AUTO, gems, pity and the result; the
// INDEX (the collection) is one button away and never rolls, prices or replays.
//
// HONEST: the strip is drawn from the live roll table of the roll that was just paid for (reelPlan.drawStrip), the
// landing cell is the real result, nothing is inserted next to it; the odds and pity are the game's (rollTable /
// oneInX / pityLadder) — the mockup's boosted demo luck is not here. NO SPOILERS: the line, the pity, the INDEX
// count and an auto-equipped MAIN update when the reel LANDS, never before. TAP ANYWHERE mid-reveal jumps to the
// result; a tap closes a DIM / FULL reveal. Closing mid-reveal still lands it (the roll is already paid and saved).
// A DOUBLE ROLL's extra shows on the line ("+NAME"), and a first-time mark anywhere in the roll gets the full reveal.
// Coming back from the INDEX never replays the last roll (the `played` ref outlives the Reel's remount).
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { registerMarkGlyphs } from '../MarkBadge';
import { ROLLED_GLYPHS, GLYPH_FINISH } from '../markGlyphsRolled.jsx';
import Reel from './Reel';
import ShinyBadge from './ShinyBadge';
import SpotlightTutorial from '../../tutorials/SpotlightTutorial.jsx';
import { TUTORIALS, hasSeenTutorial, markTutorialSeen } from '../../tutorials/registry.js';
import { MARK_TIERS } from '../../progress/marks';
import {
  markEntry, viewState, pityLadder, rollTable, ensureRollState, permanentOwnedCount, mainTag, collection, getSkipBelow,
  setSkipBelow, SKIP_TIERS, PITY,
} from '../../progress/markRolls';
import { buyMarkRoll, nextRollCost, applyRollEquip } from '../../progress/markRollShop';
import { getGems, subscribeGems } from '../../progress/gems';
import { GemIcon, GemCount } from '../gems/Gems';
import { isBoostActive } from '../../progress/boost';
import { sndPurchase, sndWordRejected } from '../../audio/gameSounds';
import { sndRollCharge, sndRollCancel, sndRollRelease } from '../../audio/rollSounds';
import { createHoldConfirm } from '../kit/holdConfirm.js';
import { announceRolls } from '../../leaderboard/live';
import { formatNum } from '../../format';
import { lazyWithReload } from '../../lib/chunkReload';
import { holdBeats } from '../../hooks/useBeatSync';
import { CARD_RAR, cardTier } from '../markCard/palette.js';
import { splitTag } from '../markCard/cardModel.js';
import {
  drawStrip, revealMode, restOffset, autoShouldStop, needMoreText, nextAutoTarget, AUTO_GAP_MS, CHARGE_MS, OVERHOLD_MS,
} from './reelPlan.js';
import './RollScreen.css';
import { useReduceMotion } from '../../lib/useReduceMotion';
import { SEASON2, V3 } from '../../progress/season';

registerMarkGlyphs(ROLLED_GLYPHS, GLYPH_FINISH);

// This screen covers the whole menu: a pointer moving over it must not drive the menu's magnetic cards / wall
// parallax / cursor trail underneath (window listeners — each move restyled the hidden menu every frame).
export const stopMenuPointer = (e) => e.stopPropagation();

const MarksIndex = lazyWithReload(() => import('../MarksIndex'), 'MarksIndex');
const tierName = (t) => (MARK_TIERS[t] ? MARK_TIERS[t].name : String(t || '').toUpperCase());

// REDUCE MOTION: the in-game toggle (PR #207, src/lib/reduceMotion.js) — live, never the OS media query.
const useReducedMotion = useReduceMotion;

/** The result LINE under the reel (mockup): NAME in its tier colour · the stat number · what it touches · ★ pips. */
function ResultLine({ result, view, pop = true }) {
  if (!result) return <div className="rs-result is-empty" aria-hidden="true" />;
  const m = markEntry(result.markId);
  const { num, kind } = splitTag(mainTag(result.markId, view)); // "×1.1 WINS" → ×1.1 · WINS (numbers first)
  const extra = (result.extra || []).filter(Boolean);
  return (
    <div
      className={`rs-result${pop ? '' : ' is-rest'}`}
      data-testid="mark-roll-result"
      data-tier={result.tier}
      data-shiny={result.shiny ? '1' : undefined}
      style={{ '--rs-tier': CARD_RAR[cardTier(result.tier)].line }}
    >
      <span className="rs-res-name">{m ? m.name : ''}</span>
      {result.newMark ? <span className="rs-chip is-new">NEW</span> : null}
      <span className="rs-card-stat">
        <span className="rs-res-num">{num}</span>
        {kind ? ' ' : null}
        {kind ? <span className="rs-res-kind">{kind}</span> : null}
      </span>
      {result.copies > 1 ? <span className="rs-chip is-dupe">×{formatNum(result.copies)}</span> : null}
      {result.shiny ? <ShinyBadge className="rs-res-shiny" /> : null}
      {extra.length ? (
        <span className="rs-card-extra" data-testid="mark-roll-extra">
          {extra.map((x, i) => {
            const xm = markEntry(x.markId);
            return (
              <span key={i} className="rs-chip is-extra" data-tier={x.tier} style={{ '--rs-tier': CARD_RAR[cardTier(x.tier)].line }}>
                +{xm ? xm.name : ''}{x.newMark ? ' · NEW' : ''}
              </span>
            );
          })}
        </span>
      ) : null}
    </div>
  );
}

// startIndex: opened from the menu's INDEX rail button — the INDEX shows at once and its ✕ closes the whole overlay.
export default function RollScreen({ unlockedIds = [], equippedId = null, achievementNames = {}, level = 1, earned = [], onEquip, onClose, startIndex = false }) {
  const [landed, setLanded] = useState(0);
  const idsRef = useRef(unlockedIds);
  idsRef.current = unlockedIds;
  // NO SPOILERS: storage is re-read ONLY when a reel lands
  const view = useMemo(() => viewState(idsRef.current), [landed]); // eslint-disable-line react-hooks/exhaustive-deps
  const reduced = useReducedMotion();
  const [gems, setGems] = useState(() => getGems()); // GEMS buy rolls (Andy oct5) — wins never do
  const [spin, setSpin] = useState(null);
  // before the first roll the reel already shows REAL draws from your live odds (no result on it)
  const [idle] = useState(() => {
    try {
      return drawStrip(rollTable(viewState(idsRef.current), { permanentOwned: permanentOwnedCount(), boost: isBoostActive() }).probs, Math.random, { resultId: null });
    } catch { return null; }
  });
  const [shown, setShown] = useState(null);
  const [need, setNeed] = useState(0); // short balance: the gems missing — a number + gem, never a sentence
  const [skipBelow, setSkip] = useState(() => getSkipBelow());
  const [target, setTarget] = useState(null); // the AUTO target (null = OFF) — the one button cycles it
  const [showIndex, setShowIndex] = useState(!!startIndex);
  const [fresh, setFresh] = useState(false); // the result line pops only for a roll that just landed
  const [coverHost, setCoverHost] = useState(null);
  const [tut, setTut] = useState(() => !hasSeenTutorial('markRolls'));
  const ctl = useRef(null);
  const played = useRef(0); // the last spin seq the reel played (a remount after the INDEX never replays it)
  const btn = useRef(null);
  const closeRef = useRef(null);
  const pending = useRef(null); // the paid roll whose reel has not landed yet
  const auto = useRef({ on: false, until: null, timer: null });
  const live = useRef({});

  useEffect(() => subscribeGems(setGems), []);
  // this screen covers the whole menu: hold the menu's music-beat pops (each one restyled the whole document), and
  // mark <html> so the covered menu / wall / particles skip rendering entirely (RollScreen.css: content-visibility) —
  // a wins count-up or a parallax drift under an opaque screen was relayout + repaint every frame for nothing
  useEffect(() => {
    const release = holdBeats();
    const de = document.documentElement;
    de.setAttribute('data-roll-cover', '');
    return () => { release(); de.removeAttribute('data-roll-cover'); };
  }, []);

  const cost = nextRollCost(level, view);
  const canAfford = cost.free || gems >= cost.gems;
  const ladder = pityLadder(view);
  const epicLeft = (ladder.find((p) => p.tier === 'epic') || { left: 0 }).left;
  const legLeft = (ladder.find((p) => p.tier === 'legendary') || { left: 0 }).left;
  const epicFrac = Math.max(0, Math.min(1, 1 - epicLeft / PITY.epic.hard));
  const legFrac = PITY.legendary && PITY.legendary.hard ? Math.max(0, Math.min(1, 1 - legLeft / PITY.legendary.hard)) : 0;
  const col = collection(view);
  const tutDef = TUTORIALS.find((t) => t.id === 'markRolls');
  const rolling = !!(spin && pending.current);
  // the worn mark's stat for the EQUIPPED chip (read on render; the line updates when a reel lands / an equip lands)
  const wornE = equippedId ? markEntry(equippedId) : null;
  const worn = wornE ? { name: wornE.name, tier: wornE.tier, tag: mainTag(equippedId, view) } : null;

  const stopAuto = () => {
    auto.current.on = false;
    auto.current.until = null;
    if (auto.current.timer) clearTimeout(auto.current.timer);
    auto.current.timer = null;
    setTarget(null);
  };
  const short = () => {
    const c = nextRollCost(level);
    setNeed(Math.max(1, Math.ceil(c.gems - getGems())));
    sndWordRejected();
    const el = btn.current;
    if (el && typeof el.animate === 'function' && !reduced) {
      el.style.willChange = 'transform';
      const a = el.animate(
        [{ transform: 'translateX(0)' }, { transform: 'translateX(-8px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(-3px)' }, { transform: 'translateX(0)' }],
        { duration: 260, easing: 'linear' },
      );
      const off = () => { el.style.willChange = ''; };
      a.finished.then(off, off);
    }
  };

  // the reel LANDED (or was skipped): now the line, pity, INDEX count and the MAIN may change; a hit at the AUTO
  // target (or better) stops AUTO right here, so its reveal stays up for the tap
  const commit = (res) => {
    const p = pending.current;
    if (!p || p !== res) return;
    pending.current = null;
    setShown(res);
    setFresh(true);
    setLanded((n) => n + 1);
    if (auto.current.on && autoShouldStop(res, auto.current.until)) stopAuto();
    announceRolls([res, ...(res.extra || [])]); // MYTHIC+ → one ticker line each
    const wornNow = res.decision === 'auto' ? applyRollEquip(res, earned) : null;
    if (wornNow && onEquip) onEquip(wornNow);
  };

  const doRoll = () => {
    if (ctl.current && ctl.current.busy()) { ctl.current.finish(true); return null; }
    if (pending.current) commit(pending.current);
    // the LIVE table of the roll about to be paid for — the strip is drawn from exactly these odds
    const before = ensureRollState();
    const table = rollTable(before, { permanentOwned: permanentOwnedCount(), boost: isBoostActive() });
    const res = buyMarkRoll({ level });
    if (!res) { short(); stopAuto(); return null; }
    setNeed(0);
    sndPurchase();
    // the hit that stops AUTO always gets the full reveal
    const mode = revealMode(res, { skipBelow, reduced, autoUntil: auto.current.on ? auto.current.until : null });
    const strip = drawStrip(table.probs, Math.random, { resultId: res.markId });
    const rest = restOffset();
    pending.current = res;
    setShown(null);
    setSpin((s) => ({ seq: (s ? s.seq : 0) + 1, result: res, strip, mode, rest }));
    return res;
  };
  live.current.doRoll = doRoll;

  const onLand = (res) => commit(res);
  const onDone = () => {
    if (!auto.current.on) return;
    auto.current.timer = setTimeout(() => {
      auto.current.timer = null;
      if (auto.current.on) live.current.doRoll();
    }, AUTO_GAP_MS);
  };

  // HOLD TO ROLL (NIGHT oct8 R4 — Andy: "I liked hold-to-buy — greater satisfaction"). The kit's hold clock, re-timed:
  // phase 1 (light rattle, the fill crosses) → at CHARGE_MS the button is CHARGED (phase 2: hard rattle, "RELEASE!")
  // → the RELEASE is the spin (a slingshot). Released before full charge = cancel (the fill drains, nothing is paid).
  // Held past OVERHOLD_MS after the charge → fires by itself (never stuck). Mid-spin the overlay's capture handler
  // takes the pointer-down (jump to the result), so a hold can never start over a running reel. NO GEMS: the press
  // shows the shortfall at once (no hold to find out).
  const [holdPhase, setHoldPhase] = useState(0); // 0 idle · 1 charging · 2 charged
  const holdRef = useRef(null);
  if (!holdRef.current) {
    holdRef.current = createHoldConfirm({
      holdMs: CHARGE_MS + OVERHOLD_MS,
      shakeAt: CHARGE_MS,
      onPhase: (p) => {
        setHoldPhase(p);
        if (ctl.current && ctl.current.charge) ctl.current.charge(live.current.reduced ? 0 : p);
      },
      onCommit: () => { live.current.fire(); }, // the overhold: fires on its own
      onCancel: (ms) => {
        if (ms >= CHARGE_MS) { live.current.fire(); return; } // charged + released = THE SPIN
        sndRollCancel();
      },
    });
  }
  useEffect(() => () => holdRef.current && holdRef.current.dispose(), []);
  const fire = () => {
    sndRollRelease();
    doRoll();
  };
  live.current.fire = fire;
  live.current.reduced = reduced;
  const holdStart = () => {
    if (ctl.current && ctl.current.busy()) { ctl.current.finish(); return; }
    if (!canAfford) { short(); return; }
    if (holdRef.current.start()) sndRollCharge(CHARGE_MS);
  };
  const holdEnd = () => { if (holdRef.current) holdRef.current.end(); };
  const holdKeyDown = (e) => {
    if (e.key !== ' ' && e.key !== 'Enter') return;
    e.preventDefault();
    if (!e.repeat) holdStart();
  };
  const holdKeyUp = (e) => {
    if (e.key !== ' ' && e.key !== 'Enter') return;
    e.preventDefault();
    holdEnd();
  };
  // AUTO (mockup): one button cycles OFF → RARE+ → EPIC+ → LEGENDARY+ → OFF. From OFF it starts rolling; while on, a
  // tap only moves the target (the spin in flight is judged against the new one when it lands).
  // v3 (SEASON2): AUTO ROLL is the R2 unlock (progression-v3.md; markRollShop.autoRoll gates the same door). Flag OFF:
  // always open, as today.
  const autoOpen = !SEASON2 || !V3.unlocks || V3.unlocks.featureOpen('autoRoll');
  const pressAuto = () => {
    if (!autoOpen) { sndWordRejected(); return; }
    const next = nextAutoTarget(target);
    if (!next) { stopAuto(); return; }
    setTarget(next);
    auto.current.until = next;
    if (auto.current.on) return;
    auto.current.on = true;
    if (ctl.current && ctl.current.busy()) return; // the land in flight hands over (onDone) — never a double roll
    if (!doRoll()) stopAuto();
  };
  const pickSkip = (t) => setSkip(setSkipBelow(t));
  // leaving for the INDEX: a running reveal lands at once (no effects) so nothing is left half-played
  const openIndex = () => {
    stopAuto();
    if (ctl.current && ctl.current.busy()) ctl.current.finish(true);
    setFresh(false); // coming back shows the line at rest — never a replayed pop
    setShowIndex(true);
  };
  // TAP ANYWHERE mid-reveal jumps to the result / closes the reveal (capture: the tap never also presses what is
  // under it). The AUTO button is let through so it always answers in one tap; INDEX and ✕ too — they land the
  // reveal themselves, and a first tap that only skipped read as a dead button.
  useEffect(() => {
    const host = coverHost;
    if (!host || typeof host.addEventListener !== 'function') return undefined;
    let swallowUntil = 0;
    const t = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const down = (e) => {
      if (!ctl.current || !ctl.current.busy()) return;
      if (e.target && e.target.closest && e.target.closest('.rs-auto-btn, .rs-index-btn, .rs-close')) return;
      e.stopPropagation();
      e.preventDefault();
      swallowUntil = t() + 800;
      ctl.current.finish();
    };
    const click = (e) => {
      if (t() >= swallowUntil) return;
      swallowUntil = 0;
      e.stopPropagation();
      e.preventDefault();
    };
    host.addEventListener('pointerdown', down, true);
    host.addEventListener('click', click, true);
    return () => {
      host.removeEventListener('pointerdown', down, true);
      host.removeEventListener('click', click, true);
    };
  }, [coverHost]);

  // focus ✕ when this screen shows (and on the way back from the INDEX) — ONLY then: App passes a fresh onClose on
  // every render, and re-running focus() on each of those was a forced style/layout on every roll
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (showIndex) return undefined;
    closeRef.current?.focus();
    const onKey = (ev) => { if (ev.key === 'Escape' && onCloseRef.current) onCloseRef.current(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showIndex]);
  // the tab goes HIDDEN mid-roll (or mid-AUTO): the roll lands now, quietly (it is already paid and saved), and AUTO
  // stops — no gems are ever spent while nobody is looking
  useEffect(() => {
    const onVis = () => {
      if (typeof document === 'undefined' || document.visibilityState !== 'hidden') return;
      live.current.stopAuto && live.current.stopAuto();
      if (ctl.current && ctl.current.busy()) ctl.current.finish(true);
      else if (pending.current) live.current.commit && live.current.commit(pending.current);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);
  // closing mid-reveal still lands the roll (equip + ticker), and an auto roll stops
  useEffect(() => () => {
    if (auto.current.timer) clearTimeout(auto.current.timer);
    auto.current.on = false;
    if (pending.current) live.current.commit && live.current.commit(pending.current);
  }, []);
  live.current.commit = commit;
  live.current.stopAuto = stopAuto;

  if (showIndex) {
    return (
      <Suspense fallback={null}>
        <MarksIndex
          unlockedIds={unlockedIds}
          equippedId={equippedId}
          achievementNames={achievementNames}
          earned={earned}
          onEquip={onEquip}
          onClose={() => { if (startIndex) { onClose(); return; } setShowIndex(false); setLanded((n) => n + 1); }}
        />
      </Suspense>
    );
  }

  // the label says what the hand must do: HOLD TO ROLL at rest, HOLD… while the fill crosses, RELEASE! once charged
  const rollLabel = holdPhase === 2 ? 'RELEASE!' : holdPhase === 1 ? 'HOLD\u2026' : cost.free ? 'HOLD · FREE ROLL' : rolling ? '...' : canAfford ? 'HOLD TO ROLL' : 'NO GEMS';
  return (
    <div className={`marks-overlay rs-overlay${reduced ? ' is-reduced' : ''}`} role="dialog" aria-modal="true" aria-label="Roll for a mark" ref={setCoverHost} onPointerMove={stopMenuPointer} onMouseMove={stopMenuPointer}>
      <div className="rs-top">
        {/* NIGHT oct8 #4 (RollV3 mockup): ← MENU · INDEX n/N · EQUIPPED <stat> … the GEMS pill */}
        <button type="button" className="rs-close marks-close" onClick={onClose} aria-label="Close" ref={closeRef}>
          <span aria-hidden="true">←</span> MENU
        </button>
        <button type="button" className="rs-index-btn" onClick={openIndex} data-testid="roll-index">
          INDEX <span className="rs-index-n">{formatNum(col.base)}/{formatNum(col.total)}</span>
        </button>
        <div className="rs-equipped" aria-label={worn ? `Equipped: ${worn.name}, ${worn.tag}` : 'Nothing equipped'}>
          <span className="rs-equipped-k">EQUIPPED</span>
          <span className="rs-equipped-v" style={worn ? { '--rs-tier': CARD_RAR[cardTier(worn.tier)].line } : undefined}>{worn ? worn.tag : 'NONE'}</span>
        </div>
        <h2 className="rs-title" aria-hidden="true">ROLL</h2>
        <div className="rs-topr">
          {/* GEMS: the balance the price is paid from, in its pill; a short balance shows −N + gem beside it */}
          <div className="rs-sub">
            <div className="rs-msg" role="status" aria-live="polite" data-need={need || undefined}>
              {need ? (
                <>
                  <span className="rs-sr">{needMoreText(need, 0, formatNum)}</span>
                  <span className="rs-need" aria-hidden="true">−{formatNum(need)}<GemIcon size={16} className="rs-need-gem" /></span>
                </>
              ) : null}
            </div>
            <GemCount value={gems} size={30} className="rs-gems-bal" />
          </div>
        </div>
      </div>

      <div className="rs-stage" data-tier={spin ? spin.result.tier : undefined} data-mode={spin ? spin.mode : undefined}>
        <Reel spin={spin} idle={idle} view={view} auto={target != null} coverHost={coverHost} ctl={ctl} played={played} onLand={onLand} onDone={onDone}>
          <div className="rs-result-slot">
            <ResultLine key={spin ? spin.seq : 0} result={shown} view={view} pop={fresh} />
          </div>
        </Reel>
      </div>

      {/* the pity numbers live in TWO places (the EPIC+ headline under ROLL, the bars on the left): the testid wraps both */}
      <div className="rs-controls" data-testid="roll-pity">
        <div className="rs-pity" aria-label="Pity">
          <div className="rs-pity-row is-epic">
            <span className="rs-pity-lbl">EPIC+</span>
            <div className="rs-pity-bar" aria-hidden="true"><span className="rs-pity-fill" style={{ transform: `scaleX(${epicFrac})` }} /></div>
          </div>
          <div className="rs-pity-row is-leg">
            <span className="rs-pity-lbl rs-pity-leg">LEGENDARY+ IN</span>{' '}
            <span className="rs-pity-n">{formatNum(legLeft)}</span>
            <div className="rs-pity-bar" aria-hidden="true"><span className="rs-pity-fill" style={{ transform: `scaleX(${legFrac})` }} /></div>
          </div>
        </div>
        <div className="rs-rollcol">
          <button
            type="button"
            ref={btn}
            className={`rs-roll rs-hold${canAfford ? '' : ' is-short'}${cost.free ? ' is-free' : ''}${rolling ? ' is-rolling' : ''}${holdPhase === 1 ? ' is-holding' : ''}${holdPhase === 2 ? ' is-charged' : ''}`}
            style={{ '--rs-hold-ms': `${CHARGE_MS}ms` }}
            onPointerDown={(e) => { if (e.button === 0) holdStart(); }}
            onPointerUp={holdEnd}
            onPointerLeave={holdEnd}
            onPointerCancel={holdEnd}
            onKeyDown={holdKeyDown}
            onKeyUp={holdKeyUp}
            onBlur={holdEnd}
            onClick={(e) => e.preventDefault()}
            onContextMenu={(e) => e.preventDefault()}
            aria-pressed={holdPhase > 0}
            data-hold={holdPhase || undefined}
            aria-label={cost.free ? 'HOLD TO ROLL · FREE ROLL' : `HOLD TO ROLL · ${formatNum(cost.gems)} GEMS`}
          >
            {/* the charge fill: one rectangle crossing the face (transform only), drains on an early release */}
            <span className="rs-hold-clip" aria-hidden="true"><span className="rs-hold-fill" /></span>
            <span className="rs-roll-lbl">{rollLabel}</span>
            {cost.free ? null : (
              <span className="rs-roll-price"><GemIcon size={22} className="rs-roll-gem" />{formatNum(cost.gems)}</span>
            )}
          </button>
          {/* the pity headline, BIG, right under the button it is about (NIGHT oct8 #4) */}
          <div className="rs-pity-big" aria-hidden="true">
            EPIC+ IN <b>{formatNum(epicLeft)}</b>
          </div>
        </div>
        <div className="rs-opts">
          <button
            type="button"
            className={`rs-auto-btn${target ? ` is-on is-${target}` : ''}${autoOpen ? '' : ' is-locked'}`}
            aria-pressed={target != null}
            aria-disabled={autoOpen ? undefined : 'true'}
            aria-label={!autoOpen ? 'Auto roll unlocks at rebirth 1' : target ? `Auto roll until ${tierName(target)} or better — tap to change` : 'Auto roll off — tap to set a target'}
            onClick={pressAuto}
            data-testid="roll-auto"
            data-target={target || 'off'}
          >
            {!autoOpen ? `AUTO · R${(V3.unlocks && V3.unlocks.unlockAt('autoRoll')) || 1}` : target ? `AUTO → ${tierName(target)}+` : 'AUTO: OFF'}
          </button>
          <div className="rs-auto-cap" aria-hidden="true">{autoOpen ? 'TAP TO SET TARGET' : 'UNLOCKS AT REBIRTH 1'}</div>
          <label className="rs-pick rs-skip">
            <span aria-hidden="true">SKIP</span>
            <select
              className="rs-select"
              value={skipBelow}
              onChange={(e) => pickSkip(e.target.value)}
              aria-label="Skip reveals below this tier"
              data-testid="roll-skip"
            >
              {SKIP_TIERS.map((t) => <option key={t} value={t}>&lt; {tierName(t)}</option>)}
            </select>
          </label>
        </div>
      </div>

      {tut && tutDef && (
        <SpotlightTutorial tutorial={tutDef} onDone={() => { markTutorialSeen('markRolls'); setTut(false); }} />
      )}
    </div>
  );
}
