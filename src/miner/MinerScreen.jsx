// MinerScreen.jsx — the live MINER board: the SHAFT (one column per miner, digging down toward the CORE),
// the prompt + one-answer input, the reveal, and the results. Everything it shows comes from the server's
// miner_* frames (minerState.js); the only local decision is the instant "type something" nudge.
//
// ART VS MOTION: the shaft wall, the digger, the ores and the lamps are painted assets (public/miner/,
// public/cards/miner-*.webp); CSS only moves them. MOTION: transform/opacity only, every animation finite —
// a digger slides down (400ms) when its depth lands, an ore pops once on a find, the bell bar drains once
// per round. Nothing loops at rest.
import { useEffect, useMemo, useRef, useState } from 'react';
import { ORES, MINER_REASON_COPY } from './config';
import { secondsLeft } from './minerState';
import { formatNum } from '../format';
import { noteTypedLetters } from '../progress/letterXp.js';
import { usePlayClock } from '../progress/playClock.js';
import { GemPop, GemsEarnedLine, useGemsRunMark } from '../components/gems/Gems';
import { XpEarnedLine, useGameXpRunMark } from '../components/xp/XpEarned';
import ContractDoneLine from '../components/contracts/ContractDoneLine.jsx';
import RebirthReadyButton from '../components/RebirthReadyButton.jsx';
import { payGameResult } from '../progress/gems';
import { otherSeatIds } from '../progress/seats';
import FitText from '../components/kit/FitText.jsx';
import './Miner.css';

const HERO = '/cards/miner-hero.webp';
const LAMP = '/miner/lamp.webp';

function useNow(active) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return undefined;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

