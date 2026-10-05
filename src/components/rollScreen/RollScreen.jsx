// RollScreen.jsx — THE ROLL SCREEN (Andy oct5): "own full screen from the MARKS button; one big ROLL button,
// nothing crowding". The MARKS button opens this; its INDEX button opens the MARKS INDEX (MarksIndex.jsx) as a
// layer of the same overlay slot.
//
//   top      INDEX · the pity ladder (EPIC+ IN N · LEGENDARY+ IN N — always visible) · close
//   middle   THE ONE BIG THING: the reel (Reel.jsx — real-odds strip, decelerates onto the result) + the result card
//   bottom   ROLL (price) · AUTO ROLL "until [tier] or better" · "skip reveals below [tier]"
//
// HONEST: the strip is drawn from the live roll table of the roll that was just paid for (reelPlan.drawStrip), the
// landing cell is the real result, nothing is inserted next to it. NO SPOILERS: the card, the pity ladder, the
// INDEX and an auto-equipped MAIN update when the reel LANDS, never before. TAP ANYWHERE mid-reveal jumps to the
// result. Closing mid-reveal still lands it (the roll is already paid and saved). A DOUBLE ROLL's extra shows on the
// card ("+NAME"), and a first-time mark anywhere in the roll gets the full reveal.
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import MarkBadge, { registerMarkGlyphs } from '../MarkBadge';
import { ROLLED_GLYPHS } from '../markGlyphsRolled.jsx';
import Reel from './Reel';
import ShinyBadge from './ShinyBadge';
import MarkPips from '../rarity/MarkPips';
import RarityFx from '../rarity/RarityFx';
import UnlockTutorial from '../../tutorials/UnlockTutorial.jsx';
import { TUTORIALS, hasSeenTutorial, markTutorialSeen } from '../../tutorials/registry.js';
import { MARK_TIERS } from '../../progress/marks';
import {
  markEntry, viewState, pityLadder, rollTable, ensureRollState, permanentOwnedCount, statLine, getSkipBelow, setSkipBelow,
  SKIP_TIERS, MAX_PIPS,
} from '../../progress/markRolls';
import { buyMarkRoll, nextRollCost, applyRollEquip, AUTO_ROLL_TIERS } from '../../progress/markRollShop';
import { getWins, subscribeBalance } from '../../progress/wins';
import { isBoostActive } from '../../progress/boost';
import { sndPurchase, sndWordRejected } from '../../audio/gameSounds';
import { announceRolls } from '../../leaderboard/live';
import { formatNum } from '../../format';
import { rarityClass } from '../../lib/rarityStyle.js';
import { lazyWithReload } from '../../lib/chunkReload';
import { drawStrip, revealMode, restOffset, autoShouldStop, needMoreText, pipLine, AUTO_GAP_MS } from './reelPlan.js';
import '../rarity/RarityFin.css';
import './RollScreen.css';

registerMarkGlyphs(ROLLED_GLYPHS);

const MarksIndex = lazyWithReload(() => import('../MarksIndex'), 'MarksIndex');
const AUTO_KEY = 'taw.rollAutoUntil'; // per-viewer convenience: the last "until" tier picked
const tierName = (t) => (MARK_TIERS[t] ? MARK_TIERS[t].name : String(t || '').toUpperCase());
const readAuto = () => {
  try {
    const v = localStorage.getItem(AUTO_KEY);
    return AUTO_ROLL_TIERS.includes(v) ? v : 'epic';
  } catch { return 'epic'; }
};

function useReducedMotion() {
  const [r, setR] = useState(() => {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
  });
  useEffect(() => {
    let mq;
    try { mq = window.matchMedia('(prefers-reduced-motion: reduce)'); } catch { return undefined; }
    const on = () => setR(mq.matches);
    if (mq.addEventListener) mq.addEventListener('change', on); else mq.addListener(on);
    return () => (mq.removeEventListener ? mq.removeEventListener('change', on) : mq.removeListener(on));
  }, []);
  return r;
}

/** The result card — in the rarity system: tier fill, ★ pips, the stat. */
function ResultCard({ result, seq }) {
  if (!result) return <div className="rs-card is-empty" aria-hidden="true" />;
  const m = markEntry(result.markId);
  const stat = statLine(result.markId, result.state);
  const pl = pipLine(result.have, result.need, result.pips, formatNum);
  const extra = (result.extra || []).filter(Boolean);
  return (
    <div className={`rs-card ${rarityClass(result.tier, { tint: true })}`} data-testid="mark-roll-result" data-tier={result.tier} data-shiny={result.shiny ? '1' : undefined}>
      <span className="rs-card-artwrap">
        <MarkBadge mark={m} size={84} className="rs-card-art" />
        {result.shiny ? <ShinyBadge /> : null}
      </span>
      <div className="rs-card-body">
        <div className="rs-card-name">
          <span className="rs-card-nm">{m ? m.name : ''}</span>
          {result.newMark ? <span className="rs-chip is-new">NEW</span> : null}
        </div>
        <div className={`rs-card-tier rarity-ink is-${result.tier}`}>
          <span>{tierName(result.tier)}</span> <span>· 1 IN {formatNum(result.oneInX)}</span>
        </div>
        {stat ? <div className="rs-card-stat">{stat}</div> : null}
        <div className="rs-card-pips">
          <MarkPips pips={result.pips} max={MAX_PIPS} />
          {pl ? <span className="rs-card-pipline">{pl}</span> : null}
        </div>
        {extra.length ? (
          <div className="rs-card-extra" data-testid="mark-roll-extra">
            {extra.map((x, i) => {
              const xm = markEntry(x.markId);
              return (
                <span key={i} className={`rs-chip is-extra rarity-fin is-${x.tier}`} data-tier={x.tier}>
                  +{xm ? xm.name : ''}{x.newMark ? ' · NEW' : ''}
                </span>
              );
            })}
          </div>
        ) : null}
      </div>
      <RarityFx key={seq} tier={result.tier} />
    </div>
  );
}

