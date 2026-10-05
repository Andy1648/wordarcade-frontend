// MarksIndex.jsx — INDEX v2 (Andy oct5, verbatim): "INDEX (separate button): unowned marks are locked silhouettes
// with rarity colour + "1 IN X". Each new mark and each ★ level pays wins; there's a per-rarity completion reward.
// Card face max 4 things (name, rarity, 1 IN X, stat). Tap shows the flavour line, owned count, first roll #, and
// a replay-reveal button."
//
// PROPS (the ROLL screen opens this from its INDEX button):
//   onClose()           close the INDEX
//   onReplay(markId)    replay that mark's reveal (the detail's REPLAY button; owned rollable marks only)
//   unlockedIds, equippedId, earned, onEquip   optional — the owned set / worn MAIN; with onEquip the detail can
//                       SET AS MAIN. achievementNames names a locked PERMANENT's task.
// COMPAT: a host that passes no onReplay (the menu's MARKS button, until the ROLL screen owns it) still gets the
// ROLL panel above the grid, so rolling never disappears between the two PRs. `level` feeds that panel's price.
//
// THE CARD (rule: max 4 things) — name · rarity · 1 IN X · stat, on the tier's fill; the ★ pips sit under the
// art with their "7/10 → ★3" (Andy: "Card shows 7/10 → ★3"). LOCKED: no name — a silhouette (an asset, masked
// and painted in the tier colour) + rarity + 1 IN X. PERMANENT: its task instead of odds.
// COMPLETION: one chip per rarity in the head, filled in the tier colour by owned/total (numbers only, no words);
// a complete tier is a solid tier fill. The engine pays the INDEX rewards (new mark / ★ / tier complete) — this
// screen never states an amount, so it can never claim more than it pays.
//
// NO SPOILERS: storage is snapshotted on mount and re-read only when a roll's reveal LANDS (compat ROLL panel).
// Motion: the detail sheet pops in once (transform/opacity, finite); RarityFx sweeps once per card from EPIC up;
// nothing loops; reduced motion shows the same states still.
import { useEffect, useMemo, useRef, useState } from 'react';
import { markProgress, markTier, markById } from '../progress/marks';
import { ACHIEVEMENTS } from '../progress/achievements';
import {
  ROLL_MARKS, PERMANENT_MARKS, RETIRED_MARK_IDS, ROLLABLE_TIERS, viewState, markLevel, mainTag, oneInX, collection,
  permanentOwnedIds, markEntry, indexEntry, completedTiers, perkLine, statLine,
} from '../progress/markRolls';
import { wearMark } from '../progress/markRollShop';
import { flavourOf } from '../progress/markFlavour';
import MarkBadge, { registerMarkGlyphs } from './MarkBadge';
import { ROLLED_GLYPHS } from './markGlyphsRolled.jsx';
import RollPanel from './markRolls/RollPanel';
import { ShinyBadge } from './markRolls/RollReveal';
import UnlockTutorial from '../tutorials/UnlockTutorial.jsx';
import { TUTORIALS, hasSeenTutorial, markTutorialSeen } from '../tutorials/registry.js';
import { formatNum } from '../format';
import { rarityClass } from '../lib/rarityStyle.js';
import RarityFx from './rarity/RarityFx';
import MarkPips from './rarity/MarkPips';
import './rarity/RarityFin.css';
import './MarksIndex.css';
import './markRolls/MarkRolls.css';

registerMarkGlyphs(ROLLED_GLYPHS);

const tierName = (tier) => (tier === 'permanent' ? 'PERMANENT' : markTier({ tier }).name);
// a locked PERMANENT says the TASK (the achievement's hint), as the old index did
const ACH_HINT = Object.fromEntries(
  ACHIEVEMENTS.map((a) => [a.id, a.secret ? a.name : String(a.hint || a.name || '').replace(/\.$/, '').toUpperCase()]),
);

