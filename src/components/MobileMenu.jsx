// MobileMenu.jsx — the phone (<=480px) first screen.
//
// WHAT THIS REPLACES: at 390x844 the desktop menu renders five 109px game cards (two of them
// padlocked), a wins/XP/LEVEL chrome cluster and a corner nav — ~436 nodes inside
// .homepage-stage, of which the card region alone is ~391. None of it is readable at that
// width; the cards are a horizontal strip of thumbnails with 8px type.
//
// This is FULL-WIDTH TYPOGRAPHIC BANDS instead: the title, the three big modes as tappable
// slabs, a split CHAIN | FUSE band, a SHOP / STATS / REBIRTH strip, and a footer with CREDITS +
// JOIN ROOM. Everywhere the desktop menu can go, the phone can go — and the whole screen still
// fits one viewport with no scroll. It is a separate COMPONENT
// (not a pile of `display:none`) on purpose — see lib/useMediaQuery.js for why the node count
// is the point.
//
// SCOPE: rendered only when `(max-width: 480px)` matches. Desktop and tablet never mount this
// and render exactly the tree they always have.
//
// ART VS MOTION (CLAUDE.md): the one piece of vector art here is the chevron, an inline stroke
// SVG. There is no CSS-drawn art and no character illustration — the <Mascot> PNG component is
// untouched and simply has no place on this screen.
import AudioControls from './AudioControls';
import LayeredWord from './LayeredWord';
import TrophyIcon from './TrophyIcon';
import WordHook from './WordHook';

// The three BIG modes, in menu order. CHAIN and FUSE (level-gated) share the split solo band
// below it — smaller, because a newcomer meets them locked.
//
// `desc` is read from gameData (passed in) so the sub-copy has ONE source of truth and cannot
// drift from the mode dialog / card / SEO copy.
// WORD RACE joins as a fourth row only when its (dark-launch) card is in `games` at all.
const MODE_IDS = ['word-bomb', 'category-blitz', 'sat-rush', 'word-race'];

// Per-row palette. The band is INVERTED: the slab is the dark panel base and the NAME carries
// the mode's neon, set in the chromatic Bungee stack (LayeredWord) — the treatment CHAIN, FUSE,
// Word Bomb and the room code already use. Flat black type on a flat colour block was below
// that bar. `sub` is a muted tint of the same accent so each band keeps its identity without
// competing with the name; every value clears 4.5:1 on the band (8.97:1 at worst).
const ROW_STYLE = {
  'word-bomb': { accent: '#2EFFE0', sub: '#8FC7BF' },
  'category-blitz': { accent: '#FF6B3D', sub: '#E0A88F' },
  'sat-rush': { accent: '#FFE94A', sub: '#D6C98A' },
  'word-race': { accent: '#FF4FA3', sub: '#E6A3C4' },
};

// The in-app route each row points at, so the row is a REAL link: long-press gets a URL,
// middle-click/ctrl-click opens a tab, and a screen reader announces a link. The click handler
// preventDefault()s and hands off to the same in-app handler the cards use, so the actual
// navigation path is byte-identical to tapping a card.
const ROW_HREF = {
  'word-bomb': '/word-bomb/play',
  'category-blitz': '/category-blitz/play',
  'sat-rush': '/sat-rush/play',
  'word-race': '/?race=1',
};

