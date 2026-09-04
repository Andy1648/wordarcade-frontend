import { useEffect } from 'react';
import { sndWordAccepted, sndWordRejected, sndRunOver } from '../audio/gameSounds';
import { markPlayed } from '../visitHistory';
import { addWords } from '../wordCount';
import { bankWordWins, awardWins } from '../progress/wins';
import { awardWordXp, cappedWordMult } from '../progress/xp';
import { freshCombo, comboAccept, comboBreak } from '../progress/combo';
import { makeLuckyOracle, luckyReward, randomSeed } from '../progress/luck';
import { recordAcceptedWord } from '../progress/collection';
import { noteWord, noteLucky } from '../progress/records';
import { wordSenseWinsFactor } from '../progress/wordSense';
import { rarityOf, isRarityIndexLoaded, whenRarityReady } from '../progress/rarityIndex';
import { saveDailyState, recordDailyResult, resolveDailyScore } from '../daily/streak.js';
import { friendlyError } from '../friendlyError';
import { track } from '../lib/analytics';

// Server frame types that resolve an in-flight action (see the one-shot guard bump
// at the end of the drain). Timer/typing frames are intentionally excluded so an
// in-flight reroll guard is not cleared early by an unrelated tick.
const RESOLVING_TYPES = new Set([
  'room_update',
  'game_reset',
  'game_started',
  'round_start',
  'error',
]);

// Kill-feed flavor lines shown when a player is eliminated (their last life is
// lost). `{player}` is replaced with the eliminated player's name. FNF/Newgrounds
// voice, curated from the content review pile.
const KILL_FEED_LINES = [
  '{player} CHOKED.',
  '{player} ran out of words.',
  '{player} got DELETED.',
  'The bomb chose {player}.',
  '{player} forgot how to read.',
  '{player} typed nothing. bold strategy.',
  '{player} got cooked.',
  '{player} fumbled the bag.',
  '{player} ran out of time AND talent.',
  '{player} blew up. literally.',
  "{player}'s brain buffered.",
  '{player} got left on read by the dictionary.',
  '{player} is no longer with us.',
  '{player} rage quit (mentally).',
  "{player} couldn't spell their way out.",
  '{player} got bodied by the alphabet.',
  '{player} typed like the wifi was lagging.',
  '{player} let the clock cook them.',
  '{player} sent it. it did not send.',
  '{player} took an L in real time.',
  '{player} spelled it wrong. tragic.',
  '{player} hit submit on nothing.',
  '{player} blinked and it was over.',
  '{player} got outspelled by a 7th grader.',
  '{player} panicked and froze.',
  "{player}'s autocorrect betrayed them.",
  '{player} ran the clock all the way down.',
  '{player} brought a knife to a word fight.',
  '{player} got ratioed by the dictionary.',
  '{player} typed three letters and gave up.',
  '{player} got speedrun out of the game.',
  '{player} ghosted their own turn.',
  '{player} forgot words exist.',
  '{player} got humbled by a vowel.',
  '{player} folded under pressure.',
  '{player} lagged out of relevance.',
  '{player} pressed enter and prayed. it failed.',
  '{player} got benched by a bomb.',
];

