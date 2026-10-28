// MinerScreen.jsx — the live MINER board. Andy oct27: "you're hunting ONE rare answer" — so the screen is built
// around the hunt for RARITY:
//   THE SIGN     "THE RAREST / PIZZA TOPPING" — the singular ask, the biggest thing on screen
//   THE LADDER   DIRT → COAL → GOLD → DIAMOND, what a find is worth; your find lights its rung
//   THE FIND     your locked answer as a big ore with "TOP 4% RAREST"
//   THE REVEAL   the round's RAREST FIND crowned (big ore, the word, who dug it) — the other picks under it,
//                and the deep cut NOBODY FOUND
//   THE RACE     one tunnel row per miner, the digger travelling toward the CORE
// Everything comes from the server's miner_* frames (minerState.js); the only local decision is the instant
// "type something" nudge.
//
// ART VS MOTION: the cave wall, the digger, the ores and the lamps are painted assets (public/miner/,
// public/cards/miner-*.webp); CSS only moves them. MOTION: transform/opacity only, every animation finite —
// the digger slides when its depth lands, an ore pops once on a find, the crown drops once, the bell drains
// once per round. Nothing loops at rest.
import { useEffect, useMemo, useRef, useState } from 'react';
import { ORES, ORE_ORDER, MINER_REASON_COPY } from './config';
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
const WALL = '/cards/miner-bg.webp';
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

