// SatRushResults.jsx — the death / score reveal, as one manga PAGE (ink on paper,
// double-ruled panels, screentone plates — no spot colour). Death still dominates
// entry: the CASE CLOSED stamp slams, the score + AVG ANTE
// count up on the shared JUICE.CELEBRATION timings (same staged sequence Category
// Blitz solo results use), then the rest of the page staggers in. AVG ANTE stays
// working untouched; only its container is styled to sit on the page.
import { useEffect, useRef, useState } from 'react';
import { formatNum } from '../format';
import { createCountUp } from '../juice/countUp';
import { JUICE, prefersReducedMotion } from '../juice';
import * as juice from './juice';
import TryModeRow from '../share/TryModeRow.jsx';
import ClaimPrompt from '../leaderboard/ClaimPrompt.jsx';
import RebirthReadyButton from '../components/RebirthReadyButton.jsx';
import { MORE_MODES } from '../gameData';

const C = JUICE.CELEBRATION;

// One runLog entry -> its film-strip frame. Special states keep a GLYPH mark, so
// clear/miss and deep/rev/silver read by shape + label, never colour alone.
function frameOf(e) {
  const glyph = e.silver ? '✦' : e.deepCut ? '◆' : e.revenant ? '↺' : e.ok ? '' : '✕';
  const kind = e.ok ? 'ok' : 'miss';
  const parts = [e.ok ? 'captured' : 'got away'];
  if (e.silver) parts.push('silver tongue');
  if (e.deepCut) parts.push('deep cut');
  if (e.revenant) parts.push('revenant');
  return { glyph, kind, label: parts.join(', ') };
}