// Extracted verbatim from App.jsx (the WS drain). The hook receives every component-
// scope setter/ref/value it closes over via `deps` (from App + the room/overlay/
// progression hooks); the effect body is byte-identical to its App original.
export function useGameSocket(deps) {
  const {
    blitzComboRef, blitzLuckyOracleRef, categoryTotalsRef, consumeMessages, dailyStateRef, drawLucky, 
    feedCurrentRef, feedPrevLivesRef, feedReasonRef, gameDifficultyRef, gameModeRef, gameStartMsRef, 
    messages, myBlitzAcceptedRef, myBlitzWeightRef, myIdRef, myNameRef, myOutstandingWordsRef, 
    myWbAcceptedRef, myWbWeightRef, playerCountRef, reactionIdRef, reconnectTimerRef, rejoinPendingRef, 
    rejoinSentRef, rerollKeyRef, setCategoryRerolls, setCategoryRound, setCategoryScores, setCategoryTotals, 
    setCheckingAnswer, setDailyResult, setDailyState, setFeedEvents, setGameNonce, setGameOver, 
    setGameState, setGameStats, setGameType, setIsDailyGame, setLastReroll, setLastWordResult, 
    setLinkJoinPending, setMyAnswers, setMyId, setPlayerProgress, setPublicRooms, setReactions, 
    setReconnect, setRoom, setRoomClosedNotice, setRoundResults, setServerError, setServerEventId, 
    setTimerSeconds, setTypingText, setView, setWinsEarnedTotal, setWinsTally, setWinsWords, 
    wbComboRef, wbLuckyOracleRef, 
  } = deps;

  useEffect(() => {
    if (!messages.length) return;
    // Drain the FIFO queue in arrival order so co-arriving frames (e.g.
    // game_started immediately followed by room_update) are EACH processed -
    // batched delivery can no longer collapse them into just the latest one.
    // (Body left at its original indent so the fix reads as a pure wrapper.)
    let sawResolving = false;
    for (const lastMessage of messages) {
    if (!lastMessage) continue;
    // Track whether this drain carried any action-resolving frame, so we bump the
    // one-shot guard signal exactly once below (even if several arrive together).
    if (RESOLVING_TYPES.has(lastMessage.type)) sawResolving = true;

    if (lastMessage.type === 'connected') {
      setMyId(lastMessage.payload.id);
      myIdRef.current = lastMessage.payload.id; // live copy for this drain effect
    }

    // Public-room browser list refresh (response to list_public_rooms).
    if (lastMessage.type === 'public_rooms') {
      setPublicRooms(lastMessage.payload.rooms || []);
    }

    if (lastMessage.type === 'room_update') {
      // feat/reconnect: a room_update while a rejoin is in flight = we're back in (a waiting/finished
      // room accepted us). Clear the reconnect overlay; the normal handling below restores state.
      if (rejoinPendingRef.current) {
        rejoinPendingRef.current = false;
        rejoinSentRef.current = false;
        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = null;
        }
        setReconnect(null);
      }
      setRoom(lastMessage.payload);
      setServerError('');
      setLinkJoinPending(false); // invite-link join answered (we're in)
      // Only fall back to the room view if we're not currently in a game. A
      // room_update can land right after game_started (host start) and would
      // otherwise yank the player back out of the match. The rematch flow sends
      // an explicit game_reset to drive the game -> room transition instead.
      // 'cg-arm' is guarded the SAME way: the cg provisioning add_bot broadcasts a
      // room_update while the player is still on the arm screen — it must NOT pull
      // them into the waiting room; they leave cg-arm only via game_started.
      // Functional update so we read the LIVE view, not the stale `view` captured
      // in this effect's closure (the effect is keyed only on [lastMessage]).
      setView((prev) => (prev === 'game' || prev === 'cg-arm' ? prev : 'room'));
    }

    if (lastMessage.type === 'game_reset') {
      // Host rematch: the room data already arrived via room_update; this is
      // the explicit cue to leave the game view and return to the lobby.
      setView('room');
    }

    // The server closed the room out from under us (idle reap, or an internal
    // error the backend contained to this room). There is no seat to return
    // to, so surface a blocking notice whose only exit is the menu - the
    // alternative is a lobby that silently stopped responding.
    if (lastMessage.type === 'room_closed') {
      setRoomClosedNotice(
        lastMessage.payload?.reason === 'server_error'
          ? 'THE SERVER HIT A GLITCH AND CLOSED THIS ROOM. GRAB A FRESH ONE.'
          : 'THIS ROOM SAT QUIET TOO LONG, SO THE SERVER SWEPT IT AWAY.'
      );
    }

    if (lastMessage.type === 'game_started') {
      setGameType(lastMessage.payload.gameType || 'word-bomb');
      setIsDailyGame(!!lastMessage.payload.daily);
      setGameNonce((n) => n + 1);
      setCategoryRerolls(null);
      setLastReroll(null);
      setGameOver(null);
      setServerError('');
      // Fresh game - wipe the live feed and its bookkeeping.
      setFeedEvents([]);
      setReactions([]);
      feedCurrentRef.current = { id: null, name: 'SOMEONE' };
      feedPrevLivesRef.current = {};
      feedReasonRef.current = null;
      // Fresh game - reset stats and stamp the start time.
      setGameStats({
        wordsPlayed: [],
        timeouts: [],
        skips: [],
        gameStartTime: Date.now(),
        gameEndTime: null,
      });
      myWbAcceptedRef.current = 0; // fresh game → reset my Wins accept count
      myWbWeightRef.current = 0; // fresh game → reset the rarity weight ledger
      wbComboRef.current = freshCombo(); // fresh game → reset the payout combo
      wbLuckyOracleRef.current = makeLuckyOracle(randomSeed()); // + a fresh lucky stream
      // WPM is no longer tracked in Word Bomb / Category Blitz — they're turn-based, so typing
      // speed there is meaningless (§2). Only the continuous modes + menu record it.
      myOutstandingWordsRef.current = []; // fresh game → drop any stale in-flight submits
      setWinsTally(0); // fresh game → reset the live HUD wins tally + the earned total
      setWinsWords(0);
      setWinsEarnedTotal(0);
      setView('game');
      // Daily Challenge: a fresh game clears any previous daily result; the
      // game_over handler below re-fills it if THIS game is a daily.
      setDailyResult(null);
      // Analytics: stamp start refs (read back at game_over for duration) and
      // capture the start. mode comes straight off the message (never stale).
      const startedMode = lastMessage.payload.gameType || 'word-bomb';
      gameModeRef.current = startedMode;
      gameStartMsRef.current = Date.now();
      // No longer a first-timer: future rooms default to CRAZY instead of CHILL.
      markPlayed();
      track('game_started', { mode: startedMode, daily: !!lastMessage.payload.daily });
    }

    if (lastMessage.type === 'typing_update') {
      const { playerId, text } = lastMessage.payload;
      setTypingText((prev) => ({ ...prev, [playerId]: text }));
    }

    if (lastMessage.type === 'spectator_reaction') {
      const { emoji, playerName } = lastMessage.payload;
      const id = reactionIdRef.current++;
      setReactions((prev) => {
        const next = [...prev, { id, emoji, playerName }];
        // Cap at the 5 most recent so a flood can't pile up on screen.
        return next.length > 5 ? next.slice(next.length - 5) : next;
      });
      // Auto-remove this reaction after its float animation (2s).
      setTimeout(() => {
        setReactions((prev) => prev.filter((r) => r.id !== id));
      }, 2000);
    }

    if (lastMessage.type === 'turn_update') {
      const payload = lastMessage.payload;
      setGameState(payload);
      setTimerSeconds(payload.timerSeconds);
      setLastWordResult(null);
      // New turn - wipe the typing slate so a previous typist's leftover text
      // doesn't linger under the (now stale) active player.
      setTypingText({});

      // ---- Live feed bookkeeping (Word Bomb) ----
      const players = payload.players || [];
      // Remember whose turn it is now so an incoming word_result can be
      // attributed to the submitter - the turn hasn't advanced past them yet.
      const cur = players.find((p) => p.id === payload.currentPlayerId);
      feedCurrentRef.current = cur
        ? { id: cur.id, name: cur.name }
        : { id: payload.currentPlayerId, name: 'SOMEONE' };

      // Diff lives against the previous snapshot: any player who just dropped a
      // life timed out or skipped. Which one is carried by feedReasonRef, set
      // by the turn_timeout/turn_skipped message that arrives just before this.
      const prevLives = feedPrevLivesRef.current;
      const reason = feedReasonRef.current || 'timeout';
      const lostPlayers = [];
      players.forEach((p) => {
        const before = prevLives[p.id];
        if (
          typeof before === 'number' &&
          typeof p.lives === 'number' &&
          p.lives < before
        ) {
          lostPlayers.push({ id: p.id, name: p.name, lives: p.lives });
        }
      });
      feedPrevLivesRef.current = Object.fromEntries(
        players.map((p) => [p.id, p.lives])
      );
      feedReasonRef.current = null;
      // COMBO (parity): if I just lost a life (my turn timed out / was skipped), that's a miss —
      // break my payout combo, mirroring the cosmetic streak's miss() on the same life-loss.
      if (lostPlayers.some((p) => p.id === myIdRef.current)) {
        wbComboRef.current = comboBreak(wbComboRef.current);
      }
      if (lostPlayers.length) {
        const now = Date.now();
        setFeedEvents((prev) => {
          const next = [
            ...prev,
            ...lostPlayers.map((p) => ({
              type: reason,
              playerId: p.id,
              playerName: p.name,
              timestamp: now,
            })),
          ];
          // Anyone who hit 0 lives is eliminated: add a flavor kill-feed line
          // right after their life-loss row.
          lostPlayers
            .filter((p) => typeof p.lives === 'number' && p.lives <= 0)
            .forEach((p) => {
              const line = KILL_FEED_LINES[
                Math.floor(Math.random() * KILL_FEED_LINES.length)
              ].replace('{player}', p.name);
              next.push({
                type: 'eliminated',
                playerId: p.id,
                playerName: p.name,
                message: line,
                timestamp: now,
              });
            });
          return next;
        });
        // Record the life loss in the end-game stats under its cause.
        setGameStats((prev) => {
          const key = reason === 'skip' ? 'skips' : 'timeouts';
          return {
            ...prev,
            [key]: [
              ...prev[key],
              ...lostPlayers.map((p) => ({
                playerId: p.id,
                playerName: p.name,
                timestamp: now,
              })),
            ],
          };
        });
      }
    }

    if (lastMessage.type === 'timer_tick') {
      setTimerSeconds(lastMessage.payload.secondsRemaining);
    }

    if (lastMessage.type === 'word_result') {
      const payload = lastMessage.payload;
      setLastWordResult(payload);
      // Attribute this result. Prefer a WORD MATCH against my own outstanding submits
      // over the live turn pointer (feedCurrentRef): a turn_update processed just before
      // this frame advances the pointer off me, which used to drop my accepted word from
      // the wins count (see e2e/word-bomb-scoring RACE). A match => it's mine wherever the
      // turn pointer is; no match => fall back to feedCurrentRef (a broadcast accept for
      // another player). Rejections are only sent to the submitter, so those are mine too.
      const resultWord = (payload.word || '').trim().toLowerCase();
      const q = myOutstandingWordsRef.current;
      const qIdx = resultWord ? q.indexOf(resultWord) : -1;
      if (qIdx !== -1) q.splice(qIdx, 1);
      const submitter = feedCurrentRef.current;
      const isMine = qIdx !== -1 || submitter.id === myIdRef.current;
      const attributedId = isMine ? myIdRef.current : submitter.id;
      const playerName = isMine ? myNameRef.current || 'YOU' : submitter.name || 'SOMEONE';
      if (payload.accepted) {
        const now = Date.now();
        // RARITY (word-value): scored for MY own accepted words only (the pop is my feedback);
        // hoisted so the feed event below can carry it. Null for other players' words.
        let wbRarity = null;
        // Lifetime WORDS TYPED + Wins: count ONLY the local player's own accepted words.
        // (Daily flows through this same path and counts as word-bomb — fine.)
        if (isMine) {
          sndWordAccepted(myWbAcceptedRef.current); // Job 11: accept chime, pitch climbs with count
          addWords('word-bomb');
          const prevWb = myWbAcceptedRef.current;
          myWbAcceptedRef.current += 1; // my accepted words this Word Bomb game (for Wins)
          const wbNowWords = myWbAcceptedRef.current; // snapshot for this word's banking gate
          setWinsWords(wbNowWords); // drives the pill's pre-gate state
          const wbWord = payload.word;
          // COMBO + LUCKY (parity): advance the payout combo and draw the lucky oracle NOW, at accept
          // time, and CAPTURE this word's multipliers — so even if scoring defers past the rarity
          // race, the word is weighted by the combo/lucky it had when it landed (order-safe).
          wbComboRef.current = comboAccept(wbComboRef.current);
          const wbComboMult = wbComboRef.current.mult;
          const wbLucky = luckyReward(drawLucky(wbLuckyOracleRef.current));
          if (wbLucky.lucky) noteLucky(); // permanent CHANCE record (guarded)
          // RARITY-DEPENDENT SCORING. Route through whenRarityReady so a word accepted before the
          // lazy rarity index has loaded (the RACE: rarityOf would return COMMON → underpay) is
          // scored the instant the index resolves, in word order, instead of being locked at ×1.
          // When the index is already loaded this runs SYNCHRONOUSLY (this same tick), so wbRarity
          // is set for the feed event below and nothing changes; the deferral is only the rare
          // first-~100ms cold path. Instant feedback (chime, count, pill, feed) already fired above.
          const scoreWbWord = () => {
            const r = rarityOf(wbWord);
            const prevWbWeight = myWbWeightRef.current;
            // Unified economy (Job 1): the per-word reward weight (rarity × combo × lucky, capped at
            // ×40) feeds BOTH the wins banking below AND an XP grant — parity with CHAIN/FUSE.
            const wbWeight = cappedWordMult(r.mult, wbComboMult, wbLucky.winsWeight);
            // WINS weight rides WORD SENSE (Job 4) — a wins multiplier on rarity, outside the ×40 cap.
            myWbWeightRef.current += wbWeight * wordSenseWinsFactor(r.mult);
            awardWordXp({ mode: 'word-bomb', wordLength: (wbWord || '').trim().length, weight: wbWeight });
            recordAcceptedWord(wbWord, { mode: 'word-bomb', band: r.band }); // Collection (Job 3)
            noteWord(wbWord, r); // permanent record: distinct / obscure / rarest-ever (guarded)
            // BANK wins for this word (§2): past the 3-word gate every accepted word banks
            // immediately (leaving mid-game keeps it). Payout rides the rarity WEIGHT delta,
            // gated on the accept COUNT snapshot taken when the word landed.
            const banked = bankWordWins({
              mode: 'wordBomb',
              difficulty: gameDifficultyRef.current,
              prevWords: wbNowWords - 1,
              nowWords: wbNowWords,
              prevWeight: prevWbWeight,
              nowWeight: myWbWeightRef.current,
            });
            if (banked > 0) setWinsEarnedTotal((prev) => prev + banked);
            setWinsTally(
              awardWins({ wordsAccepted: myWbAcceptedRef.current, mode: 'wordBomb', difficulty: gameDifficultyRef.current })
            );
            return r;
          };
          if (isRarityIndexLoaded()) {
            wbRarity = scoreWbWord(); // synchronous — feeds the rarity pop in the feed event below
          } else {
            whenRarityReady(scoreWbWord); // defer: score correctly on resolve, in word order
          }
        }
        setFeedEvents((prev) => [
          ...prev,
          {
            type: 'accepted',
            playerId: attributedId,
            playerName,
            word: payload.word,
            timestamp: now,
            // Rarity tag for MY own accepted words (announce=false for COMMON → the feed shows
            // nothing extra; UNCOMMON+ carry a label + tier colour for the pop).
            rarity: wbRarity && wbRarity.announce ? { label: wbRarity.label, color: wbRarity.color, band: wbRarity.band } : null,
          },
        ]);
        // Tally the accepted word for the end-game stats.
        setGameStats((prev) => ({
          ...prev,
          wordsPlayed: [
            ...prev.wordsPlayed,
            {
              word: payload.word,
              playerId: attributedId,
              playerName,
              timestamp: now,
            },
          ],
        }));
      } else {
        // Rejections are only sent to the player who submitted, so this is
        // always our own miss.
        wbComboRef.current = comboBreak(wbComboRef.current); // a reject ends the payout combo
        sndWordRejected(); // Job 11: soft reject
        setFeedEvents((prev) => [
          ...prev,
          {
            type: 'rejected',
            playerId: attributedId,
            playerName,
            reason: payload.reason,
            timestamp: Date.now(),
          },
        ]);
      }
    }

    // turn_timeout / turn_skipped arrive just before the turn_update that
    // advances play. They carry no player id, so we don't emit the feed event
    // here - we just record the reason and let the turn_update's life-loss diff
    // attribute it to the right player.
    if (lastMessage.type === 'turn_timeout') {
      feedReasonRef.current = 'timeout';
    }

    if (lastMessage.type === 'turn_skipped') {
      feedReasonRef.current = 'skip';
    }

    // ---- Category Blitz (simultaneous, round-based) ----

    if (lastMessage.type === 'round_start') {
      const payload = lastMessage.payload;
      // Category Blitz round_start. This is the SINGLE path for both a normal
      // round and a host reroll (a server-authoritative round restart): either
      // way we clear answers/progress, take the server's category + full timer,
      // and update the reroll count. A reroll keeps the same round number (so
      // CategoryBlitzScreen doesn't replay the 3-2-1) and carries `reroll`/`by`
      // so non-host clients can flash the "host rerolled" notice.
      setCategoryRound(payload);
      setTimerSeconds(payload.timerSeconds);
      setCategoryRerolls(payload.rerollsRemaining ?? null);
      setMyAnswers([]);
      myBlitzAcceptedRef.current = 0; // fresh round → reset my Wins accept count
      myBlitzWeightRef.current = 0; // fresh round → reset the rarity weight ledger
      blitzComboRef.current = freshCombo(); // fresh round → reset the payout combo (Blitz pays per round)
      blitzLuckyOracleRef.current = makeLuckyOracle(randomSeed()); // + a fresh lucky stream
      setWinsTally(0); // fresh round → reset the live HUD wins tally (Blitz pays per round)
      setWinsWords(0);
      setPlayerProgress({});
      setRoundResults(null);
      setLastWordResult(null);
      setGameOver(null);
      setCategoryScores(null);
      if (payload.round === 1) {
        setCategoryTotals({}); // fresh game
        categoryTotalsRef.current = {};
        setWinsEarnedTotal(0); // fresh Blitz game → reset the run's earned-wins total
      }
      if (payload.reroll) {
        setLastReroll({ by: payload.by, byId: payload.byId, key: rerollKeyRef.current++ });
      }
      setView('game');
    }

    // AI fallback is judging this answer (list-miss). Show the "checking…"
    // indicator until the authoritative answer_result lands.
    if (lastMessage.type === 'answer_checking') {
      setCheckingAnswer(lastMessage.payload?.answer ?? '');
    }

    if (lastMessage.type === 'answer_result') {
      const payload = lastMessage.payload;
      setCheckingAnswer(null); // result is in - drop the "checking…" state
      // RARITY (word-value): score an accepted answer and carry the verdict on the result so the
      // feedback toast can pop "RARE ×2.5". answer_result is always about MY own answer.
      const blitzRarity = payload.accepted ? rarityOf(payload.answer) : null;
      setLastWordResult(
        blitzRarity && blitzRarity.announce
          ? { ...payload, rarity: { label: blitzRarity.label, color: blitzRarity.color, band: blitzRarity.band } }
          : payload
      ); // reused to drive the feedback toast
      if (payload.accepted) {
        sndWordAccepted(myBlitzAcceptedRef.current); // Job 11: accept chime
        setMyAnswers((prev) => [...prev, payload.answer]);
        addWords('category-blitz');
        myBlitzAcceptedRef.current += 1; // my accepts this Blitz round (for Wins)
        const blitzNowWords = myBlitzAcceptedRef.current; // snapshot for this answer's banking gate
        setWinsWords(blitzNowWords); // drives the pill's pre-gate state
        const blitzAnswer = payload.answer;
        // COMBO + LUCKY (parity): advance at accept time and capture this answer's multipliers, so a
        // deferred (rarity-race) score still weights the answer by the combo/lucky it had on accept.
        blitzComboRef.current = comboAccept(blitzComboRef.current);
        const blitzComboMult = blitzComboRef.current.mult;
        const blitzLucky = luckyReward(drawLucky(blitzLuckyOracleRef.current));
        if (blitzLucky.lucky) noteLucky(); // permanent CHANCE record (guarded)
        // RARITY-DEPENDENT SCORING — same RACE fix as Word Bomb: route through whenRarityReady so an
        // answer accepted before the lazy rarity index loads is scored correctly on resolve (in
        // order), not locked at COMMON ×1. Synchronous when the index is already loaded.
        const scoreBlitzWord = () => {
          const r = rarityOf(blitzAnswer);
          const prevBlitzWeight = myBlitzWeightRef.current;
          const blitzWeight = cappedWordMult(r.mult, blitzComboMult, blitzLucky.winsWeight);
          myBlitzWeightRef.current += blitzWeight * wordSenseWinsFactor(r.mult); // WORD SENSE (Job 4)
          awardWordXp({ mode: 'category-blitz', wordLength: (blitzAnswer || '').trim().length, weight: blitzWeight });
          recordAcceptedWord(blitzAnswer, { mode: 'category-blitz', band: r.band }); // Collection (Job 3)
          noteWord(blitzAnswer, r); // permanent record: distinct / obscure / rarest-ever (guarded)
          const banked = bankWordWins({
            mode: 'blitz',
            difficulty: gameDifficultyRef.current,
            prevWords: blitzNowWords - 1,
            nowWords: blitzNowWords,
            prevWeight: prevBlitzWeight,
            nowWeight: myBlitzWeightRef.current,
          });
          if (banked > 0) setWinsEarnedTotal((prev) => prev + banked);
          setWinsTally(
            awardWins({ wordsAccepted: myBlitzAcceptedRef.current, mode: 'blitz', difficulty: gameDifficultyRef.current })
          );
        };
        if (isRarityIndexLoaded()) scoreBlitzWord();
        else whenRarityReady(scoreBlitzWord);
      } else {
        // A rejected answer is a miss → break the payout combo, mirroring the cosmetic streak's
        // miss() on the same rejected answer_result.
        blitzComboRef.current = comboBreak(blitzComboRef.current);
      }
    }

    if (lastMessage.type === 'player_progress') {
      const { playerId, answerCount } = lastMessage.payload;
      setPlayerProgress((prev) => ({ ...prev, [playerId]: answerCount }));
    }


    if (lastMessage.type === 'round_end') {
      const payload = lastMessage.payload;
      // WINS: already banked per-answer during the round (bankWordWins in answer_result) — NO
      // end-of-round payout here (that would double-pay). winsEarnedTotal already accumulated.
      setRoundResults(payload);
      setCategoryRound(null); // round over - timer stops, show results
      setLastWordResult(null);
      setCheckingAnswer(null); // drop any pending "checking…" if the round closed
      // Tally cumulative totals from this round's per-player scores.
      setCategoryTotals((prev) => {
        const next = { ...prev };
        (payload.playerResults || []).forEach((pr) => {
          next[pr.id] = (next[pr.id] || 0) + pr.roundScore;
        });
        categoryTotalsRef.current = next; // keep the sync mirror current
        return next;
      });
    }

    if (lastMessage.type === 'game_over') {
      const payload = lastMessage.payload;
      sndRunOver(); // Job 11: game-over fall (feat/sound)
      // (No wpmEnd() — fix/three-again §2 removed WPM tracking from the turn-based modes.)
      // Category Blitz carries finalScores; Word Bomb carries just winnerId.
      if (payload.finalScores) {
        setCategoryScores(payload.finalScores);
        setCategoryRound(null);
        setRoundResults(null);
      } else {
        // WINS: already banked per-word during play (bankWordWins in word_result) — NO
        // end-of-game payout here (that would double-pay). winsEarnedTotal already accumulated.
      }
      setGameOver(payload);
      // Daily Challenge completed: fold the result into the persisted streak
      // history, keyed by the SERVER's dayNumber (never the local clock).
      // recordDailyResult is same-day-replay safe (streak counts a day once),
      // so a PLAY-AGAIN-then-finish can't double-increment.
      if (payload.daily && payload.finalScores) {
        const mine = payload.finalScores.find((s) => s.id === myIdRef.current);
        // Authoritative score = the round-sum we tallied (matches the breakdown),
        // with the server scoreboard as a fallback. Using finalScores alone let a
        // missing/mismatched entry record AND show a 0 while rounds scored points.
        const dailyScore = resolveDailyScore(
          categoryTotalsRef.current[myIdRef.current],
          mine ? mine.score : undefined
        );
        // The Daily's OWN previous best (before this run) — the daily screen
        // compares against this, NOT the separate solo-CB personal best.
        const prevDailyBest =
          (dailyStateRef.current && dailyStateRef.current.bestScore) || 0;
        // A REPLAY = today was already recorded before this run. Replays keep your
        // best-of-day (streak counts a day once), so a replay that doesn't beat
        // your best isn't re-recorded — the results screen says so.
        const isReplay =
          !!dailyStateRef.current &&
          dailyStateRef.current.lastDayNumber === payload.daily.dayNumber;
        const next = recordDailyResult(
          dailyStateRef.current,
          payload.daily.dayNumber,
          dailyScore
        );
        saveDailyState(next);
        setDailyState(next);
        // NOTE: the daily STREAK feature was removed — the streak/bestStreak counters
        // are no longer surfaced anywhere. The day-tracking (best score + replay
        // detection via lastDayNumber) stays so the Daily Challenge itself still works.
        setDailyResult({
          dayNumber: payload.daily.dayNumber,
          score: dailyScore,
          prevBest: prevDailyBest,
          isReplay,
        });
      }
      // Stamp the end time so the overlay can show the game's duration.
      setGameStats((prev) => ({ ...prev, gameEndTime: Date.now() }));
      setView('game');
      // Analytics: counts/enums only (no PII). mode + duration come from refs
      // stamped at game_started; player_count from the room-synced ref — all live,
      // never stale. duration omitted if we somehow never saw a start.
      track('game_completed', {
        mode: gameModeRef.current || payload.gameType || 'word-bomb',
        player_count: playerCountRef.current,
        duration_seconds: gameStartMsRef.current
          ? Math.round((Date.now() - gameStartMsRef.current) / 1000)
          : null,
      });
    }

    if (lastMessage.type === 'error') {
      // feat/reconnect: an error while a rejoin is in flight = the room's gone (room_not_found) or the
      // game moved on (game_already_started) — we can't return to that live seat. Fall to the
      // wins-preserved landing rather than a dead screen. (Swallow the error toast in this case.)
      if (rejoinPendingRef.current) {
        rejoinPendingRef.current = false;
        rejoinSentRef.current = false;
        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = null;
        }
        setReconnect('lost');
        setLinkJoinPending(false);
        continue; // don't also surface this as a generic server error toast
      }
      setServerError(friendlyError(lastMessage.payload.message));
      setLinkJoinPending(false); // if a link join was in flight, it just failed
      // A join that failed while we're still on the HOME screen (an invite
      // link to a full/ended/unknown room) must not dead-end invisibly: land
      // on the JOIN ROOM screen, which shows the error plus live public rooms
      // to hop into instead. Functional update — the live view, not the
      // closure's stale copy.
      if (lastMessage.payload.context === 'join_room') {
        setView((prev) => (prev === 'home' ? 'browse' : prev));
      }
    }
    } // end for-of: every queued frame handled in order
    // One fresh re-enable signal per drain that carried an ack/state-change/error.
    // A counter (never an error string) so an identical repeated error still
    // re-enables the one-shot button guards.
    if (sawResolving) setServerEventId((n) => n + 1);
    // Drop exactly the frames we just processed. The hook's consume is a
    // functional update, so any frame that arrived after this snapshot is kept,
    // never skipped.
    consumeMessages(messages.length);
    // Keyed on the queue: the effect re-runs whenever new frames land and drains
    // every one. It no longer reads `view` directly (the room_update guard uses a
    // functional setView), so [messages, consumeMessages] is the complete dep list.
  // The setters/refs it calls (incl. useRoom's setMyId/setPublicRooms/setServerError/
  // setRoomClosedNotice + myIdRef) are STABLE React identities — safe to omit, and adding
  // them would defeat the deliberately-trimmed array that guards the documented drain
  // re-run / stale-closure bugs. ESLint can't tell a custom hook's returns are stable:
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, consumeMessages]);
}
