// RollPanel.jsx — MARK ROLLS (Andy M + H3): the ROLL button with its price, the pity counters and LUCK, the
// rarity-scaled reveal, and the result card. Lives inside the MARKS panel (MarksIndex.jsx), lazy with it.
//
// HOLD TO ROLL: a tap rolls once; holding keeps rolling, but only after each reveal has FINISHED (+ a 120 ms
// beat) — never on a fixed clock — and it stops on anything worth looking at (EPIC+, a NEW mark, a GOLD /
// RAINBOW step-up) or a balance that can't pay. revealPlan.js owns those rules. A tap during a reveal SKIPS
// to the result (the input always answers at once; it never queues a roll).
//
// NOTHING MOVES UNDER THE FINGER: the stage has a FIXED height and nothing above the button changes size, so
// the ROLL button never shifts under the cursor (a shift fires onPointerLeave and kills the hold).
// NO SPOILERS: the index, % COLLECTED, pity and an auto-equipped MAIN update when the reveal LANDS.
import { useEffect, useRef, useState } from 'react';
import MarkBadge from '../MarkBadge';
import RollReveal from './RollReveal';
import { createPacer, revealMs, isHeavy, holdStopReason, needMoreText } from './revealPlan.js';
import { MARK_TIERS } from '../../progress/marks';
import { markEntry, mainTag, perkTag, luck, pityLeft, isBonusRoll, permanentOwnedCount, BONUS_ROLL_MULT } from '../../progress/markRolls';
import { buyMarkRoll, nextRollCost, applyRollEquip } from '../../progress/markRollShop';
import { getWins, subscribeBalance } from '../../progress/wins';
import { isBoostActive } from '../../progress/boost';
import { sndPurchase, sndLucky, sndAchievement, sndWordRejected } from '../../audio/gameSounds';
import { formatNum } from '../../format';

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const tierName = (t) => (MARK_TIERS[t] ? MARK_TIERS[t].name : String(t).toUpperCase());
/** LUCK is always written one way: a multiplier, ×1.05 (never "+0.05"). */
export const luckText = (v) => `LUCK ×${+Number(v).toFixed(2)}`;

function ResultCard({ result, worn }) {
  if (!result) return null;
  const m = markEntry(result.markId);
  const isWorn = worn === result.markId;
  const finish = result.rainbow > 0 ? 'rainbow' : result.gold > 0 ? 'gold' : 'base';
  return (
    <div className={`mr-card is-${result.tier}`} data-testid="mark-roll-result">
      <MarkBadge mark={m} size={64} finish={finish} className="mr-card-art" />
      <div className="mr-card-body">
        <div className="mr-card-name">{m ? m.name : ''}</div>
        <div className="mr-card-tier">{tierName(result.tier)} · 1 IN {formatNum(result.oneInX)}</div>
        <div className="mr-card-line">
          {/* rule U: ONE tag — MAIN when worn, PERK otherwise */}
          <span className="mr-card-tag">{isWorn ? mainTag(result.markId) : perkTag(result.state, result.markId)}</span>
          {result.newMark && <span className="mr-chip is-new">NEW</span>}
          {result.rainbowUp ? <span className="mr-chip is-rainbow">RAINBOW</span> : result.goldUp ? <span className="mr-chip is-gold">GOLD</span> : null}
          {!result.newMark && !result.goldUp && !result.rainbowUp && <span className="mr-chip">×{formatNum(result.copies)}</span>}
        </div>
      </div>
    </div>
  );
}

export default function RollPanel({ level = 1, view, worn, earned = [], reduced = false, coverHost = null, onRolled }) {
  const [result, setResult] = useState(null);
  const [seq, setSeq] = useState(0);
  const [skipSeq, setSkipSeq] = useState(0);
  const [wins, setWins] = useState(() => getWins());
  const [msg, setMsg] = useState('');
  const pacer = useRef(null);
  if (!pacer.current) pacer.current = createPacer();
  const btn = useRef(null);
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

  // SHORT BALANCE: say how much more, and buzz — never a silent grey button
  const short = () => {
    const c = nextRollCost(level);
    setMsg(needMoreText(c.wins, getWins(), formatNum));
    sndWordRejected();
    const el = btn.current;
    if (el && typeof el.animate === 'function' && !reduced) {
      el.style.willChange = 'transform';
      const a = el.animate(
        [{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(5px)' }, { transform: 'translateX(-3px)' }, { transform: 'translateX(0)' }],
        { duration: 240, easing: 'linear' },
      );
      a.finished.then(() => { el.style.willChange = ''; }, () => { el.style.willChange = ''; });
    }
  };

  const doRoll = () => {
    const t = now();
    if (!pacer.current.canRoll(t)) return null;
    if (pending.current) latest.current.commit(); // land the last result before the next one starts
    const res = buyMarkRoll({ level });
    if (!res) { short(); return null; }
    setMsg('');
    sndPurchase();
    lastResult.current = res;
    pacer.current.start(t, res.tier);
    setResult(res);
    setSeq((n) => n + 1);
    pending.current = res;
    if (commitTimer.current) clearTimeout(commitTimer.current);
    commitTimer.current = setTimeout(() => latest.current.commit(), revealMs(res.tier));
    scheduleHold();
    return res;
  };
  // the reveal LANDED (or was skipped): now the index, pity and the MAIN may change
  const commit = () => {
    if (commitTimer.current) clearTimeout(commitTimer.current);
    commitTimer.current = null;
    const res = pending.current;
    if (!res) return;
    pending.current = null;
    if (res.tier !== 'common') (isHeavy(res.tier) ? sndAchievement : sndLucky)(); // the payoff lands with the result
    const wornNow = res.decision === 'auto' ? applyRollEquip(res, earned) : null;
    onRolled && onRolled(res, wornNow);
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
      else {
        // a hold that ran out of wins stops WITH the message (not just a quiet stop)
        if (held.current && holdStopReason(lastResult.current, { canAfford: ok }) === 'broke') short();
        held.current = false;
      }
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

  const stopHold = () => { held.current = false; };
  const label = cost.free ? 'FREE ROLL' : `ROLL · ${formatNum(cost.wins)} WINS`;

  return (
    <section className="mr-panel" aria-label="Roll for a mark">
      <RollReveal
        seq={seq}
        skipSeq={skipSeq}
        result={result}
        reduced={reduced}
        coverHost={coverHost}
        card={<ResultCard result={result} worn={worn} />}
      />
      <button
        type="button"
        ref={btn}
        className={`mr-roll${canAfford ? '' : ' is-short'}${cost.free ? ' is-free' : ''}`}
        aria-label={`${label}. Hold to keep rolling`}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          pointerRolled.current = true;
          held.current = true;
          press();
        }}
        onPointerUp={stopHold}
        onPointerLeave={stopHold}
        onPointerCancel={stopHold}
        onClick={() => {
          if (pointerRolled.current) { pointerRolled.current = false; return; } // the pointer path already rolled
          held.current = false;
          press();
        }}
      >
        <span className="mr-roll-main">{label}</span>
        <span className="mr-roll-hint" aria-hidden="true">HOLD</span>
      </button>
      <div className="mr-msg" role="status" aria-live="polite">{msg}</div>
      <div className="mr-meta">
        <span className="mr-pity">EPIC IN ≤{pity.epic} · LEGENDARY IN ≤{pity.legendary}</span>
        <span className="mr-luck">{luckText(L)}</span>
        {bonus && <span className="mr-bonus">×{BONUS_ROLL_MULT} LUCK READY</span>}
      </div>
    </section>
  );
}
