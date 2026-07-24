// RoomScreen.jsx
import { useState, useEffect, useRef } from 'react';
import { useSound } from '../contexts/SoundContext';
import WaveText from './WaveText';
import Mascot from './Mascot';
import PlayerDot from './PlayerDot';
import { resolvePlayerColor } from '../playerColors';
import { inviteLink } from '../share/links.js';
import { track } from '../lib/analytics';
import './RoomScreen.css';

// Each difficulty carries a short timer blurb so players know what they're
// picking. The `desc` mirrors the backend DIFFICULTY_PRESETS startSeconds in
// gameLogic.js (easy 15s, medium 10s, hard 7s).
// Display names are the edgy HARD / CRAZY / HELL tiers; the `key` (easy/medium/
// hard) is unchanged so all the underlying timer logic stays put. The `desc` is
// the Word Bomb per-turn timer (that mode still varies by tier).
const DIFFICULTIES = [
  { key: 'chill', label: 'CHILL', desc: '20s · 3 lives' },
  { key: 'easy', label: 'HARD', desc: '15s timer' },
  { key: 'medium', label: 'CRAZY', desc: '10s timer' },
  { key: 'hard', label: 'HELL', desc: '7s timer' },
];

// Category Blitz reroll allowance per tier (mirrors the backend). In that mode
// the timer is a fixed 20s, so difficulty controls rerolls instead - which is
// what the difficulty blurb shows there.
const CB_REROLLS = { chill: 3, easy: 3, medium: 2, hard: 1 };

function difficultyDesc(diff, gameType) {
  if (gameType === 'category-blitz') {
    const n = CB_REROLLS[diff.key] ?? 0;
    return `20s · ${n} reroll${n === 1 ? '' : 's'}`;
  }
  return diff.desc;
}

// Read-only readout for non-hosts: "CRAZY — 10s timer" (falls back to the bare
// key if it's somehow unknown).
function difficultyReadout(key, gameType) {
  const match = DIFFICULTIES.find((d) => d.key === key);
  return match
    ? `${match.label} — ${difficultyDesc(match, gameType)}`
    : (key || '').toUpperCase();
}
// The two playable game modes. `key` is the value the server expects in
// set_game_type / reports back in room_update's gameType; `label` is the
// display text.
const GAME_TYPES = [
  { key: 'word-bomb', label: 'WORD BOMB' },
  { key: 'category-blitz', label: 'AI CATEGORY BLITZ' },
  { key: 'imposter-word', label: 'IMPOSTER WORD' },
];

function gameTypeLabel(gameType) {
  const match = GAME_TYPES.find((gt) => gt.key === gameType);
  return (match || GAME_TYPES[0]).label;
}
// Minimum players to start, by game type. Mirrors the backend (the server is
// the real source of truth and will reject an under-count start_game), but
// matching it here gives instant feedback (a disabled button) instead of a
// round-trip error. Imposter Word needs 3 - it's no fun finding the imposter
// among one other person.
const MIN_PLAYERS_TO_START = 2;
const MIN_PLAYERS_BY_TYPE = { 'imposter-word': 3 };

function minPlayersFor(gameType) {
  return MIN_PLAYERS_BY_TYPE[gameType] || MIN_PLAYERS_TO_START;
}

// Bot opponent difficulty (solo Word Bomb / Category Blitz). These are the
// BOT's own skill tiers - how fast and how much it answers - and are
// deliberately separate from the game's timer difficulty (HARD/CRAZY/HELL
// above). The `key` matches the backend's BOT_DIFFICULTY keys
// (easy/medium/hard); the descs stay mode-agnostic since both modes share
// this picker.
const BOT_DIFFICULTIES = [
  { key: 'easy', label: 'EASY', desc: 'slow · beatable' },
  { key: 'medium', label: 'MEDIUM', desc: 'quick · solid' },
  { key: 'hard', label: 'HARD', desc: 'fast · brutal' },
];

// Modes with a server-side bot opponent (roomManager's BOT_FACTORY_BY_GAME_TYPE).
const BOT_GAME_TYPES = ['word-bomb', 'category-blitz'];

