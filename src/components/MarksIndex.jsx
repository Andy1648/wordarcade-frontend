// MarksIndex.jsx — E6 (Andy oct2 evening) + MARK ROLLS (Andy M, H3): the MARKS INDEX. Your MAIN on top, the
// ROLL panel (price, pity, luck, the rarity-scaled reveal), and an inventory of every mark: the 29 rollable
// marks (with "1 IN X" while locked, GOLD / RAINBOW on owned ones), the PERMANENT marks from the hard
// achievements, and any retired mark you still own. % COLLECTED + the next milestone sit in the header.
// Tap a mark → SET AS MAIN. Reached from the MARKS button.
//
// RULE U (Andy): a card says name, rarity, "1 IN X" and ONE tag — the worn mark "MAIN ×N", every other mark
// "PERK +X%" (a mark with no perk — permanent / retired — shows what wearing it pays). No other prose.
//
// Motion: the MAIN hero punches once when a new MAIN is set; the roll reveal lives in RollReveal.jsx. Both
// finite, transform/opacity only; static at rest; reduced motion shows the same states with no movement.
import { useEffect, useMemo, useRef, useState } from 'react';
import { MARKS, MARK_RANK_NAMES, MAX_MARK_RANK, markProgress, markMainMult, markTier, markById } from '../progress/marks';
import {
  ROLL_MARKS, PERMANENT_MARKS, RETIRED_MARK_IDS, viewState, markLevel, perkTag, mainTag, oneInX, collection,
  nextMilestone, permanentOwnedIds, markEntry,
} from '../progress/markRolls';
import MarkBadge from './MarkBadge';
import RollPanel from './markRolls/RollPanel';
import { revealVersion } from './markRolls/revealPlan.js';
import UnlockTutorial from '../tutorials/UnlockTutorial.jsx';
import { TUTORIALS, hasSeenTutorial, markTutorialSeen } from '../tutorials/registry.js';
import { formatNum, formatMultExact as formatMult } from '../format';
import './MarksIndex.css';
import './markRolls/MarkRolls.css';

const PERM_COLOUR = '#9A1AFF';
const tierOf = (e) => (e.kind === 'perm' ? { name: 'PERMANENT', colour: PERM_COLOUR } : markTier({ tier: e.tier }));
// the true ceiling — the best legacy mark at MAX rank (rolled + permanent marks top out at ×4)
const MAX_MULT = Math.max(4, ...MARKS.map((m) => markMainMult(m, MAX_MARK_RANK)));

/** Every mark the index draws, in order: rollable (common → legendary), permanent, retired-but-owned. */
function buildEntries(unlocked) {
  const out = ROLL_MARKS.map((m) => ({ id: m.id, name: m.name, tier: m.tier, kind: 'roll' }));
  for (const p of PERMANENT_MARKS) out.push({ id: p.id, name: p.name, tier: 'legendary', kind: 'perm', from: p.from });
  for (const id of RETIRED_MARK_IDS) {
    const m = markById(id);
    if (m && unlocked.has(id)) out.push({ id, name: m.name, tier: m.tier, kind: 'retired' });
  }
  return out;
}

/** MAIN ×N for any id — a legacy mark at its real rank, a rolled / permanent mark by tier. */
function mainTagFor(id) {
  const m = markById(id);
  return m ? `MAIN ×${formatMult(markMainMult(m, markProgress(id).rank))}` : mainTag(id);
}

function useReducedMotion() {
  const [r, setR] = useState(() => {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
  });
  useEffect(() => {
    let mq;
    try { mq = window.matchMedia('(prefers-reduced-motion: reduce)'); } catch { return undefined; }
    const on = () => setR(mq.matches);
    mq.addEventListener ? mq.addEventListener('change', on) : mq.addListener(on);
    return () => (mq.removeEventListener ? mq.removeEventListener('change', on) : mq.removeListener(on));
  }, []);
  return r;
}

