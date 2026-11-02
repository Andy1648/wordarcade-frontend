// RollScreen.jsx — THE ROLL SCREEN (ROLL v1 — Andy oct5 mockup claude/mockups/roll-v1/Main.dc.html: "this is gold,
// before was ass"). The MARKS button opens this; its INDEX button opens the MARKS INDEX (MarksIndex.jsx) as a layer of
// the same overlay slot.
//
//   top      INDEX n/N · ROLL · the GEMS pill (+ ✕)
//   middle   THE REEL: a full-width band of mark cards under a yellow pointer (Reel.jsx), and the result LINE under
//            it (name · stat number · what it touches · ★ pips)
//   bottom   the PITY bars (EPIC+ IN n, big, + its bar · LEGENDARY+ IN n) · ROLL (gem price) · AUTO (one button that
//            cycles OFF → RARE+ → EPIC+ → LEGENDARY+, "TAP TO SET TARGET") + SKIP ◀ < tier ▶ (a stepper, R4)
//
// ROLL vs INDEX are TWO screens, never mixed (Andy oct5): this one is ROLL, AUTO, gems, pity and the result; the
// INDEX (the collection) is one button away and never rolls, prices or replays.
//
// HONEST: the strip is drawn from the live roll table of the roll that was just paid for (reelPlan.drawShowcaseStrip:
// far filler cells show EPIC+ more often as decoration — Andy oct9), the landing cell is the real result, the 3 cells
// either side of it are plain live-odds draws; the odds and pity are the game's (rollTable /
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
import VesselArt from './VesselArt';
import RatesPop from './RatesPop.jsx';
import { ChaseFan, CollectionStrip } from './RollShowcase.jsx';
import SpotlightTutorial from '../../tutorials/SpotlightTutorial.jsx';
import { TUTORIALS, hasSeenTutorial, markTutorialSeen } from '../../tutorials/registry.js';
import { MARK_TIERS } from '../../progress/marks';
import {
  markEntry, viewState, pityLadder, rollTable, ensureRollState, permanentOwnedCount, mainTag, collection, getSkipBelow,
  PITY, ROLL_MARKS, substatsOf,
} from '../../progress/markRolls';
import { buyMarkRoll, buyTicketRoll, nextRollCost, applyRollEquip } from '../../progress/markRollShop';
// 060 GUARANTEED ROLLS: tickets the SERVER mints and owns — only ever drawn from what lb_tickets just returned
import { listTickets, rollTicket, claimTicket, noteLanded } from '../../leaderboard/serverTickets';
import { bestTicket, countOf, ticketLabel, ticketTable } from '../../progress/rollTickets';
import { luck as rollLuck } from '../../progress/markRolls';
import { rollsPerRoll } from '../../progress/markPerks';
// 036 SERVER-CHECKED ROLLS: a named season-2 player's roll is picked by the server (asked at the HOLD start)
import { serverRollOn, prepare as prepareServerRoll, take as takeServerRoll, claim as claimServerRoll, syncPity } from '../../leaderboard/serverRoll';
import { getGems, subscribeGems } from '../../progress/gems';
import { GemIcon, GemCount } from '../gems/Gems';
import { isBoostActive } from '../../progress/boost';
import { sndPurchase, sndWordRejected } from '../../audio/gameSounds';
import { sndRollRelease, sndRollReady } from '../../audio/rollSounds';
import { announceRolls } from '../../leaderboard/live';
import { pushShowcaseNow } from '../../leaderboard/client.js';
import { rollChaseDrop, writeMain } from '../../cast/cast.js';
import { formatNum } from '../../format';
import { lazyWithReload } from '../../lib/chunkReload';
import { holdBeats } from '../../hooks/useBeatSync';
import { CARD_RAR, cardTier } from '../markCard/palette.js';
import { splitTag } from '../markCard/cardModel.js';
import { substatParts } from '../../progress/critText';
import {
  drawShowcaseStrip, revealMode, restOffset, autoShouldStop, needMoreText, nextAutoTarget, AUTO_GAP_MS,
} from './reelPlan.js';
import '../kit/tokens.css';
import './RollScreen.css';
import { useReduceMotion } from '../../lib/useReduceMotion';
import { SEASON2, V3 } from '../../progress/season';

