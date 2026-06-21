// GameScreen.jsx
import { useEffect, useRef, useState } from 'react';
import './GameScreen.css';

// Exact heart path supplied by the design - filled pink while the life is
// intact, dark gray once it's been lost. Stroke stays black to match the
// thick-outline cel style used everywhere else.
const HEART_PATH =
  'M8 14s-5.5-3.5-5.5-7A3.5 3.5 0 0 1 8 4.5 3.5 3.5 0 0 1 13.5 7C13.5 10.5 8 14 8 14z';

function Heart({ filled, shatter }) {
  return (
    <svg
      className={shatter ? 'heart heart-shatter' : 'heart'}
      viewBox="0 0 16 16"
      width="16"
      height="16"
      aria-hidden="true"
    >
      <path
        d={HEART_PATH}
        // While shattering, keep the heart pink (it's bursting, not yet lost);
        // once the animation clears it falls back to the gray "lost" fill.
        fill={filled || shatter ? '#FF2EC4' : '#555'}
        stroke="#000"
        strokeWidth="1.5"
      />
    </svg>
  );
}

// Human-readable copy for each server rejection reason. [combo] is filled
// in with the combo that was required at the moment of rejection. Word Bomb
// and Category Blitz share most reasons; the too-short floor differs (3 vs
// 2) and each mode has one reason the other never emits.
const REJECTION_MESSAGES = {
  too_short: 'TOO SHORT — NEED 3+ LETTERS',
  too_short_category: 'TOO SHORT — NEED 2+ LETTERS',
  missing_combo: 'MUST CONTAIN [combo]',
  already_used: 'ALREADY USED — TRY AGAIN',
  already_said: 'ALREADY SAID — TRY ANOTHER',
  not_a_word: 'NOT A REAL WORD',
  not_in_category: "DOESN'T FIT THE CATEGORY — TRY AGAIN",
};

// Category Blitz is always a fixed 3 rounds (mirrors the backend's
// TOTAL_ROUNDS); the round_start payload reports the current round but not
// the total, so the total lives here.
const TOTAL_CATEGORY_ROUNDS = 3;

function rejectionMessage(reason, { combo = '', isCategory = false } = {}) {
  // Category answers have a lower length floor, so reuse a mode-specific
  // string for the same reason code.
  const key = reason === 'too_short' && isCategory ? 'too_short_category' : reason;
  const template = REJECTION_MESSAGES[key];
  if (!template) return isCategory ? 'INVALID ANSWER' : 'INVALID WORD';
  return template.replace('[combo]', combo);
}

// Hype feedback - a punchy popup word + a screen shake on every accepted
// answer, shared by both game modes via the useHypeFeedback hook below.
const HYPE_WORDS = ['SICK!', 'FIRE!', 'CLEAN!', 'NASTY!', 'EZ!', 'NICE!', 'DOPE!', 'LIT!', 'GOD!', 'BEAST!'];
const HYPE_COLORS = ['#FF2EC4', '#2EFFE0', '#FFE94A', '#FF6B3D', '#9A1AFF'];

/**
 * A single throwaway hype word that scales up, tilts, and fades out (see the
 * hype-pop keyframes in GameScreen.css). The parent gives it a unique `key`
 * (the trigger counter) so each accepted answer re-mounts a fresh one and
 * replays the animation. It picks its word/color/tilt once on mount and
 * removes itself when the animation ends. pointer-events:none (in CSS) keeps
 * the input clickable underneath.
 */
function HypePopup() {
  const [done, setDone] = useState(false);
  const [look] = useState(() => ({
    word: HYPE_WORDS[Math.floor(Math.random() * HYPE_WORDS.length)],
    color: HYPE_COLORS[Math.floor(Math.random() * HYPE_COLORS.length)],
    rotation: Math.floor(Math.random() * 31) - 15, // -15deg..15deg
  }));

  if (done) return null;

  return (
    <div
      className="hype-popup"
      style={{ color: look.color, '--hype-rot': `${look.rotation}deg` }}
      onAnimationEnd={() => setDone(true)}
      aria-hidden="true"
    >
      {look.word}
    </div>
  );
}

/**
 * A throwaway "+1" that floats up and fades near the input on each accepted
 * answer. Re-keyed by the same hype counter so it replays per accept, and
 * removes itself on animation end. pointer-events:none (in CSS).
 */
function FloatingScore() {
  const [done, setDone] = useState(false);
  if (done) return null;
  return (
    <div
      className="floating-score"
      onAnimationEnd={() => setDone(true)}
      aria-hidden="true"
    >
      +1
    </div>
  );
}

// 3-2-1-GO! intro sequence. Each entry shows for 700ms; null marks the end.
const COUNTDOWN_STEPS = [3, 2, 1, 'GO!', null];

/**
 * Fullscreen "3 2 1 GO!" countdown shown when gameplay (re)starts. Steps
 * through COUNTDOWN_STEPS on a 700ms interval; when it reaches the trailing
 * null it calls onComplete (once) so the parent can hide it and unblock the
 * input. Each step gets a random tilt for graffiti energy, and is re-keyed so
 * the countdown-pop animation replays per number.
 */
