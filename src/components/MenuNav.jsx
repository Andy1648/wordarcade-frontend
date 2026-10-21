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
import LockChains from './lockChains/LockChains.jsx';
import { KitIconButton, KitRailButton } from './kit/KitNavButton.jsx';
import FitText from './kit/FitText.jsx';
import KitIcon from './kit/KitIcon.jsx';
import { KitPill } from './kit/KitPill.jsx';
import { formatNum } from '../format';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { CARD_RAR } from './markCard/palette.js';
import { mainTag, substatsOf, substatText } from '../progress/markRollsCore';
import { IDLE_SHEEN_TIERS, GLOW_TIERS } from './markCard/idleSheen.js';
import { useReduceMotion } from '../lib/useReduceMotion';
// The cog + glyph art is the INDEX chunk's (MarkBadge, ~11 KB): the gear slot loads it only once a mark is worn —
// payload ratchet (e2e/payload-budget.spec.js). Until it lands, the dashed hole holds the spot.
const MarkBadge = lazy(() => import('./MarkBadge.jsx'));
// the crit line's WORDS (critText) stay lazy too — loaded only when the worn gear has a crit rate
// the EPIC+ glow (aura + motes, Andy oct9 "clash royale cards") — code and art load only when such a gear is worn
const GearFx = lazy(() => import('./GearFx.jsx'));

/** Focus the control `id` inside `root` (App's overlay-return a11y — see Homepage). */
export function focusNav(root, id) {
  const el = root && root.querySelector(`[data-nav="${id}"]`);
  if (el) el.focus();
}

export function MenuIcons({ board, ach, achSlot = null, settingsSlot = null, news = null, profile = null, navigating }) {
  return (
    <div className="hp-icons" role="group" aria-label="Records">
      {/* PROFILE (oct17): your hero's face — joins this cluster (no orphan fixed UI); the paged desktop has the column tile */}
      {profile && (
        <KitIconButton
          art={profile.art}
          tone="cyan"
          className="hp-ico is-profile"
          data-nav="profile"
          disabled={navigating}
          onClick={profile.onClick}
          ariaLabel="Open your profile"
          title="Profile"
        />
      )}
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
      {/* UPDATE LOG (Andy oct12): re-opens this release's PATCH NOTES — joins the cluster, never its own fixed spot */}
      {news && (
        <KitIconButton
          icon="news"
          tone="pink"
          className="hp-ico is-news"
          data-nav="news"
          disabled={navigating}
          onClick={news.onClick}
          ariaLabel="Open the update log"
          title="Update log"
        />
      )}
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
 * @param daily  the DAILY tile (contracts/DailyTile — streak flame + contracts), full width under the four tiles
 */
// THE DOT NUDGE (MENU MOTION LAW, Andy oct9 "the 4 icons in the menu … at least some animation"): a rail tile with an
// actionable dot nudges its icon ONCE every NUDGE_EVERY_MS — one shared setTimeout for the whole rail (never a CSS loop,
// never a timer per tile), a finite WAAPI transform on the icon's .kb-rico host, staggered when several tiles have a
// dot. will-change only while it plays. Skipped on a hidden tab; REDUCE MOTION gets none.
export const NUDGE_EVERY_MS = 8000;
const NUDGE_FIRST_MS = 2600;
const NUDGE = [
  { transform: 'translateY(0) rotate(0) scale(1)' },
  { transform: 'translateY(-7px) rotate(-12deg) scale(1.14)', offset: 0.22 },
  { transform: 'translateY(0) rotate(9deg) scale(1)', offset: 0.46 },
  { transform: 'translateY(-2px) rotate(-5deg) scale(1.04)', offset: 0.68 },
  { transform: 'translateY(0) rotate(0) scale(1)' },
];
function useDotNudge(rootRef, enabled) {
  useEffect(() => {
    const root = rootRef.current;
    if (!enabled || !root || typeof root.animate !== 'function') return undefined;
    let timer = null;
    const runs = [];
    const tick = () => {
      timer = setTimeout(tick, NUDGE_EVERY_MS);
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      const hosts = [...root.querySelectorAll('.kb-rwrap')]
        .filter((w) => w.querySelector('.kb-rdot'))
        .map((w) => w.querySelector('.kb-rico'))
        .filter(Boolean);
      hosts.forEach((el, i) => {
        if (typeof el.animate !== 'function') return;
        el.style.willChange = 'transform';
        const a = el.animate(NUDGE, { duration: 560, delay: i * 160, easing: 'cubic-bezier(.3,1.3,.5,1)' });
        runs.push(a);
        const off = () => {
          el.style.willChange = '';
          const at = runs.indexOf(a);
          if (at >= 0) runs.splice(at, 1);
        };
        a.finished.then(off, off);
      });
    };
    timer = setTimeout(tick, NUDGE_FIRST_MS);
    return () => {
      clearTimeout(timer);
      runs.splice(0).forEach((a) => { try { a.cancel(); } catch { /* gone */ } });
    };
  }, [rootRef, enabled]);
}

export function MenuRail({ items, wins, gems, navigating, className = '', extra = null, daily = null, foot = null }) {
  const navRef = useRef(null);
  const reduced = useReduceMotion();
  useDotNudge(navRef, !reduced);
  return (
    <nav ref={navRef} className={`homepage-corner-nav hp-rail ${className}`} aria-label="Menu">
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
      {daily}
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
 *     ROLL FOR ONE + a dot, and the ROLL screen; gears owned but none equipped → NONE / EQUIP ONE + a dot.
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

/** LUCK / LEVELS / OVERDRIVE are off the menu's first-paint icon set (kitIconsCore): load the full set only when a worn
 *  gear's substats need one. */
const LAZY_ICONS = new Set(['luck', 'levels', 'overdrive']);
function useKitIconFor(need) {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    if (!need || ok) return undefined;
    let live = true;
    import('./kit/kitIconData.js').then(() => { if (live) setOk(true); });
    return () => { live = false; };
  }, [need, ok]);
  return ok;
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
    Promise.all([import('./gearShowcase.js'), import('./gearShowcase.css')])
      .then(([m]) => { if (live) stop = m.startShowcase(el, tier); }, () => {});
    return () => { live = false; if (stop) stop(); };
  }, [slotRef, tier, enabled]);
}

