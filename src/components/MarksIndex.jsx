// MarksIndex.jsx — the INDEX, ROLL v1 (Andy oct5 mockup claude/mockups/roll-v1/Index.dc.html: "this is gold").
// The COLLECTION only — ROLL vs INDEX are TWO screens, never mixed (Andy oct5): no roll buttons, no pity, no gems, no
// REPLAY. Rolling lives on the ROLL screen (rollScreen/RollScreen.jsx), one "← ROLL" away.
//
//   head   ← ROLL · INDEX n/N · one chip per rarity (the tier's colour bar + owned/total; solid when complete)
//   grid   every mark as its CARD (markCard/MarkCard.jsx): rollable common → secret, then PERMANENT, then a retired
//          mark the save still owns. Nothing under a card (R2 oct8 #5: no ★ lines — rarity is COLOUR, dupes are the
//          card's own small ×N; the "7/10 → ★3" progress lives in the detail sheet). The worn MAIN wears a sticker.
//   LOCKED a HIDDEN design (GEAR TILE v2, Andy oct9): a black silhouette of the mark's own glyph in its tier-coloured
//          cog, "???", its odds as the hero and a "?" pip per hidden extra stat — no stat value (an EARNED gear: a lock
//          + ACHIEVEMENT; the task that earns it is in the detail sheet only).
//   sheet  tap a card → the detail (GearSheet.jsx — the menu's YOUR GEAR slot opens the same one), GEAR SHEET v2 (Andy oct9 — the Genshin artifact panel): the card, then the MAIN
//          STAT biggest, the extra stats as a quiet list, the PERK in its own cyan panel, flavour, odds + ★ progress,
//          owned ×N / first roll #, SET AS MAIN. LOCKED: rarity · LOCKED, the odds + ROLL TO UNLOCK (an EARNED gear:
//          ACHIEVEMENT + its task) and only the COUNT of what is hidden ("2 EXTRA STATS · 1 PERK") — no values. The engine pays the INDEX rewards (new mark / ★ / tier complete) — this screen never states
//          an amount, so it can never claim more than it pays.
//
// PROPS (the ROLL screen opens this from its INDEX button):
//   onClose()           back to the ROLL screen
//   unlockedIds, equippedId, earned, onEquip   optional — the owned set / worn MAIN; with onEquip the detail can
//                       SET AS MAIN. achievementNames names a locked PERMANENT's task (detail only).
//
// NO SPOILERS: storage is snapshotted on mount (the ROLL screen remounts this layer each time it opens it).
// Motion: the sheet pops in once and its card plays its reveal one-shots (cog spin, shine) once; cards spin their cog
// on hover; nothing loops; reduced motion shows the same states still.
import { useEffect, useMemo, useRef, useState } from 'react';
import { markProgress, markById } from '../progress/marks';
import { ACHIEVEMENTS } from '../progress/achievements';
import {
  ROLL_MARKS, PERMANENT_MARKS, RETIRED_MARK_IDS, ROLLABLE_TIERS, viewState, markLevel, oneInX, collection,
  permanentOwnedIds, completedTiers,
} from '../progress/markRolls';
import { wearMark } from '../progress/markRollShop';
import { registerMarkGlyphs } from './MarkBadge';
import { ROLLED_GLYPHS, GLYPH_FINISH } from './markGlyphsRolled.jsx';
import MarkCard from './markCard/MarkCard';
import GearSheet from './GearSheet';
import GearFx from './GearFx';
import { GLOW_TIERS } from './markCard/idleSheen.js';
import { CARD_RAR } from './markCard/palette.js';
import { tierLabel } from './markCard/cardModel.js';
import { formatNum } from '../format';
import { useReduceMotion } from '../lib/useReduceMotion';
import { IDLE_SHEEN_TIERS, IDLE_SHEEN_EVERY_MS, IDLE_SHEEN_MS, nextIdleSheen } from './rollScreen/revealPlan.js';
import './MarksIndex.css';

registerMarkGlyphs(ROLLED_GLYPHS, GLYPH_FINISH);

// a locked PERMANENT says the TASK (the achievement's hint), as the old index did — in the detail sheet only
const ACH_HINT = Object.fromEntries(
  ACHIEVEMENTS.map((a) => [a.id, a.secret ? a.name : String(a.hint || a.name || '').replace(/\.$/, '').toUpperCase()]),
);
const TILE_PARTS = { tier: 'mx-tile-tier', odds: 'mx-tile-odds', name: 'mx-tile-name', stat: 'mx-tile-sub' };

