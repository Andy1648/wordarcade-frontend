// MenuNav.jsx — the v2 MENU's chrome (claude/mockups/v2/Menu.dc.html), shared by both menu trees:
//   MenuIcons   the top-right LEADERBOARD / ACHIEVEMENTS tiles (KitIconButton)
//   MenuRail    the left column: the WINS + GEMS pills (KitPill) over the UPGRADES | GEARS / REBIRTH | STATS
//               rail (KitRailButton). NIGHT oct8 #2: GEARS = ROLL + INDEX merged (it opens the ROLL screen, whose
//               INDEX button is the index's door); STATS moved down from the top-right. Andy oct6 SEASON 2 #5: all four show FROM THE START — a gated one is
//               LOCKED (padlock + its gate, "R2" / "LV10") — and each carries a LIVE value line.
//   MenuMarkChip the worn mark — its NAME only, a purple stripe (Andy oct5: the stat lives on ROLL / INDEX);
//               nothing worn → "ROLL" + a notification dot (opens the ROLL screen)
// Kit components only, imported file by file (the kit barrel would drag every kit stylesheet into the
// homepage chunk). Each control is a real <button> (≥ 44px) carrying data-nav="<id>" — the one hook
// focus-restore and the e2e specs use, at either width (React 18: the kit buttons take no ref).
import { KitIconButton, KitRailButton } from './kit/KitNavButton.jsx';
import FitText from './kit/FitText.jsx';
import { KitPill } from './kit/KitPill.jsx';
import { formatNum } from '../format';
import { lazy, Suspense, useEffect, useRef } from 'react';
import { CARD_RAR } from './markCard/palette.js';
import { mainTag, critTierOf } from '../progress/markRollsCore';
import { IDLE_SHEEN_TIERS, GLOW_TIERS } from './markCard/idleSheen.js';
import { useReduceMotion } from '../lib/useReduceMotion';
// The cog + glyph art is the INDEX chunk's (MarkBadge, ~11 KB): the gear slot loads it only once a mark is worn —
// payload ratchet (e2e/payload-budget.spec.js). Until it lands, the dashed hole holds the spot.
const MarkBadge = lazy(() => import('./MarkBadge.jsx'));
// the crit line's WORDS (critText) stay lazy too — loaded only when the worn gear has a crit rate
const GearSlotCrit = lazy(() => import('./GearSlotCrit.jsx'));
// the EPIC+ glow (aura + motes, Andy oct9 "clash royale cards") — code and art load only when such a gear is worn
const GearFx = lazy(() => import('./GearFx.jsx'));

/** Focus the control `id` inside `root` (App's overlay-return a11y — see Homepage). */
export function focusNav(root, id) {
  const el = root && root.querySelector(`[data-nav="${id}"]`);
  if (el) el.focus();
}