function CountdownOverlay({ onComplete }) {
  const [index, setIndex] = useState(0);
  const doneRef = useRef(false);
  // One random tilt (-5deg..5deg) per step, picked once on mount.
  const [rotations] = useState(() =>
    COUNTDOWN_STEPS.map(() => Math.floor(Math.random() * 11) - 5)
  );

  useEffect(() => {
    const intervalId = setInterval(() => {
      setIndex((i) => (i >= COUNTDOWN_STEPS.length - 1 ? i : i + 1));
    }, 700);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (COUNTDOWN_STEPS[index] === null && !doneRef.current) {
      doneRef.current = true;
      onComplete();
    }
  }, [index, onComplete]);

  const step = COUNTDOWN_STEPS[index];
  if (step === null || step === undefined) return null;

  return (
    <div className="countdown-overlay">
      <div
        key={index}
        className={`countdown-text${step === 'GO!' ? ' go' : ''}`}
        style={{ '--cd-rot': `${rotations[index]}deg` }}
        aria-hidden="true"
      >
        {step}
      </div>
    </div>
  );
}

// Paint-splatter confetti colours (the same graffiti palette used everywhere).
const CONFETTI_COLORS = ['#FF2EC4', '#2EFFE0', '#FFE94A', '#FF6B3D', '#9A1AFF'];

/**
 * A burst of 25 throwaway confetti pieces that rain down the full viewport
 * when the local player wins. Each piece picks its position, colour, size,
 * shape, spin and timing once on mount (see confetti-fall in GameScreen.css).
 * Fixed + pointer-events:none so it never blocks the game-over buttons.
 * Only the parent decides whether to render it (winners only).
 */
function ConfettiEffect() {
  const [pieces] = useState(() =>
    Array.from({ length: 25 }, () => ({
      left: Math.random() * 100, // 0-100% of screen width
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      size: 8 + Math.random() * 8, // 8-16px
      rotation: Math.random() * 360, // starting tilt
      duration: 2 + Math.random() * 2, // 2-4s fall
      delay: Math.random(), // 0-1s stagger
      circle: Math.random() < 0.5, // mix of circles and squares
    }))
  );

  return (
    <div className="confetti-layer" aria-hidden="true">
      {pieces.map((piece, i) => (
        <div
          key={i}
          className={`confetti-piece${piece.circle ? ' circle' : ''}`}
          style={{
            left: `${piece.left}%`,
            width: `${piece.size}px`,
            height: `${piece.size}px`,
            background: piece.color,
            animationDuration: `${piece.duration}s`,
            animationDelay: `${piece.delay}s`,
            '--confetti-rot': `${piece.rotation}deg`,
          }}
        />
      ))}
    </div>
  );
}

/**
 * Counts a number up from 0 to `to` over `duration` ms, used on the winner's
 * final score so it tallies up dramatically instead of just appearing.
 */
function CountUp({ to, duration = 1000 }) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    const target = Number(to) || 0;
    if (target <= 0) {
      setValue(target);
      return;
    }
    const steps = 30;
    let frame = 0;
    const intervalId = setInterval(() => {
      frame += 1;
      if (frame >= steps) {
        setValue(target);
        clearInterval(intervalId);
      } else {
        setValue(Math.round((target * frame) / steps));
      }
    }, duration / steps);
    return () => clearInterval(intervalId);
  }, [to, duration]);

  return <>{value}</>;
}

/**
 * Renders text with each letter wrapped in its own span carrying a staggered
 * animation-delay, so the letters wobble out of sync (see letter-wobble).
 * Used for the loser's "GAME OVER" title.
 */
function WobbleText({ text }) {
  return (
    <>
      {text.split('').map((ch, i) => (
        <span
          key={i}
          className="wobble-letter"
          style={{ animationDelay: `${i * 80}ms` }}
        >
          {ch === ' ' ? ' ' : ch}
        </span>
      ))}
    </>
  );
}

/**
 * Word Bomb's centerpiece: a cartoon bomb whose fuse length IS the turn timer.
 * Newgrounds/graffiti style - flat solid fills, thick black outlines, a hard
 * cel highlight, no gradients or glows. As time runs out the fuse shrinks, the
 * flame grows, and the bomb escalates through three tension tiers (calm /
 * warning / critical) driven by the bomb-* keyframes in GameScreen.css. The
 * live seconds count sits inside the body and grows bolder as the clock drains.
 */
