// MarksIndex.jsx — E6 (Andy oct2 evening): the MARKS INDEX. An inventory of every mark: the ones you
// own, the ones you don't (locked, with exactly how to get them). Tap one → SET AS MAIN, which equips it
// as your title with its big bonus (marks.js, unchanged). The current MAIN is the one big thing, at the
// top. Reached from the MARKS button.
//
// Motion: one finite PUNCH on the hero when a new MAIN is set (transform/opacity only); static at rest;
// reduced motion shows the same states with no movement.
import { useEffect, useRef, useState } from 'react';
import { MARKS, MARK_RANK_NAMES, MAX_MARK_RANK, markProgress, markMainMult, markTier, markBlurbAt } from '../progress/marks';
import { ACHIEVEMENTS } from '../progress/achievements';
import MarkBadge from './MarkBadge';
import { formatNum, formatMultExact as formatMult } from '../format';
import './MarksIndex.css';

const pct = (m, rank) => Math.round((markMainMult(m, rank) - 1) * 100);
// U (Andy oct2 22:25): a mark reads as ONE short tag — MAIN ×N — never a sentence explaining it
const tag = (m, rank) => `MAIN ×${formatMult(markMainMult(m, rank))}`;
// the true ceiling — the best mark at MAX rank (the old hard-coded +300% was rank I only)
const MAX_PCT = Math.max(...MARKS.map((m) => pct(m, MAX_MARK_RANK)));
// H6/M10: "HOW TO GET IT" names the TASK (the achievement's hint), not just the achievement's name,
// which only meant something in another tab. Secrets stay masked until earned.
const ACH_HINT = Object.fromEntries(
  ACHIEVEMENTS.map((a) => [a.id, a.secret ? null : String(a.hint || '').replace(/\.$/, '').toUpperCase()]),
);

function Detail({ m, have, on, howTo, onSet }) {
  const p = markProgress(m.id);
  const tier = markTier(m);
  const rank = have ? p.rank : 1;
  return (
    <div className={`mx-detail${have ? '' : ' is-locked'}`} style={{ '--tier': tier.colour }}>
      <MarkBadge mark={m} rank={rank} locked={!have} size={84} className="mx-detail-art" />
      <div className="mx-detail-body">
        <div className="mx-detail-name">{m.name}</div>
        <div className="mx-detail-tier">{tier.name}{have ? ` · MARK ${MARK_RANK_NAMES[rank - 1]}` : ''}</div>
        <div className="mx-detail-pct">{tag(m, rank)}</div>
        {/* H6/M11: the perk that makes this mark differ from the others of its tier. */}
        <div className="mx-detail-blurb">+ {markBlurbAt(m, rank).toUpperCase()}</div>
        {have ? (
          <button type="button" className={`mx-set${on ? ' is-on' : ''}`} onClick={() => onSet(on ? null : m.id)}>
            {on ? 'YOUR MAIN — TAKE OFF' : 'SET AS MAIN'}
          </button>
        ) : (
          <div className="mx-howto">HOW TO GET IT: {howTo}</div>
        )}
      </div>
    </div>
  );
}