function ordinal(n) {
  const s = ['TH', 'ST', 'ND', 'RD'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

export function OreIcon({ ore, size = 'md', pop = false }) {
  const o = ORES[ore];
  if (!o) return null;
  return (
    <img
      className={`mn-ore mn-ore-${size}${pop ? ' is-pop' : ''}`}
      src={o.art}
      alt={o.name}
      draggable="false"
      decoding="async"
    />
  );
}

function Lamps({ lives, max = 3 }) {
  return (
    <span className="mn-lamps" aria-label={`${lives} of ${max} lives`}>
      {Array.from({ length: max }, (_, i) => (
        <img key={i} className={`mn-lamp${i < lives ? '' : ' is-out'}`} src={LAMP} alt="" aria-hidden="true" draggable="false" />
      ))}
    </span>
  );
}

function Shaft({ miner, myId }) {
  const target = miner?.target || 500;
  const miners = miner?.miners || [];
  const digging = miner?.status === 'digging';
  const reveal = miner?.status === 'reveal' ? miner.reveal : null;
  const winners = new Set(miner?.over?.winnerIds || []);
  return (
    <section className="mn-shaft" aria-label="The mine" data-count={miners.length}>
      <img className="mn-shaft-wall" src="/cards/miner-bg.webp" alt="" aria-hidden="true" draggable="false" />
      <ol className="mn-cols">
        {miners.map((m) => {
          const d = Math.min(1, (m.depth || 0) / target);
          const pick = reveal ? reveal.picks.find((p) => p.id === m.id) : null;
          const cls = [
            'mn-col',
            m.id === myId ? 'is-me' : '',
            m.out ? 'is-out' : '',
            m.left ? 'is-left' : '',
            winners.has(m.id) ? 'is-winner' : '',
          ].filter(Boolean).join(' ');
          return (
            <li key={m.id} className={cls} style={{ '--d': d }} data-miner-id={m.id} data-depth={m.depth || 0}>
              <FitText className="mn-col-name">{m.id === myId ? 'YOU' : m.name}</FitText>
              <div className="mn-col-track">
                <div className="mn-col-dug" aria-hidden="true" />
                <div className="mn-col-slide" aria-hidden="true">
                  <img className="mn-digger" src={HERO} alt="" draggable="false" />
                  {pick && pick.ore && <OreIcon ore={pick.ore} size="sm" pop key={`p${reveal.round}`} />}
                </div>
                {digging && m.locked && <span className="mn-col-lock" aria-label="locked in">✓</span>}
              </div>
              <span className="mn-col-depth">{formatNum(m.depth || 0)}m</span>
              <Lamps lives={m.lives ?? 3} />
            </li>
          );
        })}
      </ol>
      <span className="mn-core" aria-label={`The core at ${target} metres`}>CORE {target}m</span>
    </section>
  );
}

export default function MinerScreen({
  miner,
  myId,
  audioSlot,
  earned,
  againPending,
  onSubmit,
  onLocalReject,
  onAgain,
  onLeave,
}) {
  usePlayClock();
  const [text, setText] = useState('');
  const [shakeSeq, setShakeSeq] = useState(0);
  const inputRef = useRef(null);
  const status = miner ? miner.status : 'countdown';
  const now = useNow(status === 'countdown' || status === 'digging' || status === 'reveal');
  const me = (miner?.miners || []).find((m) => m.id === myId) || null;
  const out = !!(me && (me.out || me.left));
  const myPick = miner?.myPick || null;
  const result = miner?.lastResult || null;
  const resultSeq = miner?.resultSeq || 0;
  const goIn = miner?.goAt ? miner.goAt - now : 0;
  const counting = status === 'countdown' && goIn > 0;
  const canType = status === 'digging' && !myPick && !out;

  // a new round clears the box and puts the cursor back in it
  const round = miner?.round || 0;
  // the bell drains ONCE per round from what was left when the round arrived (never re-timed per render)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const bellMs = useMemo(() => Math.max(0, (miner?.endsAt || Date.now()) - Date.now()), [round, status === 'digging']);
  useEffect(() => {
    setText('');
    if (canType && inputRef.current) inputRef.current.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, status]);

  useEffect(() => {
    if (!resultSeq || !result) return;
    if (result.accepted) setText('');
    else setShakeSeq((n) => n + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultSeq]);

  function submit(e) {
    e.preventDefault();
    const answer = text.trim();
    if (!canType) return;
    if (!answer) {
      onLocalReject({ accepted: false, answer: '', reason: 'too_short' });
      return;
    }
    onSubmit(answer);
  }

  const over = status === 'over' ? miner.over : null;
  const standings = over?.standings || [];
  const iWon = !!over && over.winnerIds.includes(myId);
  const myPlace = over ? standings.findIndex((s) => s.id === myId) + 1 : 0;

  // GEMS: one payout at the end — a miner who finished shallower than me is beaten (gems.payGameResult dedupes).
  const playing = status === 'digging' || status === 'reveal';
  const gemsSince = useGemsRunMark(playing);
  const xpSince = useGameXpRunMark(playing);
  useEffect(() => {
    if (!over) return;
    const mine = standings.find((s) => s.id === myId);
    const myDepth = mine ? mine.depth : 0;
    const rivals = standings
      .filter((s) => s.id !== myId)
      .map((s) => ({ id: s.id, isBot: !!s.isBot, beaten: iWon ? !over.winnerIds.includes(s.id) : s.depth < myDepth }));
    payGameResult({ key: `miner-${miner.gameKey}`, iWon, rivals, selfIds: otherSeatIds(), mode: 'category-blitz' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [over]);

  const rejectCopy = result && !result.accepted ? MINER_REASON_COPY[result.reason] || 'NOT ACCEPTED' : null;
  const left = secondsLeft(miner?.endsAt, now);
  const reveal = status === 'reveal' ? miner.reveal : null;
  const names = Object.fromEntries((miner?.miners || []).map((m) => [m.id, m.id === myId ? 'YOU' : m.name]));

  return (
    <div className="mn-root" data-miner-status={status}>
      <header className="mn-head">
        <span className="mn-chip">MINER</span>
        {round > 0 && status !== 'over' && <span className="mn-round">#{round}</span>}
        <div className="mn-head-actions">
          {audioSlot}
          <button type="button" className="mn-btn mn-btn-ghost" onClick={onLeave}>
            LEAVE
          </button>
        </div>
      </header>

      <div className="mn-body">
        <Shaft miner={miner} myId={myId} />

        <section className="mn-play" aria-live="polite">
          <GemPop />
          {counting && (
            <div className="mn-count-wrap">
              <span className="mn-count" key={Math.ceil(goIn / 1000)}>{Math.ceil(goIn / 1000)}</span>
            </div>
          )}

          {status === 'digging' && (
            <>
              <h2 className="mn-prompt" data-testid="miner-prompt">{miner.prompt}</h2>
              <div className="mn-bell" aria-label={`${left} seconds left`}>
                <span
                  className="mn-bell-fill"
                  key={`bell-${round}`}
                  style={{ animationDuration: `${bellMs}ms` }}
                />
                <span className="mn-bell-num">{left}</span>
              </div>
              {myPick ? (
                <div className="mn-locked" data-testid="miner-locked" data-ore={myPick.ore}>
                  <OreIcon ore={myPick.ore} size="lg" pop />
                  <span className="mn-locked-word">{myPick.answer}</span>
                  <span className="mn-locked-ore" style={{ color: ORES[myPick.ore]?.color }}>
                    {ORES[myPick.ore]?.name} +{myPick.depth}m
                  </span>
                </div>
              ) : out ? (
                <p className="mn-out">CAVED IN</p>
              ) : (
                <form className={`mn-form${shakeSeq ? ` mn-shake-${shakeSeq % 2}` : ''}`} onSubmit={submit}>
                  <input
                    ref={inputRef}
                    className="mn-input"
                    value={text}
                    onChange={(e) => {
                      noteTypedLetters(text, e.target.value, 'category-blitz');
                      setText(e.target.value.slice(0, 40));
                    }}
                    placeholder="DIG FOR A RARE ONE"
                    aria-label="Your answer"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    enterKeyHint="go"
                  />
                  <button type="submit" className="mn-btn mn-btn-go">DIG</button>
                </form>
              )}
              <p className={`mn-toast${rejectCopy ? ' is-reject' : ''}`} role="status" data-reason={rejectCopy ? result.reason : ''}>
                {rejectCopy || ' '}
              </p>
            </>
          )}

          {reveal && (
            <div className="mn-reveal" data-testid="miner-reveal">
              <h2 className="mn-prompt mn-prompt-sm">{reveal.prompt}</h2>
              <ol className="mn-picks">
                {[...reveal.picks].sort((a, b) => (b.gained || 0) - (a.gained || 0)).map((p) => (
                  <li key={p.id} className={`mn-pick${p.id === myId ? ' is-me' : ''}${p.caveIn ? ' is-cave' : ''}`}>
                    <FitText className="mn-pick-name">{names[p.id] || '?'}</FitText>
                    {p.caveIn ? (
                      <span className="mn-pick-word">CAVE-IN</span>
                    ) : (
                      <>
                        <OreIcon ore={p.ore} size="sm" />
                        <span className="mn-pick-word">{p.answer}</span>
                      </>
                    )}
                    <span className="mn-pick-gain">{p.caveIn ? '−1' : `+${p.gained}m`}{p.shared ? ' ½' : ''}</span>
                  </li>
                ))}
              </ol>
              {reveal.diamond && (
                <p className="mn-deep">
                  <OreIcon ore="diamond" size="sm" />
                  <span className="mn-deep-word">{reveal.diamond}</span>
                </p>
              )}
            </div>
          )}

          {over && (
            <div className="mn-over" data-testid="miner-over">
              <div className="mn-over-hero">
                <img className={`mn-over-digger${iWon ? ' is-win' : ''}`} src={HERO} alt="" draggable="false" />
                <h2 className="mn-over-title">{iWon ? 'YOU HIT THE CORE!' : `${ordinal(myPlace || standings.length)} PLACE`}</h2>
              </div>
              <ol className="mn-standings">
                {standings.map((s, i) => (
                  <li key={s.id} className={`mn-st${s.id === myId ? ' is-me' : ''}${over.winnerIds.includes(s.id) ? ' is-winner' : ''}`}>
                    <span className="mn-st-place">{ordinal(i + 1)}</span>
                    <FitText className="mn-st-name">{s.id === myId ? 'YOU' : s.name}</FitText>
                    {s.best ? (
                      <span className="mn-st-best">
                        <OreIcon ore={s.best.ore} size="sm" />
                        <span className="mn-st-best-word">{s.best.text}</span>
                      </span>
                    ) : <span className="mn-st-best" />}
                    <span className="mn-st-depth">{formatNum(s.depth)}m</span>
                  </li>
                ))}
              </ol>
              <p className="mn-earn">+{formatNum(earned?.wins || 0)} WINS</p>
              <XpEarnedLine since={xpSince} />
              <GemsEarnedLine since={gemsSince} />
              <ContractDoneLine since={gemsSince} />
              <div className="mn-over-actions">
                <RebirthReadyButton onGo={onLeave} />
                <button type="button" className="mn-btn mn-btn-go" onClick={onAgain} disabled={againPending}>
                  DIG AGAIN
                </button>
                <button type="button" className="mn-btn mn-btn-ghost" onClick={onLeave}>
                  MENU
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
