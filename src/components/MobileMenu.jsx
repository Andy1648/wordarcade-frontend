// MobileMenu.jsx — the phone (<=480px) first screen.
//
// WHAT THIS REPLACES: at 390x844 the desktop menu renders five 109px game cards (two of them
// padlocked), a wins/XP/LEVEL chrome cluster and a corner nav — ~436 nodes inside
// .homepage-stage, of which the card region alone is ~391. None of it is readable at that
// width; the cards are a horizontal strip of thumbnails with 8px type.
//
// This is THREE FULL-WIDTH TYPOGRAPHIC ROWS instead: the title, the three playable modes as
// big tappable slabs, and one quiet line about what unlocks later. It is a separate COMPONENT
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

// The three PLAYABLE modes, in menu order. CHAIN and FUSE are level-gated and are represented
// by the single unlock line below rather than by two padlocked cards that cannot be tapped.
//
// `desc` is read from gameData (passed in) so the sub-copy has ONE source of truth and cannot
// drift from the mode dialog / card / SEO copy.
const MODE_IDS = ['word-bomb', 'category-blitz', 'sat-rush'];

// Per-row palette. Kept here rather than in gameData because these are THIS SCREEN's slab
// colours (a full-bleed fill behind 50px type), not the card colours — the card palette is
// tuned for a 109px thumbnail with art behind it and reads far too hot at full width.
const ROW_STYLE = {
  'word-bomb': { bg: '#2EFFE0', sub: '#0b4a43' },
  'category-blitz': { bg: '#FF6B3D', sub: '#4a1a08' },
  'sat-rush': { bg: '#f4efe1', sub: '#4a4438' },
};

// The in-app route each row points at, so the row is a REAL link: long-press gets a URL,
// middle-click/ctrl-click opens a tab, and a screen reader announces a link. The click handler
// preventDefault()s and hands off to the same in-app handler the cards use, so the actual
// navigation path is byte-identical to tapping a card.
const ROW_HREF = {
  'word-bomb': '/word-bomb/play',
  'category-blitz': '/category-blitz/play',
  'sat-rush': '/sat-rush/play',
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

/**
 * @param games   the GAMES array from gameData (for the description copy)
 * @param onOpen  (gameId, el) => void — the SAME handler the desktop cards call
 * @param onJoin  join-room handler
 * @param joinLabel  node for the JOIN control (carries the CONNECTING… state)
 * @param navigating  true once a navigation has fired (locks the controls)
 */
export default function MobileMenu({
  games,
  onOpen,
  onJoin,
  joinLabel = 'JOIN ROOM',
  navigating = false,
  musicMuted = false,
  onToggleMusic,
}) {
  const rows = MODE_IDS
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
              style={{ '--row-bg': s.bg, '--row-sub': s.sub }}
              onClick={(e) => {
                // Let a modified click (new tab / new window) behave like a normal link.
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1) return;
                e.preventDefault();
                if (navigating) return;
                onOpen(game.id, e.currentTarget);
              }}
            >
              <span className="hp-m-row-text">
                <span className="hp-m-name">{game.name.replace('\n', ' ')}</span>
                <span className="hp-m-desc">{game.description}</span>
              </span>
              <Chevron />
            </a>
          );
        })}
      </nav>

      {/* 3. One quiet line for what is still locked, and JOIN ROOM on the same row. No padlock
             card art, and no "YOU'RE LV 1 - 19 TO GO" — a countdown to a mode you have not seen
             is noise on the screen where you are choosing what to play. */}
      <div className="hp-m-foot">
        <span className="hp-m-unlock">
          <LockGlyph />
          CHAIN + FUSE UNLOCK AS YOU PLAY
        </span>
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