function BombVisual({ timerSeconds, maxTimer, showCountdown }) {
  // Fraction of time remaining (full while the 3-2-1 intro is still up).
  const ratio = showCountdown
    ? 1
    : Math.max(0, Math.min(1, timerSeconds / (maxTimer || 1)));

  // Tension tier drives the wobble/shake class plus a warmer body fill, a
  // bigger flame, and (critical only) spark particles.
  const tension = ratio > 0.6 ? 'calm' : ratio >= 0.3 ? 'warning' : 'critical';
  const bodyFill =
    tension === 'calm' ? '#2a2a2a' : tension === 'warning' ? '#3a2a2a' : '#4a2424';
  const flameScale = tension === 'calm' ? 0.85 : tension === 'warning' ? 1.15 : 1.45;
  const critical = tension === 'critical';

  // Fuse shrinks toward the body as time drains; the flame rides its burning
  // tip, curving off to one side for a bit of cartoon energy.
  const fuseLen = 8 + 40 * ratio;
  const tipX = 75 + 18 * ratio;
  const tipY = 50 - fuseLen;
  const ctrlX = 75 + 30 * ratio;
  const ctrlY = 50 - fuseLen * 0.5;
  const fusePath = `M75 50 Q ${ctrlX.toFixed(1)} ${ctrlY.toFixed(1)} ${tipX.toFixed(1)} ${tipY.toFixed(1)}`;

  // Seconds grow bigger/bolder as time runs down.
  const secondsFontSize = 32 + (1 - ratio) * 22;

  return (
    <div className={`bomb-body-wrap ${tension}`}>
      <svg className="bomb-svg" viewBox="0 0 150 175" width="140" aria-hidden="true">
        {/* Fuse drawn twice: a fat black outline first, the brown rope on top. */}
        <path d={fusePath} fill="none" stroke="#000" strokeWidth="10" strokeLinecap="round" />
        <path d={fusePath} fill="none" stroke="#6b4a2a" strokeWidth="5" strokeLinecap="round" />

        {/* Connector cap where the fuse enters the body. */}
        <rect x="64" y="46" width="22" height="22" rx="3" fill="#1a1a1a" stroke="#000" strokeWidth="5" />

        {/* Bomb body. */}
        <circle cx="75" cy="115" r="50" fill={bodyFill} stroke="#000" strokeWidth="5" />

        {/* Flat cel highlight on the upper-left - a solid polygon, not a gradient. */}
        <path
          d="M48 102 C 48 80 63 71 80 71 C 67 76 59 90 59 106 C 55 108 50 107 48 102 Z"
          fill="#444"
        />

        {/* Live seconds inside the body (white, heavy black outline). */}
        <text
          x="75"
          y="117"
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily="'Bungee', cursive"
          fontSize={secondsFontSize}
          fill="#fff"
          stroke="#000"
          strokeWidth="4"
          paintOrder="stroke"
        >
          {timerSeconds}
        </text>

        {/* Lit fuse tip: outer orange + inner yellow flame. Positioned via the
            inline transform; the flicker (critical) animates opacity only so it
            never fights that transform. */}
        <g transform={`translate(${tipX.toFixed(1)} ${tipY.toFixed(1)}) scale(${flameScale})`}>
          <g className={critical ? 'bomb-flame-flicker' : undefined}>
            <path d="M0 2 C -7 -3 -8 -14 0 -22 C 8 -14 7 -3 0 2 Z" fill="#FF6B3D" stroke="#000" strokeWidth="3" />
            <path d="M0 -2 C -4 -6 -4 -12 0 -17 C 4 -12 4 -6 0 -2 Z" fill="#FFE94A" />
          </g>
        </g>

        {/* Critical-only spark particles near the flame. */}
        {critical && (
          <g>
            <rect className="bomb-spark s1" x={tipX - 15} y={tipY - 4} width="5" height="5" fill="#FFE94A" stroke="#000" strokeWidth="1.5" />
            <rect className="bomb-spark s2" x={tipX + 11} y={tipY} width="4" height="4" fill="#FF6B3D" stroke="#000" strokeWidth="1.5" />
            <rect className="bomb-spark s3" x={tipX + 2} y={tipY - 15} width="4" height="4" fill="#FFE94A" stroke="#000" strokeWidth="1.5" />
          </g>
        )}
      </svg>
    </div>
  );
}

// Flat debris colours for the explosion (orange/yellow/red + bomb-body gray).
const EXPLOSION_DEBRIS_COLORS = ['#FF6B3D', '#FFE94A', '#FF5C5C', '#2a2a2a'];

/**
 * Full-screen bomb explosion, shown when a Word Bomb player times out or skips
 * (i.e. a life is lost). A white flash, an expanding orange blast ring with a
 * delayed yellow inner ring, and ~18 debris shards (outlined squares and
 * triangles) flung outward. Self-removes after ~850ms. The parent re-keys it
 * per detonation so it replays. Fixed + pointer-events:none, so it never blocks
 * input underneath.
 */