registerMarkGlyphs(ROLLED_GLYPHS, GLYPH_FINISH);

// This screen covers the whole menu: a pointer moving over it must not drive the menu's magnetic cards / wall
// parallax / cursor trail underneath (window listeners — each move restyled the hidden menu every frame).
export const stopMenuPointer = (e) => e.stopPropagation();

const MarksIndex = lazyWithReload(() => import('../MarksIndex'), 'MarksIndex');
// 065: an EPIC+ / LEGENDARY+ ticket opens as a SEALED CAPSULE (its own big reveal), not the reel
const SealedRollReveal = lazyWithReload(() => import('./SealedRollReveal'), 'SealedRollReveal');
// THE CHASE DROP's reveal (oct28): the NEW HERO moment, only fetched when a roll actually drops a CHASE hero
const HeroUnlock = lazyWithReload(() => import('../../cast/HeroUnlock.jsx'), 'HeroUnlock');
const SEALED_TIERS = ['epic', 'legendary'];
const tierName = (t) => (MARK_TIERS[t] ? MARK_TIERS[t].name : String(t || '').toUpperCase());

// REDUCE MOTION: the in-game toggle (PR #207, src/lib/reduceMotion.js) — live, never the OS media query.
const useReducedMotion = useReduceMotion;

/** The result LINE under the reel (mockup): NAME in its tier colour · the stat number · what it touches · ★ pips. */
function ResultLine({ result, view, pop = true }) {
  if (!result) return <div className="rs-result is-empty" aria-hidden="true" />;
  const m = markEntry(result.markId);
  const { num, kind } = splitTag(mainTag(result.markId, view)); // "×1.1 WINS" → ×1.1 · WINS (numbers first)
  const extra = (result.extra || []).filter(Boolean);
  const crit = substatParts(substatsOf(result.markId, view)); // gear card v4: every substat line, under its MAIN
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
      {result.rollOf && result.rollOf[0] < result.rollOf[1] ? <span className="rs-chip is-double" data-testid="mark-roll-double">ROLL {result.rollOf[0]}/{result.rollOf[1]}</span> : null}
      {result.ticket ? <span className="rs-chip is-ticket" data-testid="mark-roll-ticket">{ticketLabel(result.ticket)} TICKET</span> : null}
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
      {crit.length ? (
        <span className="rs-res-crit" data-testid="mark-roll-crit">
          {crit.map((l) => (
            <span key={l.id} className="rs-crit-line">
              <span className="rs-crit-num">{l.num}</span> <span className="rs-crit-kind">{l.kind}</span>
            </span>
          ))}
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
  // 047: the pity countdown is the server's — synced once on open (pitySync re-reads the view when it changed)
  const [pitySync, setPitySync] = useState(0);
  useEffect(() => { let live = true; syncPity().then((changed) => { if (live && changed) setPitySync((n) => n + 1); }); return () => { live = false; }; }, []);
  const view = useMemo(() => viewState(idsRef.current), [landed, pitySync]); // eslint-disable-line react-hooks/exhaustive-deps
  const reduced = useReducedMotion();
  const [gems, setGems] = useState(() => getGems()); // GEMS buy rolls (Andy oct5) — wins never do
  const [spin, setSpin] = useState(null);
  // before the first roll the reel already shows REAL draws from your live odds (no result on it)
  const [idle] = useState(() => {
    try {
      return drawShowcaseStrip(rollTable(viewState(idsRef.current), { permanentOwned: permanentOwnedCount(), boost: isBoostActive() }).probs, Math.random, { resultId: null, marks: ROLL_MARKS });
    } catch { return null; }
  });
  const [shown, setShown] = useState(null);
  const [need, setNeed] = useState(0); // short balance: the gems missing — a number + gem, never a sentence
  const [skipBelow] = useState(() => getSkipBelow()); // ONE auto control (Andy oct11): no SKIP stepper — the stored value (default EPIC) still sets which reveals are short
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
  // DOUBLE ROLLS (Andy oct22 "roll twice should roll twice"): a roll that paid out two gears (SINGULARITY's perk, a
  // double server pick) spins the reel ONCE PER GEAR — the lesser first, the rarest last (it is `pending`, the one that
  // commits: equip, AUTO stop, ticker). `queue` = the parts still to spin; `partProbs` = that roll's live odds (strip).
  const queue = useRef([]);
  const partProbs = useRef(null);
  const auto = useRef({ on: false, until: null, timer: null });
  // a CHASE hero this roll dropped: held until the gear's reveal closes, then its own NEW HERO reveal plays
  const dropRef = useRef(null);
  const [heroDrop, setHeroDrop] = useState(null);
  const live = useRef({});

  useEffect(() => subscribeGems(setGems), []);
  // 060: my tickets, from the server only (never cached — a ticket the server didn't list is never drawn)
  const [tickets, setTickets] = useState([]);
  const [ticketBusy, setTicketBusy] = useState(false);
  const [sealed, setSealed] = useState(null); // 065: the ticket whose vessel is open
  const refreshTickets = () => listTickets().then((l) => { if (live.current.mounted) setTickets(l); });
  useEffect(() => { live.current.mounted = true; refreshTickets(); return () => { live.current.mounted = false; }; }, []); // eslint-disable-line react-hooks/exhaustive-deps
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
    queue.current = []; // a roll that lands (or is flushed) ends its chain
    setShown(res);
    setFresh(true);
    setLanded((n) => n + 1);
    if (auto.current.on && autoShouldStop(res, auto.current.until)) stopAuto();
    askServer(); // the next roll's pick: asked while this reveal plays (AUTO or a tap)
    announceRolls([res, ...(res.extra || [])]); // MYTHIC+ → one ticker line each
    // THE CHASE DROP (oct28): every gear roll can also drop a CHASE hero (cast.js CHASE_ODDS) — kept at once, shown
    // after this reveal; AUTO stops so it is never rolled past
    const drop = rollChaseDrop();
    if (drop) { dropRef.current = drop; stopAuto(); }
    const wornNow = res.decision === 'auto' ? applyRollEquip(res, earned) : null;
    if (wornNow && onEquip) onEquip(wornNow);
  };

  // 036: the server's pick for the next roll — asked when the HOLD starts (and after each AUTO landing) so it is back
  // before the release; luck is the save's own (the server clamps it). Falls back to the local roll when null.
  const srv = useRef({ waiting: false, fallback: false });
  const askServer = () => {
    if (!serverRollOn()) return;
    const st = ensureRollState();
    prepareServerRoll(rollLuck(st, { permanentOwned: permanentOwnedCount(), boost: isBoostActive() }), rollsPerRoll());
  };
  const doRoll = () => {
    if (ctl.current && ctl.current.busy()) { ctl.current.finish(true); return null; }
    if (pending.current) commit(pending.current);
    let picks = null;
    let seq = 0;
    if (serverRollOn() && !srv.current.fallback) {
      const sr = takeServerRoll();
      if (!sr) {
        // not back yet (a tap without a hold, AUTO's first roll): wait for it, then roll — never a local pick instead
        if (!srv.current.waiting) {
          srv.current.waiting = true;
          const st = ensureRollState();
          prepareServerRoll(rollLuck(st, { permanentOwned: permanentOwnedCount(), boost: isBoostActive() }), rollsPerRoll()).then((r) => {
            srv.current.waiting = false;
            if (!r) srv.current.fallback = true; // the server can't roll for us (offline / pre-036): the local roll, once
            live.current.doRoll();
          });
        }
        return null;
      }
      picks = sr.picks;
      seq = sr.seq;
    }
    srv.current.fallback = false;
    // the LIVE table of the roll about to be paid for — the strip is drawn from exactly these odds
    const before = ensureRollState();
    const table = rollTable(before, { permanentOwned: permanentOwnedCount(), boost: isBoostActive() });
    const res = buyMarkRoll({ level, picks });
    if (!res) { short(); stopAuto(); return null; }
    if (seq) claimServerRoll(seq); // the release commits the server's pick (retried later if this fails)
    setNeed(0);
    sndPurchase();
    const parts = [...(res.extra || []).filter(Boolean), res];
    if (parts.length > 1) parts.forEach((x, i) => { x.rollOf = [i + 1, parts.length]; });
    const first = parts[0];
    // the hit that stops AUTO always gets the full reveal
    const mode = revealMode(first, { skipBelow, reduced, autoUntil: auto.current.on ? auto.current.until : null });
    const strip = drawShowcaseStrip(table.probs, Math.random, { resultId: first.markId, marks: ROLL_MARKS });
    const rest = restOffset();
    pending.current = res;
    setShown(null);
    queue.current = parts.slice(1);
    partProbs.current = table.probs;
    setSpin((s) => ({ seq: (s ? s.seq : 0) + 1, result: first, strip, mode, rest }));
    return res;
  };
  live.current.doRoll = doRoll;

  // 060 USE TICKET: the server picks (lb_ticket_roll — the floor is ITS row's tier, the browser sends only the id), the
  // reel lands on it with the full reveal, the landing claims it (lb_ticket_claim). Free: no gems, no pity change.
  const spendTicket = async () => {
    if (ticketBusy) return;
    if (ctl.current && ctl.current.busy()) { ctl.current.finish(); return; }
    const t = bestTicket(tickets);
    if (!t) return;
    stopAuto();
    if (SEALED_TIERS.includes(t.tier)) { if (pending.current) commit(pending.current); setSealed(t); return; }
    setTicketBusy(true);
    const pick = t.pick || (await rollTicket(t));
    if (!live.current.mounted) return;
    if (!pick) { setTicketBusy(false); sndWordRejected(); refreshTickets(); return; }
    if (pending.current) commit(pending.current);
    const res = buyTicketRoll({ pick, floor: t.tier });
    setTicketBusy(false);
    if (!res) { refreshTickets(); return; }
    noteLanded(t.id); // in this save now: a lost claim is retried, never replayed
    setTickets((l) => l.filter((x) => x.id !== t.id));
    claimTicket(t.id).then(() => refreshTickets());
    sndPurchase();
    const strip = drawShowcaseStrip(ticketTable(t.tier), Math.random, { resultId: res.markId, marks: ROLL_MARKS });
    pending.current = res;
    setShown(null);
    setSpin((sp) => ({ seq: (sp ? sp.seq : 0) + 1, result: res, strip, mode: reduced ? 'none' : 'full', rest: restOffset() }));
  };
  const offer = bestTicket(tickets);

  // a DOUBLE ROLL's first part lands: its line shows ("ROLL 1/2"), nothing commits until the last part lands
  const onLand = (res) => {
    if (res && res !== pending.current && res.rollOf) { setShown(res); setFresh(true); return; }
    commit(res);
  };
  const spinNextPart = () => {
    const nxt = queue.current.shift();
    const mode = revealMode(nxt, { skipBelow, reduced, autoUntil: auto.current.on ? auto.current.until : null });
    const strip = drawShowcaseStrip(partProbs.current, Math.random, { resultId: nxt.markId, marks: ROLL_MARKS });
    setShown(null);
    setSpin((s) => ({ seq: (s ? s.seq : 0) + 1, result: nxt, strip, mode, rest: restOffset() }));
  };
  // RE-ARM (R4 step 7, the one thing the prod critique found missing): after a roll is kept, nothing pulled the thumb
  // back — the slab just went quiet. Now the ROLL slab gives ONE bump (transform, 320 ms) + a two-note "ready" blip
  // a beat after the reveal closes, the way Clash's chest slot and Pet Sim's egg re-light. Never under AUTO.
  const rearm = () => {
    const el = btn.current;
    if (!el || reduced || typeof el.animate !== 'function') return;
    el.style.willChange = 'transform';
    const a = el.animate(
      [{ transform: 'rotate(-1deg) scale(1)' }, { transform: 'rotate(-1deg) scale(1.07)', offset: 0.4 }, { transform: 'rotate(-1deg) scale(0.98)', offset: 0.7 }, { transform: 'rotate(-1deg) scale(1)' }],
      { duration: 320, delay: 180, easing: 'cubic-bezier(.2,1.4,.4,1)' },
    );
    const off = () => { el.style.willChange = ''; };
    a.finished.then(off, off);
    setTimeout(sndRollReady, 180);
  };
  const onDone = () => {
    if (pending.current && queue.current.length) { spinNextPart(); return; } // the DOUBLE ROLL's next spin
    if (dropRef.current) { setHeroDrop(dropRef.current); dropRef.current = null; return; } // the CHASE DROP's turn
    if (!auto.current.on) { rearm(); return; }
    auto.current.timer = setTimeout(() => {
      auto.current.timer = null;
      if (auto.current.on) live.current.doRoll();
    }, AUTO_GAP_MS);
  };

  // TAP TO ROLL (Andy oct13 "no need to hold to roll gears"; was HOLD TO ROLL, NIGHT oct8 R4). One tap pays and spins.
  // The server's pick (036) is asked AHEAD — when the screen opens, on the press itself and after every landing — so the
  // tap almost never waits for it. Mid-spin a tap jumps to the result. NO GEMS: the tap shows the shortfall.
  const tap = () => {
    if (ctl.current && ctl.current.busy()) { ctl.current.finish(); return; }
    if (!canAfford) { short(); return; }
    sndRollRelease();
    doRoll();
  };
  const pressStart = () => {
    if (canAfford && !(ctl.current && ctl.current.busy())) askServer();
  };
  useEffect(() => {
    if (canAfford) askServer(); // the first roll's pick is back before the thumb lands
    // once, on open (askServer is single-flight and re-asks after each landing)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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

  // the label says what the hand must do: ROLL (NO GEMS when short; '...' mid-spin)
  const rollLabel = cost.free ? 'ROLL' : rolling ? '...' : canAfford ? 'ROLL' : 'NO GEMS';
  return (
    <div className={`marks-overlay rs-overlay${reduced ? ' is-reduced' : ''}`} role="dialog" aria-modal="true" aria-label="Roll for a mark" ref={setCoverHost} onPointerMove={stopMenuPointer} onMouseMove={stopMenuPointer}>
      <div className="rs-top">
        {/* NIGHT oct8 #4 (RollV3 mockup): ← MENU · INDEX n/N · EQUIPPED <stat> … the GEMS pill */}
        <button type="button" className="rs-close marks-close" onClick={onClose} aria-label="Close" ref={closeRef}>
          <span className="rs-close-arrow" aria-hidden="true">←</span> <span className="rs-close-t">MENU</span>
        </button>
        {/* INDEX (RATES moved to the options cluster beside AUTO — overlap audit oct29: in the top row the EQUIPPED pill
            lay over it at 1024 and at 360 it sat off-canvas past the gems pill, scrolling the screen sideways) */}
        <span className="rs-top-pair">
          <button type="button" className="rs-index-btn" onClick={openIndex} data-testid="roll-index">
            <span className="rs-index-k">INDEX</span> <span className="rs-index-n">{formatNum(col.base)}/{formatNum(col.total)}</span>
          </button>
        </span>
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
        <ChaseFan view={view} />
        <Reel spin={spin} idle={idle} view={view} auto={target != null} coverHost={coverHost} ctl={ctl} played={played} onLand={onLand} onDone={onDone}>
          <div className="rs-result-slot">
            <ResultLine key={spin ? spin.seq : 0} result={shown} view={view} pop={fresh} />
          </div>
        </Reel>
        <CollectionStrip view={view} />
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
            <span className="rs-pity-n">{formatNum(legLeft)}</span>{/* the count IS the read-out (Andy oct22) — no bar beside it */}
          </div>
        </div>
        <div className="rs-rollcol">
          <button
            type="button"
            ref={btn}
            className={`rs-roll rs-hold${canAfford ? '' : ' is-short'}${cost.free ? ' is-free' : ''}${rolling ? ' is-rolling' : ''}`}
            onPointerDown={(e) => { if (e.button === 0) pressStart(); }}
            onClick={tap}
            onContextMenu={(e) => e.preventDefault()}
            aria-label={cost.free ? 'ROLL · FREE ROLL' : `ROLL · ${formatNum(cost.gems)} GEMS`}
          >
            <span className="rs-roll-lbl">{rollLabel}</span>
            {/* a free roll keeps ROLL — FREE sits in the price pill */}
            {cost.free ? <span className="rs-roll-price is-free">FREE ROLL</span> : (
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
            {/* AUTO in the house style (Andy oct9 "auto roll … so boring and tiny"): the word, then its state on a plate —
                OFF / → TIER+ in the tier colour / the R1 gate in gold. No caption line under it (no explaining sentences). */}
            <span className="rs-auto-k">AUTO</span>
            <span className={`rs-auto-v${!autoOpen ? ' is-gate' : target ? '' : ' is-off'}`}>
              {!autoOpen ? ` · R${(V3.unlocks && V3.unlocks.unlockAt('autoRoll')) || 1}` : target ? ` → ${tierName(target)}+` : ': OFF'}
            </span>
          </button>
          {offer ? (
            <button
              type="button"
              className={`rs-ticket-btn is-${offer.tier}`}
              onClick={spendTicket}
              disabled={ticketBusy || rolling}
              data-testid="roll-ticket"
              data-tier={offer.tier}
              aria-label={`Use a ${ticketLabel(offer.tier)} ticket — a guaranteed ${tierName(offer.tier)} or better`}
            >
              {SEALED_TIERS.includes(offer.tier) ? <VesselArt tier={offer.tier} size={null} label={false} className="rs-ticket-vessel" /> : null}
              <span className="rs-ticket-k">OPEN</span>{' '}
              <span className="rs-ticket-v">{ticketLabel(offer.tier)}</span>{' '}
              <span className="rs-ticket-w">{SEALED_TIERS.includes(offer.tier) ? 'ROLL' : 'TICKET'}</span>{' '}
              {countOf(tickets, offer.tier) > 1 ? <span className="rs-ticket-n">×{formatNum(countOf(tickets, offer.tier))}</span> : null}
            </button>
          ) : null}
          {/* RATES: the odds of YOUR next roll, behind a button in the options cluster (gear card v4) */}
          <RatesPop />
        </div>
      </div>

      {sealed ? (
        <Suspense fallback={null}>
          <SealedRollReveal
            ticket={sealed}
            onDone={() => { setSealed(null); setTickets((l) => l.filter((x) => x.id !== sealed.id)); refreshTickets(); setLanded((n) => n + 1); }}
          />
        </Suspense>
      ) : null}
      {heroDrop ? (
        <Suspense fallback={null}>
          <HeroUnlock ids={[heroDrop]} onEquip={(id) => { writeMain(id); pushShowcaseNow(); }} onClose={() => { setHeroDrop(null); rearm(); }} />
        </Suspense>
      ) : null}
      {tut && tutDef && (
        <SpotlightTutorial tutorial={tutDef} onDone={() => { markTutorialSeen('markRolls'); setTut(false); }} />
      )}
    </div>
  );
}
