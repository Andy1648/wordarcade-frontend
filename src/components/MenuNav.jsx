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
import { lazy, Suspense } from 'react';
import { CARD_RAR } from './markCard/palette.js';
// The cog + glyph art is the INDEX chunk's (MarkBadge, ~11 KB): the gear slot loads it only once a mark is worn —
// payload ratchet (e2e/payload-budget.spec.js). Until it lands, the dashed hole holds the spot.
const MarkBadge = lazy(() => import('./MarkBadge.jsx'));

/** Focus the control `id` inside `root` (App's overlay-return a11y — see Homepage). */
export function focusNav(root, id) {
  const el = root && root.querySelector(`[data-nav="${id}"]`);
  if (el) el.focus();
}

export function MenuIcons({ board, ach, achSlot = null, navigating }) {
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
 * SLOT at the foot of the rail — the cog, the stat big ("×1.5 WINS"), the name · tier small in the tier colour.
 * Nothing worn → NONE / ROLL FOR ONE + a notification dot. Opens the ROLL screen either way.
 */
/** "+28 BASE WINS/WORD" → { big: "+28", unit: "BASE WINS/WORD" }; "×2 WINS + XP" → { big: "×2", unit: "WINS + XP" }. */
export function gearSplit(text) {
  const m = /^([+×x]?[\d.,]+[A-Za-z%]{0,2}s?)\s+(.+)$/.exec(String(text || '').trim());
  return m ? { big: m[1], unit: m[2] } : { big: String(text || ''), unit: '' };
}

export function MenuGearSlot({ mark, onClick, disabled }) {
  const rar = mark ? CARD_RAR[mark.tier] || CARD_RAR.common : null;
  return (
    <button
      type="button"
      className={`hp-gear menu-mark${mark ? ' is-worn' : ' is-empty'}`}
      style={rar ? { '--gear-line': rar.line } : undefined}
      onClick={onClick}
      disabled={disabled}
      data-nav="gear"
      aria-label={mark ? `Your gear: ${mark.name}, ${mark.tier}, ${mark.blurb || ''}. Open roll` : 'Your gear: none. Roll for one'}
    >
      <span className="hp-gear-label">YOUR GEAR</span>
      <span className="hp-gear-body">
        {mark ? (
          <Suspense fallback={<span className="hp-gear-hole" aria-hidden="true" />}>
            <MarkBadge mark={mark} size={56} className="hp-gear-cog" />
          </Suspense>
        ) : <span className="hp-gear-hole" aria-hidden="true" />}
        <span className="hp-gear-text">
          {/* Andy oct9 ("gear just goes into the Word Bomb card"): the stat's NUMBER is the big line ("+28", "×2"), its
              unit a small line under it ("BASE WINS/WORD"), so a long stat never runs out of the slot; FitText is the
              last guard. */}
          <FitText className="hp-gear-big menu-mark-name">{mark ? gearSplit(mark.blurb || mark.name).big : 'NONE'}</FitText>
          {mark && gearSplit(mark.blurb || mark.name).unit && <span className="hp-gear-unit">{gearSplit(mark.blurb || mark.name).unit}</span>}
          <span className="hp-gear-sub">{mark ? mark.name : 'ROLL FOR ONE'}</span>{/* the tier is the colour (Andy: colour is for rarity) */}
        </span>
      </span>
      {!mark && <span className="hp-chip-dot" aria-hidden="true" />}
    </button>
  );
}

/** The worn mark, NAME ONLY — or, while nothing is worn, "ROLL" + a notification dot (it opens the ROLL screen). */
export function MenuMarkChip({ mark, onClick }) {
  const name = mark ? mark.name : 'ROLL';
  return (
    <button
      type="button"
      className={`menu-mark hp-chip${mark ? '' : ' is-empty is-roll'}`}
      onClick={onClick}
      aria-label={mark ? `Mark equipped: ${mark.name}` : 'No mark worn. Roll for a mark'}
    >
      <span className="hp-chip-edge" aria-hidden="true" />
      <span className="menu-mark-name">{name}</span>
      {!mark && <span className="hp-chip-dot" aria-hidden="true" />}
    </button>
  );
}