function ExplosionEffect() {
  const [done, setDone] = useState(false);
  const [debris] = useState(() =>
    Array.from({ length: 18 }, (_, i) => {
      // Spread shards roughly evenly around the circle, with some jitter.
      const angle = (Math.PI * 2 * i) / 18 + Math.random() * 0.5;
      const dist = 120 + Math.random() * 120; // 120-240px outward
      return {
        dx: Math.round(Math.cos(angle) * dist),
        dy: Math.round(Math.sin(angle) * dist),
        color: EXPLOSION_DEBRIS_COLORS[Math.floor(Math.random() * EXPLOSION_DEBRIS_COLORS.length)],
        size: 10 + Math.round(Math.random() * 10), // 10-20px
        triangle: Math.random() < 0.4,
        delay: Math.round(Math.random() * 80),
      };
    })
  );

  useEffect(() => {
    const id = setTimeout(() => setDone(true), 850);
    return () => clearTimeout(id);
  }, []);

  if (done) return null;

  return (
    <div className="explosion-layer" aria-hidden="true">
      <div className="explosion-flash" />
      <div className="explosion-blast" />
      <div className="explosion-blast inner" />
      {debris.map((d, i) => (
        <svg
          key={i}
          className="explosion-debris"
          width={d.size}
          height={d.size}
          viewBox="0 0 10 10"
          style={{
            '--dx': `${d.dx}px`,
            '--dy': `${d.dy}px`,
            marginLeft: `${-d.size / 2}px`,
            marginTop: `${-d.size / 2}px`,
            animationDelay: `${d.delay}ms`,
          }}
        >
          {d.triangle ? (
            <polygon points="5,0 10,10 0,10" fill={d.color} stroke="#000" strokeWidth="2" />
          ) : (
            <rect x="1" y="1" width="8" height="8" fill={d.color} stroke="#000" strokeWidth="2" />
          )}
        </svg>
      ))}
    </div>
  );
}

/**
 * Watches lastWordResult and reacts to each new result:
 *   - accepted -> bump hypeKey (re-keys the hype popup + floating "+1" so they
 *     replay) and fire a brief 200ms screen shake.
 *   - rejected -> fire a 400ms horizontal input shake.
 * Returns { hypeKey, shake, inputShake } for the caller to render.
 */
function useHypeFeedback(lastWordResult) {
  const [hypeKey, setHypeKey] = useState(0);
  const [shake, setShake] = useState(false);
  const [inputShake, setInputShake] = useState(false);

  useEffect(() => {
    if (!lastWordResult) return;

    if (lastWordResult.accepted) {
      setHypeKey((k) => k + 1);
      setShake(true);
      const timeoutId = setTimeout(() => setShake(false), 200);
      return () => clearTimeout(timeoutId);
    }

    // Rejected: shake the input so the miss is felt, not just read.
    setInputShake(true);
    const timeoutId = setTimeout(() => setInputShake(false), 400);
    return () => clearTimeout(timeoutId);
  }, [lastWordResult]);

  return { hypeKey, shake, inputShake };
}

/**
 * The live Chain Reaction play screen. All of its data is driven by props
 * fed from App.jsx's WebSocket message handling:
 *
 *   gameState      - latest turn_update payload (players, whose turn, timer
 *                    max, and the mode-specific prompt/history fields)
 *   gameType       - 'word-bomb' | 'category-blitz'; selects which prompt
 *                    (combo vs category) and history (words vs answers) to show
 *   myId           - this client's connection id, to know if it's our turn
 *   timerSeconds   - live countdown for the current turn
 *   lastWordResult - transient accept/reject of the most recent submission
 *   gameOver       - final results once the game ends (null while playing)
 *
 * The only local state is the text the player is typing; everything else
 * is authoritative server state passed down.
 */