function Chevron() {
  return (
    <svg
      className="hp-m-chev"
      viewBox="0 0 24 24"
      width="26"
      height="26"
      fill="none"
      stroke="currentColor"
      strokeWidth="3.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}

function LockGlyph() {
  return (
    <svg
      className="hp-m-lock"
      viewBox="0 0 24 24"
      width="11"
      height="11"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

// THE SOLO PAIR. CHAIN and FUSE share one band, split in two: each half is a real control that
// calls the SAME Homepage handler its desktop card calls — handleOpenDialog when unlocked (the
// solo mode dialog with its PLAY button), handleLockedSelect when level-gated (the read-only
// locked-preview panel). The accents are the two palette colours the three big rows do not use,
// so no band repeats another's colour; FUSE's is a light tint of the house purple because
// #9A1AFF itself is under 3:1 on the dark band.
const SOLO_IDS = ['chain', 'fuse'];
const SOLO_STYLE = {
  chain: { accent: '#FF4FA3', sub: '#E6A3C4' },
  fuse: { accent: '#C58BFF', sub: '#C9B3E6' },
};
// A locked half keeps its name but drops to the muted menu violet, so "not yet" reads at a
// glance without dimming the text below contrast.
const LOCKED_STYLE = { accent: '#A89EC4', sub: '#A89EC4' };
const SOLO_HREF = { chain: '/chain/play', fuse: '/fuse/play' };

// Let a modified click (new tab / new window) behave like a normal link.
const isModified = (e) => e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1;

/**
 * @param games   the GAMES array from gameData (for the description copy)
 * @param onOpen  (gameId, el) => void — the SAME handler the desktop cards call
 * @param onLockedSelect  (gameId) => void — the SAME handler a desktop locked card calls
 * @param lockedIds  ids of the modes that are level-gated for this player right now
 * @param onJoin  join-room handler
 * @param joinLabel  node for the JOIN control (carries the CONNECTING… state)
 * @param navigating  true once a navigation has fired (locks the controls)
 * @param onShop / onStats / onCredits  the desktop corner-nav / footer handlers
 * @param onRebirth  the desktop REBIRTH handler, or null while REBIRTH is gated off (LV1 etc.)
 * @param shopDot  true when something in the shop is affordable (the desktop SHOP dot)
 * @param shopRef / statsRef / rebirthRef  Homepage's focus-restore refs (return from an overlay)
 * @param onHookPlay  first-timers only: starts solo Word Bomb from the TYPE A WORD hook; null hides it
 * @param hookPlayLabel  node for the hook's PLAY button while the socket wakes (or null)
 */
export default function MobileMenu({
  games,
  onOpen,
  onLockedSelect,
  lockedIds = [],
  onJoin,
  joinLabel = 'JOIN ROOM',
  navigating = false,
  musicMuted = false,
  onToggleMusic,
  onShop,
  onStats,
  onRebirth = null,
  onCredits,
  shopDot = false,
  shopRef,
  statsRef,
  rebirthRef,
  onHookPlay = null,
  hookPlayLabel = null,
  onLeaderboard = null,
  boardRef,
}) {
  const rows = MODE_IDS
    .map((id) => games.find((g) => g.id === id))
    .filter(Boolean);
  const solos = SOLO_IDS
    .map((id) => games.find((g) => g.id === id))
    .filter(Boolean);

  return (
    <div className="hp-m">
      {/* 1. TITLE + the sound toggle, sharing one row. The toggle JOINS this cluster rather
             than floating as its own fixed control (CLAUDE.md: NO ORPHAN FIXED UI). */}
      <div className="hp-m-top">
        <h1 className="hp-m-title">
          TYPE A
          <br />
          WORD
        </h1>
        <AudioControls
          variant="inline"
          accent="#2EFFE0"
          musicMuted={musicMuted}
          onToggleMusic={onToggleMusic}
        />
      </div>

      {/* 1b. FIRST VISIT ONLY: "TYPE A WORD 👇" + an input. The search visitors who land here
             from the "type a word" trend get exactly that, then one tap into solo Word Bomb.
             In flow (not fixed), so the mode rows below simply flex a little shorter. */}
      {onHookPlay && <WordHook onPlay={onHookPlay} playLabel={hookPlayLabel} navigating={navigating} />}

      {/* 2. The three mode rows. They flex-grow to share whatever height is left, so the
             screen always fills exactly one viewport with no scroll at any phone height. */}
      <nav className="hp-m-modes" aria-label="Game modes">
        {rows.map((game) => {
          const s = ROW_STYLE[game.id];
          return (
            <a
              key={game.id}
              className={`hp-m-row hp-m-row--${game.id}${navigating ? ' is-disabled' : ''}`}
              href={ROW_HREF[game.id]}
              style={{ '--row-accent': s.accent, '--row-sub': s.sub }}
              /* The letterform stack is aria-hidden (four copies of the same word), so the
                 link has to carry the accessible name itself. */
              aria-label={`${game.name.replace('\n', ' ')} — ${game.description}`}
              onClick={(e) => {
                if (isModified(e)) return;
                e.preventDefault();
                if (navigating) return;
                onOpen(game.id, e.currentTarget);
              }}
            >
              <span className="hp-m-row-text">
                {/* game.name already carries its own break ("WORD\nBOMB"); the stack honours
                    it, which is what lets the type run at the band's full width instead of
                    shrinking to fit one long line. */}
                <LayeredWord className="hp-m-name" text={game.name} accent={s.accent} />
                <span className="hp-m-desc">{game.description}</span>
              </span>
              <Chevron />
            </a>
          );
        })}
      </nav>

      {/* 3. CHAIN + FUSE — one band, two halves. This replaced the "CHAIN + FUSE UNLOCK AS YOU
             PLAY" line, which named two modes and gave no way to reach either (or even to see
             what they were). A locked half opens the same read-only preview the padlocked
             desktop card does; an unlocked half opens the same solo mode dialog. */}
      <div className="hp-m-solo" role="group" aria-label="Solo modes">
        {solos.map((game) => {
          const locked = lockedIds.includes(game.id);
          const s = locked ? LOCKED_STYLE : SOLO_STYLE[game.id];
          const style = { '--row-accent': s.accent, '--row-sub': s.sub };
          const cls = `hp-m-solo-btn hp-m-solo-btn--${game.id}${locked ? ' is-locked' : ''}${navigating ? ' is-disabled' : ''}`;
          // Locked: the padlock + the level it opens at ("LV 2"). The long form ("unlocks at
          // level 2") is the aria-label and the preview panel's own copy; spelled out here it
          // wraps to two lines in a 320px half-band.
          const body = (
            <>
              <LayeredWord className="hp-m-solo-name" text={game.name} accent={s.accent} />
              <span className="hp-m-solo-sub">
                {locked && <LockGlyph />}
                {locked ? `LV ${game.unlockLevel}` : 'SOLO'}
              </span>
            </>
          );
          if (locked) {
            return (
              <button
                key={game.id}
                type="button"
                className={cls}
                style={style}
                disabled={navigating}
                aria-label={`${game.name} — locked, unlocks at level ${game.unlockLevel}`}
                onClick={() => onLockedSelect && onLockedSelect(game.id)}
              >
                {body}
              </button>
            );
          }
          return (
            <a
              key={game.id}
              className={cls}
              href={SOLO_HREF[game.id]}
              style={style}
              aria-label={`${game.name} — ${game.description}`}
              onClick={(e) => {
                if (isModified(e)) return;
                e.preventDefault();
                if (navigating) return;
                onOpen(game.id, e.currentTarget);
              }}
            >
              {body}
            </a>
          );
        })}
      </div>

      {/* 4. SHOP / STATS / REBIRTH — the desktop corner nav, as one strip of slabs in the thumb
             zone. REBIRTH obeys the desktop gate exactly (Homepage passes null until it means
             something), and the strip re-flows to two slabs without it. */}
      <nav className="hp-m-nav" aria-label="Menu">
        <button
          ref={shopRef}
          type="button"
          className={`hp-m-navbtn is-shop${navigating ? ' is-disabled' : ''}`}
          onClick={onShop}
          disabled={navigating}
          aria-label={`Open shop${shopDot ? ' — items available' : ''}`}
        >
          SHOP
          {shopDot && <span className="hp-m-dot" aria-hidden="true" />}
        </button>
        <button
          ref={statsRef}
          type="button"
          className={`hp-m-navbtn is-stats${navigating ? ' is-disabled' : ''}`}
          onClick={onStats}
          disabled={navigating}
          aria-label="Open stats"
        >
          STATS
        </button>
        {onLeaderboard && (
          <button
            ref={boardRef}
            type="button"
            className={`hp-m-navbtn is-board${navigating ? ' is-disabled' : ''}`}
            onClick={onLeaderboard}
            disabled={navigating}
            aria-label="Open leaderboard"
          >
            <TrophyIcon size={24} />
          </button>
        )}
        {onRebirth && (
          <button
            ref={rebirthRef}
            type="button"
            className={`hp-m-navbtn is-rebirth${navigating ? ' is-disabled' : ''}`}
            onClick={onRebirth}
            disabled={navigating}
            aria-label="Open rebirth"
          >
            REBIRTH
          </button>
        )}
      </nav>

      {/* 5. The footer: CREDITS (the desktop footer link) on the left, JOIN ROOM on the right. */}
      <div className="hp-m-foot">
        <button
          type="button"
          className={`hp-m-credits${navigating ? ' is-disabled' : ''}`}
          onClick={onCredits}
          disabled={navigating}
        >
          CREDITS
        </button>
        <button
          type="button"
          className={`hp-m-join${navigating ? ' is-disabled' : ''}`}
          onClick={onJoin}
          disabled={navigating}
        >
          {joinLabel}
        </button>
      </div>
    </div>
  );
}
