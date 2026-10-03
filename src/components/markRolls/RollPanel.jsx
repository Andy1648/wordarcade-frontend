// RollPanel.jsx — MARK ROLLS (Andy M + H3): the ROLL button with its price, the pity counters and LUCK, the
// rarity-scaled reveal, and the result card. Lives inside the MARKS panel (MarksIndex.jsx).
//
// HOLD TO ROLL: a tap rolls once; holding keeps rolling, but only after each reveal has FINISHED (+ a 120 ms
// beat) — never on a fixed clock — and it stops on anything worth looking at (EPIC+, a NEW mark, a GOLD /
// RAINBOW step-up, an EQUIP? question, or a balance that can't pay). revealPlan.js owns those rules.
// A tap during a reveal SKIPS to the result (the input always answers at once; it never queues a roll).
import { useEffect, useRef, useState } from 'react';
import MarkBadge from '../MarkBadge';
import RollReveal, { reelNames } from './RollReveal';
import { createPacer, revealMs, isHeavy } from './revealPlan.js';
import { MARK_TIERS } from '../../progress/marks';
import { markEntry, mainTag, perkTag, luck, pityLeft, isBonusRoll, permanentOwnedCount, BONUS_ROLL_MULT } from '../../progress/markRolls';
import { buyMarkRoll, nextRollCost, wearMark } from '../../progress/markRollShop';
import { getWins, subscribeBalance } from '../../progress/wins';
import { isBoostActive } from '../../progress/boost';
import { sndPurchase, sndLucky, sndAchievement } from '../../audio/gameSounds';
import { formatNum, formatMultExact as formatMult } from '../../format';

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const tierName = (t) => (MARK_TIERS[t] ? MARK_TIERS[t].name : String(t).toUpperCase());
const luckText = (v) => `×${+v.toFixed(2)}`;