export default function SatRushResults({ results, winsEarned = 0, winsBonusLines = [], onAgain, onExit, offerMenu = false }) {
  // STEP 57 (Andy oct2: "make CASE CLOSED clear, satisfying and consistent with the other modes"):
  // the page leads with what every other mode's run-over card leads with — how many you got (here:
  // CAPTURED) and the WINS it paid — and the mode's own numbers (score, avg ante, streak, mastered)
  // move to one ruled line under them. These two are what count up.
  const finalScore = results.cleared || 0;
  const finalAnte = winsEarned || 0;
  // H6/H15: bonuses credited during the run (mastery / collection milestones), itemised under the
  // wins line so the card adds up to what the balance moved by.
  const bonusLines = (winsBonusLines || []).filter((l) => l && l.kind === 'bonus' && l.amount > 0);
  const [score, setScore] = useState(0);
  const [ante, setAnte] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const raf = useRef(null); // the count-up controller
  const timers = useRef([]);

  useEffect(() => {
    const reduced = prefersReducedMotion();
    // Audio sting fires either way (sound ≠ motion).
    if (reduced) {
      setScore(finalScore);
      setAnte(finalAnte);
      setRevealed(true);
      juice.resultsSting();
      return undefined;
    }

    const add = (fn, ms) => timers.current.push(setTimeout(fn, ms));

    add(() => juice.resultsStamp(), C.stampDelay); // DEAD slam
    const finish = () => {
      setScore(finalScore);
      setAnte(finalAnte);
      setRevealed(true);
      if (results.bestStreak >= 5) juice.resultsBest(); // a hot run earns a sparkle
    };
    add(() => {
      juice.resultsSting(); // descending defeat tone
      // THE one count-up (juice/countUp.js, Andy oct3 #4): it counts the WINS (the gain this page
      // exists to show — 2 s from nothing), and CAPTURED rides the same eased progress. A run that
      // paid nothing counts its captures instead.
      const target = finalAnte > 0 ? finalAnte : finalScore;
      if (!(target > 0)) {
        finish();
        return;
      }
      let lastTick = 0;
      raf.current = createCountUp({
        initial: 0,
        onFrame: (v) => {
          const p = Math.min(1, v / target);
          const s = Math.round(finalScore * p);
          setScore(s);
          setAnte(Math.round(finalAnte * p));
          if (s - lastTick >= C.score.tickEvery) {
            lastTick = s;
            juice.scoreTick(p);
          }
        },
        onDone: finish,
      });
      raf.current.to(target);
    }, C.scoreDelay);

    return () => {
      if (raf.current) raf.current.cancel();
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
    // Run once on mount; results is fixed for a finished run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const avgAnte = results.avgAnte ? `${Number(results.avgAnte).toFixed(1)}×` : '—';
  const fmt = (n) => formatNum(Number(n) || 0); // the one app-wide number format (E2)
  const hardest = results.hardestWord ? results.hardestWord.word.toUpperCase() : null;


  return (
    <div className="sr-screen sr-results">
      <div className="sr-respage">
        {/* entry stamp, bounty voice: the run is over — the case is closed. */}
        <div className="sr-dead">CASE CLOSED</div>

        {/* THE ONE BIG THING: how many you captured (and how many got away). */}
        <div className="sr-panel sr-hero">
          <div className="sr-hero-row">
            <div className="sr-capt-value sr-print" data-v={fmt(score)} aria-label={`${fmt(finalScore)} captured`}>
              {fmt(score)}
            </div>
            <div className="sr-capt-side">
              <span className="sr-capt-label">captured</span>
              <span className="sr-capt-away">{fmt(results.missed || 0)} got away</span>
            </div>
          </div>
        </div>

        {/* WINS EARNED — the same second number every mode's run-over card has. */}
        <div className="sr-winsline" aria-label={`${fmt(finalAnte)} wins earned`}>
          {finalAnte > 0 ? <><b>+{fmt(ante)}</b> wins earned</> : <>no wins earned — capture 3 to start the bounty</>}
        </div>
        {bonusLines.map((l) => (
          <div className="sr-winsline" key={l.id} data-wins-line={l.label} data-wins-amount={l.amount}>
            <b>+{formatNum(l.amount)}</b> {l.label}
          </div>
        ))}

        {/* The exits never wait for the count-up, and sit RIGHT UNDER the result (fine-tune oct2:
            at 1280x551 / 1366x625 they were below the fold under the study panels). */}
        <div className="sr-results-actions in">
          {/* REBIRTH READY → ×5 FOREVER (Andy oct3): first, when the gate is reached — leaves through
              onExit; the menu runs the rebirth + ceremony. */}
          <RebirthReadyButton onGo={onExit} className="is-sat" />
          <button type="button" className="sr-btn" onClick={onAgain}>
            Run it back
          </button>
          {/* A deep-link visitor has never seen the menu, so their way on is the OFFER below —
              the whole grid — and the generic Menu button beside it would be a second control
              doing the same thing. Everyone else gets the normal Menu button. */}
          {offerMenu ? null : (
            <button type="button" className="sr-btn sr-btn-ghost" onClick={onExit}>
              Menu
            </button>
          )}
          {/* SECOND ROW (feat/solo-endgame): a DIFFERENT unlocked mode — the one played least —
              so the run ends on a fork, not only "run it back". Nothing renders when every other
              mode is still locked.
              NOT shown to a deep-link visitor: they have seen no modes at all, so "try FUSE next"
              is a narrower, stranger offer than "here are the other four". They get the offer. */}
          <ClaimPrompt />
          {offerMenu ? null : <TryModeRow current="sat-rush" />}
        </div>

        {/* The mode's own numbers, one ruled line (was three boxed panels + a strip). */}
        <div className="sr-resline in">
          <span>score <b>{fmt(results.score)}</b></span>
          <span>avg ante <b>{avgAnte}</b></span>
          <span>best streak <b>{results.bestStreak || 0}</b></span>
          <span>mastered <b>{results.mastered || 0}</b></span>
        </div>

        {/* runLog film-strip: one small ruled frame per word, in order. */}
        {results.runLog.length > 0 && (
          <div className={`sr-filmstrip${revealed ? ' in' : ''}`} aria-label="run timeline">
            {results.runLog.map((e, i) => {
              const f = frameOf(e);
              return (
                <div key={i} className={`sr-frame ${f.kind}`} title={f.label} aria-label={f.label}>
                  <span aria-hidden="true">{f.glyph}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* hardest word — its own panel, sitting on the one halftone patch. */}
        {hardest && (
          <div className={`sr-panel sr-hardestpanel${revealed ? ' in' : ''}`}>
            <span className="sr-panel-label">hardest clear</span>
            <b className="sr-hardest-word">{hardest}</b>
          </div>
        )}

        {/* WORDS YOU KEEP MISSING — the persistent study list (across runs), from
            the lexicon SRS. Only shown once the player has genuinely-sticky misses. */}
        {Array.isArray(results.keepMissing) && results.keepMissing.length > 0 && (
          <div className={`sr-panel sr-keepmissing${revealed ? ' in' : ''}`}>
            <span className="sr-panel-label">words you keep missing</span>
            <ul className="sr-missing-list">
              {results.keepMissing.map((m) => (
                <li key={m.w} className="sr-missing-row">
                  <b className="sr-missing-word">{m.w}</b>
                  <span className="sr-missing-tally">missed {m.missed}×</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* When the offer is shown its button IS the way out (same onExit), so the plain
                  MENU/LEAVE button beside it would be two adjacent controls doing one thing. The
                  offer's label is the better one for this visitor — it says what is through the
                  door — so it replaces the generic button rather than sitting under it. */}
        {/* THE REST OF THE GAME — shown ONLY to a visitor who landed here on a /sat-rush/play link
            and has never seen the menu (App: LAUNCH_INTENT.satrush && !hasSeenMenu()). They have
            just finished a run with no idea the other modes exist, and this is the one moment they
            are looking at a stopped screen. One line, one button, IN PLACE: no modal, no share, and
            "Run it back" stays the primary action above it. Set as a CASE FILE cross-reference so it
            belongs to this page's language (paper, ink, red rule) rather than the neon house look —
            the same offer CHAIN and FUSE make, spoken in SAT RUSH's voice. */}
        {offerMenu ? (
          <div className={`sr-offer${revealed ? ' in' : ''}`}>
            <p className="sr-offer-line">{`${MORE_MODES} MORE CASES ON FILE.`}</p>
            <button type="button" className="sr-btn sr-offer-btn" onClick={onExit}>
              See all modes
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