/** Every mark the INDEX draws, in order: rollable (common → secret), permanent, retired-but-owned. */
function buildEntries(unlocked) {
  const out = ROLL_MARKS.map((m) => ({ id: m.id, name: m.name, tier: m.tier, kind: 'roll' }));
  for (const p of PERMANENT_MARKS) out.push({ id: p.id, name: p.name, tier: 'permanent', kind: 'perm', from: p.from });
  for (const id of RETIRED_MARK_IDS) {
    const m = markById(id);
    if (m && unlocked.has(id)) out.push({ id, name: m.name, tier: m.tier, kind: 'retired' });
  }
  return out;
}

/** "7/10 → ★3" (or "★5" when maxed) — numbers through formatNum. '' for a mark with no pips. */
function pipText(p) {
  if (!p) return '';
  if (!p.need) return `★${formatNum(p.pips)}`;
  return `${formatNum(p.have)}/${formatNum(p.need)} → ★${formatNum(p.pips + 1)}`;
}

/** Per-rarity completion: [{ tier, owned, total, complete }]. */
function tierCompletion(view, owns) {
  const done = new Set(completedTiers(view));
  return ROLLABLE_TIERS.map((tier) => {
    const ms = ROLL_MARKS.filter((m) => m.tier === tier);
    const owned = ms.filter((m) => owns(m.id)).length;
    return { tier, owned, total: ms.length, complete: done.has(tier) || (ms.length > 0 && owned === ms.length) };
  });
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

/** A locked mark: the silhouette asset, masked and painted in the tier colour (the host carries the tier vars). */
function Silhouette({ className = '' }) {
  return (
    <span className={`mx-sil-wrap ${className}`} aria-hidden="true">
      <span className="mx-sil" />
    </span>
  );
}

/** The art block: the mark (or its silhouette) with the ★ pip row + "7/10 → ★3" under it. */
function Art({ e, have, size, pips, view }) {
  const legacy = markById(e.id);
  return (
    <span className="mx-art">
      {have
        ? <MarkBadge mark={markEntry(e.id)} rank={legacy ? markProgress(e.id).rank : 1} size={size} permanent={e.kind === 'perm'} className="mx-art-badge" />
        : <Silhouette className="mx-art-badge" />}
      {have && pips ? (
        <span className="mx-pips">
          <MarkPips pips={pips.pips} />
          <span className="mx-pips-text">{pipText(pips)}</span>
        </span>
      ) : null}
      {have && view && view.marks && view.marks[e.id] && view.marks[e.id].shiny ? <ShinyBadge className="mx-tile-shiny" /> : null}
    </span>
  );
}

function Sheet({ e, have, on, view, howTo, onSet, onReplay, onClose }) {
  const closeRef = useRef(null);
  useEffect(() => { closeRef.current?.focus(); }, [e.id]);
  const rolled = e.kind === 'roll';
  const info = rolled ? indexEntry(e.id, view) : null;
  const pips = rolled && have ? { pips: info.pips, have: info.have, need: info.need } : null;
  const tag = rolled ? (info.statLine || '') : have ? mainTag(e.id, view) : '';
  const perk = perkLine(e.id);
  const flavour = have ? flavourOf(e.id) : '';
  return (
    <div className="mx-sheet-layer" onClick={onClose}>
      <div
        className={`mx-sheet ${rarityClass(e.tier, { tint: true })}${have ? '' : ' is-locked'}`}
        role="dialog"
        aria-modal="true"
        aria-label={have ? e.name : tierName(e.tier)}
        data-mark={e.id}
        onClick={(ev) => ev.stopPropagation()}
      >
        <button type="button" className="mx-close mx-sheet-close" onClick={onClose} aria-label="Close" ref={closeRef}>✕</button>
        <Art e={e} have={have} size={132} pips={pips} view={view} />
        <div className="mx-sheet-body">
          {have ? <div className="mx-sheet-name">{e.name}</div> : null}
          <div className="mx-sheet-tier">
            <span className={`rarity-chip ${rarityClass(e.tier)}`}>{tierName(e.tier)}</span>
            {rolled ? <span className="mx-nowrap">1 IN {formatNum(oneInX(e.id))}</span> : null}
          </div>
          {tag ? <div className="mx-sheet-stat">{tag}</div> : null}
          {perk ? <div className="mx-sheet-perk">{perk}</div> : null}
          {flavour ? <div className="mx-sheet-flavour" data-testid="mark-flavour">{flavour}</div> : null}
          {!have && howTo ? <div className="mx-howto">{howTo}</div> : null}
          {rolled && have ? (
            <div className="mx-sheet-facts">
              <span data-testid="mark-owned">OWNED ×{formatNum(info.owned)}</span>
              {info.firstRoll ? <span data-testid="mark-first-roll">FIRST ROLL #{formatNum(info.firstRoll)}</span> : null}
            </div>
          ) : null}
          {have && (onReplay || onSet) ? (
            <div className="mx-sheet-actions">
              {rolled && onReplay ? (
                <button type="button" className="mx-replay" onClick={() => onReplay(e.id)}>REPLAY</button>
              ) : null}
              {onSet ? (
                <button type="button" className={`mx-set${on ? ' is-on' : ''}`} onClick={() => onSet(on ? null : e.id)}>
                  {on ? 'YOUR MAIN — TAKE OFF' : 'SET AS MAIN'}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
        {have ? <RarityFx key={e.id} tier={e.tier} /> : null}
      </div>
    </div>
  );
}

export default function MarksIndex({
  onClose, onReplay, unlockedIds = [], equippedId = null, achievementNames = {}, level = 1, earned = [], onEquip,
}) {
  const compat = typeof onReplay !== 'function'; // hosted by the menu's MARKS button: keep the ROLL panel here
  // `landed` ticks when a roll's reveal lands — the ONLY time this screen re-reads storage
  const [landed, setLanded] = useState(0);
  const idsRef = useRef(unlockedIds);
  idsRef.current = unlockedIds;
  const snap = useMemo(() => {
    const ids = idsRef.current;
    return { unlocked: new Set(ids), view: viewState(ids), permOwned: new Set(permanentOwnedIds()) };
  }, [landed]); // eslint-disable-line react-hooks/exhaustive-deps -- re-read storage ONLY when a reveal lands
  const { unlocked, view, permOwned } = snap;
  const entries = useMemo(() => buildEntries(unlocked), [unlocked]);
  const ownsId = (id, kind) => (kind === 'roll' ? markLevel(view, id).copies > 0 || unlocked.has(id) : kind === 'perm' ? permOwned.has(id) || unlocked.has(id) : unlocked.has(id));
  const owns = (e) => ownsId(e.id, e.kind);
  const [worn, setWorn] = useState(equippedId);
  useEffect(() => { setWorn(equippedId); }, [equippedId]);
  const [sel, setSel] = useState(null);
  const [coverHost, setCoverHost] = useState(null);
  const [tut, setTut] = useState(() => compat && !hasSeenTutorial('markRolls'));
  const reduced = useReducedMotion();
  const closeRef = useRef(null);
  const selRef = useRef(sel);
  selRef.current = sel;
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (ev) => {
      if (ev.key !== 'Escape') return;
      if (selRef.current) setSel(null); // the open sheet closes first
      else if (onClose) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const set = onEquip ? (id) => {
    const w = wearMark(id, earned);
    setWorn(w);
    onEquip(w);
  } : null;
  const col = collection(view);
  const tiers = tierCompletion(view, (id) => ownsId(id, 'roll'));
  const selE = sel ? entries.find((e) => e.id === sel) : null;
  const tutDef = TUTORIALS.find((t) => t.id === 'markRolls');

  return (
    <div className="marks-overlay mx-overlay" role="dialog" aria-modal="true" aria-label="Index" ref={setCoverHost}>
      <div className={`mx-panel${compat ? ' is-compat' : ''}`}>
        <div className="mx-head">
          <h2 className="mx-title">INDEX</h2>
          {/* per-rarity completion, by COLOUR: each chip fills in its tier colour as you collect; complete = solid */}
          <div className="mx-tiers" data-testid="marks-collected" data-pct={Math.round(col.pct)} role="list">
            {tiers.map((t) => (
              <span
                key={t.tier}
                role="listitem"
                className={`mx-tierchip ${rarityClass(t.tier, { tint: !t.complete })}${t.complete ? ' is-complete' : ''}`}
                data-tier={t.tier}
                aria-label={`${tierName(t.tier)} ${formatNum(t.owned)}/${formatNum(t.total)}`}
              >
                <span className="mx-tierchip-fill" style={{ transform: `scaleX(${t.total ? t.owned / t.total : 0})` }} aria-hidden="true" />
                <span className="mx-tierchip-num">{formatNum(t.owned)}/{formatNum(t.total)}</span>
                {t.complete ? <RarityFx tier={t.tier} particles={false} /> : null}
              </span>
            ))}
          </div>
          <button type="button" className="mx-close marks-close" onClick={onClose} aria-label="Close" ref={closeRef}>✕</button>
        </div>
        {compat ? (
          <div className="mx-roll-slot">
            <RollPanel
              level={level}
              view={view}
              worn={worn}
              earned={earned}
              reduced={reduced}
              coverHost={coverHost}
              onRolled={(res, wornNow) => {
                setLanded((n) => n + 1);
                if (wornNow) { setWorn(wornNow); onEquip && onEquip(wornNow); }
              }}
            />
          </div>
        ) : null}
        <div className="mx-grid" role="list">
          {entries.map((e) => {
            const have = owns(e);
            const on = worn === e.id;
            const rolled = e.kind === 'roll';
            const lv = rolled && have ? markLevel(view, e.id) : null;
            const pips = lv ? { pips: lv.pips, have: lv.have, need: lv.need } : null;
            // the FOUR things: name · rarity · 1 IN X · stat (locked: rarity · 1 IN X; PERMANENT: its task)
            const odds = rolled ? `1 IN ${formatNum(oneInX(e.id))}` : '';
            const stat = have ? (rolled ? statLine(e.id, view) : mainTag(e.id, view)) : '';
            const task = !have && e.kind === 'perm' ? ACH_HINT[e.from] || achievementNames[e.from] || '' : '';
            return (
              <button
                key={e.id}
                type="button"
                role="listitem"
                className={`mx-tile ${rarityClass(e.tier, { tint: true })}${have ? '' : ' is-locked'}${on ? ' is-on' : ''}${e.kind === 'perm' ? ' is-perm' : ''}`}
                aria-label={`${have ? `${e.name}, ` : ''}${tierName(e.tier)}${odds ? `, ${odds}` : ''}${have ? '' : ', locked'}${on ? ', your main' : ''}`}
                aria-haspopup="dialog"
                data-mark={e.id}
                data-tier={e.tier}
                onClick={() => setSel(e.id)}
              >
                <Art e={e} have={have} size={64} pips={pips} view={view} />
                {have ? <span className="mx-tile-name">{e.name}</span> : null}
                <span className="mx-tile-tier">{tierName(e.tier)}</span>
                {odds ? <span className="mx-tile-odds">{odds}</span> : null}
                {stat ? <span className="mx-tile-sub">{stat}</span> : null}
                {task ? <span className="mx-tile-sub is-task">{task}</span> : null}
                {on && <span className="mx-tile-main">MAIN</span>}
                {have ? <RarityFx tier={e.tier} /> : null}
              </button>
            );
          })}
        </div>
      </div>
      {selE ? (
        <Sheet
          key={selE.id}
          e={selE}
          have={owns(selE)}
          on={worn === selE.id}
          view={view}
          howTo={selE.kind === 'perm' ? ACH_HINT[selE.from] || achievementNames[selE.from] || selE.from : ''}
          onSet={set}
          onReplay={compat ? null : onReplay}
          onClose={() => setSel(null)}
        />
      ) : null}
      {tut && tutDef && (
        <UnlockTutorial tutorial={tutDef} onDone={() => { markTutorialSeen('markRolls'); setTut(false); }} />
      )}
    </div>
  );
}