function ResultCard({ result, worn, onAnswer }) {
  if (!result) return null;
  const m = markEntry(result.markId);
  const isWorn = worn === result.markId;
  const finish = result.rainbow > 0 ? 'rainbow' : result.gold > 0 ? 'gold' : 'base';
  return (
    <div className={`mr-card is-${result.tier}`} data-testid="mark-roll-result">
      <MarkBadge mark={m} size={72} finish={finish} className="mr-card-art" />
      <div className="mr-card-body">
        <div className="mr-card-name">{m ? m.name : ''}</div>
        <div className="mr-card-tier">{tierName(result.tier)} · 1 IN {formatNum(result.oneInX)}</div>
        {/* rule U: ONE tag — MAIN when worn, PERK otherwise */}
        <div className="mr-card-tag">{isWorn ? mainTag(result.markId) : perkTag(result.state, result.markId)}</div>
        <div className="mr-card-chips">
          {result.newMark && <span className="mr-chip is-new">NEW</span>}
          {result.rainbowUp ? <span className="mr-chip is-rainbow">RAINBOW</span> : result.goldUp ? <span className="mr-chip is-gold">GOLD</span> : null}
          {!result.newMark && !result.goldUp && !result.rainbowUp && <span className="mr-chip">×{formatNum(result.copies)}</span>}
        </div>
        {result.decision === 'ask' && !result.answered && (
          <div className="mr-ask" role="group" aria-label="Equip this mark?">
            <span className="mr-ask-q">EQUIP? ×{formatMult(result.fromMain)} → ×{formatMult(result.toMain)}</span>
            <button type="button" className="mr-ask-yes" onClick={() => onAnswer(true)}>EQUIP</button>
            <button type="button" className="mr-ask-no" onClick={() => onAnswer(false)}>KEEP</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function RollPanel({ level = 1, view, worn, earned = [], version = 'a', reduced = false, coverHost = null, onRolled, onEquip }) {
  const [result, setResult] = useState(null);
  const [seq, setSeq] = useState(0);
  const [skipSeq, setSkipSeq] = useState(0);
  const [reel, setReel] = useState(() => reelNames(null));
  const [wins, setWins] = useState(() => getWins());
  const pacer = useRef(null);
  if (!pacer.current) pacer.current = createPacer();
  const held = useRef(false);
  const pointerRolled = useRef(false);
  const timer = useRef(null);
  const lastResult = useRef(null);
  const latest = useRef({});
  const pending = useRef(null);
  const commitTimer = useRef(null);

  useEffect(() => subscribeBalance(setWins), []);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
    // closing MARKS mid-reveal still lands the result (the roll is already paid + saved)
    if (latest.current.commit) latest.current.commit();
  }, []);

  const cost = nextRollCost(level, view);
  const canAfford = cost.free || wins >= cost.wins;
  const pity = pityLeft(view);
  const bonus = isBonusRoll(view);
  const L = luck(view, { permanentOwned: permanentOwnedCount(), boost: isBoostActive() });

  const doRoll = () => {
    const t = now();
    if (!pacer.current.canRoll(t)) return null;
    if (pending.current) latest.current.commit(); // land the last result before the next one starts
    const res = buyMarkRoll({ level, earned });
    if (!res) return null;
    sndPurchase();
    lastResult.current = res;
    pacer.current.start(t, res.tier, version);
    setReel(reelNames(res));
    setResult(res);
    setSeq((n) => n + 1);
    // NO SPOILERS: the index, % COLLECTED and an auto-equipped MAIN update when the reveal LANDS (or is
    // skipped), not on the tap — otherwise the grid behind a rare's build-up would give the result away
    pending.current = res;
    if (commitTimer.current) clearTimeout(commitTimer.current);
    commitTimer.current = setTimeout(() => latest.current.commit(), revealMs(res.tier, version));
    scheduleHold();
    return res;
  };
  const commit = () => {
    if (commitTimer.current) clearTimeout(commitTimer.current);
    commitTimer.current = null;
    const res = pending.current;
    if (!res) return;
    pending.current = null;
    if (res.tier !== 'common') (isHeavy(res.tier) ? sndAchievement : sndLucky)(); // the payoff lands with the result
    onRolled && onRolled(res);
    if (res.decision === 'auto' && onEquip) onEquip(res.markId);
  };
  latest.current.doRoll = doRoll;
  latest.current.commit = commit;

  // the held button asks the pacer once the reveal has finished — one timer per roll, never a loop
  function scheduleHold() {
    if (timer.current) clearTimeout(timer.current);
    const wait = Math.max(0, pacer.current.nextHeldAt() - now());
    timer.current = setTimeout(() => {
      timer.current = null;
      const c = nextRollCost(level);
      const ok = c.free || getWins() >= c.wins;
      const step = pacer.current.holdStep(now(), held.current, lastResult.current, { canAfford: ok });
      if (step === 'roll') latest.current.doRoll();
      else if (step === 'wait') scheduleHold();
      else held.current = false;
    }, wait);
  }

  const press = () => {
    const t = now();
    if (pacer.current.busy(t)) {
      // mid-reveal: SKIP to the result (never a second roll on top of a reveal)
      pacer.current.finishNow(t);
      setSkipSeq((n) => n + 1);
      commit();
      if (held.current) scheduleHold();
      return;
    }
    doRoll();
  };

  const answer = (yes) => {
    if (!result) return;
    if (yes) {
      wearMark(result.markId, earned);
      onEquip && onEquip(result.markId);
    }
    setResult({ ...result, answered: true });
  };

  const stopHold = () => { held.current = false; };
  const label = cost.free ? 'FREE ROLL' : `ROLL · ${cost.words} WORDS ≈ ${formatNum(cost.wins)} WINS`;

  return (
    <section className="mr-panel" aria-label="Roll for a mark">
      <RollReveal
        seq={seq}
        skipSeq={skipSeq}
        result={result}
        reel={reel}
        version={version}
        reduced={reduced}
        coverHost={coverHost}
        card={<ResultCard result={result} worn={worn} onAnswer={answer} />}
      />
      <button
        type="button"
        className={`mr-roll${canAfford ? '' : ' is-short'}${cost.free ? ' is-free' : ''}`}
        aria-disabled={!canAfford}
        aria-label={`${label}. Hold to keep rolling`}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          pointerRolled.current = true;
          held.current = true;
          if (canAfford) press();
        }}
        onPointerUp={stopHold}
        onPointerLeave={stopHold}
        onPointerCancel={stopHold}
        onClick={() => {
          if (pointerRolled.current) { pointerRolled.current = false; return; } // the pointer path already rolled
          held.current = false;
          if (canAfford) press();
        }}
      >
        <span className="mr-roll-main">
          <span className="mr-roll-word">{cost.free ? 'FREE ROLL' : 'ROLL'}</span>
          {!cost.free && <span className="mr-roll-price"> · {cost.words} WORDS ≈ {formatNum(cost.wins)} WINS</span>}
        </span>
        <span className="mr-roll-hint" aria-hidden="true">HOLD</span>
      </button>
      <div className="mr-meta">
        <span className="mr-pity">EPIC IN ≤{pity.epic} · LEGENDARY IN ≤{pity.legendary}</span>
        <span className="mr-luck">LUCK {luckText(L)}</span>
        {bonus && <span className="mr-bonus">×{BONUS_ROLL_MULT} LUCK READY</span>}
      </div>
    </section>
  );
}
