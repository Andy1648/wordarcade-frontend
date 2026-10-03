// MarksIndex.jsx — E6 (Andy oct2 evening) + MARK ROLLS (Andy M, H3): the MARKS INDEX. Your MAIN on top, the
// ROLL panel (price, pity, luck, the rarity-scaled reveal), and an inventory of every mark: the 29 rollable
// marks (with "1 IN X" while locked, GOLD / RAINBOW on owned ones), the PERMANENT marks from the hard
// achievements, and any retired mark you still own. % COLLECTED + the next milestone sit in the header.
// Tap a mark → SET AS MAIN. Reached from the MARKS button; LAZY (this whole roll system is off the menu's
// first paint — payload ratchet).
//
// RULE U (Andy): a card says name, rarity, "1 IN X" and ONE tag — the worn mark "MAIN ×N", every other mark
// "PERK +X%" (a mark with no perk — permanent / retired — shows what wearing it pays). No other prose.
//
// NO SPOILERS (oct3 review): everything this screen reads from storage — the roll state, the owned set, the
// worn MAIN — is snapshotted on mount and re-read ONLY when a roll's reveal LANDS (`landed`), never on a
// re-render. A roll's balance write re-renders the menu behind; that must not move a tile or a counter.
//
// Motion: the MAIN hero punches once when a new MAIN is set; the roll reveal lives in RollReveal.jsx. Both
// finite, transform/opacity only; static at rest; reduced motion shows the same states with no movement.
import { useEffect, useMemo, useRef, useState } from 'react';
import { MARK_RANK_NAMES, markProgress, markMainMult, markTier, markById } from '../progress/marks';
import { ACHIEVEMENTS } from '../progress/achievements';
import {
  ROLL_MARKS, PERMANENT_MARKS, RETIRED_MARK_IDS, viewState, markLevel, perkTag, mainTag, oneInX, collection,
  nextMilestone, permanentOwnedIds, permanentOwnedCount, markEntry, luck,
} from '../progress/markRolls';
import { wearMark } from '../progress/markRollShop';
import MarkBadge, { registerMarkGlyphs } from './MarkBadge';
import { ROLLED_GLYPHS } from './markGlyphsRolled.jsx';
import RollPanel, { luckText } from './markRolls/RollPanel';
import UnlockTutorial from '../tutorials/UnlockTutorial.jsx';
import { TUTORIALS, hasSeenTutorial, markTutorialSeen } from '../tutorials/registry.js';
import { formatNum, formatMultExact as formatMult } from '../format';
import './MarksIndex.css';
import './markRolls/MarkRolls.css';

registerMarkGlyphs(ROLLED_GLYPHS);