/** "+9% CRIT RATE" → "+9% CRIT", "+1× CRIT POWER" → "+1× CRIT PWR", "+10 BASE WINS" → "+10 BASE WINS" (the slot's width). */
/** A substat as a menu CHIP (GEAR CARD v4): the number ("14%", "2×", "30") beside its icon — the slot is too narrow
 * for the card's words, so the ICON says what it boosts and the full line rides the chip's label (and the sheet). */
export function subChip(x) {
  const t = substatText(x);
  const n = t.split(' ')[0].replace(/^\+/, ''); // every substat ADDS — the chip drops the '+' to fit two a row
  const icon = x.kind === 'baseWins' ? 'wins' : x.kind === 'gemsPct' ? 'gems' : x.kind === 'luckPct' ? 'luck'
    : x.kind === 'baseXp' ? 'levels' : x.kind === 'overdriveSec' ? 'overdrive' : 'crit';
  // both crit chips share the burst icon and both read as a % (Andy oct12) — a small key tells RATE from PWR
  const key = x.kind === 'critRatePct' ? 'RATE' : x.kind === 'critPower' ? 'PWR' : '';
  return { n, icon, key, label: t };
}
export function MenuGearSlot({ mark, owns = false, onClick, disabled, slot = 1 }) {
  const two = slot === 2; // the 2ND GEAR, unlocked (Andy oct11 "i want it to be the same as the first gear")
  const tier = mark ? (CARD_RAR[mark.tier] ? mark.tier : 'rare') : null;
  const rar = tier ? CARD_RAR[tier] : null;
  // the stat as it PAYS (markRollsCore.mainTag — the payout's own statOf), never a legacy blurb sentence
  const stat = mark ? gearSplit(mainTag(mark.id) || mark.blurb || mark.name) : null;
  // GEAR CARD v4 (Andy oct11 "no need to have 'your gear' … include stat and substats … like the cards but
  // horizontal"): the substat lines, as the card prints them, short ("+9% CRIT", "+10 BASE")
  const subs = mark ? substatsOf(mark.id).map(subChip) : [];
  const luck = useKitIconFor(subs.some((c) => LAZY_ICONS.has(c.icon)));
  const reduced = useReduceMotion();
  const sheen = !!mark && IDLE_SHEEN_TIERS.has(tier);
  const slotRef = useRef(null);
  useGearShowcase(slotRef, mark && GLOW_TIERS.has(tier) ? tier : null, !reduced);
  return (
    <button
      ref={slotRef}
      type="button"
      className={`hp-gear ${two ? 'menu-mark2 hp-gear--2' : 'menu-mark'}${mark ? ' is-worn' : ' is-empty'}`}
      data-tier={tier || undefined}
      style={rar ? { '--gear-line': rar.line, '--gear-edge': rar.edge, '--gear-fill': rar.fill } : undefined}
      onClick={onClick}
      disabled={disabled}
      data-nav={two ? 'gear2' : 'gear'}
      aria-haspopup={mark || two ? 'dialog' : undefined}
      aria-label={`${two ? '2nd gear' : 'Your gear'}: ${mark ? `${mark.name}, ${tier}, ${stat.big} ${stat.unit}` : 'none'}. Open your gear`}
    >
      {mark && GLOW_TIERS.has(tier) ? <Suspense fallback={null}><GearFx tier={tier} /></Suspense> : null}
      {sheen ? <span className="hp-gear-sheen" aria-hidden="true"><img className="hp-gear-sheen-band" src="/fx/sheen.svg" alt="" draggable="false" /></span> : null}
      {/* the SHOWCASE's one-shot layers (LEGENDARY+, gearShowcase.js): a tier-colour FLASH over the face and a burst
          RING behind the glyph — opacity 0 at rest, nothing moves until a run */}
      {sheen ? <span className="hp-gear-flash" aria-hidden="true" /> : null}
      {/* the BACKDROP (Andy oct11 "its just plain rn"): a sunburst / halftone / drips asset as a mask, in the tier colour */}
      <span className="hp-gear-bg" aria-hidden="true" />
      {/* the NAME on a tier plate across the top — the card's ribbon, sideways (no "YOUR GEAR" label: Andy oct11) */}
      <span className="hp-gear-plate"><FitText className="hp-gear-sub">{mark ? mark.name : two ? '2ND GEAR · EQUIP ONE' : owns ? 'EQUIP ONE' : 'ROLL FOR ONE'}</FitText></span>
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
          {/* the SUBSTATS as a 2×2 grid of icon chips under the main stat — the card's subs plate, compacted */}
          {subs.length ? (
            <span className="hp-gear-subs" data-testid={two ? 'gear2-subs' : 'gear-subs'}>
              {subs.map((c, i) => (
                <span key={i} className={`hp-gear-subline is-${c.icon}`} title={c.label} aria-label={c.label}>
                  {c.icon === 'crit' ? <img className="hp-gear-subico" src="/fx/crit-burst.svg" alt="" draggable="false" />
                    : !LAZY_ICONS.has(c.icon) || luck ? <KitIcon name={c.icon} size={18} shadow={1} extras={false} className="hp-gear-subico" /> : <span className="hp-gear-subico" />}
                  {c.n}
                  {c.key ? <span className="hp-gear-subkey">{c.key}</span> : null}
                </span>
              ))}
            </span>
          ) : null}
        </span>
      </span>
      {!mark && <span className="hp-chip-dot" aria-hidden="true" />}
    </button>
  );
}

