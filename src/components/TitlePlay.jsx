// TitlePlay.jsx — THE TITLE (feat/first-run-reveal, Andy oct22 "title screen needs rework"): what a brand-new player's
// menu is before any game — stage 0 of the progressive reveal (progress/reveal.js). One read, one path:
//   your HERO (the cast PNG you will play as) on a painted burst · ONE big PLAY (Word Bomb vs a bot, no dialog) ·
//   a quiet "OR PICK" row of the open modes (each opens the same mode dialog its card does).
// Everything else on the menu (wins, upgrades, gears, contracts, the board …) appears as it starts to mean something.
//
// ART VS MOTION: the hero is the cast's webp, the burst is /art/starburst.svg used as a mask (the SHAPE is the asset;
// CSS only tints it). Motion = one finite enter pop (transform/opacity) — no loops.
import ConnectingContent from './ConnectingContent';
import './TitlePlay.css';

// each mode's chip wears its menu accent (MobileMenu ROW_STYLE / SOLO_STYLE), outline = a darker shade of the fill
const CHIP = {
  'word-bomb': ['#2EFFE0', '#14A894'],
  'category-blitz': ['#FF6B3D', '#B8401C'],
  'sat-rush': ['#FFE94A', '#B5A21E'],
  'word-race': ['#FF4FA3', '#B32670'],
  chain: ['#FF4FA3', '#B32670'],
  fuse: ['#C58BFF', '#7A3CC0'],
};

/**
 * @param heroSrc   the hero image (mainFaceSrc — your MAIN, RIOT on a fresh save)
 * @param games     the OPEN modes, in menu order (locked ones are left out — they are not a path yet)
 * @param onPlay    the one PLAY path (Homepage handleHookSolo → App's handlePlaySolo); null → opens Word Bomb's dialog
 * @param onPick    (gameId, el) — the same handler a game card calls
 * @param connecting  true while PLAY waits on the socket (shows CONNECTING… / WAKING THE SERVER…)
 */
export default function TitlePlay({ heroSrc, games = [], onPlay, onPick, connecting = false, coldStart = false, navigating = false, variant = 'desk' }) {
  const play = (e) => {
    if (navigating) return;
    if (onPlay) onPlay();
    else if (onPick) onPick('word-bomb', e.currentTarget);
  };
  return (
    <section className={`tp tp--${variant}`} aria-label="Play">
      <div className="tp-stage" aria-hidden="true">
        <span className="tp-burst" />
        <img className="tp-hero" src={heroSrc} width="384" height="384" alt="" draggable="false" decoding="async" fetchpriority="high" />
      </div>
      <div className="tp-side">
        <button type="button" className="tp-play" data-nav="play" onClick={play} disabled={navigating && !connecting} aria-label="Play Word Bomb against a bot">
          <span className="tp-play-shadow" aria-hidden="true" />
          <span className="tp-play-face">
            {connecting ? (
              <span className="tp-play-s"><ConnectingContent cold={coldStart} /></span>
            ) : (
              <>
                <span className="tp-play-k">PLAY</span>
                <span className="tp-play-s">WORD BOMB · VS A BOT</span>
              </>
            )}
          </span>
        </button>
        {games.length > 0 && (
          <div className="tp-pick" role="group" aria-label="Or pick a game">
            <span className="tp-pick-k">OR PICK</span>
            <div className="tp-chips">
              {games.map((g) => {
                const [fill, line] = CHIP[g.id] || CHIP['word-bomb'];
                return (
                  <button
                    key={g.id}
                    type="button"
                    className="tp-chip"
                    data-game={g.id}
                    style={{ '--chip': fill, '--chip-line': line }}
                    disabled={navigating}
                    onClick={(e) => onPick && onPick(g.id, e.currentTarget)}
                  >
                    {String(g.name).replace('\n', ' ')}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
