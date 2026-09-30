// WordRaceScreen.jsx — the live WORD RACE board: one lane per racer, the hero fragment, the input,
// and the results card. Everything it shows comes from the server's race_* frames (raceState.js);
// the only thing decided locally is the instant reject for the three rules the client can check
// from its own state (the same mirror Word Bomb uses), and the dictionary is always the server's.
//
// MOTION: finite and transform/opacity only — a runner slides (300ms) when its racer scores, a
// reject nudges the input. NO infinite animation: the mascot's idle breathe is switched off inside
// .wr-root (WordRace.css). Under reduced motion nothing moves and every fact is still on screen as
// text: the lane counts (7/12), the countdown number, the reject reason, the placings.
import { useEffect, useMemo, useRef, useState } from 'react';
import Mascot from '../components/Mascot';
import LayeredWord from '../components/LayeredWord';
import { RACE_REASON_COPY, precheck, myFragment } from './raceState';
import { formatNum, plural } from '../format';
import './WordRace.css';

const ACCENT = '#FFE94A';

function ordinal(n) {
  const s = ['TH', 'ST', 'ND', 'RD'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

function clockText(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function useNow(active) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return undefined;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

export default function WordRaceScreen({
  race,
  myId,
  isHost,
  audioSlot,
  earned,
  rematchPending,
  onSubmit,
  onLocalReject,
  onRematch,
  onLeave,
}) {
  const [text, setText] = useState('');
  const [shakeSeq, setShakeSeq] = useState(0);
  const inputRef = useRef(null);
  const status = race ? race.status : 'countdown';
  const now = useNow(status === 'countdown' || status === 'racing');
  const target = race?.target || 12;
  const racers = race?.racers || [];
  const me = racers.find((r) => r.id === myId) || null;
  const fragment = myFragment(race, myId);
  const nextFragment = me && race ? race.fragments[me.index + 1] || null : null;
  const used = useMemo(() => new Set(race?.myWords || []), [race?.myWords]);

  const goIn = race?.goAt ? race.goAt - now : 0;
  const counting = status === 'countdown' && goIn > 0;
  const live = status === 'racing' || (status === 'countdown' && goIn <= 0);
  const timeLeft = race?.endsAt ? race.endsAt - now : race?.capMs || 90000;
  const finished = me && me.index >= target;

  // A result for ME: clear the box on an accept; nudge it on a reject (the reason stays as text).
  const result = race?.lastResult || null;
  const resultSeq = race?.resultSeq || 0;
  useEffect(() => {
    if (!resultSeq || !result) return;
    if (result.accepted) setText('');
    else setShakeSeq((n) => n + 1);
    // Only a NEW result should act — resultSeq is the event counter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultSeq]);

  useEffect(() => {
    if (live && inputRef.current) inputRef.current.focus();
  }, [live]);

  function submit(e) {
    e.preventDefault();
    const word = text.trim().toLowerCase();
    if (!word || !live || finished) return;
    // Mirror of the server's own rules — surfaced same-frame; only the dictionary round-trips.
    const reason = precheck(word, fragment, used);
    if (reason) {
      onLocalReject({ accepted: false, word, reason, fragment, index: me ? me.index : 0 });
      return;
    }
    onSubmit(word);
  }

  const over = status === 'over' ? race.over : null;
  const standings = over?.standings || [];
  const myPlace = standings.find((s) => s.id === myId)?.place || null;
  const iWon = !!over && over.winnerId === myId;

  const rejectCopy = result && !result.accepted
    ? result.reason === 'missing_combo' && result.fragment
      ? `NEEDS "${result.fragment.toUpperCase()}"`
      : RACE_REASON_COPY[result.reason] || 'NOT ACCEPTED'
    : null;

  return (
    <div className="wr-root wall-surface" data-race-status={status}>
      <header className="wr-head">
        <span className="wr-chip">WORD RACE</span>
        <span className="wr-clock" aria-label="Time left">
          {status === 'over' ? 'FINISHED' : clockText(timeLeft)}
        </span>
        <div className="wr-head-actions">
          {audioSlot}
          <button type="button" className="wr-btn wr-btn-ghost" onClick={onLeave}>
            LEAVE
          </button>
        </div>
      </header>

      <ol className="wr-lanes" aria-label="Race lanes">
        {racers.map((r) => {
          const isMe = r.id === myId;
          const won = over && over.winnerId === r.id;
          return (
            <li
              key={r.id}
              className={`wr-lane${isMe ? ' is-me' : ''}${r.left ? ' is-left' : ''}${won ? ' is-winner' : ''}`}
              data-racer-id={r.id}
              data-racer-index={r.index}
            >
              <span className="wr-lane-name">
                <span className="wr-lane-name-txt">{r.name}</span>
                {isMe && <span className="wr-tag wr-tag-me">YOU</span>}
                {r.isBot && <span className="wr-tag">BOT</span>}
                {r.left && <span className="wr-tag">LEFT</span>}
              </span>
              <div className="wr-track" style={{ '--p': Math.min(1, r.index / target) }}>
                <div className="wr-ticks" aria-hidden="true">
                  {Array.from({ length: target }, (_, i) => (
                    <span key={i} className={`wr-tick${i < r.index ? ' is-done' : ''}`} />
                  ))}
                </div>
                <div className="wr-runner-slide" aria-hidden="true">
                  <Mascot pose={won || r.index >= target ? 'celebrate' : 'run'} size={36} className="wr-runner" />
                </div>
              </div>
              <span className="wr-lane-count">
                {r.index}/{target}
              </span>
            </li>
          );
        })}
      </ol>

      {!over && (
        <section className="wr-play">
          <div className="wr-hero" aria-live="polite">
            {counting ? (
              <span className="wr-count" key={Math.ceil(goIn / 1000)}>
                {Math.ceil(goIn / 1000)}
              </span>
            ) : finished ? (
              <span className="wr-hero-done">FINISHED — WAITING ON THE FIELD</span>
            ) : fragment ? (
              <>
                <span className="wr-sr">Type a word containing {fragment}</span>
                <LayeredWord className="wr-hero-word" text={fragment.toUpperCase()} accent={ACCENT} />
                <span className="wr-hero-sub">
                  WORD {me ? me.index + 1 : 1} OF {target}
                  {nextFragment && <> · NEXT <b>{nextFragment.toUpperCase()}</b></>}
                </span>
              </>
            ) : null}
          </div>

          <form className={`wr-form${shakeSeq ? ` wr-shake-${shakeSeq % 2}` : ''}`} onSubmit={submit}>
            <input
              ref={inputRef}
              className="wr-input"
              value={text}
              onChange={(e) => setText(e.target.value.replace(/[^a-zA-Z]/g, '').slice(0, 30))}
              disabled={!live || finished}
              placeholder={counting ? 'GET READY…' : 'TYPE A WORD'}
              aria-label="Your word"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              enterKeyHint="send"
            />
            <button type="submit" className="wr-btn wr-btn-go" disabled={!live || finished || !text.trim()}>
              SEND
            </button>
          </form>
          <p className={`wr-toast${rejectCopy ? ' is-reject' : ''}`} role="status" data-reason={result && !result.accepted ? result.reason : ''}>
            {rejectCopy || (result && result.accepted ? `✓ ${result.word.toUpperCase()}` : ' ')}
          </p>
          <p className="wr-earn" aria-label="Earned this race">
            +{formatNum(earned?.wins || 0)} WINS · +{formatNum(earned?.xp || 0)} XP
          </p>
        </section>
      )}

      {over && (
        <section className="wr-over" aria-live="polite">
          <div className="wr-over-hero">
            <Mascot pose={iWon ? 'celebrate' : 'panic'} emote={iWon ? 'celebrate' : 'slump'} size={96} />
            <div>
              <h2 className="wr-over-title">
                {iWon ? 'YOU WIN!' : over.winnerId ? `${ordinal(myPlace || standings.length)} PLACE` : 'NO FINISHERS'}
              </h2>
              <p className="wr-over-why">
                {over.reason === 'finish' && 'FIRST TO ' + target + ' WORDS'}
                {over.reason === 'cap' && 'TIME — MOST WORDS WINS'}
                {over.reason === 'forfeit' && 'THE FIELD LEFT'}
              </p>
            </div>
          </div>
          <ol className="wr-standings">
            {standings.map((s) => (
              <li key={s.id} className={s.id === myId ? 'is-me' : ''} data-standing-id={s.id}>
                <span className="wr-st-place">{ordinal(s.place)}</span>
                <span className="wr-st-name">
                  {s.name}
                  {s.isBot ? ' (BOT)' : ''}
                </span>
                <span className="wr-st-words">{plural(s.words, 'WORD')}</span>
              </li>
            ))}
          </ol>
          <p className="wr-earn wr-earn-final">
            YOU BANKED +{formatNum(earned?.wins || 0)} WINS · +{formatNum(earned?.xp || 0)} XP
          </p>
          <div className="wr-over-actions">
            <button type="button" className="wr-btn wr-btn-go" onClick={onRematch} disabled={rematchPending}>
              {isHost ? 'RACE AGAIN' : 'BACK TO LOBBY'}
            </button>
            <button type="button" className="wr-btn wr-btn-ghost" onClick={onLeave}>
              MENU
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