/**
 * 2ND GEAR (Andy oct10: "have another (locked for users who havent unlocked rebirth 5) gear equipment below the
 * current one"): the season-2 R5 slot as a COMPACT slot under YOUR GEAR — the badge, the stat's number + what it
 * boosts, in the gear's tier frame. Below R5: a padlock + "R5" (a tap opens REBIRTH, where the unlock lives). Unlocked
 * and empty: NONE / EQUIP ONE + a dot. A tap opens the EQUIP screen in slot-2 mode. Static (the showcase is slot 1's).
 */
export function MenuGearSlot2({ mark, locked = null, onClick, disabled }) {
  // UNLOCKED: the same full slot as YOUR GEAR (name plate, big stat, substat chips, glow, showcase) — Andy oct11
  if (!locked) return <MenuGearSlot mark={mark} owns onClick={onClick} disabled={disabled} slot={2} />;
  const tier = mark ? (CARD_RAR[mark.tier] ? mark.tier : 'rare') : null;
  const rar = tier ? CARD_RAR[tier] : null;
  const stat = mark ? gearSplit(mainTag(mark.id) || mark.blurb || mark.name) : null;
  const aria = locked
    ? `2nd gear slot — locked, unlocks at rebirth ${locked.replace(/^R/, '')}`
    : mark ? `2nd gear: ${mark.name}, ${tier}, ${stat.big} ${stat.unit}. Open your gear` : '2nd gear: none. Open your gear';
  return (
    <button
      type="button"
      className={`hp-gear hp-gear2 menu-mark2${mark ? ' is-worn' : ' is-empty'}${locked ? ' is-locked' : ''}`}
      data-tier={tier || undefined}
      style={rar ? { '--gear-line': rar.line, '--gear-edge': rar.edge, '--gear-fill': rar.fill } : undefined}
      onClick={onClick}
      disabled={disabled}
      data-nav="gear2"
      data-locked={locked ? '' : undefined}
      aria-haspopup="dialog"
      aria-label={aria}
    >
      <span className="hp-gear-label">2ND GEAR</span>
      <span className="hp-gear-body">
        {locked ? (
          <LockChains wide className="hp-gear2-chains" />
        ) : mark ? (
          <Suspense fallback={<span className="hp-gear-hole" aria-hidden="true" />}>
            <MarkBadge mark={mark} size={44} className="hp-gear2-cog" />
          </Suspense>
        ) : <span className="hp-gear-hole" aria-hidden="true" />}
        <span className="hp-gear-text">
          {locked ? (
            <FitText className="hp-gear-big hp-gear2-big">REBIRTH {locked.replace(/^R/, '')}</FitText>
          ) : mark ? (
            <>
              <FitText className="hp-gear-big hp-gear2-big">{stat.big}</FitText>
              {stat.unit ? <span className="hp-gear-unit">{stat.unit}</span> : null}
            </>
          ) : (
            <>
              <FitText className="hp-gear-big hp-gear2-big">NONE</FitText>
              <span className="hp-gear-sub">EQUIP ONE</span>
            </>
          )}
        </span>
      </span>
      {!locked && !mark && <span className="hp-chip-dot" aria-hidden="true" />}
    </button>
  );
}

