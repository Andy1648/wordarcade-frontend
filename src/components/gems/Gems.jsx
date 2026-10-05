// Gems.jsx — GEMS on screen (Andy oct5): the icon + count (formatNum), the end-of-game "+N GEMS" line (always its
// own line, never hidden), and the GEM POP on a word that dropped gems.
//
// ART VS MOTION: the gem is a real asset (/art/gems/gem.svg); CSS/WAAPI only moves it.
// ANIMATION BUDGET: GemPop is ONE pooled node per mounted screen, replayed with a finite WAAPI one-shot
// (transform + opacity only); will-change is set for the life of the animation and cleared on finish. No layout
// reads anywhere (the pop sits at a fixed spot inside an already-positioned slot). Nothing loops.
import { useEffect, useRef, useState } from 'react';
import { formatNum } from '../../format';
import { getGems, subscribeGems, subscribeGemLedger, gemsLedgerMark, gemsLedgerSince, sumGems } from '../../progress/gems';
import './Gems.css';

export const GEM_SRC = '/art/gems/gem.svg';

/** The gem asset, decorative. */
export function GemIcon({ size = 18, className = '' }) {
  return (
    <img className={`gem-icon ${className}`.trim()} src={GEM_SRC} width={size} height={size} alt="" aria-hidden="true" draggable="false" />
  );
}

/** The live gems balance (every grant / spend tells it). */
export function useGems() {
  const [gems, setGems] = useState(() => getGems());
  useEffect(() => subscribeGems(setGems), []);
  return gems;
}

/** Icon + count. `testid` for the gates. */
export function GemCount({ value, size = 18, className = '', label = true }) {
  const v = Number.isFinite(value) ? value : 0;
  return (
    <span className={`gem-count ${className}`.trim()} data-gems={v} aria-label={label ? `${formatNum(v)} gems` : undefined}>
      <GemIcon size={size} />
      <span className="gem-count-num" aria-hidden={label ? 'true' : undefined}>{formatNum(v)}</span>
    </span>
  );
}

/**
 * The ledger mark for THIS round: taken on mount and again whenever `resetKey` changes (a new game / a new run).
 * Everything granted after it is "gems earned this round".
 */
export function useGemsRound(resetKey) {
  const [since, setSince] = useState(() => gemsLedgerMark());
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setSince(gemsLedgerMark());
  }, [resetKey]);
  return since;
}

/** The ledger mark for a RUN that starts whenever `playing` turns true (a solo run, a race): taken on mount and on
 *  every false → true flip — never when the run ends, so the end card still counts the whole run. */
export function useGemsRunMark(playing) {
  const [since, setSince] = useState(() => gemsLedgerMark());
  const was = useRef(!!playing);
  useEffect(() => {
    if (playing && !was.current) setSince(gemsLedgerMark());
    was.current = !!playing;
  }, [playing]);
  return since;
}

/**
 * "+N GEMS" — the round's gems, ALWAYS its own line (Andy: "never hidden"), live (a game-result grant that lands as
 * the card mounts still adds in). data-gems-total / data-gems-by are the gates' handle.
 */
export function GemsEarnedLine({ since = 0, className = '', print = false }) {
  const [entries, setEntries] = useState(() => gemsLedgerSince(since));
  useEffect(() => {
    setEntries(gemsLedgerSince(since));
    return subscribeGemLedger(() => setEntries(gemsLedgerSince(since)));
  }, [since]);
  const { total, by } = sumGems(entries);
  // SAT RUSH's printed page: the line in the page's own ink voice (its .sr-winsline), not the neon panel
  if (print) {
    return (
      <div className={`gems-earned-print ${className}`.trim()} data-testid="gems-earned" data-gems-total={total} data-gems-by={JSON.stringify(by)}>
        <GemIcon size={18} /> <b>+{formatNum(total)}</b> gems
      </div>
    );
  }
  return (
    <div className={`gems-earned ${className}`.trim()} data-testid="gems-earned" data-gems-total={total} data-gems-by={JSON.stringify(by)}>
      <GemIcon size={22} />
      <span className="gems-earned-num">+{formatNum(total)}</span>
      <span className="gems-earned-label">GEMS</span>
    </div>
  );
}

/**
 * The GEM POP on the word: one pooled node that replays a finite one-shot whenever an accepted word DROPS gems
 * (the gems ledger, reason 'drop'). Mount it inside an existing positioned reaction slot — it never brings its own
 * coordinates to the page (no orphan fixed UI). Renders nothing visible at rest (opacity 0).
 */
export function GemPop({ reduced = false, className = '' }) {
  const ref = useRef(null);
  const numRef = useRef(null);
  const anim = useRef(null);
  useEffect(() => subscribeGemLedger((e) => {
    if (!e || e.reason !== 'drop') return;
    const el = ref.current;
    if (!el) return;
    if (numRef.current) numRef.current.textContent = `+${formatNum(e.amount)}`;
    if (anim.current) { try { anim.current.cancel(); } catch { /* gone */ } }
    if (typeof el.animate !== 'function') return;
    el.style.willChange = 'transform, opacity';
    const frames = reduced
      ? [{ opacity: 0 }, { opacity: 1, offset: 0.15 }, { opacity: 1, offset: 0.75 }, { opacity: 0 }]
      : [
        { opacity: 0, transform: 'translate(0, 8px) scale(0.4) rotate(-12deg)' },
        { opacity: 1, transform: 'translate(0, -6px) scale(1.18) rotate(6deg)', offset: 0.18 },
        { opacity: 1, transform: 'translate(0, -10px) scale(1) rotate(0deg)', offset: 0.34 },
        { opacity: 1, transform: 'translate(0, -14px) scale(1) rotate(0deg)', offset: 0.78 },
        { opacity: 0, transform: 'translate(0, -24px) scale(0.9) rotate(0deg)' },
      ];
    const a = el.animate(frames, { duration: 900, easing: 'cubic-bezier(.2,.9,.3,1)', fill: 'none' });
    anim.current = a;
    const clear = () => { if (anim.current === a) { el.style.willChange = ''; anim.current = null; } };
    a.finished.then(clear, clear);
  }), [reduced]);
  useEffect(() => () => { if (anim.current) { try { anim.current.cancel(); } catch { /* gone */ } } }, []);
  return (
    <span ref={ref} className={`gem-pop ${className}`.trim()} aria-hidden="true">
      <GemIcon size={26} />
      <span ref={numRef} className="gem-pop-num" />
    </span>
  );
}