export function MenuIcons({ board, ach, achSlot = null, settingsSlot = null, navigating }) {
  return (
    <div className="hp-icons" role="group" aria-label="Records">
      {board && (
        <KitIconButton
          icon="leaderboard"
          tone="yellow"
          className="homepage-nav-btn hp-m-navbtn is-board"
          data-nav="leaderboard"
          tag={board.rank ? `#${formatNum(board.rank)}` : undefined}
          dot={board.news || undefined}
          disabled={navigating}
          onClick={board.onClick}
          ariaLabel={`Open leaderboard${board.myRank ? ` — you're #${formatNum(board.myRank)}` : ''}${board.news ? ' — your rank went up' : ''}`}
          title="Leaderboard"
        />
      )}
      {achSlot || <KitIconButton
        icon="achievements"
        tone="gold"
        className="hp-ico is-ach"
        data-nav="achievements"
        dot={ach.count > 0 ? ach.count : undefined}
        disabled={navigating}
        onClick={ach.onClick}
        ariaLabel={ach.count > 0 ? `Open achievements — ${formatNum(ach.count)} to claim` : 'Open achievements'}
        title="Achievements"
      />}
      {/* SETTINGS (Andy oct9 "top right placement instead"): the cog joins this cluster as its last tile */}
      {settingsSlot}
    </div>
  );
}

// row one UPGRADES | GEARS, row two REBIRTH | STATS (DOM order = reading order; the phone row keeps it too)
const RAIL = [
  { id: 'shop', label: 'UPGRADES', tone: 'yellow' },
  { id: 'gears', label: 'GEARS', tone: 'cyan' },
  { id: 'rebirth', label: 'REBIRTH', tone: 'purple' },
  { id: 'stats', label: 'STATS', tone: 'pink' },
];
const ARIA = { shop: 'Open upgrades', gears: 'Open gears — roll and index', rebirth: 'Open rebirth', stats: 'Open stats' };
const DOT_SAYS = { shop: ' — items available', gears: ' — a roll is ready or a new gear', rebirth: ' — ready', stats: '' };
const NAME = { shop: 'Upgrades', gears: 'Gears', rebirth: 'Rebirth', stats: 'Stats' };
/** "R2" → "rebirth 2", "LV10" → "level 10" (the locked button's spoken gate). */
function sayGate(g) {
  const m = /^(R|LV)\s*([\d,.]+[KMB]?)$/i.exec(String(g || ''));
  if (!m) return String(g || '');
  return `${m[1].toUpperCase() === 'R' ? 'rebirth' : 'level'} ${m[2]}`;
}

/**
 * @param items  { shop, gears, rebirth, stats }: each { onClick, dot, value, valueSays, locked } or null (not rendered).
 *               `value` = the live line under the label; `locked` = its gate ("R2" / "LV10") while it is closed.
 * @param wins / gems  balances; gems null hides its pill (MARKS not revealed yet)
 * @param extra  rendered after the pills (the phone puts CREDITS there)
 */
export function MenuRail({ items, wins, gems, navigating, className = '', extra = null, foot = null }) {
  return (
    <nav className={`homepage-corner-nav hp-rail ${className}`} aria-label="Menu">
      <KitPill kind="wins" value={wins} className="menu-wins-chip" />
      {gems != null && <KitPill kind="gems" value={gems} className="menu-gems-chip" />}
      {extra}
      <span className="hp-rail-gap" aria-hidden="true" />
      {RAIL.map(({ id, label, tone }) => {
        const it = items[id];
        if (!it) return null;
        const locked = it.locked || null;
        const aria = locked
          ? `${NAME[id]} — locked, unlocks at ${sayGate(locked)}`
          : `${ARIA[id]}${it.valueSays ? ` — ${it.valueSays}` : ''}${it.dot ? DOT_SAYS[id] : ''}`;
        return (
          <KitRailButton
            key={id}
            icon={id}
            label={label}
            tone={tone}
            dot={!!it.dot}
            value={it.value}
            locked={locked}
            className={`hp-nav homepage-nav-btn is-${id}${id === 'rebirth' && it.dot ? ' is-ready' : ''}`}
            data-nav={id}
            data-locked={locked ? '' : undefined}
            disabled={navigating}
            onClick={it.onClick}
            onMouseEnter={locked ? undefined : it.onHover}
            aria-label={aria}
          />
        );
      })}
      {foot}
    </nav>
  );
}

/**
 * YOUR GEAR (feat/menu-perrow, Andy oct6 "a floating mark icon nobody knows to click"): the worn mark as a labelled
 * SLOT at the foot of the rail — the cog, the stat's NUMBER big ("×3"), WHAT it boosts under it ("WINS"), the crit
 * rate as one compact line when the gear has one, the gear's name small in its tier colour.
 * Andy oct9 ("add a glow or smthn to rarer gears … clicking the 'your gear' should show the gear stats"):
 *   - RARITY is the frame, not a glow (flat rule): the border and the hard offset shadow take the tier colour, rare
 *     quiet → mythic loud (Homepage.css `.hp-gear[data-tier]`); LEGENDARY+ also catch the INDEX's one-shot sheen.
 *   - a tap opens the EQUIP screen (Homepage → EquipScreen, Andy oct9 22:56); a save with no gear at all → NONE /
 *     ROLL FOR ONE + a dot, and the ROLL screen.
 */
/** "+28 BASE WINS/WORD" → { big: "+28", unit: "BASE WINS/WORD" } — split at the first space, exactly as the GEAR
 *  SHEET's splitTag (markCard/cardModel.js), so the slot's number and words are the sheet's. */
export function gearSplit(text) {
  const s = String(text || '').trim();
  const ev = /^(EVERY \S+) (.+)$/.exec(s); // "EVERY 4TH KEY CRITS" → EVERY 4TH · KEY CRITS (as splitTag)
  if (ev) return { big: ev[1], unit: ev[2] };
  const i = s.indexOf(' ');
  return i < 0 ? { big: s, unit: '' } : { big: s.slice(0, i), unit: s.slice(i + 1) };
}

/**
 * THE YOUR GEAR SHOWCASE (gear UI v3, Andy oct9 22:56 "make the menu 'your gear' animation even more attractive (for
 * legendary ones)"): EPIC+ worn gears perform once every ~6.5–8 s — aura flare + mote burst, glyph pop, sheen sweep,
 * stat punch (gearShowcase.js, lazy: loaded only once such a gear is worn). Finite WAAPI one-shots on one setTimeout
 * chain, never a CSS loop. REDUCE MOTION: never started — the slot is static.
 */
function useGearShowcase(slotRef, tier, enabled) {
  useEffect(() => {
    const el = slotRef.current;
    if (!enabled || !el || !tier) return undefined;
    let live = true;
    let stop = null;
    import('./gearShowcase.js').then((m) => { if (live) stop = m.startShowcase(el, tier); }, () => {});
    return () => { live = false; if (stop) stop(); };
  }, [slotRef, tier, enabled]);
}

export function MenuGearSlot({ mark, onClick, disabled }) {
  const tier = mark ? (CARD_RAR[mark.tier] ? mark.tier : 'rare') : null;
  const rar = tier ? CARD_RAR[tier] : null;
  // the stat as it PAYS (markRollsCore.mainTag — the payout's own statOf), never a legacy blurb sentence
  const stat = mark ? gearSplit(mainTag(mark.id) || mark.blurb || mark.name) : null;
  const crit = mark ? critTierOf(mark.id) : null;
  const hasCrit = !!(crit && crit.rate > 0);
  const reduced = useReduceMotion();
  const sheen = !!mark && IDLE_SHEEN_TIERS.has(tier);
  const slotRef = useRef(null);
  useGearShowcase(slotRef, mark && GLOW_TIERS.has(tier) ? tier : null, !reduced);
  return (
    <button
      ref={slotRef}
      type="button"
      className={`hp-gear menu-mark${mark ? ' is-worn' : ' is-empty'}`}
      data-tier={tier || undefined}
      style={rar ? { '--gear-line': rar.line, '--gear-edge': rar.edge, '--gear-fill': rar.fill } : undefined}
      onClick={onClick}
      disabled={disabled}
      data-nav="gear"
      aria-haspopup={mark ? 'dialog' : undefined}
      aria-label={mark ? `Your gear: ${mark.name}, ${tier}, ${stat.big} ${stat.unit}. Open your gear` : 'Your gear: none. Open your gear'}
    >
      {mark && GLOW_TIERS.has(tier) ? <Suspense fallback={null}><GearFx tier={tier} /></Suspense> : null}
      {sheen ? <span className="hp-gear-sheen" aria-hidden="true"><img className="hp-gear-sheen-band" src="/fx/sheen.svg" alt="" draggable="false" /></span> : null}
      {/* the SHOWCASE's one-shot layers (LEGENDARY+, gearShowcase.js): a tier-colour FLASH over the face and a burst
          RING behind the glyph — opacity 0 at rest, nothing moves until a run */}
      {sheen ? <span className="hp-gear-flash" aria-hidden="true" /> : null}
      <span className="hp-gear-label">YOUR GEAR</span>
      <span className="hp-gear-body">
        {mark ? (
          <span className="hp-gear-art">
            {sheen ? <span className="hp-gear-ring" aria-hidden="true" /> : null}
            <Suspense fallback={<span className="hp-gear-hole" aria-hidden="true" />}>
              <MarkBadge mark={mark} size={56} className="hp-gear-cog" />
            </Suspense>
          </span>
        ) : <span className="hp-gear-hole" aria-hidden="true" />}
        <span className="hp-gear-text">
          {/* the NUMBER big ("×3"), WHAT it boosts under it ("WINS") — the sheet's MAIN STAT, small; FitText is the
              last guard against a long number */}
          <FitText className="hp-gear-big menu-mark-name">{mark ? stat.big : 'NONE'}</FitText>
          {mark && stat.unit ? <span className="hp-gear-unit">{stat.unit}</span> : null}
          {hasCrit ? (
            <Suspense fallback={<span className="hp-gear-crit" aria-hidden="true">&nbsp;</span>}>
              <GearSlotCrit id={mark.id} />
            </Suspense>
          ) : null}
          <span className="hp-gear-sub">{mark ? mark.name : 'ROLL FOR ONE'}</span>{/* the tier is the colour (Andy: colour is for rarity) */}
        </span>
      </span>
      {!mark && <span className="hp-chip-dot" aria-hidden="true" />}
    </button>
  );
}

/** The worn mark, NAME ONLY — or, while nothing is worn, "ROLL" + a notification dot (it opens the ROLL screen). It
 *  wears the YOUR GEAR slot's TIER FRAME (Andy oct9): the edge stripe, border and shadow in the tier colour. */
export function MenuMarkChip({ mark, onClick }) {
  const name = mark ? mark.name : 'ROLL';
  const tier = mark ? (CARD_RAR[mark.tier] ? mark.tier : 'rare') : null;
  const rar = tier ? CARD_RAR[tier] : null;
  return (
    <button
      type="button"
      className={`menu-mark hp-chip${mark ? '' : ' is-empty is-roll'}`}
      data-tier={tier || undefined}
      style={rar ? { '--gear-line': rar.line, '--gear-edge': rar.edge, '--gear-fill': rar.fill } : undefined}
      onClick={onClick}
      aria-haspopup={mark ? 'dialog' : undefined}
      data-nav="gear"
      aria-label={mark ? `Gear equipped: ${mark.name}, ${tier}. Open your gear` : 'No gear equipped. Open your gear'}
    >
      <span className="hp-chip-edge" aria-hidden="true" />
      <span className="menu-mark-name">{name}</span>
      {!mark && <span className="hp-chip-dot" aria-hidden="true" />}
    </button>
  );
}