function Detail({ e, have, on, finish, tagText, howTo, onSet }) {
  const t = tierOf(e);
  const legacy = markById(e.id);
  const rank = have && legacy ? markProgress(e.id).rank : 1;
  return (
    <div className={`mx-detail${have ? '' : ' is-locked'}`} style={{ '--tier': t.colour }}>
      <MarkBadge mark={markEntry(e.id)} rank={rank} locked={!have} size={84} finish={finish} permanent={e.kind === 'perm'} className="mx-detail-art" />
      <div className="mx-detail-body">
        <div className="mx-detail-name">{e.name}</div>
        <div className="mx-detail-tier">
          {t.name}
          {e.kind === 'roll' ? ` · 1 IN ${formatNum(oneInX(e.id))}` : ''}
          {have && legacy ? ` · RANK ${MARK_RANK_NAMES[rank - 1]}` : ''}
        </div>
        {have ? <div className="mx-detail-pct">{tagText}</div> : <div className="mx-howto">{howTo}</div>}
        {have && (
          <button type="button" className={`mx-set${on ? ' is-on' : ''}`} onClick={() => onSet(on ? null : e.id)}>
            {on ? 'YOUR MAIN — TAKE OFF' : 'SET AS MAIN'}
          </button>
        )}
      </div>
    </div>
  );
}