/** The phone's 2ND GEAR chip (beside the GEAR chip): the worn gear's NAME, or a padlock + R5, or EQUIP + a dot. */
export function MenuGear2Chip({ mark, locked = null, onClick }) {
  const tier = mark ? (CARD_RAR[mark.tier] ? mark.tier : 'rare') : null;
  const rar = tier ? CARD_RAR[tier] : null;
  return (
    <button
      type="button"
      className={`menu-mark2 hp-chip${mark ? '' : ' is-empty'}${locked ? ' is-locked' : ''}`}
      data-tier={tier || undefined}
      style={rar ? { '--gear-line': rar.line, '--gear-edge': rar.edge, '--gear-fill': rar.fill } : undefined}
      onClick={onClick}
      data-nav="gear2"
      data-locked={locked ? '' : undefined}
      aria-label={locked ? `2nd gear slot — locked, unlocks at rebirth ${locked.replace(/^R/, '')}` : mark ? `2nd gear: ${mark.name}, ${tier}. Open your gear` : '2nd gear: none. Open your gear'}
    >
      <span className="hp-chip-edge" aria-hidden="true" />
      <span className="hp-chip-k">2ND</span>
      {locked ? <KitIcon name="lock" size={18} shadow={1} extras={false} className="hp-chip-lock" /> : null}
      <span className="menu-mark-name">{locked ? locked : mark ? mark.name : 'EQUIP'}</span>
      {!locked && !mark && <span className="hp-chip-dot" aria-hidden="true" />}
    </button>
  );
}

/** The worn mark, NAME ONLY — or, while nothing is worn, "ROLL" + a notification dot (it opens the ROLL screen). It
 *  wears the YOUR GEAR slot's TIER FRAME (Andy oct9): the edge stripe, border and shadow in the tier colour. */
export function MenuMarkChip({ mark, owns = false, onClick }) {
  const name = mark ? mark.name : owns ? 'EQUIP' : 'ROLL';
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
