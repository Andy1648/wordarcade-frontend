// MenuNav.jsx — the v2 MENU's chrome (claude/mockups/v2/Menu.dc.html), shared by both menu trees:
//   MenuIcons   the top-right LEADERBOARD / STATS / ACHIEVEMENTS tiles (KitIconButton)
//   MenuRail    the left column: the WINS + GEMS pills (KitPill) over the UPGRADES / ROLL / INDEX / REBIRTH
//               rail (KitRailButton). Andy oct6 SEASON 2 #5: all four show FROM THE START — a gated one is
//               LOCKED (padlock + its gate, "R2" / "LV10") — and each carries a LIVE value line.
//   MenuMarkChip the worn mark — its NAME only, a purple stripe (Andy oct5: the stat lives on ROLL / INDEX);
//               nothing worn → "ROLL" + a notification dot (opens the ROLL screen)
// Kit components only, imported file by file (the kit barrel would drag every kit stylesheet into the
// homepage chunk). Each control is a real <button> (≥ 44px) carrying data-nav="<id>" — the one hook
// focus-restore and the e2e specs use, at either width (React 18: the kit buttons take no ref).
import { KitIconButton, KitRailButton } from './kit/KitNavButton.jsx';
import { KitPill } from './kit/KitPill.jsx';
import { formatNum } from '../format';
import MarkBadge from './MarkBadge.jsx';
import { CARD_RAR } from './markCard/palette.js';

/** Focus the control `id` inside `root` (App's overlay-return a11y — see Homepage). */
export function focusNav(root, id) {
  const el = root && root.querySelector(`[data-nav="${id}"]`);
  if (el) el.focus();
}

export function MenuIcons({ board, onStats, ach, achSlot = null, navigating }) {
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
      <KitIconButton icon="stats" tone="cyan" className="hp-ico homepage-nav-btn is-stats" data-nav="stats" disabled={navigating} onClick={onStats} ariaLabel="Open stats" title="Stats" />
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

const RAIL = [
  { id: 'shop', label: 'UPGRADES', tone: 'yellow' },
  { id: 'roll', label: 'ROLL', tone: 'cyan' },
  { id: 'index', label: 'INDEX', tone: 'pink' },
  { id: 'rebirth', label: 'REBIRTH', tone: 'purple' },
];
const ARIA = { shop: 'Open upgrades', roll: 'Open roll', index: 'Open the marks index', rebirth: 'Open rebirth' };
const DOT_SAYS = { shop: ' — items available', roll: ' — a roll is ready', index: ' — a new mark', rebirth: ' — ready' };
const NAME = { shop: 'Upgrades', roll: 'Roll', index: 'Marks index', rebirth: 'Rebirth' };
/** "R2" → "rebirth 2", "LV10" → "level 10" (the locked button's spoken gate). */
function sayGate(g) {
  const m = /^(R|LV)\s*([\d,.]+[KMB]?)$/i.exec(String(g || ''));
  if (!m) return String(g || '');
  return `${m[1].toUpperCase() === 'R' ? 'rebirth' : 'level'} ${m[2]}`;
}

/**
 * @param items  { shop, roll, index, rebirth }: each { onClick, dot, value, valueSays, locked } or null (not rendered).
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
      {foot}
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
    </nav>
  );
}

/**
 * YOUR GEAR (feat/menu-perrow, Andy oct6 "a floating mark icon nobody knows to click"): the worn mark as a labelled
 * SLOT at the foot of the rail — the cog, the stat big ("×1.5 WINS"), the name · tier small in the tier colour.
 * Nothing worn → NONE / ROLL FOR ONE + a notification dot. Opens the ROLL screen either way.
 */
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
        {mark ? <MarkBadge mark={mark} size={56} className="hp-gear-cog" /> : <span className="hp-gear-hole" aria-hidden="true" />}
        <span className="hp-gear-text">
          <span className="hp-gear-big menu-mark-name">{mark ? mark.blurb || mark.name : 'NONE'}</span>
          <span className="hp-gear-sub">{mark ? `${mark.name} · ${String(mark.tier).toUpperCase()}` : 'ROLL FOR ONE'}</span>
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
