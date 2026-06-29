// ImposterWordScreen.jsx
// Imposter Word - a social-deduction party mode. Everyone gets the same real
// category except one player (the imposter), who sees only "blend in" and has
// to reverse-engineer the category from everyone's live answers. Then everyone
// votes on who the fake is. Three phases per round: answering -> voting ->
// reveal, for 5 rounds, then a scoreboard with detective / imposter awards.
//
// Driven entirely by props fed from App.jsx's WebSocket handling. Self-contained
// (its own small countdown / count-up / confetti helpers that reuse the shared
// GameScreen.css classes) so it doesn't create an import cycle with GameScreen.
import { useEffect, useRef, useState } from 'react';
import { useSound } from '../contexts/SoundContext';
import Mascot from './Mascot';
import { ShareBar } from '../share';
import './ImposterWord.css';

// A distinct, stable colour per player (by roster index) - used for answer
// chips, vote-card borders, and the vote/score lines so each player reads as
// "theirs" at a glance. This is a LOCAL fallback only: the real per-session
// colour comes from the shared playerColors map (the locked 5-colour palette)
// so a player is the same colour here as in the room and the other games.
const PLAYER_COLORS = ['#FF2EC4', '#2EFFE0', '#FFE94A', '#FF6B3D', '#9A1AFF'];
const CONFETTI_COLORS = ['#FF2EC4', '#2EFFE0', '#FFE94A', '#FF6B3D', '#9A1AFF'];
const CD_STEPS = [3, 2, 1, 'GO!', null];

// Build the id -> colour-string map the rest of this screen consumes. Prefers
// the shared session map (keyed by stable id, locked palette); falls back to the
// local roster-index palette for any id the shared map doesn't cover.
function buildColorMap(roster, shared) {
  const map = {};
  (roster || []).forEach((p, i) => {
    const fromShared = shared && shared[p.id] && shared[p.id].color;
    map[p.id] = fromShared || PLAYER_COLORS[i % PLAYER_COLORS.length];
  });
  return map;
}

function rejectMessage(reason) {
  const m = {
    too_short: 'TOO SHORT — 2+ LETTERS',
    max_answers: "THAT'S 3 — WATCH & WAIT",
    already_said: 'ALREADY SAID THAT',
    wrong_phase: 'NOT RIGHT NOW',
  };
  return m[reason] || 'INVALID';
}

// ---- Small self-contained helpers (reuse global GameScreen.css classes) ----

function Countdown({ onComplete, sound }) {
  const [index, setIndex] = useState(0);
  const doneRef = useRef(false);
  useEffect(() => {
    const id = setInterval(
      () => setIndex((i) => (i >= CD_STEPS.length - 1 ? i : i + 1)),
      700
    );
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const step = CD_STEPS[index];
    if (step === null && !doneRef.current) {
      doneRef.current = true;
      onComplete();
    } else if (step === 'GO!') sound.countdown(true);
    else if (typeof step === 'number') sound.countdown(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);
  const step = CD_STEPS[index];
  if (step === null || step === undefined) return null;
  return (
    <div className="countdown-overlay">
      <div className={`countdown-text${step === 'GO!' ? ' go' : ''}`} aria-hidden="true">
        {step}
      </div>
    </div>
  );
}

function CountUp({ to, duration = 800 }) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const target = Number(to) || 0;
    if (target <= 0) {
      setValue(target);
      return;
    }
    const steps = 24;
    let frame = 0;
    const id = setInterval(() => {
      frame += 1;
      if (frame >= steps) {
        setValue(target);
        clearInterval(id);
      } else setValue(Math.round((target * frame) / steps));
    }, duration / steps);
    return () => clearInterval(id);
  }, [to, duration]);
  return <>{value}</>;
}