// QUALITY PROTOCOL (E6): three layouts were built (case: detail sheet under the grid; split: hero +
// detail beside the grid; expand: the tile opens in place) and an adversarial reviewer picked SPLIT —
// the only one with the hero, SET AS MAIN and most of the inventory on screen together at 1280x551.
export default function MarksIndex({ unlockedIds = [], equippedId = null, achievementNames = {}, onEquip, onClose }) {
  const unlocked = new Set(unlockedIds);
  const main = MARKS.find((m) => m.id === equippedId) || null;
  // the default selection is the useful NEXT tap — another mark you own (or, with nothing else owned, the
  // first one to chase); selecting the MAIN by default repeated the hero right under it (loop 4)
  const [sel, setSel] = useState(() => (
    MARKS.find((m) => unlocked.has(m.id) && m.id !== equippedId)
    || MARKS.find((m) => !unlocked.has(m.id))
    || main
    || MARKS[0]
  ).id);
  const [punch, setPunch] = useState(0);
  const closeRef = useRef(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose && onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const set = (id) => {
    onEquip && onEquip(id);
    if (id) setPunch((n) => n + 1);
  };
  const selM = MARKS.find((m) => m.id === sel) || MARKS[0];
  const owned = MARKS.filter((m) => unlocked.has(m.id)).length;
  const mp = main ? markProgress(main.id) : null;
  const detail = (
    <Detail
      m={selM}
      have={unlocked.has(selM.id)}
      on={equippedId === selM.id}
      howTo={ACH_HINT[selM.from] ? `${ACH_HINT[selM.from]} (${achievementNames[selM.from] || selM.from})` : (achievementNames[selM.from] || selM.from)}
      onSet={set}
    />
  );
  return (
    <div className="marks-overlay mx-overlay" role="dialog" aria-modal="true" aria-label="Marks index">
      <div className="mx-panel">
        <div className="mx-head">
          <h2 className="mx-title">MARKS</h2>
          <span className="mx-count">{owned} / {MARKS.length} OWNED</span>
          <button type="button" className="mx-close marks-close" onClick={onClose} aria-label="Close" ref={closeRef}>✕</button>
        </div>
        <div className="mx-main-col">
          {/* THE ONE BIG THING: your MAIN — title + bonus, hero-size */}
          <section className={`mx-hero${main ? '' : ' is-empty'}`} key={`p${punch}`} style={main ? { '--tier': markTier(main).colour } : undefined} aria-label="Your main mark">
            {main ? (
              <>
                <MarkBadge mark={main} rank={mp.rank} size={128} className="mx-hero-art" />
                <div className="mx-hero-body">
                  <div className="mx-hero-kicker">YOUR MAIN · <span className="mx-nowrap">MARK {MARK_RANK_NAMES[mp.rank - 1]}</span></div>
                  <div className="mx-hero-name">{main.name}</div>
                  <div className="mx-hero-pct">{tag(main, mp.rank)}</div>
                  {!mp.maxed ? (
                    <div className="mx-hero-rank">
                      <span className="mx-bar"><span className="mx-bar-fill" style={{ transform: `scaleX(${Math.max(0, Math.min(1, mp.frac))})` }} /></span>
                      <span>{formatNum(Math.max(0, mp.need - mp.into))} MORE WORDS → MARK {MARK_RANK_NAMES[mp.rank]} · ×{formatMult(markMainMult(main, mp.rank + 1))}</span>
                    </div>
                  ) : <div className="mx-hero-rank">MAXED</div>}
                </div>
              </>
            ) : (
              <div className="mx-hero-body">
                <div className="mx-hero-kicker">NO MAIN YET</div>
                <div className="mx-hero-name">PICK ONE BELOW</div>
                <div className="mx-hero-pct">UP TO ×{formatMult(1 + MAX_PCT / 100)}</div>
              </div>
            )}
          </section>
          {detail}
        </div>
        <div className="mx-grid" role="list">
          {MARKS.map((m) => {
            const have = unlocked.has(m.id);
            const on = equippedId === m.id;
            const tier = markTier(m);
            const p = markProgress(m.id);
            const isSel = sel === m.id;
            return (
              <button
                key={m.id}
                type="button"
                role="listitem"
                className={`mx-tile${have ? '' : ' is-locked'}${on ? ' is-on' : ''}${isSel ? ' is-sel' : ''}`}
                style={{ '--tier': tier.colour }}
                aria-pressed={isSel}
                aria-label={`${m.name}, ${tier.name}${have ? '' : ', locked'}${on ? ', your main' : ''}`}
                onClick={() => setSel(m.id)}
              >
                <MarkBadge mark={m} rank={have ? p.rank : 1} locked={!have} size={60} className="mx-tile-art" />
                <span className="mx-tile-name">{m.name}</span>
                <span className="mx-tile-sub">{have ? tag(m, p.rank) : `GET: ${achievementNames[m.from] || m.from}`}</span>
                {on && <span className="mx-tile-main">MAIN</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
