// GameScreen.jsx
import { useEffect, useRef, useState } from 'react';
import './GameScreen.css';

// Exact heart path supplied by the design - filled pink while the life is
// intact, dark gray once it's been lost. Stroke stays black to match the
// thick-outline cel style used everywhere else.
const HEART_PATH =
  'M8 14s-5.5-3.5-5.5-7A3.5 3.5 0 0 1 8 4.5 3.5 3.5 0 0 1 13.5 7C13.5 10.5 8 14 8 14z';

function Heart({ filled }) {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <path
        d={HEART_PATH}
        fill={filled ? '#FF2EC4' : '#555'}
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
  not_a_word: 'NOT A REAL WORD',
  not_in_category: "DOESN'T FIT THE CATEGORY — TRY AGAIN",
};

function rejectionMessage(reason, { combo = '', isCategory = false } = {}) {
  // Category answers have a lower length floor, so reuse a mode-specific
  // string for the same reason code.
  const key = reason === 'too_short' && isCategory ? 'too_short_category' : reason;
  const template = REJECTION_MESSAGES[key];
  if (!template) return isCategory ? 'INVALID ANSWER' : 'INVALID WORD';
  return template.replace('[combo]', combo);
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
  onSubmitWord,
  onSkipTurn,
  onLeave,
}) {
  const [draft, setDraft] = useState('');
  const inputRef = useRef(null);

  const isMyTurn = !!gameState && gameState.currentPlayerId === myId;
  const inputEnabled = isMyTurn && !gameOver;

  // Drop focus into the input the moment the turn swings to us, so the
  // player can just start typing without clicking first.
  useEffect(() => {
    if (inputEnabled && inputRef.current) {
      inputRef.current.focus();
    }
  }, [inputEnabled]);

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

  const maxTimer = gameState.timerSeconds || 1;
  const ratio = Math.max(0, Math.min(1, timerSeconds / maxTimer));
  const timerColor = ratio > 0.6 ? '#2EFFE0' : ratio >= 0.3 ? '#FFE94A' : '#FF5C5C';

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
      <div className="game-stage">
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
            const cardClass = [
              'game-player-card',
              isCurrent && !eliminated ? 'current' : '',
              eliminated ? 'eliminated' : '',
            ]
              .filter(Boolean)
              .join(' ');

            return (
              <div key={player.id} className="game-player-slot">
                {isCurrent && isMe && !gameOver && (
                  <div className="game-your-turn">YOUR TURN</div>
                )}
                <div className={cardClass}>
                  <div className="game-player-name">
                    {player.name}
                    {isMe && <span className="game-player-you">YOU</span>}
                  </div>
                  <div className="game-player-hearts">
                    {Array.from({ length: maxLives }).map((_, i) => (
                      <Heart key={i} filled={i < player.lives} />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="game-timer-row">
          <div className="game-timer-track">
            <div
              className="game-timer-fill"
              style={{ width: `${ratio * 100}%`, background: timerColor }}
            />
          </div>
          <div className="game-timer-num">{timerSeconds}s</div>
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
            className="game-input"
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
          <div className="game-over-card">
            <div className={`game-over-title${iWon ? ' win' : ''}`}>
              {iWon ? 'YOU WIN!' : 'GAME OVER'}
            </div>
            {!iWon && (
              <div className="game-over-winner">
                {winner ? `${winner.name.toUpperCase()} WINS` : 'NO WINNER'}
              </div>
            )}
            <div className="game-over-stat">
              {isCategory
                ? `ANSWERS GIVEN: ${
                    (gameState.usedAnswers ||
                      (gameOver && gameOver.usedAnswers) ||
                      []).length
                  }`
                : `WORDS PLAYED: ${usedItems.length}`}
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
