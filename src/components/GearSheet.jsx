// GearSheet.jsx — the GEAR SHEET v2 (Andy oct9 — the Genshin artifact panel), shared by the INDEX (a tap on any
// tile) and the EQUIP screen (EquipScreen.jsx, the menu's YOUR GEAR) — one sheet, one set of numbers. The card, then
// the gear's stat biggest, the extra stats, the PERK in its own cyan panel, flavour, odds + ★ progress, owned ×N /
// first roll #, and ONE big EQUIP / UNEQUIP button (Andy oct9 22:56: "instead of the word 'main' we'll just equip and
// unequip … no need to bombard with sentences everywhere or define crit"). LOCKED: rarity · LOCKED, the odds + ROLL TO
// UNLOCK (an EARNED gear: ACHIEVEMENT + its task) and only the COUNT of what is hidden ("2 EXTRA STATS · 1 PERK") —
// no values, and no EQUIP.
import { useEffect, useRef } from 'react';
import { markProgress, markById } from '../progress/marks';
import { indexEntry } from '../progress/markRolls';
import { flavourOf } from '../progress/markFlavour';
import { registerMarkGlyphs } from './MarkBadge';
import { ROLLED_GLYPHS, GLYPH_FINISH } from './markGlyphsRolled.jsx';
import MarkCard from './markCard/MarkCard';
import { CARD_RAR } from './markCard/palette.js';
import { cardModel, pipNext, pipsLabel, perkLines, tierLabel } from './markCard/cardModel.js';
import { formatNum } from '../format';
import GearFx from './GearFx';
import { GLOW_TIERS } from './markCard/idleSheen.js';
import './GearSheet.css';

registerMarkGlyphs(ROLLED_GLYPHS, GLYPH_FINISH);

const SHEET_PARTS = { head: 'mx-sheet-tier', name: 'mx-sheet-name', stat: 'mx-sheet-stat' };
const rankOf = (id) => (markById(id) ? markProgress(id).rank : 1);
const lineOf = (e) => (CARD_RAR[e.tier] || CARD_RAR.rare).line;

/**
 * e: { id, name, tier, kind: 'roll' | 'perm' | 'retired' } · have: owned · on: equipped · view: the roll state
 * (viewState) · howTo: a locked EARNED gear's task · onSet(id | null): EQUIP / UNEQUIP (omit → no button; a locked
 * gear never shows one).
 */
export default function GearSheet({ e, have, on, view, howTo, onSet, onClose }) {
  const closeRef = useRef(null);
  useEffect(() => { closeRef.current?.focus(); }, [e.id]);
  const rolled = e.kind === 'roll';
  const info = rolled ? indexEntry(e.id, view) : null;
  // the same model the card draws from: a LOCKED one carries no stat value at all (GEAR TILE v2)
  const c = cardModel({ id: e.id, kind: e.kind, tier: e.tier, name: e.name, locked: !have, state: view });
  const next = rolled && have ? pipNext(info) || (info && info.pips >= 5 ? '★5 MAX' : '') : '';
  const perks = have ? perkLines(e.id) : [];
  const flavour = have ? flavourOf(e.id) : '';
  const hidden = have ? '' : pipsLabel(c, { stars: false }); // "2 EXTRA STATS · 1 PERK" — counts, never values
  return (
    <div className="mx-sheet-layer" onClick={onClose}>
      <div
        className={`mx-sheet${have ? '' : ' is-locked'}`}
        role="dialog"
        aria-modal="true"
        aria-label={have ? e.name : tierLabel(e.tier, e.kind)}
        data-mark={e.id}
        style={{ '--mx-tier': lineOf(e) }}
        onClick={(ev) => ev.stopPropagation()}
      >
        <button type="button" className="mx-close mx-sheet-close" onClick={onClose} aria-label="Close" ref={closeRef}>✕</button>
        <div className="mx-sheet-card">
          {GLOW_TIERS.has(e.tier) ? <GearFx tier={e.tier} /> : null}
          <MarkCard
            id={e.id} kind={e.kind} tier={e.tier} name={e.name} locked={!have} state={view} rank={rankOf(e.id)}
            shiny={!!(info && info.shiny)} fx={have} parts={SHEET_PARTS}
          />
        </div>
        {/* GEAR SHEET v2 (Andy oct9 — the Genshin artifact panel): MAIN STAT biggest → the extra stats, quiet → the
            PERK in its own panel → odds + ★ progress → EQUIP / UNEQUIP. LOCKED: the odds as the main line, how to get it, and
            only the COUNT of what is hidden. */}
        <div className="mx-sheet-body">
          {have ? (
            <div className="mx-main" data-testid="mark-main">
              <span className="mx-main-num">{c.statNum}</span>
              {c.statKind ? <span className="mx-main-kind">{c.statKind}</span> : null}
            </div>
          ) : rolled ? (
            <div className="mx-main is-locked" data-testid="mark-main">
              <span className="mx-main-kick">{c.rarityName} · LOCKED</span>
              <span className="mx-main-num">{c.odds}</span>
              <span className="mx-main-kind">ROLL TO UNLOCK</span>
            </div>
          ) : (
            <div className="mx-main is-locked is-word" data-testid="mark-main">
              <span className="mx-main-kick">{c.rarityName} · LOCKED</span>
              <span className="mx-main-num">ACHIEVEMENT</span>
              {howTo ? <span className="mx-main-kind mx-howto">{howTo}</span> : null}
            </div>
          )}
          {c.critLines.length ? (
            <div className="mx-sheet-crit" data-testid="mark-crit">
              {c.critLines.map((l) => (
                <span key={l.id} className="mx-crit-line">
                  <span className="mx-crit-num">{l.num}</span> <span className="mx-crit-kind">{l.kind}</span>
                </span>
              ))}
            </div>
          ) : null}
          {hidden ? <div className="mx-hidden" data-testid="mark-hidden">{hidden}</div> : null}
          {perks.length ? (
            <div className="mx-sheet-perk" data-testid="mark-perk">
              <span className="mx-perk-kick">PERK{perks.length > 1 ? 'S' : ''}</span>
              {perks.map((p) => <span key={p} className="mx-perk-line">{p}</span>)}
            </div>
          ) : null}
          {flavour ? <div className="mx-sheet-flavour" data-testid="mark-flavour">{flavour}</div> : null}
          {have && (c.odds || next) ? (
            <div className="mx-sheet-odds">
              {c.odds ? (
                <span className="mx-fact">
                  <span className="mx-odds" data-testid="mark-odds">{c.odds}</span>
                  <span className="mx-fact-k">{rolled ? 'ODDS' : 'ACHIEVEMENT'}</span>
                </span>
              ) : null}
              {next ? (
                <span className="mx-fact">
                  <span className="mx-pips-text">{next}</span>
                  <span className="mx-fact-k">DUPES</span>
                </span>
              ) : null}
            </div>
          ) : null}
          {rolled && have ? (
            <div className="mx-sheet-facts">
              <span data-testid="mark-owned">OWNED ×{formatNum(info.owned)}</span>
              {info.firstRoll ? <span data-testid="mark-first-roll">FIRST ROLL #{formatNum(info.firstRoll)}</span> : null}
            </div>
          ) : null}
          {have && onSet ? (
            <div className="mx-sheet-actions">
              <button type="button" className={`mx-set${on ? ' is-on' : ''}`} data-testid="gear-equip" onClick={() => onSet(on ? null : e.id)}>
                {on ? 'UNEQUIP' : 'EQUIP'}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