function botDifficultyLabel(key) {
  return (BOT_DIFFICULTIES.find((d) => d.key === key) || {}).label || 'BOT';
}

/**
 * Shown once a room has been successfully created or joined.
 *
 * `myId` (the player's own connection id, learned from the server's
 * 'connected' message in App.jsx) determines whether host-only controls
 * - the difficulty selector and Start Game button - are shown. Non-host
 * players instead see the current difficulty as read-only text and a
 * "waiting for host" message.
 */
export default function RoomScreen({ room, myId, playerColors = {}, preselectedGame, serverError, startPending, diffPending, botPending, onLeave, onSetGameType, onSetDifficulty, onStartGame, onAddBot, onRemoveBot }) {
  // Start / difficulty / bot are one-shot, server-acked actions: their guards
  // (disable-on-click + recover-on-ack/error) live in App via useOneShotAction
  // and arrive here as the *Pending booleans, so a repeated identical error can
  // never strand a button. Leave is a one-way local lock (you're on your way out).
  const [leaving, setLeaving] = useState(false);
  // Whether the bot difficulty picker is expanded (after tapping ADD BOT).
  const [showBotPicker, setShowBotPicker] = useState(false);
  const { sound } = useSound();

  // Mascot reacts when the roster GROWS: a quick excited pop (pure presentation,
  // diffed off the existing player list - no new game state). The 600ms window
  // also keeps the waiting mascot mounted just long enough to play the pop even
  // when that same join makes the room startable (and the block would otherwise
  // unmount instantly).
  const [joinPop, setJoinPop] = useState(false);
  const prevPlayerCountRef = useRef(room ? room.players.length : 0);
  const joinPopTimerRef = useRef(null);
  useEffect(() => {
    const n = room ? room.players.length : 0;
    if (n > prevPlayerCountRef.current) {
      setJoinPop(true);
      sound.playerJoin(); // a bright arrival pop as the new chip slams in
      if (joinPopTimerRef.current) clearTimeout(joinPopTimerRef.current);
      joinPopTimerRef.current = setTimeout(() => setJoinPop(false), 600);
    }
    prevPlayerCountRef.current = n;
    // sound is stable (apiRef); react to roster changes only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room]);
  useEffect(() => () => clearTimeout(joinPopTimerRef.current), []);

  if (!room) return null;

  const isHost = myId !== null && myId === room.hostId;
  const minPlayers = minPlayersFor(room.gameType);
  // Category Blitz has a solo mode: a single player racing the clock alone, so
  // it can start with just one. Word Bomb and Imposter Word still need a crowd.
  const isSoloCategoryBlitz =
    room.gameType === 'category-blitz' && room.players.length === 1;
  const canStart = isSoloCategoryBlitz || room.players.length >= minPlayers;

  // ---- Solo bot opponent (Word Bomb / Category Blitz) ----
  const humanCount = room.players.filter((p) => !p.isBot).length;
  const bot = room.players.find((p) => p.isBot);
  // The host can add ONE bot when they're alone in a bot-capable mode. (The
  // server enforces the same; this just shows/hides the control.)
  const canAddBot =
    isHost && BOT_GAME_TYPES.includes(room.gameType) && humanCount === 1 && !bot;

  function handleAddBot(difficulty) {
    sound.click();
    setShowBotPicker(false);
    if (onAddBot) onAddBot(difficulty);
  }

  function handleRemoveBot() {
    sound.click();
    setShowBotPicker(false);
    if (onRemoveBot) onRemoveBot();
  }

  function handleStartGame() {
    if (startPending) return; // guard re-enables on the server ack/error (App)
    sound.click(); // the countdown beeps follow once the game screen mounts
    onStartGame();
  }

  function handleLeave() {
    if (leaving) return;
    sound.click();
    setLeaving(true);
    onLeave();
  }

  // ---- Invite link (the frictionless join loop) ----
  // COPY writes the ?join=CODE deep link to the clipboard (with a brief ✓
  // confirmation); SHARE opens the native sheet where the platform has one
  // (mobile). Both are room-code-pure — no game state touched.
  const [inviteCopied, setInviteCopied] = useState(false);
  const inviteCopiedTimerRef = useRef(null);
  const canNativeShare = typeof navigator !== 'undefined' && !!navigator.share;
  useEffect(() => () => clearTimeout(inviteCopiedTimerRef.current), []);

  async function handleCopyInvite() {
    sound.click();
    const link = inviteLink(room.code);
    try {
      await navigator.clipboard.writeText(link);
      setInviteCopied(true);
      clearTimeout(inviteCopiedTimerRef.current);
      inviteCopiedTimerRef.current = setTimeout(() => setInviteCopied(false), 1600);
      track('invite_link_copied', { method: 'copy' });
    } catch {
      // Clipboard blocked (permissions / http): fall back to the native sheet
      // if there is one; otherwise select-able prompt is overkill — just no-op.
      if (canNativeShare) handleShareInvite();
    }
  }

  async function handleShareInvite() {
    sound.click();
    try {
      await navigator.share({
        title: 'TYPE A WORD',
        text: `join my room — type fast. die slow. code ${room.code}`,
        url: inviteLink(room.code),
      });
      track('invite_link_copied', { method: 'native' });
    } catch {
      /* user cancelled the sheet — nothing to do */
    }
  }

  return (
    <div className="room-wrap">
      <div className="room-box">
        <div className="room-label">ROOM CODE</div>
        <div className="room-code">
          <WaveText text={room.code} />
        </div>
        <div className="room-hint">SHARE THIS CODE WITH FRIENDS TO JOIN</div>

        {/* One-tap invite: copies (or natively shares, where supported) a
            ?join=CODE deep link that drops a friend STRAIGHT into this room —
            no name prompt, no code typing. */}
        <div className="room-invite-row">
          <button className="room-invite-btn" onClick={handleCopyInvite}>
            {inviteCopied ? '✓ LINK COPIED' : '⧉ COPY INVITE LINK'}
          </button>
          {canNativeShare && (
            <button className="room-invite-btn room-invite-share" onClick={handleShareInvite}>
              📣 SHARE
            </button>
          )}
        </div>

        <div className="room-players-label">PLAYERS ({room.players.length})</div>
        <div className="room-players-list">
          {room.players.map((player) => {
            const pc = resolvePlayerColor(playerColors, player.id);
            // Each player sits in a keyed SLOT. Because the list is keyed by
            // player id, an existing player's slot is preserved across room
            // updates while a newly-arrived player mounts a FRESH slot - which
            // replays the one-shot colored slam-in entrance (chip-slam-in) on
            // the inner chip. So people "slam into" the lobby as they arrive
            // (Jackbox-style), and on first entry the whole roster slams in. The
            // slot carries the gentle idle rock; the chip carries the entrance,
            // so the two transforms never fight (same split as the game cards).
            return (
              <div key={player.id} className="room-player-slot">
                <div
                  className="room-player-chip"
                  style={{ '--pc': pc.color, '--pc-dark': pc.dark }}
                >
                  <PlayerDot color={pc.color} dark={pc.dark} tier={pc.tier} />
                  <span className="room-player-name">{player.name}</span>
                  {player.id === room.hostId && <span className="room-host-badge">HOST</span>}
                  {player.isBot && (
                    <span className="room-bot-badge">
                      BOT · {botDifficultyLabel(player.botDifficulty)}
                    </span>
                  )}
                  {player.isBot && isHost && (
                    <button
                      className="room-bot-remove"
                      disabled={botPending}
                      onClick={handleRemoveBot}
                      title="Remove this bot"
                      aria-label="Remove bot"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Fill the dead air while there still aren't enough players: the mascot
            loiters next to the roster, impatiently swaying (the bored sway is a
            wrapper animation, so it composes with the mascot's own idle bounce +
            its bored fidget), under a softly pulsing "waiting for players" cue.
            Also shown briefly on a join so the excited pop can play even once the
            room has become startable. */}
        {((!canStart && !canAddBot) || joinPop) && (
          <div className="room-waiting">
            <div className="room-waiting-mascot">
              <Mascot
                pose={joinPop ? 'celebrate' : 'idle'}
                emote={joinPop ? 'pop' : 'bored'}
                size={84}
              />
            </div>
            {!canStart && !canAddBot && (
              <div className="room-waiting-cue">WAITING FOR PLAYERS...</div>
            )}
          </div>
        )}

        {/* Solo Word Bomb / Category Blitz: rather than wait for a human, the
            lone player can add a bot opponent at a difficulty of their choosing
            (the bot's own skill, separate from the timer difficulty below). */}
        {canAddBot && (
          <div className="room-addbot">
            {!showBotPicker ? (
              <button
                className="room-addbot-btn"
                onClick={() => {
                  sound.click();
                  setShowBotPicker(true);
                }}
              >
                🤖 ADD BOT OPPONENT
              </button>
            ) : (
              <>
                <div className="room-addbot-label">PICK BOT DIFFICULTY</div>
                <div className="room-addbot-row">
                  {BOT_DIFFICULTIES.map((d) => (
                    <button
                      key={d.key}
                      className="room-addbot-diff"
                      disabled={botPending}
                      onClick={() => handleAddBot(d.key)}
                    >
                      <span className="room-addbot-name">{d.label}</span>
                      <span className="room-addbot-desc">{d.desc}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* The game-mode picker is hidden when the player already chose a
            specific game from the homepage (preselectedGame) - it's locked in.
            It only appears when they came through generic "Create Room". */}
        {!preselectedGame && (
          <>
            <div className="room-section-label">GAME MODE</div>
            {isHost ? (
              <div className="room-gametype-row">
                {GAME_TYPES.map((gt) => (
                  <button
                    key={gt.key}
                    className={`room-gametype-btn${room.gameType === gt.key ? ' selected' : ''}`}
                    onClick={() => {
                      sound.click();
                      onSetGameType(gt.key);
                    }}
                  >
                    {gt.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="room-difficulty-readonly">{gameTypeLabel(room.gameType)}</div>
            )}
          </>
        )}

        {/* DIFFICULTY is a Word Bomb concept (the HARD/CRAZY/HELL timer tiers).
            Category Blitz and Imposter have no difficulty control, so render none
            for them — the desc/readout helpers stay defined, just not used here. */}
        {room.gameType === 'word-bomb' && (
          <>
            <div className="room-section-label">DIFFICULTY</div>
            {isHost ? (
              <div className="room-difficulty-row">
                {DIFFICULTIES.map((diff) => (
                  <button
                    key={diff.key}
                    className={`room-difficulty-btn${room.difficultyKey === diff.key ? ' selected' : ''}`}
                    disabled={diffPending}
                    onClick={() => {
                      sound.click();
                      onSetDifficulty(diff.key);
                    }}
                  >
                    <span className="room-difficulty-name">{diff.label}</span>
                    <span className="room-difficulty-desc">{difficultyDesc(diff, room.gameType)}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="room-difficulty-readonly">{difficultyReadout(room.difficultyKey, room.gameType)}</div>
            )}
          </>
        )}

        {/* A bounced start (server rejection: room full, game already going, etc.)
            re-enables the button via the effect above - surface WHY right next to
            START so the host isn't left guessing. Host-only (only they see START);
            App clears serverError on the next room_update, so it never lingers. */}
        {isHost && serverError && (
          <div className="room-error" role="alert">{serverError}</div>
        )}

        {isHost ? (
          <button
            className="room-start-btn"
            onClick={handleStartGame}
            disabled={!canStart || startPending}
          >
            {!canStart
              ? `NEED ${minPlayers}+ PLAYERS TO START`
              : startPending
              ? 'STARTING...'
              : isSoloCategoryBlitz
              ? 'PLAY SOLO'
              : 'START GAME'}
          </button>
        ) : (
          <div className="room-waiting-msg">WAITING FOR HOST TO START THE GAME...</div>
        )}

        <button
          className={`room-leave-btn${leaving ? ' disabled' : ''}`}
          onClick={handleLeave}
          disabled={leaving}
        >
          LEAVE ROOM
        </button>
      </div>
    </div>
  );
}