function Confetti() {
  const [pieces] = useState(() =>
    Array.from({ length: 25 }, () => ({
      left: Math.random() * 100,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      size: 8 + Math.random() * 8,
      rotation: Math.random() * 360,
      duration: 2 + Math.random() * 2,
      delay: Math.random(),
      circle: Math.random() < 0.5,
    }))
  );
  return (
    <div className="confetti-layer" aria-hidden="true">
      {pieces.map((p, i) => (
        <div
          key={i}
          className={`confetti-piece${p.circle ? ' circle' : ''}`}
          style={{
            left: `${p.left}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            background: p.color,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
            '--confetti-rot': `${p.rotation}deg`,
          }}
        />
      ))}
    </div>
  );
}

// ---- The dramatic reveal (THE moment) ----
// Keyed by round in the parent so it remounts each round and replays the whole
// sequence: a 2s "THE IMPOSTER WAS..." suspense, then the name SLAMS in (punch
// + screen shake + sound), the verdict, the real category, every vote, the
// updated scores counting up, and a 5s countdown to the next round.
function ImposterReveal({ results, myId, nameById, colorMap, onShake }) {
  const { sound } = useSound();
  const [revealed, setRevealed] = useState(false);
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    sound.whoosh();
    const t = setTimeout(() => {
      setRevealed(true);
      sound.punch();
      if (onShake) onShake('heavy');
    }, 2000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!revealed) return undefined;
    const id = setInterval(() => setCountdown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [revealed]);

  const caught = results.imposterCaught;

  return (
    <div className="iw-reveal-overlay" aria-hidden="true">
      {!revealed ? (
        <div className="iw-reveal-pre">
          THE IMPOSTER WAS<span className="iw-reveal-dots">…</span>
        </div>
      ) : (
        <div className="iw-reveal-body">
          <div className="iw-reveal-name">{(results.imposterName || 'UNKNOWN').toUpperCase()}</div>
          <div className={`iw-reveal-verdict ${caught ? 'caught' : 'survived'}`}>
            {caught ? 'CAUGHT! 🎯' : 'SURVIVED 😈'}
          </div>

          <div className="iw-reveal-cat">
            <div className="iw-reveal-cat-label">THE REAL CATEGORY</div>
            <div className="iw-reveal-cat-value">{(results.realCategory || '').toUpperCase()}</div>
            <div className="iw-reveal-cat-note">the imposter only saw: "blend in."</div>
          </div>

          <div className="iw-reveal-section">
            <div className="iw-reveal-section-label">THE VOTES</div>
            {results.votes.length === 0 ? (
              <div className="iw-reveal-vote-row">NOBODY VOTED 😴</div>
            ) : (
              results.votes.map((v, i) => (
                <div key={i} className="iw-reveal-vote-row">
                  <span style={{ color: colorMap[v.voterId] || '#fff' }}>{nameById[v.voterId] || '???'}</span>
                  <span className="iw-reveal-arrow">→</span>
                  <span style={{ color: colorMap[v.suspectId] || '#fff' }}>
                    {nameById[v.suspectId] || '???'}
                    {v.suspectId === results.imposterId ? ' 🎯' : ''}
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="iw-reveal-section">
            <div className="iw-reveal-section-label">SCORES</div>
            {[...results.scores]
              .sort((a, b) => b.score - a.score)
              .map((s) => (
                <div key={s.id} className="iw-reveal-score-row">
                  <span style={{ color: colorMap[s.id] || '#fff' }}>
                    {s.name}
                    {s.id === myId ? ' (YOU)' : ''}
                  </span>
                  <span className="iw-reveal-score-pts">
                    <CountUp to={s.score} duration={700} />
                  </span>
                </div>
              ))}
          </div>

          <div className="iw-reveal-countdown">NEXT ROUND IN {countdown}</div>
        </div>
      )}
    </div>
  );
}

// Returns the single clear leader for a numeric field (highest, no tie, > 0),
// or null when there's no unambiguous winner - used for the two awards.
function topUnique(scores, field) {
  let max = 0;
  let leader = null;
  let tied = false;
  scores.forEach((s) => {
    const v = s[field] || 0;
    if (v > max) {
      max = v;
      leader = s;
      tied = false;
    } else if (v === max && v > 0) {
      tied = true;
    }
  });
  if (!leader || max <= 0 || tied) return null;
  return leader;
}

function ImposterGameOver({ final, myId, isHost, colorMap, onLeave, onRematch, rematchPending }) {
  const { sound } = useSound();
  const scores = [...(final.finalScores || [])].sort((a, b) => b.score - a.score);
  const iWon = final.winnerId === myId;
  const winnerName = (scores.find((s) => s.id === final.winnerId) || {}).name;
  const bestDetective = topUnique(scores, 'caughtCount');
  const bestImposter = topUnique(scores, 'survivedCount');

  useEffect(() => {
    if (iWon) sound.victory();
    else sound.defeat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="game-wrap">
      <div className="game-over-overlay">
        {iWon && <Confetti />}
        <div className="game-over-card">
          <div className={`game-over-title${iWon ? ' win winner-bounce' : ''}`}>
            {iWon ? 'YOU WIN!' : 'GAME OVER'}
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
                className={`cb-score-row${s.id === final.winnerId ? ' winner' : ''}`}
                style={{ '--pc': colorMap[s.id], '--pc-dark': colorMap[s.id] }}
              >
                <span className="cb-score-rank">{i + 1}</span>
                <span className="cb-score-name">
                  <span className="cb-score-name-text">{s.name}</span>
                  {s.id === myId && <span className="game-player-you">YOU</span>}
                </span>
                <span className="cb-score-pts">
                  {iWon && s.id === final.winnerId ? <CountUp to={s.score} /> : s.score}
                </span>
              </div>
            ))}
          </div>

          {(bestDetective || bestImposter) && (
            <div className="iw-awards">
              {bestDetective && (
                <div className="iw-award detective">
                  <span className="iw-award-label">🕵️ BEST DETECTIVE</span>
                  <span className="iw-award-name">{bestDetective.name}</span>
                  <span className="iw-award-detail">{bestDetective.caughtCount} CAUGHT</span>
                </div>
              )}
              {bestImposter && (
                <div className="iw-award imposter">
                  <span className="iw-award-label">😈 BEST IMPOSTER</span>
                  <span className="iw-award-name">{bestImposter.name}</span>
                  <span className="iw-award-detail">{bestImposter.survivedCount} SURVIVED</span>
                </div>
              )}
            </div>
          )}

          {/* Shareable result card — reads the existing aggregate scoreboard
              only (win + caught/fooled counts); never the secret word. */}
          <ShareBar
            mode="imposter-word"
            neon="#9A1AFF"
            outcome={{ won: iWon }}
            data={{
              caught: (scores.find((s) => s.id === myId) || {}).caughtCount,
              fooled: (scores.find((s) => s.id === myId) || {}).survivedCount,
            }}
          />
          <div className="game-over-actions">
            {isHost && (
              <button className="game-over-rematch" onClick={() => { sound.click(); onRematch(); }} disabled={rematchPending}>
                {rematchPending ? 'REMATCHING...' : 'REMATCH'}
              </button>
            )}
            <button
              className={`game-over-leave${isHost ? ' secondary' : ''}`}
              onClick={() => { sound.click(); onLeave(); }}
            >
              LEAVE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ImposterWordScreen({
  myId,
  isHost,
  playerColors = {},
  timerSeconds,
  lastWordResult,
  round,
  phase,
  liveAnswers = [],
  myAnswers = [],
  voteData,
  voteCount = { voted: 0, total: 0 },
  myVote,
  results,
  final,
  onSubmitAnswer,
  onSubmitVote,
  onLeave,
  onRematch,
  rematchPending,
  onShake,
}) {
  const { sound } = useSound();
  const [draft, setDraft] = useState('');
  const inputRef = useRef(null);

  // 3-2-1 countdown at the start of each answering phase (covers the backend's
  // countdown delay before the answer timer starts ticking).
  const [showCountdown, setShowCountdown] = useState(false);
  const prevRoundRef = useRef(null);
  const roundNum = round ? round.round : null;
  useEffect(() => {
    if (phase === 'answering' && roundNum != null && roundNum !== prevRoundRef.current) {
      prevRoundRef.current = roundNum;
      setShowCountdown(true);
    }
  }, [phase, roundNum]);

  const amImposter = !!(round && round.isImposter);

  // Stable roster + colour map, from whichever phase payload is available.
  const roster =
    (round && round.players && round.players.length && round.players) ||
    (voteData && voteData.players) ||
    (results && results.scores) ||
    (final && final.finalScores) ||
    [];
  const colorMap = buildColorMap(roster, playerColors);
  const nameById = {};
  roster.forEach((p) => {
    nameById[p.id] = p.name;
  });

  const canAnswer = phase === 'answering' && !showCountdown && myAnswers.length < 3;
  useEffect(() => {
    if (canAnswer && inputRef.current) inputRef.current.focus();
  }, [canAnswer]);

  function submit() {
    const a = draft.trim();
    if (!a || !canAnswer) return;
    onSubmitAnswer(a);
    setDraft('');
  }
  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
  }

  // Game over is its own screen.
  if (phase === 'finished' && final) {
    return (
      <ImposterGameOver
        final={final}
        myId={myId}
        isHost={isHost}
        colorMap={colorMap}
        onLeave={onLeave}
        onRematch={onRematch}
        rematchPending={rematchPending}
      />
    );
  }

  if (!phase || (!round && !voteData && !results)) {
    return (
      <div className="game-wrap">
        <div className="game-loading">STARTING GAME...</div>
      </div>
    );
  }

  // Timer bar ratio for the active phase.
  let maxT = 1;
  if (phase === 'answering' && round) maxT = round.answerSeconds || 1;
  else if (phase === 'voting' && voteData) maxT = voteData.voteSeconds || 1;
  const ratio = Math.max(0, Math.min(1, (timerSeconds || 0) / maxT));
  const timerColor = ratio > 0.6 ? '#2EFFE0' : ratio >= 0.3 ? '#FFE94A' : '#FF5C5C';
  const lowTime = !showCountdown && (timerSeconds || 0) <= 5;

  const mascotPose =
    phase === 'reveal' && results
      ? results.imposterCaught
        ? 'celebrate'
        : 'panic'
      : amImposter
      ? 'taunt'
      : 'idle';
  // A one-shot reaction on the reveal: a happy bob when the imposter is caught,
  // a flinch when they slip away. It returns to null between reveals (other
  // phases), so the emote re-applies and replays on each new reveal.
  const mascotEmote =
    phase === 'reveal' && results ? (results.imposterCaught ? 'bob' : 'flinch') : null;

  return (
    <div className={`game-wrap iw-wrap${amImposter && phase !== 'reveal' ? ' iw-imposter' : ''}`}>
      {showCountdown && phase === 'answering' && (
        <Countdown onComplete={() => setShowCountdown(false)} sound={sound} />
      )}

      {phase === 'reveal' && results && (
        <ImposterReveal
          key={round ? round.round : 'r'}
          results={results}
          myId={myId}
          nameById={nameById}
          colorMap={colorMap}
          onShake={onShake}
        />
      )}

      {/* Mascot reacts: taunt while hiding (imposter), celebrate/panic on reveal,
          plus a one-shot bob/flinch as the reveal lands. */}
      <Mascot pose={mascotPose} emote={mascotEmote} size={92} className="iw-mascot" />

      <div className="game-stage">
        <div className="game-header">
          <div className="game-title iw-title">IMPOSTER WORD</div>
          <div className="game-header-right">
            <div className="game-meta">
              {round && (
                <span className="game-meta-round">
                  ROUND {round.round}/{round.totalRounds}
                </span>
              )}
            </div>
            <button className="game-leave-btn" onClick={() => { sound.click(); onLeave(); }}>
              LEAVE
            </button>
          </div>
        </div>

        {/* ---------------- ANSWER PHASE ---------------- */}
        {phase === 'answering' && round && (
          <>
            {amImposter ? (
              <div className="iw-imposter-banner-wrap">
                <div className="iw-imposter-banner">YOU ARE THE IMPOSTER</div>
                <div className="iw-imposter-sub">Watch the answers. Blend in.</div>
              </div>
            ) : (
              <>
                <div className="cb-category-label">EVERYONE'S CATEGORY</div>
                <div className="cb-category-display">{(round.category || '').toUpperCase()}</div>
              </>
            )}

            <div className="game-timer-row">
              <div className={`game-timer-track${lowTime ? ' urgent' : ''}`}>
                <div
                  className="game-timer-fill"
                  style={{ width: `${(showCountdown ? 1 : ratio) * 100}%`, background: timerColor }}
                />
              </div>
              <div className="game-timer-num">{timerSeconds}s</div>
            </div>

            <div className="game-input-row">
              <input
                ref={inputRef}
                className="game-input"
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={!canAnswer}
                placeholder={
                  myAnswers.length >= 3
                    ? "THAT'S 3 — WATCH & WAIT"
                    : showCountdown
                    ? 'GET READY...'
                    : amImposter
                    ? 'Fake an answer to blend in...'
                    : 'Type an answer...'
                }
                maxLength={32}
                autoComplete="off"
                spellCheck="false"
              />
              <button className="game-send-btn" onClick={submit} disabled={!canAnswer}>
                SEND
              </button>
            </div>

            {lastWordResult && (
              <div className={`game-toast ${lastWordResult.accepted ? 'accepted' : 'rejected'}`}>
                {lastWordResult.accepted
                  ? `ADDED "${(lastWordResult.answer || '').toUpperCase()}"`
                  : rejectMessage(lastWordResult.reason)}
              </div>
            )}

            <div className="iw-myanswers">
              <div className="cb-section-label">YOUR ANSWERS ({myAnswers.length}/3)</div>
              <div className="cb-answers-list">
                {myAnswers.length === 0 ? (
                  <span className="game-used-empty">
                    {amImposter ? 'FAKE IT — TYPE SOMETHING PLAUSIBLE' : 'NAME UP TO 3 THINGS'}
                  </span>
                ) : (
                  myAnswers.map((a, i) => (
                    <span key={i} className="cb-answer-chip">
                      {a.toUpperCase()}
                    </span>
                  ))
                )}
              </div>
            </div>

            <div className="iw-feed">
              <div className="iw-feed-title">
                ANSWERS COMING IN{amImposter ? ' — GUESS THE CATEGORY' : ''}
              </div>
              <div className="iw-feed-list">
                {liveAnswers.length === 0 ? (
                  <span className="game-used-empty">WAITING FOR ANSWERS...</span>
                ) : (
                  liveAnswers.map((a, i) => (
                    <span
                      key={i}
                      className="iw-feed-chip"
                      style={{ borderColor: colorMap[a.playerId] || '#000' }}
                    >
                      <span
                        className="iw-feed-name"
                        style={{ color: colorMap[a.playerId] || '#fff' }}
                      >
                        {a.playerName}
                      </span>{' '}
                      {(a.answer || '').toUpperCase()}
                    </span>
                  ))
                )}
              </div>
            </div>
          </>
        )}

        {/* ---------------- VOTING PHASE ---------------- */}
        {phase === 'voting' && voteData && (
          <>
            <div className="cb-category-label">DISCUSS — THEN VOTE</div>
            <div className="iw-vote-header">WHO IS THE IMPOSTER?</div>

            <div className="game-timer-row">
              <div className={`game-timer-track${lowTime ? ' urgent' : ''}`}>
                <div className="game-timer-fill" style={{ width: `${ratio * 100}%`, background: timerColor }} />
              </div>
              <div className="game-timer-num">{timerSeconds}s</div>
            </div>

            <div className="iw-vote-progress">
              {voteCount.voted} / {voteCount.total} VOTED
            </div>

            <div className="iw-vote-grid">
              {voteData.answers.map((p) => {
                const isMe = p.playerId === myId;
                const voted = myVote === p.playerId;
                const color = colorMap[p.playerId] || '#9A1AFF';
                return (
                  <div key={p.playerId} className="iw-vote-card" style={{ borderColor: color }}>
                    <div className="iw-vote-name" style={{ color }}>
                      {p.playerName}
                      {isMe && <span className="game-player-you">YOU</span>}
                    </div>
                    <div className="iw-vote-answers">
                      {p.answers.length === 0 ? (
                        <span className="game-used-empty">SAID NOTHING 👀</span>
                      ) : (
                        p.answers.map((a, i) => (
                          <span key={i} className="cb-answer-chip">
                            {a.toUpperCase()}
                          </span>
                        ))
                      )}
                    </div>
                    {!isMe && (
                      <button
                        className={`iw-vote-btn${voted ? ' voted' : ''}`}
                        style={voted ? { background: color, borderColor: color } : undefined}
                        disabled={!!myVote}
                        onClick={() => { sound.click(); onSubmitVote(p.playerId); }}
                      >
                        {voted ? '✓ VOTED' : myVote ? 'VOTE LOCKED' : 'VOTE'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
