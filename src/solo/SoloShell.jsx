// SoloShell.jsx — the shared chrome for CHAIN and FUSE: the HERO (clock ring + the big
// letter, ONE object), the input with its reject sill, the reason line, the arm hint, the
// first-run teach, and the death card. Mode-specific content (the HUD, the deck) is passed in.
//
// DESIGN LAW honored here: the INPUT element is never animated (only the sill and the
// clock give feedback). The sill "flash" is an OPACITY pulse of an always-red bar (so we
// stay within transform/opacity-only animation). There is no idle animation anywhere — the
// only motion is EVENT-driven (reject sill, lucky burst, travel FX) or BEAT-driven (the
// one-shot pops in Solo.css, fired by html[data-beat] from useBeatSync).
import { useEffect, useRef, useState } from 'react';
import '../components/wall-system.css'; // .solo-root adopts .wall-surface (token overrides in Solo.css)
import './Solo.css';
import { LUCKY_WINS_MULT } from '../progress/luck';
import { WinsHudPill, WinsEarnedTotal } from '../components/WinsHud';
// The standing multiplier readout — "every win and multiplier visible, no hidden credits".
import LiveStack from '../components/LiveStack';
import Mascot from '../components/Mascot';
import LayeredWord from '../components/LayeredWord';
import { wpmKeyStroke } from '../progress/wpmLive';
import { hasSeenTeach, markTeachSeen } from '../progress/onboarding';
import TeachStrip from '../components/TeachStrip.jsx';
import SoloExit from './SoloExit.jsx';
import { MORE_MODES } from '../gameData';
import { heatTier } from '../juice/ladder';
import { TierSlam, SlotTags, LevelUpChip } from '../components/FeelLadder';
import { ComboShatter } from '../components/ComboMeter';

// THE HERO RING. The countdown and the letter are ONE object, not a ring plus a separate
// tile elsewhere on the card. Progress is driven by React state every frame (not a CSS
// keyframe), so there's no idle animation and no var() inside keyframes.
//
// Ring geometry (viewBox 120): r=44, a 15px BLACK outline circle under a #241536 track under
// the 9px accent arc. The `state` ring (r=53.5, dashed) is the OUT tile's old FEW LEFT /
// DEAD END signal, re-homed onto the hero's rim.
function HeroRing({ remaining, tMax, redZone, armed }) {
  const R = 44;
  const C = 2 * Math.PI * R;
  const frac = armed ? Math.max(0, Math.min(1, remaining / tMax)) : 1;
  return (
    <svg className="solo-clock" viewBox="0 0 120 120" aria-hidden="true">
      <circle className="solo-clock-outline" cx="60" cy="60" r={R} />
      <circle className="solo-clock-track" cx="60" cy="60" r={R} />
      <circle
        className={`solo-clock-fill${redZone ? ' is-red' : ''}`}
        cx="60"
        cy="60"
        r={R}
        style={{ strokeDasharray: C, strokeDashoffset: C * (1 - frac) }}
      />
      <circle className="solo-clock-state" cx="60" cy="60" r="53.5" />
    </svg>
  );
}

// The hero letter, built from Bungee's REAL chromatic layer family (Shade / regular / Inline /
// Outline) stacked in register — NOT a text-shadow stack. Depth comes from the font, matching
// the CANONICAL MENU TITLE law (CLAUDE.md) applied to the app's one other giant display glyph.
//
// The stack itself is now LayeredWord: the four faces and their four colours were written out
// here AND in RoomScreen AND in MobileMenu, three copies of one recipe. What this hand-rolled
// copy was missing is the Shade metric correction — Bungee Shade advances +0.10em per character
// against the other three faces, so the black extrude walked out from under the fill as the
// string grew. A single CHAIN glyph hid it; a FUSE fragment was already drifting. Only the SIZE
// and the mode colour live here now (.solo-cl in Solo.css).
function HeroLetter({ text }) {
  return (
    <div className="solo-center" aria-hidden="true">
      <LayeredWord className="solo-cl" text={text} />
    </div>
  );
}