export default function RollScreen({ unlockedIds = [], equippedId = null, achievementNames = {}, level = 1, earned = [], onEquip, onClose }) {
  const [landed, setLanded] = useState(0);
  const idsRef = useRef(unlockedIds);
  idsRef.current = unlockedIds;
  // NO SPOILERS: storage is re-read ONLY when a reel lands
  const view = useMemo(() => viewState(idsRef.current), [landed]); // eslint-disable-line react-hooks/exhaustive-deps
  const reduced = useReducedMotion();
  const [wins, setWins] = useState(() => getWins());
  const [spin, setSpin] = useState(null);
  // before the first roll the reel already shows REAL draws from your live odds (no result on it)
  const [idle] = useState(() => {
    try {
      return drawStrip(rollTable(viewState(idsRef.current), { permanentOwned: permanentOwnedCount(), boost: isBoostActive() }).probs, Math.random, { resultId: null });
    } catch { return null; }
  });
  const [shown, setShown] = useState(null);
  const [msg, setMsg] = useState('');
  const [skipBelow, setSkip] = useState(() => getSkipBelow());
  const [until, setUntil] = useState(readAuto);
  const [autoOn, setAutoOn] = useState(false);
  const [showIndex, setShowIndex] = useState(false);
  const [coverHost, setCoverHost] = useState(null);
  const [tut, setTut] = useState(() => !hasSeenTutorial('markRolls'));
  const ctl = useRef(null);
  const played = useRef(0); // the last spin seq the reel played (a remount after the INDEX never replays it)
  const btn = useRef(null);
  const closeRef = useRef(null);
  const pending = useRef(null); // the paid roll whose reel has not landed yet
  const lastRes = useRef(null); // the roll on the reel now (AUTO ROLL reads it when the reveal ends)
  const auto = useRef({ on: false, until: 'epic', timer: null });
  auto.current.until = until;
  const live = useRef({});

  useEffect(() => subscribeBalance(setWins), []);

  const cost = nextRollCost(level, view);
  const canAfford = cost.free || wins >= cost.wins;
  const ladder = pityLadder(view);
  const tutDef = TUTORIALS.find((t) => t.id === 'markRolls');

  const stopAuto = () => {
    auto.current.on = false;
    if (auto.current.timer) clearTimeout(auto.current.timer);
    auto.current.timer = null;
    setAutoOn(false);
  };
  const short = () => {
    const c = nextRollCost(level);
    setMsg(needMoreText(c.wins, getWins(), formatNum));
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

  // the reel LANDED (or was skipped): now the card, pity, INDEX and the MAIN may change
  const commit = (res) => {
    const p = pending.current;
    if (!p || p !== res) return;
    pending.current = null;
    setShown(res);
    setLanded((n) => n + 1);
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
    setMsg('');
    sndPurchase();
    // the hit that stops AUTO ROLL always gets the full reveal
    const mode = revealMode(res, { skipBelow, reduced, autoUntil: auto.current.on ? auto.current.until : null });
    const strip = drawStrip(table.probs, Math.random, { resultId: res.markId });
    const rest = restOffset();
    pending.current = res;
    lastRes.current = res;
    setShown(null);
    setSpin((s) => ({ seq: (s ? s.seq : 0) + 1, result: res, strip, mode, rest }));
    return res;
  };
  live.current.doRoll = doRoll;

  const onLand = (res) => commit(res);
  const onDone = () => {
    const last = lastRes.current;
    if (!auto.current.on) return;
    if (!last || autoShouldStop(last, auto.current.until)) { stopAuto(); return; }
    auto.current.timer = setTimeout(() => {
      auto.current.timer = null;
      if (auto.current.on) live.current.doRoll();
    }, AUTO_GAP_MS);
  };

  const pressRoll = () => {
    if (ctl.current && ctl.current.busy()) { ctl.current.finish(); return; }
    doRoll();
  };
  const pressAuto = () => {
    if (auto.current.on) {
      stopAuto();
      return;
    }
    if (ctl.current && ctl.current.busy()) ctl.current.finish(true);
    auto.current.on = true;
    setAutoOn(true);
    if (!doRoll()) stopAuto();
  };
  const pickUntil = (t) => {
    setUntil(t);
    try { localStorage.setItem(AUTO_KEY, t); } catch { /* blocked */ }
  };
  const pickSkip = (t) => setSkip(setSkipBelow(t));
  // leaving for the INDEX: a running reveal lands at once (no effects) so nothing is left half-played
  const openIndex = () => {
    stopAuto();
    if (ctl.current && ctl.current.busy()) ctl.current.finish(true);
    setShowIndex(true);
  };

  // TAP ANYWHERE mid-reveal jumps to the result (capture: the tap never also presses what is under it). The AUTO
  // ROLL button is let through so a running auto roll can always be stopped in one tap.
  useEffect(() => {
    const host = coverHost;
    if (!host || typeof host.addEventListener !== 'function') return undefined;
    let swallowUntil = 0;
    const t = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const down = (e) => {
      if (!ctl.current || !ctl.current.busy()) return;
      if (e.target && e.target.closest && e.target.closest('.rs-auto-btn')) return;
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

  useEffect(() => {
    if (!showIndex) closeRef.current?.focus();
    const onKey = (ev) => { if (ev.key === 'Escape' && !showIndex) onClose && onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, showIndex]);
  // closing mid-reveal still lands the roll (equip + ticker), and an auto roll stops
  useEffect(() => () => {
    if (auto.current.timer) clearTimeout(auto.current.timer);
    auto.current.on = false;
    if (pending.current) live.current.commit && live.current.commit(pending.current);
  }, []);
  live.current.commit = commit;

  const label = cost.free ? 'FREE ROLL' : `ROLL · ${formatNum(cost.wins)} WINS`;

  if (showIndex) {
    return (
      <Suspense fallback={null}>
        <MarksIndex
          unlockedIds={unlockedIds}
          equippedId={equippedId}
          achievementNames={achievementNames}
          level={level}
          earned={earned}
          onEquip={onEquip}
          onClose={() => { setShowIndex(false); setLanded((n) => n + 1); }}
        />
      </Suspense>
    );
  }

  return (
    <div className="marks-overlay rs-overlay" role="dialog" aria-modal="true" aria-label="Roll for a mark" ref={setCoverHost}>
      <div className="rs-top">
        <button type="button" className="rs-index-btn" onClick={openIndex} data-testid="roll-index">INDEX</button>
        <div className="rs-pity" data-testid="roll-pity" aria-label="Pity">
          {ladder.map((p) => (
            <span key={p.tier} className={`rs-pity-step rarity-fin is-${p.tier}`} data-tier={p.tier}>
              {tierName(p.tier)}+ IN {formatNum(p.left)}
            </span>
          ))}
        </div>
        <button type="button" className="rs-close marks-close" onClick={onClose} aria-label="Close" ref={closeRef}>✕</button>
      </div>

      <div className="rs-stage" data-tier={spin ? spin.result.tier : undefined} data-mode={spin ? spin.mode : undefined}>
        <Reel spin={spin} idle={idle} coverHost={coverHost} ctl={ctl} played={played} onLand={onLand} onDone={onDone}>
          <div className="rs-card-slot">
            <ResultCard result={shown} seq={spin ? spin.seq : 0} />
          </div>
        </Reel>
      </div>

      <div className="rs-controls">
        <button
          type="button"
          ref={btn}
          className={`rs-roll${canAfford ? '' : ' is-short'}${cost.free ? ' is-free' : ''}`}
          onClick={pressRoll}
        >
          {label}
        </button>
        <div className="rs-msg" role="status" aria-live="polite">{msg}</div>
        <div className="rs-opts">
          <div className="rs-auto">
            <button type="button" className={`rs-auto-btn${autoOn ? ' is-on' : ''}`} aria-pressed={autoOn} onClick={pressAuto} data-testid="roll-auto">
              AUTO ROLL
            </button>
            <label className="rs-pick">
              <span>UNTIL</span>
              <select className={`rs-select rarity-fin is-${until}`} value={until} onChange={(e) => pickUntil(e.target.value)} data-testid="roll-until">
                {AUTO_ROLL_TIERS.map((t) => <option key={t} value={t}>{tierName(t)}</option>)}
              </select>
              <span>OR BETTER</span>
            </label>
          </div>
          <label className="rs-pick rs-skip">
            <span>SKIP REVEALS BELOW</span>
            <select className={`rs-select rarity-fin is-${skipBelow}`} value={skipBelow} onChange={(e) => pickSkip(e.target.value)} data-testid="roll-skip">
              {SKIP_TIERS.map((t) => <option key={t} value={t}>{tierName(t)}</option>)}
            </select>
          </label>
        </div>
      </div>

      {tut && tutDef && (
        <UnlockTutorial tutorial={tutDef} onDone={() => { markTutorialSeen('markRolls'); setTut(false); }} />
      )}
    </div>
  );
}