export default function GameScreen({
  gameState,
  gameType,
  myId,
  timerSeconds,
  lastWordResult,
  gameOver,
  roomPlayers,
  categoryRound,
  myAnswers,
  playerProgress,
  roundResults,
  categoryScores,
  categoryTotals,
  onSubmitWord,
  onSubmitAnswer,
  onSkipTurn,
  onLeave,
}) {
  const [draft, setDraft] = useState('');
  const inputRef = useRef(null);
  // Intro countdown plays once when the screen mounts; the input stays
  // disabled until it finishes.
  const [showCountdown, setShowCountdown] = useState(true);

  const isMyTurn = !!gameState && gameState.currentPlayerId === myId;
  const inputEnabled = isMyTurn && !gameOver && !showCountdown;

  // Drop focus into the input the moment the turn swings to us, so the
  // player can just start typing without clicking first.
  useEffect(() => {
    if (inputEnabled && inputRef.current) {
      inputRef.current.focus();
    }
  }, [inputEnabled]);

  // Hype popup + screen shake (accepted) and input shake (rejected). Called
  // before the category early-return so the hooks always run in the same order.
  const { hypeKey, shake, inputShake } = useHypeFeedback(lastWordResult);

  // ---- Heart-shatter + elimination detection (Word Bomb only) ----
  // Each turn_update carries fresh lives/eliminated for every player. We diff
  // against the previous snapshot so we can fire one-shot animations exactly
  // on the transition: a heart that was just lost shatters, and a player who
  // just went out tilts away. Hooks live before the category early-return so
  // the hook order stays stable across renders.
  const prevPlayersRef = useRef({});
  // playerId -> true while the just-lost heart is mid-shatter (cleared after 500ms).
  const [shatteredHearts, setShatteredHearts] = useState({});
  // playerId -> true once eliminated; stays set so the card holds its final
  // tilted/dimmed state (the animation is forwards and never replays).
  const [eliminatingPlayers, setEliminatingPlayers] = useState({});
  // Bumped each time a life is lost (timeout/skip) to re-key + replay the
  // full-screen explosion.
  const [explosionKey, setExplosionKey] = useState(0);
  // The bomb-pass throw: direction ('left' | 'right') the bomb lunges when the
  // turn hands off, cleared when that 300ms animation ends.
  const [passDir, setPassDir] = useState(null);
  const prevCurrentRef = useRef(null);

  useEffect(() => {
    if (!gameState || gameType !== 'word-bomb') return;
    const players = gameState.players || [];
    const prev = prevPlayersRef.current;

    const shatterIds = [];
    const eliminateIds = [];
    players.forEach((p) => {
      const before = prev[p.id];
      if (!before) return; // first sighting - nothing to transition from
      if (typeof p.lives === 'number' && p.lives < before.lives) {
        shatterIds.push(p.id);
      }
      const nowEliminated = p.eliminated || p.lives <= 0;
      if (!before.eliminated && nowEliminated) {
        eliminateIds.push(p.id);
      }
    });

    // Snapshot the current state for the next diff.
    prevPlayersRef.current = Object.fromEntries(
      players.map((p) => [
        p.id,
        { lives: p.lives, eliminated: p.eliminated || p.lives <= 0 },
      ])
    );

    if (eliminateIds.length) {
      setEliminatingPlayers((cur) => {
        const next = { ...cur };
        eliminateIds.forEach((id) => {
          next[id] = true;
        });
        return next;
      });
    }

    if (!shatterIds.length) return;

    // A life was lost (timeout/skip) - detonate the bomb.
    setExplosionKey((k) => k + 1);

    setShatteredHearts((cur) => {
      const next = { ...cur };
      shatterIds.forEach((id) => {
        next[id] = true;
      });
      return next;
    });
    // Clear the shatter flag after the 500ms animation so the heart settles
    // into its normal gray "lost" state.
    const timerId = setTimeout(() => {
      setShatteredHearts((cur) => {
        const next = { ...cur };
        shatterIds.forEach((id) => {
          delete next[id];
        });
        return next;
      });
    }, 500);
    return () => clearTimeout(timerId);
  }, [gameState, gameType]);

  // ---- Bomb-pass throw (Word Bomb only) ----
  // When the turn hands off to a new player, throw the bomb toward their side
  // of the player bar: left if they sit in the left half, right otherwise.
  useEffect(() => {
    if (!gameState || gameType !== 'word-bomb') return;
    const cur = gameState.currentPlayerId;
    const prev = prevCurrentRef.current;
    if (prev != null && cur != null && cur !== prev) {
      const list = gameState.players || [];
      const idx = list.findIndex((p) => p.id === cur);
      if (idx >= 0 && list.length > 1) {
        const mid = (list.length - 1) / 2;
        setPassDir(idx <= mid ? 'left' : 'right');
      }
    }
    prevCurrentRef.current = cur;
  }, [gameState, gameType]);

  // Category Blitz is a completely different (simultaneous, round-based)
  // experience, so it renders as its own component with its own state rather
  // than threading conditionals through the turn-based Word Bomb layout.
  if (gameType === 'category-blitz') {
    return (
      <CategoryBlitzScreen
        myId={myId}
        timerSeconds={timerSeconds}
        lastWordResult={lastWordResult}
        gameOver={gameOver}
        roomPlayers={roomPlayers || []}
        categoryRound={categoryRound}
        myAnswers={myAnswers || []}
        playerProgress={playerProgress || {}}
        roundResults={roundResults}
        categoryScores={categoryScores}
        categoryTotals={categoryTotals || {}}
        onSubmitAnswer={onSubmitAnswer}
        onLeave={onLeave}
      />
    );
  }

  // Until the first turn_update lands there's nothing to render.
  if (!gameState) {
    return (
      <div className="game-wrap">
        <div className="game-loading">STARTING GAME...</div>
      </div>
    );
  }

  const isCategory = gameType === 'category-blitz';

  const players = gameState.players || [];

  // Mode-specific prompt + history. Word Bomb prompts with a letter combo
  // and tracks used words; Category Blitz prompts with a category and
  // tracks used answers. Everything downstream reads these shared locals.
  const combo = (gameState.combo || '').toUpperCase();
  const categoryRaw = gameState.category || '';
  const usedItems = (isCategory ? gameState.usedAnswers : gameState.usedWords) || [];

  const title = isCategory ? 'CATEGORY BLITZ' : 'WORD BOMB';
  const promptLabel = isCategory
    ? 'NAME SOMETHING IN THIS CATEGORY'
    : 'TYPE A WORD CONTAINING';
  const promptValue = isCategory
    ? categoryRaw.toUpperCase() || '—'
    : combo || '—';
  const usedLabel = isCategory ? 'USED ANSWERS' : 'USED WORDS';

  const difficultyLabel = (gameState.difficultyKey || gameState.difficulty || '')
    .toString()
    .toUpperCase();

  // Total hearts to draw per player = the most lives anyone is known to
  // have started with. Pulled defensively from whichever field the server
  // provides so lost hearts still render gray for eliminated players.
  const maxLives = Math.max(
    gameState.maxLives || 0,
    ...players.map((p) => p.maxLives || p.lives || 0),
    1
  );

  // The per-turn starting seconds, used by the bomb to compute its fuse ratio.
  // (Word Bomb has no timer bar - the bomb's fuse is the timer.)
  const maxTimer = gameState.timerSeconds || 1;

  const winner = gameOver ? players.find((p) => p.id === gameOver.winnerId) : null;
  const iWon = !!gameOver && gameOver.winnerId === myId;

  function submit() {
    const word = draft.trim();
    if (!word || !inputEnabled) return;
    onSubmitWord(word);
    setDraft('');
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      submit();
    }
  }

  return (
    <div className="game-wrap">
      {showCountdown && (
        <CountdownOverlay onComplete={() => setShowCountdown(false)} />
      )}
      {explosionKey > 0 && <ExplosionEffect key={explosionKey} />}
      <div className={`game-stage${shake ? ' game-shake' : ''}`}>
        {hypeKey > 0 && <HypePopup key={hypeKey} />}
        <div className="game-header">
          <div className="game-title">{title}</div>
          <div className="game-header-right">
            <div className="game-meta">
              {typeof gameState.round !== 'undefined' && (
                <span className="game-meta-round">ROUND {gameState.round}</span>
              )}
              {difficultyLabel && (
                <span className="game-meta-diff">{difficultyLabel}</span>
              )}
            </div>
            <button className="game-leave-btn" onClick={onLeave}>
              LEAVE
            </button>
          </div>
        </div>

        <div className="game-player-bar">
          {players.map((player) => {
            const eliminated = player.eliminated || player.lives <= 0;
            const isCurrent = player.id === gameState.currentPlayerId;
            const isMe = player.id === myId;
            const isEliminating = !!eliminatingPlayers[player.id];
            const justShattered = !!shatteredHearts[player.id];
            const cardClass = [
              'game-player-card',
              isCurrent && !eliminated ? 'current' : '',
              eliminated ? 'eliminated' : '',
              isEliminating ? 'eliminating' : '',
            ]
              .filter(Boolean)
              .join(' ');

            return (
              <div key={player.id} className="game-player-slot">
                {isCurrent && isMe && !gameOver && (
                  <div className="game-your-turn">YOUR TURN</div>
                )}
                <div className={cardClass}>
                  {isEliminating && <div className="game-player-flash" />}
                  <div className="game-player-name">
                    {player.name}
                    {isMe && <span className="game-player-you">YOU</span>}
                  </div>
                  <div className="game-player-hearts">
                    {Array.from({ length: maxLives }).map((_, i) => (
                      <Heart
                        key={i}
                        filled={i < player.lives}
                        // The just-lost heart is the first empty slot (index ===
                        // remaining lives); shatter only that one.
                        shatter={justShattered && i === player.lives}
                      />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="bomb-area">
          <div
            className={`bomb-passer${passDir ? ` pass-${passDir}` : ''}`}
            onAnimationEnd={(e) => {
              // Only clear on the pass animation itself, not bubbled child
              // (tension/flame) animations.
              if (e.target === e.currentTarget) setPassDir(null);
            }}
          >
            <BombVisual
              timerSeconds={timerSeconds}
              maxTimer={maxTimer}
              showCountdown={showCountdown}
            />
          </div>
        </div>

        <div className="game-combo-box">
          <div className="game-combo-label">{promptLabel}</div>
          <div className={`game-combo${isCategory ? ' category' : ''}`}>
            {promptValue}
          </div>
        </div>

        <div className="game-used">
          <div className="game-used-label">
            {usedLabel} ({usedItems.length})
          </div>
          <div className="game-used-list">
            {usedItems.length === 0 ? (
              <span className="game-used-empty">NONE YET — BE THE FIRST</span>
            ) : (
              usedItems.map((item, i) => (
                <span key={`${item}-${i}`} className="game-used-chip">
                  {item.toUpperCase()}
                </span>
              ))
            )}
          </div>
        </div>

        <div className="game-input-row">
          <input
            ref={inputRef}
            className={`game-input${inputShake ? ' input-shake' : ''}`}
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!inputEnabled}
            placeholder={
              inputEnabled
                ? isCategory
                  ? `Name something in "${categoryRaw}"...`
                  : `Type a word with "${combo}"...`
                : gameOver
                ? 'GAME OVER'
                : 'WAIT YOUR TURN...'
            }
            maxLength={32}
            autoComplete="off"
            spellCheck="false"
          />
          <button
            className="game-send-btn"
            onClick={submit}
            disabled={!inputEnabled}
          >
            SEND
          </button>
          {inputEnabled && (
            <button
              className="game-skip-btn"
              onClick={onSkipTurn}
              title="Skip your turn — costs you a life"
            >
              SKIP
              <span className="game-skip-cost">-1 LIFE</span>
            </button>
          )}
          {hypeKey > 0 && <FloatingScore key={hypeKey} />}
        </div>

        {lastWordResult && (
          <div
            className={`game-toast ${
              lastWordResult.accepted ? 'accepted' : 'rejected'
            }`}
          >
            {lastWordResult.accepted
              ? `NICE! "${(lastWordResult.word || '').toUpperCase()}" ACCEPTED`
              : rejectionMessage(lastWordResult.reason, { combo, isCategory })}
          </div>
        )}
      </div>

      {gameOver && (
        <div className="game-over-overlay">
          {iWon && <ConfettiEffect />}
          <div className="game-over-card">
            <div className={`game-over-title${iWon ? ' win winner-bounce' : ''}`}>
              {iWon ? 'YOU WIN!' : <WobbleText text="GAME OVER" />}
            </div>
            {!iWon && (
              <div className="game-over-winner">
                {winner ? `${winner.name.toUpperCase()} WINS` : 'NO WINNER'}
              </div>
            )}
            <div className="game-over-stat">
              WORDS PLAYED:{' '}
              {iWon ? <CountUp to={usedItems.length} /> : usedItems.length}
            </div>
            <button className="game-over-leave" onClick={onLeave}>
              LEAVE
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * The Category Blitz play screen - a simultaneous, round-based mode with a
 * layout entirely separate from Word Bomb. It has three faces, chosen by the
 * incoming server state:
 *
 *   - GAME OVER (gameOver set): final scoreboard, winner highlighted.
 *   - DURING A ROUND (categoryRound set): the category, a draining timer, an
 *     always-on input, your own growing answer list, and a privacy-safe count
 *     of how many answers each opponent has.
 *   - BETWEEN ROUNDS (roundResults set, no active round): everyone's answers
 *     revealed with per-round and cumulative scores, plus a 5s countdown note.
 */
function CategoryBlitzScreen({
  myId,
  timerSeconds,
  lastWordResult,
  gameOver,
  roomPlayers,
  categoryRound,
  myAnswers,
  playerProgress,
  roundResults,
  categoryScores,
  categoryTotals,
  onSubmitAnswer,
  onLeave,
}) {
  const [draft, setDraft] = useState('');
  const inputRef = useRef(null);
  // Countdown replays at the start of every NEW round (and the first one).
  const [showCountdown, setShowCountdown] = useState(false);
  const prevRoundRef = useRef(null);

  const roundActive = !!categoryRound && !gameOver;
  const roundNumber = categoryRound && categoryRound.round;

  // Trigger the countdown whenever the round number changes (covers the first
  // round on mount and every subsequent round).
  useEffect(() => {
    if (roundNumber != null && roundNumber !== prevRoundRef.current) {
      prevRoundRef.current = roundNumber;
      setShowCountdown(true);
    }
  }, [roundNumber]);

  // Auto-focus the input once a round is active AND its countdown has
  // finished - no turn-taking here, so the player can fire answers freely.
  useEffect(() => {
    if (roundActive && !showCountdown && inputRef.current) {
      inputRef.current.focus();
    }
  }, [roundActive, showCountdown, roundNumber]);

  // Hype popup + screen shake (accepted) and input shake (rejected), only
  // rendered during an active round, below.
  const { hypeKey, shake, inputShake } = useHypeFeedback(lastWordResult);

  function submit() {
    const answer = draft.trim();
    if (!answer || !roundActive || showCountdown) return;
    onSubmitAnswer(answer);
    setDraft('');
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      submit();
    }
  }

  // ---- GAME OVER: final scoreboard ----
  if (gameOver) {
    const scores = [...(categoryScores || gameOver.finalScores || [])].sort(
      (a, b) => b.score - a.score
    );
    const iWon = gameOver.winnerId === myId;
    const winnerName = (scores.find((s) => s.id === gameOver.winnerId) || {}).name;

    return (
      <div className="game-wrap">
        <div className="game-over-overlay">
          {iWon && <ConfettiEffect />}
          <div className="game-over-card">
            <div className={`game-over-title${iWon ? ' win winner-bounce' : ''}`}>
              {iWon ? 'YOU WIN!' : <WobbleText text="GAME OVER" />}
            </div>
            {!iWon && (
              <div className="game-over-winner">
                {winnerName ? `${winnerName.toUpperCase()} WINS` : 'NO WINNER'}
              </div>
            )}
            <div className="cb-scoreboard">
              {scores.map((s, i) => (
                <div
                  key={s.id}
                  className={`cb-score-row${s.id === gameOver.winnerId ? ' winner' : ''}`}
                >
                  <span className="cb-score-rank">{i + 1}</span>
                  <span className="cb-score-name">
                    {s.name}
                    {s.id === myId && <span className="game-player-you">YOU</span>}
                  </span>
                  <span className="cb-score-pts">
                    {iWon && s.id === gameOver.winnerId ? (
                      <CountUp to={s.score} />
                    ) : (
                      s.score
                    )}
                  </span>
                </div>
              ))}
            </div>
            <button className="game-over-leave" onClick={onLeave}>
              LEAVE
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---- DURING A ROUND ----
  if (categoryRound) {
    const maxTimer = categoryRound.timerSeconds || 1;
    const ratio = Math.max(0, Math.min(1, timerSeconds / maxTimer));
    // Full bar while the countdown is up (timer hasn't started ticking yet).
    const displayRatio = showCountdown ? 1 : ratio;
    const timerColor =
      displayRatio > 0.6 ? '#2EFFE0' : displayRatio >= 0.3 ? '#FFE94A' : '#FF5C5C';
    const lowTime = !showCountdown && timerSeconds <= 5;
    const veryLowTime = !showCountdown && timerSeconds < 3;
    const others = roomPlayers.filter((p) => p.id !== myId);

    return (
      <div className="game-wrap">
        {showCountdown && (
          <CountdownOverlay onComplete={() => setShowCountdown(false)} />
        )}
        <div className={`game-stage${shake ? ' game-shake' : ''}`}>
          {hypeKey > 0 && <HypePopup key={hypeKey} />}
          <div className="game-header">
            <div className="game-title">CATEGORY BLITZ</div>
            <div className="game-header-right">
              <div className="game-meta">
                <span className="game-meta-round">
                  ROUND {categoryRound.round}/{TOTAL_CATEGORY_ROUNDS}
                </span>
              </div>
              <button className="game-leave-btn" onClick={onLeave}>
                LEAVE
              </button>
            </div>
          </div>

          <div className="cb-category-label">NAME AS MANY AS YOU CAN</div>
          <div className="cb-category-display">
            {(categoryRound.category || '').toUpperCase()}
          </div>

          <div className="game-timer-row">
            <div className={`game-timer-track${lowTime ? ' urgent' : ''}`}>
              <div
                className="game-timer-fill"
                style={{ width: `${displayRatio * 100}%`, background: timerColor }}
              />
            </div>
            <div className={`game-timer-num${veryLowTime ? ' shake' : ''}`}>
              {timerSeconds}s
            </div>
          </div>

          <div className="game-input-row">
            <input
              ref={inputRef}
              className={`game-input${inputShake ? ' input-shake' : ''}`}
              type="text"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleKeyDown}
              disabled={showCountdown}
              placeholder="Type an answer..."
              maxLength={32}
              autoComplete="off"
              spellCheck="false"
            />
            <button className="game-send-btn" onClick={submit}>
              SEND
            </button>
            {hypeKey > 0 && <FloatingScore key={hypeKey} />}
          </div>

          {lastWordResult && (
            <div
              className={`game-toast ${
                lastWordResult.accepted ? 'accepted' : 'rejected'
              }`}
            >
              {lastWordResult.accepted
                ? `NICE! "${(lastWordResult.answer || '').toUpperCase()}"`
                : rejectionMessage(lastWordResult.reason, { isCategory: true })}
            </div>
          )}

          <div className="cb-my-answers">
            <div className="cb-section-label">YOUR ANSWERS ({myAnswers.length})</div>
            <div className="cb-answers-list">
              {myAnswers.length === 0 ? (
                <span className="game-used-empty">GO! TYPE ANYTHING THAT FITS</span>
              ) : (
                myAnswers.map((answer, i) => (
                  <span key={`${answer}-${i}`} className="cb-answer-chip">
                    {answer.toUpperCase()}
                  </span>
                ))
              )}
            </div>
          </div>

          <div className="cb-progress">
            <div className="cb-section-label">OTHER PLAYERS</div>
            {others.length === 0 ? (
              <span className="game-used-empty">NO OTHER PLAYERS</span>
            ) : (
              others.map((p) => (
                <div key={p.id} className="cb-progress-row">
                  <span className="cb-progress-name">{p.name}</span>
                  <span className="cb-progress-count">
                    {playerProgress[p.id] || 0} answers
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  // ---- BETWEEN ROUNDS: results + countdown ----
  if (roundResults) {
    return (
      <div className="game-wrap">
        <div className="game-stage">
          <div className="game-header">
            <div className="game-title">CATEGORY BLITZ</div>
            <button className="game-leave-btn" onClick={onLeave}>
              LEAVE
            </button>
          </div>

          <div className="cb-round-results">
            <div className="cb-results-title">ROUND {roundResults.round} RESULTS</div>
            <div className="cb-results-category">
              {(roundResults.category || '').toUpperCase()}
            </div>

            {(roundResults.playerResults || []).map((pr) => (
              <div key={pr.id} className="cb-result-player">
                <div className="cb-result-head">
                  <span className="cb-result-name">
                    {pr.name}
                    {pr.id === myId && <span className="game-player-you">YOU</span>}
                  </span>
                  <span className="cb-result-scores">
                    <span className="cb-result-round">+{pr.roundScore}</span>
                    <span className="cb-result-total">
                      {categoryTotals[pr.id] != null ? categoryTotals[pr.id] : pr.roundScore} TOTAL
                    </span>
                  </span>
                </div>
                <div className="cb-result-answers">
                  {pr.answers.length === 0 ? (
                    <span className="game-used-empty">NO ANSWERS</span>
                  ) : (
                    pr.answers.map((answer, i) => (
                      <span key={`${answer}-${i}`} className="cb-answer-chip">
                        {answer.toUpperCase()}
                      </span>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="cb-next-round">
            {roundResults.round >= TOTAL_CATEGORY_ROUNDS
              ? 'FINAL SCORES IN 5 SECONDS...'
              : 'NEXT ROUND IN 5 SECONDS...'}
          </div>
        </div>
      </div>
    );
  }

  // Brief gap between game_started and the first round_start.
  return (
    <div className="game-wrap">
      <div className="game-loading">STARTING ROUND...</div>
    </div>
  );
}