export default function SoloShell({
  accent,
  title,
  mode, // 'chain' | 'fuse' — drives the wall token overrides + the hero letter scale
  hud, // top bar node (score/best/multiplier | lives/strip)
  center, // the required letter (CHAIN) / the fragment (FUSE) — a STRING, layered by HeroLetter
  motif, // optional static SVG backdrop behind the stage (per-mode; never animated)
  supply, // optional readout node under the hero — WARNING states only (see JOB 8)
  clock, // { remaining, tMax, redZone, armed }
  outState, // '' | 'thin' | 'dead' — the old OUT tile's supply state, now on the hero rim
  outCap, // '' | 'FEW LEFT' | 'DEAD END'
  outHeat = 0, // 0..1 — the old OUT tile's heat bar, now along the hero's base
  deck, // optional lower-deck node (per-mode) that fills the lower half of the card
  input,
  onInput,
  onSubmit,
  sillKey,
  reason,
  placeholder,
  maxLength, // longest word length in the built ACCEPT union — derived, not hardcoded
  armHint, // per-mode "how to play" line, shown until the clock arms
  teachMode, // gameData id ('chain' | 'fuse') — keys the PER-MODE first-run teach strip
  teachRule, // this mode's rule, in its own words, for the teach strip
  teachExample, // a VALID answer to the prompt on screen right now (see progress/teachExample.js)
  rootRef, // optional ref to .solo-root (CHAIN uses it to measure centres for FX)
  fx, // optional absolutely-positioned FX layer (CHAIN input→hero travel), overlaid on root
  phase,
  winsTally = 0, // live "+N WINS" pill amount (0 until the 3-word gate)
  winsWords = 0, // my accepted-word count, so the pill can show the pre-gate "3 WORDS TO EARN"
  luckyKey = 0, // bumps on each lucky word → re-fires the finite gold burst
  // ESCALATION LADDER (juice/ladder.js) — the live combo streak drives the tier slam + edge frame;
  // the per-word LIGHT SLOT decision (juice/effectSlot.js) is made by the mode, which knows what a
  // clutch / lucky / rare word is: `slotMain` is the winning effect, `slotTags` the outranked ones
  // (said small), `slotKey` the word they belong to.
  comboStreak = 0,
  comboBreaks = 0,
  slotMain = 'hype',
  slotTags = null,
  slotKey = 0,
  over, // { score, best, restartArmed, restart, card, bare?, restartLabel?, winsEarned?, winsBonusLines?, tryRow? }
  onExit,
  // True only for a visitor who LANDED here from a shared link and has never seen the menu
  // (App: SOLO_LAUNCH for this mode && !hasSeenMenu()). Adds the one-line run-over offer
  // below. Everyone who arrived via the menu gets the card exactly as before.
  offerMenu = false,
}) {
  const inputRef = useRef(null);

  // LONG WORDS WRAP (fix/famous-long-words). The input shrinks its type to fit a long word on one
  // line, but never below the 16px input floor (iOS zoom) — and at 16px a 45-letter word
  // (pneumonoultramicroscopicsilicovolcanoconiosis) is ~440px of Space Mono in a ~284px phone box.
  // Past that point a MIRROR takes over the display: the same text, wrapped onto two lines at
  // 16px, over the real input (which keeps focus, value, caret and every event, its own text
  // made transparent). `capacity` is how many characters fit on ONE line at the floor; it is
  // measured on mount and on resize only (ResizeObserver), so a keystroke is a pure comparison.
  const [capacity, setCapacity] = useState(Infinity);
  useEffect(() => {
    const el = inputRef.current;
    if (!el || typeof ResizeObserver !== 'function') return undefined;
    const measure = () => {
      const cs = getComputedStyle(el);
      const room = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      // Space Mono advances 0.612em; 0.62 at the 16px floor leaves a hair of slack. Zero tracking
      // is what the CSS falls back to before this point (see .solo-input letter-spacing).
      setCapacity(Math.max(1, Math.floor(room / (16 * 0.62))));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [phase]);
  const wrapLong = input.length > capacity;

  // Keep focus on the field while playing so typing always lands (the field is never
  // cleared on reject, so focus + caret position are the player's evidence).
  useEffect(() => {
    if (phase === 'playing' && inputRef.current) inputRef.current.focus();
  }, [phase]);

  const submit = (e) => {
    e.preventDefault();
    onSubmit();
  };

  // THE OLD FIRST-GAME SPOTLIGHT IS GONE FROM THE SOLO MODES, replaced by the per-mode teach
  // strip below. Keeping both was actively worse than either: the screenshots show the Spotlight's
  // scrim and its big yellow caption drawn straight OVER the strip, so a first-timer got two
  // overlapping explanations and could read neither. The Spotlight also carried the defect this
  // batch exists to fix — one flag for every game surface, so only the first mode ever taught.
  // (GameScreen still uses it for Word Bomb / Blitz until they move to the strip too.)
  //
  // PER-MODE TEACH. Keyed by `teachMode`, so each mode gets exactly one chance to explain itself
  // the first time it is played. It sits IN the layout rather than over it, and clears as soon as
  // the player has banked a word — never on a timer, because someone who has typed nothing for
  // ten seconds is exactly who still needs it.
  const [teachOpen, setTeachOpen] = useState(false);
  useEffect(() => {
    if (phase === 'playing' && teachMode && !hasSeenTeach(teachMode)) setTeachOpen(true);
  }, [phase, teachMode]);
  const closeTeach = () => { markTeachSeen(teachMode); setTeachOpen(false); };
  // The first accepted word dismisses it: proof the player has the idea.
  useEffect(() => {
    if (teachOpen && winsWords > 0) closeTeach();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [winsWords]);

  const secs = Math.max(0, (clock.remaining || 0) / 1000);

  // COMBO BREAK at T2+ (4+ in a row): the same shatter Word Bomb's meter plays, so a lost streak is
  // never silent here either. `comboBreaks` bumps on every break; the streak it ended is the one we
  // saw on the render before.
  const lastStreakRef = useRef(comboStreak);
  const lastBreaksRef = useRef(comboBreaks);
  const [shatter, setShatter] = useState(null); // { key, count }
  useEffect(() => {
    const had = lastStreakRef.current;
    const broke = comboBreaks > lastBreaksRef.current; // a restart resets breaks to 0: not a break
    lastBreaksRef.current = comboBreaks;
    lastStreakRef.current = comboStreak;
    if (broke && had >= 4 && phase === 'playing') setShatter({ key: comboBreaks, count: had });
  }, [comboStreak, comboBreaks, phase]);
  // A run that ends (or restarts) never carries a stale shatter into the next one.
  useEffect(() => {
    if (phase !== 'playing') setShatter(null);
  }, [phase]);

  return (
    <div
      className="solo-root wall-surface"
      style={{ '--solo-accent': accent }}
      data-mode={mode}
      /* EDGE FRAME: the card's border takes the combo tier colour — a static toggle, never animated. */
      data-heat={phase === 'playing' ? heatTier(comboStreak) : 0}
      ref={rootRef}
    >
      {/* STATIC STRUCTURE LAYER — the poster's geometry: an off-axis band cutting across the
          card, a violet facet above it, and the two rules that pin the cut. Four inert divs,
          no animation, no pointer events. This is what gives the panel an ARRANGEMENT to hang
          content on instead of a flat rectangle of void. */}
      <div className="solo-structure" aria-hidden="true">
        <div className="solo-band" />
        <div className="solo-facet" />
        <div className="solo-bandrule" />
        <div className="solo-bandedge" />
      </div>

      {/* ONE HUD row: the mode stats (score/mult/links | words/lives) + the wins-earned state,
          all in a single readable line inside the card (NO ORPHAN FIXED UI — the shared wins
          pill is re-homed here from its fixed viewport corner, positioning neutralised to static
          by `.solo-root` scope in Solo.css). The WIN-COMBO ×N chip and the WPM chip were REMOVED
          from the solo HUD: a second "×N" eight pixels from the score multiplier read as a
          duplicate, and the combo's effect already shows in the +N WINS figure (showWpm={false}
          drops WPM too). Now there is exactly one multiplier on the row. */}
      <div className="solo-hud">
        {/* THE WAY OUT — labelled, ≥44×44 (52 here), shared with the load state (SoloExit.jsx).
            It is now IN this row at top-LEFT rather than an absolutely-positioned corner orphan
            (CLAUDE.md NO ORPHAN FIXED UI). Solo.css keeps it at z-61 so it still outranks the
            .solo-over scrim and stays reachable on the death card. */}
        {/* On the death card the way out moves INTO the card (fine-tune oct2: the HUD-row copy sat
            mid-screen, half over the card's text on a phone, attached to nothing). */}
        {phase !== 'over' && <SoloExit onExit={onExit} />}
        <div className="solo-hud-stats">{hud}</div>
        {phase === 'playing' && (
          <div className="solo-hud-wins">
            <WinsHudPill amount={winsTally} words={winsWords} showWpm={false} />
          </div>
        )}
        {/* WHAT A WORD IS WORTH HERE, AND WHY — in THIS row, as one more chip beside the
            multiplier and the wins pill, not a second floating panel beside the card (which is
            what made it read as a separate box). Solo.css lays it out along the row and gives it
            the same 4px outline / 4px hard offset / 52px height as its neighbours; LiveStack's
            own numbers are untouched, so it still cannot quote a rate the game will not pay. */}
        {phase === 'playing' && mode && (
          <div className="solo-hud-stack">
            <LiveStack mode={mode} compact />
          </div>
        )}
      </div>

      {/* BODY — one column on narrow/portrait screens, two columns on wide-aspect ones so
          the composition fills the width and needs less height (the same move that lets the
          card fill wide-short viewports instead of sitting in a narrow centred strip). */}
      <div className="solo-body">
      <div className="solo-primary">
      <div className="solo-stage">
        {/* Per-mode static backdrop motif. A SIBLING of the stage content and of the
            input's chain (the input lives outside .solo-stage), so it can never touch
            either. No animation — house rule: nothing idles here. */}
        {motif}
        {/* THE HERO — ring + letter as ONE object. Gated to 'playing' exactly like the input
            and the HUD pills: a big bright hero left mounted under the over scrim would ghost
            through it and collide with the death card's title. */}
        {phase === 'playing' ? (
          <div className={`solo-hero${outState ? ` is-${outState}` : ''}`}>
            <HeroRing {...clock} />
            <HeroLetter text={center} />
            <div
              className={`solo-hero-heat${outHeat >= 0.36 ? ' is-hot' : ''}`}
              style={{ transform: `scaleX(${outHeat})`, opacity: outHeat > 0 ? 1 : 0 }}
              aria-hidden="true"
            />
            <div className={`solo-hero-secs${clock.redZone ? ' is-red' : ''}`}>
              {secs >= 10 ? Math.ceil(secs) : secs.toFixed(1)}
            </div>
            {outCap ? <div className="solo-hero-cap">{outCap}</div> : null}
          </div>
        ) : null}
        {phase === 'playing' && supply ? <div className="solo-supply">{supply}</div> : null}
      </div>
      </div>{/* .solo-primary */}

      <div className="solo-secondary">
      {phase === 'playing' ? (
        <form className="solo-inputwrap" onSubmit={submit} data-wrap={wrapLong ? '1' : undefined}>
          <input
            ref={inputRef}
            className="solo-input"
            type="text"
            value={input}
            style={{ '--len': Math.max(input.length, 1) }}
            onChange={(e) => {
              wpmKeyStroke(); // WPM (§2): typing activity opens this word's active-typing span
              onInput(e.target.value);
            }}
            placeholder={placeholder}
            maxLength={maxLength}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck="false"
            aria-label={title}
          />
          {wrapLong ? (
            <div className="solo-input-mirror" aria-hidden="true">
              <span className="solo-input-mirror-text">
                {input}
                <span className="solo-input-mirror-caret" />
              </span>
            </div>
          ) : null}
          {/* The reject sill: an always-red bar whose OPACITY pulses on each reject
              (keyed remount re-fires the 140ms opacity animation). */}
          <div className="solo-sill" key={sillKey} data-fire={sillKey > 0 ? '1' : '0'} />
        </form>
      ) : null}

      {/* THE FIRST-RUN TEACH, in the layout (not over it) and per mode. */}
      {teachOpen && phase === 'playing' ? (
        <TeachStrip rule={teachRule} example={teachExample} onDismiss={closeTeach} />
      ) : null}

      {/* Reason line (reject) or the arm hint before the clock starts. */}
      <div className="solo-reason" aria-live="polite">
        {phase === 'playing' && reason ? reason : ''}
      </div>
      {/* The arm hint and the first-run teach say the same rule in the same window, and rendering
          both put two overlapping explanations on the screen (caught in the 320/390 screenshots of
          the cold-visitor path — invisible to every gate). The teach is the fuller one, so it wins;
          this hint takes over the moment it clears. (On fix/cold-visitor-path this guarded against
          the Spotlight; feat/teach-first-run replaced that with TeachStrip on this surface, so the
          guard follows it.) */}
      {phase === 'playing' && !clock.armed && armHint && !teachOpen ? (
        <div className="solo-armhint">{armHint}</div>
      ) : null}

      {/* LOWER DECK — per-mode content that fills the lower half of the card (the chain
          running across the space for CHAIN; the fuse cords + big letter strip for FUSE).
          Grows to absorb the slack (flex:1) so the card is one composition, not a cluster
          floating over a dark void. Static content only (no idle animation). */}
      {phase === 'playing' && deck ? (
        <div className="solo-deck">
          {deck}
        </div>
      ) : null}
      </div>{/* .solo-secondary */}
      </div>{/* .solo-body */}

      {/* The mascot is on the card DURING PLAY, not only at the funeral — it is the one
          character in the house style, and the solo screens were the only surfaces without it
          while playing. Pinned bottom-right INSIDE the panel (never a fixed orphan); swaps to
          `panic` the moment the supply goes thin/dead, so it reacts to the state that actually
          kills you. Beat-pop comes free from .mascot-container + data-beat — no JS added, and
          Solo.css pins this instance's IDLE loop off so solo play stays at zero infinite
          animations. */}
      {phase === 'playing' && (
        <Mascot pose={outState ? 'panic' : 'idle'} size={172} className="solo-mascot" />
      )}

      {phase === 'over' ? (
        <div className="solo-over">
          <div className="solo-deathcard">
            <SoloExit onExit={onExit} />
            {/* Mascot reaction, like Blitz / Word Bomb game-over (fix/gameover-pass) — gives the
                solo death card a face + a first read above the copy. */}
            <Mascot pose="panic" emote="slump" size={104} className="solo-death-mascot" />
            {over.card}
            {/* Run's total wins earned, large (item 2) — shared component with every mode. */}
            {/* The lines prop (Batch G): bonus credits earned during THIS run — a collection milestone
                is the reachable one — so the card names them instead of the total quietly
                disagreeing with the balance. Defaults to [] for any caller that passes none. */}
            {/* Rendered on the tutorial card too (H6): WinsEarnedTotal returns null when the run
                banked nothing, so a run that DID bank (a mid-run bonus) always names it. */}
            <WinsEarnedTotal amount={over.winsEarned} lines={over.winsBonusLines || []} />
            {/* First-run tutorial card (over.bare) shows NO score/BEST line. */}
            {over.bare ? null : (
              <div className="solo-scoreline">
                <span>SCORE {over.score}</span>
                <span>BEST {over.best}</span>
              </div>
            )}
            <button
              type="button"
              className={`solo-restart${over.restartArmed ? ' is-armed' : ''}`}
              onClick={over.restart}
            >
              {`${over.restartLabel || 'RESTART'}${over.restartArmed ? ' · ENTER' : ''}`}
            </button>
            {/* SECOND ROW — one of two, never both, because they answer the same question
                ("what now?") for different people.
                  • A player who came through the menu gets TRY <MODE> (feat/solo-endgame): one
                    ghost button naming a DIFFERENT unlocked mode, so a score-attack run does not
                    dead-end on a lone RESTART. Hidden on the first-run tutorial card (over.bare).
                  • A DEEP-LINK visitor who has never seen the menu gets the OFFER instead. They
                    have no idea any other mode exists, so naming one is a narrower pitch than
                    showing them the grid. This is the only moment they are looking at a stopped
                    screen. RESTART stays the primary action above it either way. */}
            {offerMenu ? (
              <div className="solo-offer">
                <p className="solo-offer-line">{`${MORE_MODES} MORE MODES WHERE THIS CAME FROM.`}</p>
                <button type="button" className="solo-offer-btn" onClick={onExit}>
                  SEE ALL MODES
                </button>
              </div>
            ) : over.bare ? null : (
              over.tryRow
            )}
          </div>
        </div>
      ) : null}

      {/* LUCKY WORD (Job 4): a finite 400ms gold burst + "LUCKY ×5" stamp, re-keyed per lucky
          hit so it replays. Absolutely positioned, pointer-events:none, transform/opacity only —
          no idle/infinite animation. */}
      {/* THE FEEL LAYER (escalation ladder): the tier slam (one pooled node), this word's
          outranked effects as a small tag line, a broken T2+ streak's shatter, and the mid-game
          LV chip. pointer-events:none, finite, over the hero — never over the input. */}
      {phase === 'playing' && (
        <div className="solo-feel" aria-hidden="true">
          <TierSlam count={comboStreak} outranked={slotMain !== 'hype'} />
          {slotTags && slotTags.length > 0 && <SlotTags key={`tags-${slotKey}`} labels={slotTags} />}
          {shatter && (
            <div className="solo-shatter">
              <ComboShatter key={shatter.key} count={shatter.count} />
            </div>
          )}
          <div className="solo-lv">
            <LevelUpChip />
          </div>
        </div>
      )}

      {/* LUCKY is the word's light slot unless a CLUTCH outranks it (then it is a tag above). */}
      {phase === 'playing' && luckyKey > 0 && slotMain === 'lucky' && (
        <div className="solo-lucky" key={luckyKey} aria-hidden="true">
          <span className="solo-lucky-ring" />
          <span className="solo-lucky-label">LUCKY ×{LUCKY_WINS_MULT}</span>
        </div>
      )}

      {/* FX overlay (CHAIN OUT→IN travel). Absolutely positioned, pointer-events:none,
          on top of the already-correct screen; it is a SIBLING of the input's chain,
          never an ancestor, so it can animate without touching the input. */}
      {fx}

    </div>
  );
}