const PERM_COLOUR = '#9A1AFF';
const tierOf = (e) => (e.kind === 'perm' ? { name: 'PERMANENT', colour: PERM_COLOUR } : markTier({ tier: e.tier }));
// "UP TO ×N" must be TRUE for what you can get: rolled + permanent marks top out at ×4
const MAX_MULT = Math.max(...[...ROLL_MARKS, ...PERMANENT_MARKS].map((m) => 1 + markTier({ tier: m.tier === 'permanent' ? 'legendary' : m.tier }).bonus));
// a locked PERMANENT says the TASK (the achievement's hint), as main's H6/M10 did for the old index
const ACH_HINT = Object.fromEntries(
  ACHIEVEMENTS.map((a) => [a.id, a.secret ? a.name : String(a.hint || a.name || '').replace(/\.$/, '').toUpperCase()]),
);

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
    if (mq.addEventListener) mq.addEventListener('change', on); else mq.addListener(on);
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
          {e.kind === 'roll' ? <> · <span className="mx-nowrap">1 IN {formatNum(oneInX(e.id))}</span></> : null}
          {have && legacy ? <> · <span className="mx-nowrap">RANK {MARK_RANK_NAMES[rank - 1]}</span></> : null}
        </div>
        {have ? <div className="mx-detail-pct">{tagText}</div> : howTo ? <div className="mx-howto">{howTo}</div> : null}
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
  // `landed` ticks when a roll's reveal lands — the ONLY time this screen re-reads storage
  const [landed, setLanded] = useState(0);
  const idsRef = useRef(unlockedIds);
  idsRef.current = unlockedIds;
  const snap = useMemo(() => {
    const ids = idsRef.current;
    return { unlocked: new Set(ids), view: viewState(ids), permOwned: new Set(permanentOwnedIds()), permCount: permanentOwnedCount() };
  }, [landed]); // eslint-disable-line react-hooks/exhaustive-deps -- re-read storage ONLY when a reveal lands
  const { unlocked, view, permOwned } = snap;
  const entries = useMemo(() => buildEntries(unlocked), [unlocked]);
  const owns = (e) => (e.kind === 'roll' ? markLevel(view, e.id).copies > 0 || unlocked.has(e.id) : e.kind === 'perm' ? permOwned.has(e.id) || unlocked.has(e.id) : unlocked.has(e.id));
  const finishOf = (e) => (e.kind === 'roll' ? markLevel(view, e.id).variant || 'base' : 'base');
  const tagFor = (e) => (equippedId === e.id || e.kind !== 'roll' ? mainTagFor(e.id) : perkTag(view, e.id));
  // a locked rollable already says "1 IN X" on its tier line — only a PERMANENT needs a how-to (its task)
  const howTo = (e) => (e.kind === 'perm' ? ACH_HINT[e.from] || achievementNames[e.from] || e.from : '');

  const wornEntry = equippedId ? markEntry(equippedId) : null;
  const main = (equippedId && entries.find((e) => e.id === equippedId))
    || (wornEntry ? { id: equippedId, name: wornEntry.name, tier: wornEntry.tier, kind: 'retired' } : null);
  const [sel, setSel] = useState(() => (
    entries.find((e) => owns(e) && e.id !== equippedId) || entries.find((e) => !owns(e)) || main || entries[0]
  ).id);
  const [punch, setPunch] = useState(0);
  const [coverHost, setCoverHost] = useState(null);
  const [tut, setTut] = useState(() => !hasSeenTutorial('markRolls'));
  const reduced = useReducedMotion();
  const closeRef = useRef(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (ev) => { if (ev.key === 'Escape') onClose && onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const set = (id) => {
    const worn = wearMark(id, earned);
    onEquip && onEquip(worn);
    if (worn) setPunch((n) => n + 1);
  };
  const selE = entries.find((e) => e.id === sel) || entries[0];
  const col = collection(view);
  const next = nextMilestone(view);
  const L = luck(view, { permanentOwned: snap.permCount });
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
            {/* always drawn (a blank line once every milestone is paid) so the head never changes height */}
            <span className="mx-collect-next">{next ? `NEXT ${next.pct}%${next.track !== 'base' ? ` ${next.track.toUpperCase()}` : ''} → ${luckText(L + next.luck)}` : ' '}</span>
          </div>
          <button type="button" className="mx-close marks-close" onClick={onClose} aria-label="Close" ref={closeRef}>✕</button>
        </div>
        <div className="mx-main-col">
          {/* THE ONE BIG THING: your MAIN — title + bonus, hero-size. A roll that lands a higher MAIN equips it
              and this updates on the landing, never before. */}
          {/* FIXED SHAPE (PR #156 e2e: the ROLL button below moved 15px when the first roll filled this): every
              state draws the SAME slots — art (a locked coin when empty), kicker, name, tag and the rank row
              (hidden when there is no rank) — each pinned to one line / a reserved two-line box in CSS, so a new
              MAIN never changes this section's height. */}
          <section className={`mx-hero${main ? '' : ' is-empty'}`} key={`p${punch}`} style={main ? { '--tier': mainTier.colour } : undefined} aria-label="Your main mark">
            <MarkBadge mark={main ? markEntry(main.id) : null} locked={!main} rank={mp ? mp.rank : 1} size={128} finish={main ? finishOf(main) : 'base'} permanent={!!main && main.kind === 'perm'} className="mx-hero-art" />
            <div className="mx-hero-body">
              <div className="mx-hero-kicker">
                {main ? <>YOUR MAIN{mp ? <> · <span className="mx-nowrap">RANK {MARK_RANK_NAMES[mp.rank - 1]}</span></> : null}</> : 'NO MAIN YET'}
              </div>
              <div className="mx-hero-name" title={main ? main.name : undefined}>{main ? main.name : 'ROLL ONE'}</div>
              {main
                ? <div className="mx-hero-pct" data-testid="marks-main-tag">{mainTagFor(main.id)}</div>
                : <div className="mx-hero-pct">UP TO ×{formatMult(MAX_MULT)}</div>}
              <div className={`mx-hero-rank${mp ? '' : ' is-placeholder'}`} aria-hidden={mp ? undefined : 'true'}>
                <span className="mx-bar"><span className="mx-bar-fill" style={{ transform: `scaleX(${mp ? Math.max(0, Math.min(1, mp.maxed ? 1 : mp.frac)) : 0})` }} /></span>
                <span className="mx-hero-rank-text">
                  {mp && !mp.maxed
                    ? `${formatNum(Math.max(0, mp.need - mp.into))} MORE WORDS → RANK ${MARK_RANK_NAMES[mp.rank]} · ×${formatMult(markMainMult(legacyMain, mp.rank + 1))}`
                    : mp ? 'MAX RANK' : ' '}
                </span>
              </div>
            </div>
          </section>
          <RollPanel
            level={level}
            view={view}
            worn={equippedId}
            earned={earned}
            reduced={reduced}
            coverHost={coverHost}
            onRolled={(res, wornNow) => {
              setLanded((n) => n + 1);
              if (wornNow) { onEquip && onEquip(wornNow); setPunch((n) => n + 1); }
            }}
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
                <span className="mx-tile-sub">{have ? tagFor(e) : e.kind === 'roll' ? `1 IN ${formatNum(oneInX(e.id))}` : achievementNames[e.from] || ''}</span>
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