/** Every mark the INDEX draws, in order: rollable (common → secret) with the EARNED gears right after the LEGENDARY
 *  ones (Andy oct8: "put them with the normal rarity gears" — they pay the LEGENDARY ×3 and draw as legendary, locked
 *  = ACHIEVEMENT REQUIRED), then retired-but-owned. */
function buildEntries(unlocked) {
  const out = [];
  const perms = PERMANENT_MARKS.filter((p) => !p.retired || unlocked.has(p.id)).map((p) => ({ id: p.id, name: p.name, tier: 'legendary', kind: 'perm', from: p.from }));
  const lastLeg = ROLL_MARKS.map((m) => m.tier).lastIndexOf('legendary');
  ROLL_MARKS.forEach((m, i) => {
    out.push({ id: m.id, name: m.name, tier: m.tier, kind: 'roll' });
    if (i === lastLeg) out.push(...perms);
  });
  if (lastLeg < 0) out.push(...perms);
  for (const id of RETIRED_MARK_IDS) {
    const m = markById(id);
    if (m && unlocked.has(id)) out.push({ id, name: m.name, tier: m.tier, kind: 'retired' });
  }
  return out;
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
/**
 * THE IDLE SHEEN (ROLL REVEAL v2): an owned LEGENDARY+ card catches the light — ONE card at a time, scheduled by ONE
 * shared timer (every IDLE_SHEEN_EVERY_MS), each sweep a finite WAAPI one-shot of the card's sheen band (transform).
 * Only cards on screen take a turn (an IntersectionObserver — no layout reads). Nothing loops in CSS; a hidden tab or
 * REDUCE MOTION gets none.
 */
function useIdleSheen(gridRef, enabled) {
  useEffect(() => {
    const grid = gridRef.current;
    if (!enabled || !grid || typeof grid.querySelectorAll !== 'function') return undefined;
    const bands = [...grid.querySelectorAll('.mc-sheen-band')];
    if (!bands.length) return undefined;
    const clips = bands.map((b) => b.parentElement);
    const visible = new Set();
    let io = null;
    if (typeof IntersectionObserver === 'function') {
      io = new IntersectionObserver((es) => {
        for (const e of es) { if (e.isIntersecting) visible.add(e.target); else visible.delete(e.target); }
      });
      clips.forEach((c) => io.observe(c));
    } else clips.forEach((c) => visible.add(c));
    let prev = -1;
    let timer = null;
    let run = null;
    const sweep = () => {
      timer = setTimeout(sweep, IDLE_SHEEN_EVERY_MS);
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      const i = nextIdleSheen(clips, visible, prev);
      if (i < 0) return;
      prev = i;
      const band = bands[i];
      if (typeof band.animate !== 'function') return;
      band.style.willChange = 'transform';
      run = band.animate([{ transform: 'translateX(-110%)' }, { transform: 'translateX(110%)' }], { duration: IDLE_SHEEN_MS, easing: 'cubic-bezier(.45,0,.25,1)' });
      const off = () => { band.style.willChange = ''; };
      run.finished.then(off, off);
    };
    timer = setTimeout(sweep, 1200); // the first sweep soon after the INDEX opens
    return () => {
      clearTimeout(timer);
      if (io) io.disconnect();
      if (run) { try { run.cancel(); } catch { /* gone */ } }
    };
  }, [gridRef, enabled]);
}

// a full-screen layer: the menu beneath never reacts to the pointer (see RollScreen stopMenuPointer)
const stopPointer = (e) => e.stopPropagation();
const rankOf = (id) => (markById(id) ? markProgress(id).rank : 1);

export default function MarksIndex({
  onClose, unlockedIds = [], equippedId = null, achievementNames = {}, earned = [], onEquip,
}) {
  const idsRef = useRef(unlockedIds);
  idsRef.current = unlockedIds;
  // storage is read ONCE, on mount — a re-render (a balance write behind) never moves a tile or a counter
  const [snap] = useState(() => {
    const ids = idsRef.current;
    return { unlocked: new Set(ids), view: viewState(ids), permOwned: new Set(permanentOwnedIds()) };
  });
  const { unlocked, view, permOwned } = snap;
  const entries = useMemo(() => buildEntries(unlocked), [unlocked]);
  const ownsId = (id, kind) => (kind === 'roll' ? markLevel(view, id).copies > 0 || unlocked.has(id) : kind === 'perm' ? permOwned.has(id) || unlocked.has(id) : unlocked.has(id));
  const owns = (e) => ownsId(e.id, e.kind);
  const [worn, setWorn] = useState(equippedId);
  useEffect(() => { setWorn(equippedId); }, [equippedId]);
  const [sel, setSel] = useState(null);
  const closeRef = useRef(null);
  const selRef = useRef(sel);
  selRef.current = sel;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    closeRef.current?.focus(); // once, on mount — never again on a parent re-render (a fresh onClose each time)
    const onKey = (ev) => {
      if (ev.key !== 'Escape') return;
      if (selRef.current) setSel(null); // the open sheet closes first
      else if (onCloseRef.current) onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const set = onEquip ? (id) => {
    const w = wearMark(id, earned);
    setWorn(w);
    onEquip(w);
  } : null;
  const col = collection(view);
  const tiers = tierCompletion(view, (id) => ownsId(id, 'roll'));
  const selE = sel ? entries.find((e) => e.id === sel) : null;
  const reduced = useReduceMotion();
  const gridRef = useRef(null);
  useIdleSheen(gridRef, !reduced);

  return (
    <div className="marks-overlay mx-overlay" role="dialog" aria-modal="true" aria-label="Index" onPointerMove={stopPointer} onMouseMove={stopPointer}>
      <div className="mx-panel">
        <div className="mx-head">
          <button type="button" className="mx-close marks-close mx-back" onClick={onClose} aria-label="Close" ref={closeRef}>← ROLL</button>
          <div className="mx-titlewrap">
            <h2 className="mx-title">INDEX</h2>
            <span className="mx-count">{formatNum(col.base)}/{formatNum(col.total)}</span>
          </div>
          {/* per-rarity completion: the tier's colour bar + owned/total on its card colour; complete = solid */}
          <div className="mx-tiers" data-testid="marks-collected" data-pct={Math.round(col.pct)} role="list">
            {tiers.map((t) => (
              <span
                key={t.tier}
                role="listitem"
                className={`mx-tierchip${t.complete ? ' is-complete' : ''}`}
                data-tier={t.tier}
                style={{ '--mx-line': CARD_RAR[t.tier].line, '--mx-fill': CARD_RAR[t.tier].fill }}
                aria-label={`${tierLabel(t.tier)} ${formatNum(t.owned)}/${formatNum(t.total)}`}
              >
                <span className="mx-tierchip-bar" aria-hidden="true" />
                <span className="mx-tierchip-num">{formatNum(t.owned)}/{formatNum(t.total)}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="mx-grid" role="list" ref={gridRef}>
          {entries.map((e) => {
            const have = owns(e);
            const on = worn === e.id;
            const rolled = e.kind === 'roll';
            const odds = rolled ? `1 IN ${formatNum(oneInX(e.id))}` : '';
            const shiny = !!(have && view && view.marks && view.marks[e.id] && view.marks[e.id].shiny);
            return (
              <div key={e.id} className="mx-cell" role="listitem">
                <button
                  type="button"
                  className={`mx-tile${have ? '' : ' is-locked'}${on ? ' is-on' : ''}${e.kind === 'perm' ? ' is-perm' : ''}`}
                  aria-label={`${have ? `${e.name}, ` : ''}${tierLabel(e.tier, e.kind)}${odds ? `, ${odds}` : ''}${have ? '' : ', locked'}${on ? ', your main' : ''}`}
                  aria-haspopup="dialog"
                  data-mark={e.id}
                  data-tier={e.tier}
                  data-earned={e.kind === 'perm' ? '' : undefined}
                  onClick={() => setSel(e.id)}
                >
                  {have && GLOW_TIERS.has(e.tier) ? <GearFx tier={e.tier} scale={0.6} /> : null}
                  <MarkCard
                    id={e.id} kind={e.kind} tier={e.tier} name={e.name} locked={!have} state={view} rank={rankOf(e.id)}
                    shiny={shiny} parts={TILE_PARTS} sheen={have && IDLE_SHEEN_TIERS.has(e.tier)}
                  />
                  {on && <span className="mx-tile-main">MAIN</span>}
                </button>
              </div>
            );
          })}
        </div>
      </div>
      {selE ? (
        <GearSheet
          key={selE.id}
          e={selE}
          have={owns(selE)}
          on={worn === selE.id}
          view={view}
          howTo={selE.kind === 'perm' ? ACH_HINT[selE.from] || achievementNames[selE.from] || selE.from : ''}
          onSet={set}
          onClose={() => setSel(null)}
        />
      ) : null}
    </div>
  );
}