// QUALITY PROTOCOL (E6): SPLIT layout (hero + detail beside the grid) — the reviewed winner. MARK ROLLS adds the
// ROLL panel under the hero, and the % COLLECTED bar in the head.
export default function MarksIndex({ unlockedIds = [], equippedId = null, achievementNames = {}, level = 1, earned = [], onEquip, onClose }) {
  const unlocked = useMemo(() => new Set(unlockedIds), [unlockedIds]);
  const [tick, setTick] = useState(0);
  // the INDEX view: the stored roll state + legacy-owned marks (read-only until the first roll)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const view = useMemo(() => viewState(unlockedIds), [unlockedIds, tick]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const permOwned = useMemo(() => new Set(permanentOwnedIds()), [tick]);
  const entries = useMemo(() => buildEntries(unlocked), [unlocked]);
  const owns = (e) => (e.kind === 'roll' ? markLevel(view, e.id).copies > 0 || unlocked.has(e.id) : e.kind === 'perm' ? permOwned.has(e.id) || unlocked.has(e.id) : unlocked.has(e.id));
  const finishOf = (e) => (e.kind === 'roll' ? markLevel(view, e.id).variant || 'base' : 'base');
  const tagFor = (e) => (equippedId === e.id || e.kind !== 'roll' ? mainTagFor(e.id) : perkTag(view, e.id));
  const howTo = (e) => (e.kind === 'roll' ? `ROLL · 1 IN ${formatNum(oneInX(e.id))}` : achievementNames[e.from] || e.from || '');

  const wornEntry = equippedId ? markEntry(equippedId) : null;
  const main = (equippedId && entries.find((e) => e.id === equippedId))
    || (wornEntry ? { id: equippedId, name: wornEntry.name, tier: wornEntry.tier, kind: 'retired' } : null);
  const [sel, setSel] = useState(() => (
    entries.find((e) => owns(e) && e.id !== equippedId) || entries.find((e) => !owns(e)) || main || entries[0]
  ).id);
  const [punch, setPunch] = useState(0);
  const [coverHost, setCoverHost] = useState(null);
  const [tut, setTut] = useState(() => !hasSeenTutorial('markRolls'));
  const version = useMemo(() => revealVersion(typeof window !== 'undefined' ? window.location.search : ''), []);
  const reduced = useReducedMotion();
  const closeRef = useRef(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (ev) => { if (ev.key === 'Escape') onClose && onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const set = (id) => {
    onEquip && onEquip(id);
    if (id) setPunch((n) => n + 1);
  };
  const selE = entries.find((e) => e.id === sel) || entries[0];
  const col = collection(view);
  const next = nextMilestone(view);
  const legacyMain = main && markById(main.id);
  const mp = legacyMain ? markProgress(main.id) : null;
  const mainTier = main ? tierOf(main) : null;
  const tutDef = TUTORIALS.find((t) => t.id === 'markRolls');

  return (
    <div className="marks-overlay mx-overlay" role="dialog" aria-modal="true" aria-label="Marks index" ref={setCoverHost}>
      <div className="mx-panel">
        <div className="mx-head">
          <h2 className="mx-title">MARKS</h2>
          <div className="mx-collect" data-testid="marks-collected" data-pct={Math.round(col.pct)}>
            <span className="mx-collect-pct">{Math.round(col.pct)}% COLLECTED</span>
            <span className="mx-bar"><span className="mx-bar-fill" style={{ transform: `scaleX(${Math.min(1, col.pct / 100)})` }} /></span>
            {next && <span className="mx-collect-next">NEXT {next.pct}%{next.track !== 'base' ? ` ${next.track.toUpperCase()}` : ''} · LUCK +{next.luck}</span>}
          </div>
          <button type="button" className="mx-close marks-close" onClick={onClose} aria-label="Close" ref={closeRef}>✕</button>
        </div>
        <div className="mx-main-col">
          {/* THE ONE BIG THING: your MAIN — title + bonus, hero-size */}
          <section className={`mx-hero${main ? '' : ' is-empty'}`} key={`p${punch}`} style={main ? { '--tier': mainTier.colour } : undefined} aria-label="Your main mark">
            {main ? (
              <>
                <MarkBadge mark={markEntry(main.id)} rank={mp ? mp.rank : 1} size={128} finish={finishOf(main)} permanent={main.kind === 'perm'} className="mx-hero-art" />
                <div className="mx-hero-body">
                  <div className="mx-hero-kicker">YOUR MAIN{mp ? <> · <span className="mx-nowrap">RANK {MARK_RANK_NAMES[mp.rank - 1]}</span></> : null}</div>
                  <div className="mx-hero-name">{main.name}</div>
                  <div className="mx-hero-pct" data-testid="marks-main-tag">{mainTagFor(main.id)}</div>
                  {mp && !mp.maxed ? (
                    <div className="mx-hero-rank">
                      <span className="mx-bar"><span className="mx-bar-fill" style={{ transform: `scaleX(${Math.max(0, Math.min(1, mp.frac))})` }} /></span>
                      <span>{formatNum(Math.max(0, mp.need - mp.into))} WORDS → RANK {MARK_RANK_NAMES[mp.rank]} · ×{formatMult(markMainMult(legacyMain, mp.rank + 1))}</span>
                    </div>
                  ) : mp ? <div className="mx-hero-rank">MAX RANK</div> : null}
                </div>
              </>
            ) : (
              <div className="mx-hero-body">
                <div className="mx-hero-kicker">NO MAIN YET</div>
                <div className="mx-hero-name">ROLL ONE</div>
                <div className="mx-hero-pct">UP TO ×{formatMult(MAX_MULT)}</div>
              </div>
            )}
          </section>
          <RollPanel
            level={level}
            view={view}
            worn={equippedId}
            earned={earned}
            version={version}
            reduced={reduced}
            coverHost={coverHost}
            onRolled={(res) => { setTick((n) => n + 1); setSel(res.markId); }}
            onEquip={(id) => set(id)}
          />
          <Detail
            e={selE}
            have={owns(selE)}
            on={equippedId === selE.id}
            finish={finishOf(selE)}
            tagText={tagFor(selE)}
            howTo={howTo(selE)}
            onSet={set}
          />
        </div>
        <div className="mx-grid" role="list">
          {entries.map((e) => {
            const have = owns(e);
            const on = equippedId === e.id;
            const t = tierOf(e);
            const lv = e.kind === 'roll' ? markLevel(view, e.id) : null;
            const legacy = markById(e.id);
            const isSel = sel === e.id;
            return (
              <button
                key={e.id}
                type="button"
                role="listitem"
                className={`mx-tile${have ? '' : ' is-locked'}${on ? ' is-on' : ''}${isSel ? ' is-sel' : ''}${e.kind === 'perm' ? ' is-perm' : ''}`}
                style={{ '--tier': t.colour }}
                aria-pressed={isSel}
                aria-label={`${e.name}, ${t.name}${have ? '' : ', locked'}${on ? ', your main' : ''}`}
                data-mark={e.id}
                onClick={() => setSel(e.id)}
              >
                <MarkBadge mark={markEntry(e.id)} rank={have && legacy ? markProgress(e.id).rank : 1} locked={!have} size={60} finish={finishOf(e)} permanent={e.kind === 'perm'} className="mx-tile-art" />
                <span className="mx-tile-name">{e.name}</span>
                <span className="mx-tile-sub">{have ? tagFor(e) : e.kind === 'roll' ? `1 IN ${formatNum(oneInX(e.id))}` : howTo(e)}</span>
                {on && <span className="mx-tile-main">MAIN</span>}
                {lv && lv.rainbow > 0 ? (
                  <span className="mx-tile-finish is-rainbow">RAINBOW{lv.rainbow > 1 ? ` ×${lv.rainbow}` : ''}</span>
                ) : lv && lv.gold > 0 ? (
                  <span className="mx-tile-finish is-gold">GOLD{lv.gold > 1 ? ` ×${lv.gold}` : ''}</span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
      {tut && tutDef && (
        <UnlockTutorial tutorial={tutDef} onDone={() => { markTutorialSeen('markRolls'); setTut(false); }} />
      )}
    </div>
  );
}