/** "TOP 4% RAREST" — or OFF THE MAP for a real answer nobody ranked (a deep cut by definition). */
export function rarityLine(top) {
  return top == null ? 'OFF THE MAP' : `TOP ${top}% RAREST`;
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

/** DIRT → DIAMOND: what a find is worth. `hit` lights the rung your find landed on. */
function Ladder({ hit }) {
  return (
    <ol className="mn-ladder" aria-label="Ore ladder">
      {ORE_ORDER.map((id) => (
        <li key={id} className={`mn-rung${hit === id ? ' is-hit' : ''}`} data-ore={id}>
          <OreIcon ore={id} size="rung" pop={hit === id} />
          <span className="mn-rung-name">{ORES[id].name}</span>
          <span className="mn-rung-m">+{ORES[id].depth}M</span>
        </li>
      ))}
    </ol>
  );
}

/** THE RACE: one tunnel per miner, the digger travelling toward the CORE. */
function Race({ miner, myId }) {
  const target = miner?.target || 500;
  const miners = miner?.miners || [];
  const digging = miner?.status === 'digging';
  const reveal = miner?.status === 'reveal' ? miner.reveal : null;
  return (
    <section className="mn-race" aria-label="The race to the core" data-count={miners.length}>
      <ol className="mn-runs">
        {miners.map((m) => {
          const d = Math.min(1, (m.depth || 0) / target);
          const pick = reveal ? reveal.picks.find((p) => p.id === m.id) : null;
          const cls = ['mn-run', m.id === myId ? 'is-me' : '', m.out ? 'is-out' : '', m.left ? 'is-left' : '']
            .filter(Boolean).join(' ');
          return (
            <li key={m.id} className={cls} style={{ '--d': d }} data-miner-id={m.id} data-depth={m.depth || 0}>
              <span className="mn-run-head">
                <FitText className="mn-run-name">{m.id === myId ? 'YOU' : m.name}</FitText>
                <Lamps lives={m.lives ?? 3} />
              </span>
              <span className="mn-run-track">
                <span className="mn-run-dug" aria-hidden="true" />
                <span className="mn-run-slide" aria-hidden="true">
                  <img className="mn-run-digger" src={HERO} alt="" draggable="false" />
                  {pick && pick.ore && <OreIcon ore={pick.ore} size="xs" pop key={`p${reveal.round}`} />}
                </span>
                {digging && m.locked && <span className="mn-run-lock" aria-label="locked in">✓</span>}
              </span>
              <span className="mn-run-depth">{formatNum(m.depth || 0)}M</span>
            </li>
          );
        })}
      </ol>
      <span className="mn-core" aria-label={`The core at ${target} metres`}>CORE {target}M</span>
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

  const round = miner?.round || 0;
  // the bell drains ONCE per round from what was left when the round arrived (never re-timed per render)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const bellMs = useMemo(() => Math.max(0, (miner?.endsAt || Date.now()) - Date.now()), [round, status === 'digging']);
  // a new round clears the box and puts the cursor back in it
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

  const rejectCopy = result && !result.accepted
    ? result.message || MINER_REASON_COPY[result.reason] || 'NOT ACCEPTED'
    : null;
  const left = secondsLeft(miner?.endsAt, now);
  const reveal = status === 'reveal' ? miner.reveal : null;
  const names = Object.fromEntries((miner?.miners || []).map((m) => [m.id, m.id === myId ? 'YOU' : m.name]));
  const crown = reveal ? reveal.picks.find((p) => p.rarest) || null : null;
  const restPicks = reveal ? [...reveal.picks].filter((p) => p !== crown).sort((a, b) => (b.gained || 0) - (a.gained || 0)) : [];
  const active = (miner?.miners || []).filter((m) => !m.out && !m.left);
  const lockedN = active.filter((m) => m.locked).length;

  return (
    <div className="mn-root" data-miner-status={status}>
      <img className="mn-wall" src={WALL} alt="" aria-hidden="true" draggable="false" />
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
        <section className="mn-dig" aria-live="polite">
          <GemPop />
          {counting && (
            <div className="mn-count-wrap">
              <span className="mn-count" key={Math.ceil(goIn / 1000)}>{Math.ceil(goIn / 1000)}</span>
            </div>
          )}

          {status === 'digging' && (
            <>
              <div className="mn-sign" key={`sign-${round}`}>
                <span className="mn-sign-kick">THE RAREST</span>
                <h2 className="mn-ask" data-testid="miner-prompt">{miner.ask}</h2>
                <div className="mn-bell" aria-label={`${left} seconds left`}>
                  <span className="mn-bell-fill" key={`bell-${round}`} style={{ animationDuration: `${bellMs}ms` }} />
                  <span className="mn-bell-num">{left}</span>
                </div>
              </div>
              {myPick ? (
                <div className="mn-find" data-testid="miner-locked" data-ore={myPick.ore}>
                  <OreIcon ore={myPick.ore} size="find" pop />
                  <span className="mn-find-word">{myPick.answer}</span>
                  <span className="mn-find-rare">{rarityLine(myPick.top)}</span>
                  <span className="mn-find-wait">{lockedN}/{active.length} IN</span>
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
                    placeholder="ONE ANSWER"
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
              <Ladder hit={myPick ? myPick.ore : null} />
            </>
          )}

          {reveal && (
            <div className="mn-reveal" data-testid="miner-reveal">
              <p className="mn-reveal-ask">
                <span className="mn-reveal-kick">THE RAREST</span> {reveal.ask}
              </p>
              {crown ? (
                <div className={`mn-crown${crown.id === myId ? ' is-me' : ''}`} data-ore={crown.ore} key={`crown-${reveal.round}`}>
                  <span className="mn-crown-tag">RAREST FIND</span>
                  <OreIcon ore={crown.ore} size="crown" pop />
                  <span className="mn-crown-word">{crown.answer}</span>
                  <span className="mn-crown-meta">
                    <FitText className="mn-crown-by">{names[crown.id] || '?'}</FitText>
                    <span className="mn-crown-rare">{rarityLine(crown.top)}</span>
                    <span className="mn-crown-gain">+{crown.gained}M</span>
                  </span>
                </div>
              ) : (
                <div className="mn-crown is-none">
                  <span className="mn-crown-tag">NO RARE FINDS</span>
                </div>
              )}
              <ol className="mn-picks">
                {restPicks.map((p) => (
                  <li key={p.id} className={`mn-pick${p.id === myId ? ' is-me' : ''}${p.caveIn ? ' is-cave' : ''}`}>
                    <FitText className="mn-pick-name">{names[p.id] || '?'}</FitText>
                    {p.caveIn ? (
                      <span className="mn-pick-word">CAVE-IN</span>
                    ) : (
                      <span className="mn-pick-find">
                        <OreIcon ore={p.ore} size="xs" />
                        <span className="mn-pick-word">{p.answer}</span>
                      </span>
                    )}
                    <span className="mn-pick-gain">{p.caveIn ? '−1' : `+${p.gained}M`}{p.shared ? ' ½' : ''}</span>
                  </li>
                ))}
              </ol>
              {reveal.diamond && (
                <p className="mn-deep">
                  <OreIcon ore="diamond" size="xs" />
                  <span className="mn-deep-tag">NOBODY FOUND</span>
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
                        <OreIcon ore={s.best.ore} size="xs" />
                        <span className="mn-st-best-word">{s.best.text}</span>
                      </span>
                    ) : <span className="mn-st-best" />}
                    <span className="mn-st-depth">{formatNum(s.depth)}M</span>
                  </li>
                ))}
              </ol>
              <div className="mn-over-pay">
                <p className="mn-earn">+{formatNum(earned?.wins || 0)} WINS</p>
                <XpEarnedLine since={xpSince} />
                <GemsEarnedLine since={gemsSince} />
                <ContractDoneLine since={gemsSince} />
              </div>
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

        <Race miner={miner} myId={myId} />
      </div>
    </div>
  );
}
