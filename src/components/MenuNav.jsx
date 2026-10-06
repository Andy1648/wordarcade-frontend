// MenuNav.jsx — the v2 MENU's chrome (claude/mockups/v2/Menu.dc.html), shared by both menu trees:
//   MenuIcons   the top-right LEADERBOARD / STATS / ACHIEVEMENTS tiles (KitIconButton)
//   MenuRail    the left column: the WINS + GEMS pills (KitPill) over the SHOP / ROLL / INDEX / REBIRTH
//               rail (KitRailButton)
//   MenuMarkChip the worn mark — its NAME only, a purple stripe (Andy oct5: the stat lives on ROLL / INDEX)
// Kit components only, imported file by file (the kit barrel would drag every kit stylesheet into the
// homepage chunk). Each control is a real <button> (≥ 44px) carrying data-nav="<id>" — the one hook
// focus-restore and the e2e specs use, at either width (React 18: the kit buttons take no ref).
import { useEffect, useRef } from 'react';
import { KitIconButton, KitRailButton } from './kit/KitNavButton.jsx';
import { KitPill } from './kit/KitPill.jsx';
import { formatNum } from '../format';

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
  { id: 'shop', label: 'SHOP', tone: 'yellow' },
  { id: 'roll', label: 'ROLL', tone: 'cyan' },
  { id: 'index', label: 'INDEX', tone: 'pink' },
  { id: 'rebirth', label: 'REBIRTH', tone: 'purple' },
];
const ARIA = { shop: 'Open shop', roll: 'Open roll', index: 'Open the marks index', rebirth: 'Open rebirth' };
const DOT_SAYS = { shop: ' — items available', roll: ' — a roll is ready', index: ' — a new mark', rebirth: ' — ready' };

/**
 * @param items  { shop, roll, index, rebirth }: each { onClick, dot } or null (gated off — not rendered)
 * @param wins / gems  balances; gems null hides its pill (MARKS not revealed yet)
 * @param extra  rendered after the pills (the phone puts CREDITS there)
 */
export function MenuRail({ items, wins, gems, navigating, className = '', extra = null }) {
  return (
    <nav className={`homepage-corner-nav hp-rail ${className}`} aria-label="Menu">
      <KitPill kind="wins" value={wins} className="menu-wins-chip" />
      {gems != null && <KitPill kind="gems" value={gems} className="menu-gems-chip" />}
      {extra}
      <span className="hp-rail-gap" aria-hidden="true" />
      {RAIL.map(({ id, label, tone }) => {
        const it = items[id];
        if (!it) return null;
        return (
          <KitRailButton
            key={id}
            icon={id}
            label={label}
            tone={tone}
            dot={!!it.dot}
            className={`hp-nav homepage-nav-btn is-${id}${id === 'rebirth' && it.dot ? ' is-ready' : ''}`}
            data-nav={id}
            disabled={navigating}
            onClick={it.onClick}
            onMouseEnter={it.onHover}
            aria-label={`${ARIA[id]}${it.dot ? DOT_SAYS[id] : ''}`}
          />
        );
      })}
    </nav>
  );
}

/** The worn mark, NAME ONLY (or the MARKS / NEW MARK entry while nothing is worn). */
export function MenuMarkChip({ mark, isNew, onClick }) {
  const name = mark ? mark.name : isNew ? 'NEW MARK' : 'MARKS';
  return (
    <button
      type="button"
      className={`menu-mark hp-chip${mark ? '' : ' is-empty'}${isNew ? ' is-new' : ''}`}
      onClick={onClick}
      aria-label={mark ? `Mark equipped: ${mark.name}` : isNew ? 'New mark unlocked. Choose a mark to wear' : 'Marks. Choose a mark to wear'}
    >
      <span className="hp-chip-edge" aria-hidden="true" />
      <span className="menu-mark-name">{name}</span>
    </button>
  );
}

/**
 * The mockup's TYPE ANYTHING line: echoes what you type on the menu (it earns XP — useXpCapture).
 * One keydown listener, one text write per key, no layout reads; the caret is static (the mockup's
 * blink would be an infinite animation — CLAUDE.md ANIMATION BUDGET). `blockedRef.current` true
 * (a dialog / overlay is open) ignores keys, like the XP capture.
 */
export function MenuTyped({ blockedRef }) {
  const rootRef = useRef(null);
  const textRef = useRef(null);
  useEffect(() => {
    let s = '';
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || (blockedRef && blockedRef.current)) return;
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const k = e.key;
      if (k && k.length === 1 && /[a-z]/i.test(k)) s = s.length >= 16 ? k : s + k;
      else if (k === 'Backspace') s = s.slice(0, -1);
      else if (k === ' ' || k === 'Enter') s = '';
      else return;
      if (textRef.current) textRef.current.textContent = s;
      if (rootRef.current) rootRef.current.classList.toggle('has-text', s.length > 0);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [blockedRef]);
  return (
    <div ref={rootRef} className="hp-typed" aria-hidden="true">
      <span className="hp-typed-hint">TYPE ANYTHING</span>
      <span ref={textRef} className="hp-typed-text" />
      <span className="hp-typed-caret">_</span>
    </div>
  );
}
