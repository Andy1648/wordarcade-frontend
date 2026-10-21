// SatRushResults.jsx — the death / score reveal, as one manga PAGE (ink on paper,
// double-ruled panels, screentone plates — no spot colour). Death still dominates
// entry: the CASE CLOSED stamp slams, the score + AVG ANTE
// count up on the shared JUICE.CELEBRATION timings (same staged sequence Category
// Blitz solo results use), then the rest of the page staggers in. AVG ANTE stays
// working untouched; only its container is styled to sit on the page.
import { useEffect, useRef, useState } from 'react';
import { formatNum } from '../format';
import EnglishLine from './EnglishLine';
import { createCountUp } from '../juice/countUp';
import { JUICE, prefersReducedMotion } from '../juice';
import * as juice from './juice';
import TryModeRow from '../share/TryModeRow.jsx';
import ClaimPrompt from '../leaderboard/ClaimPrompt.jsx';
import NearMiss from '../components/NearMiss.jsx';
import RebirthReadyButton from '../components/RebirthReadyButton.jsx';
import { MORE_MODES } from '../gameData';
import { GemsEarnedLine } from '../components/gems/Gems';
import { MasteryUpLine } from '../components/masteryRoad/MasteryUp.jsx';
import { speakFr, canSpeak, withArticle } from './speak';

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

// THE CASE FILE (oct17): every word of the finite run, how it went, and where it now stands in the
// learning memory. A word that did not settle clean shows its definition (plain) and its example
// (quoted, the answer filled in) — the corrective feedback is the point of the list.
const OUTCOME = { clean: 'CAPTURED', recaptured: 'RECAPTURED', shaky: 'BARELY', escaped: 'ESCAPED' };
const MASTERY = { known: 'known', learning: 'learning', new: 'new' };

function CaseFileRow({ c, outcomes, speak }) {
  const open = c.outcome !== 'clean';
  const [before, after] = String(c.context || '').split(/_+/);
  return (
    <li className={`sr-casefile-row ${c.outcome}`}>
      <div className="sr-casefile-top">
        <b className="sr-casefile-word">
          {speak ? withArticle(c.word, c.rawPos, c.gender) : c.word}
          {speak && canSpeak() && (
            <button type="button" className="sr-say" onClick={() => speakFr(c.word)} aria-label={`say ${c.word}`}>
              🔊
            </button>
          )}
        </b>
        <span className={`sr-casefile-mastery ${c.mastery}`}>{MASTERY[c.mastery]}</span>
        <span className={`sr-casefile-out ${c.outcome}`}>{(outcomes || OUTCOME)[c.outcome]}</span>
      </div>
      {open && (
        <>
          <p className="sr-casefile-def">{c.gloss}</p>
          {after !== undefined && (
            <p className="sr-casefile-ex">
              “{before}
              <mark className="sr-brief-fill">{c.word}</mark>
              {after}”
            </p>
          )}
          <EnglishLine text={c.contextEn} className="sr-casefile-en" />
        </>
      )}
    </li>
  );
}

export default function SatRushResults({ results, winsEarned = 0, winsBonusLines = [], onAgain, onReplay, onExit, offerMenu = false, gemsSince = 0, masterySince = 0, economy = true, ui = null }) {
  // a pack's own words for this page (FRENCH RUSH: TERMINÉ / correct / missed / your words …)
  const RU = (ui && ui.results) || null;
  const speak = !!(ui && ui.stamps); // FRENCH RUSH reads words aloud (its pack has its own stamps)
  const [copied, setCopied] = useState(false);
  // economy=false (FRENCH RUSH, a standalone study link): no wins / gems / rebirth / cross-mode offers —
  // just the result, the case file and the way to go again.
  // STEP 57 (Andy oct2: "make CASE CLOSED clear, satisfying and consistent with the other modes"):
  // the page leads with what every other mode's run-over card leads with — how many you got (here:
  // CAPTURED) and the WINS it paid — and the mode's own numbers (score, avg ante, streak, mastered)
  // move to one ruled line under them. These two are what count up.
  const finalScore =
    results.finite && Array.isArray(results.caseFile)
      ? results.caseFile.filter((c) => c.outcome !== 'escaped').length
      : results.cleared || 0;
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
  const caseFile = Array.isArray(results.caseFile) ? results.caseFile : [];
  const finite = !!results.finite && results.runTotal > 0;
  const unsettled = caseFile.filter((c) => c.outcome !== 'clean').length;
  // captured = distinct words caught this run (a finite run counts words, not attempts)
  const capturedWords = caseFile.filter((c) => c.outcome !== 'escaped').length;


  return (
    <div className="sr-screen sr-results">
      <div className="sr-respage">
        {/* entry stamp, bounty voice: the run is over — the case is closed. */}
        <div className="sr-dead">
          {finite && !results.complete ? (RU ? RU.out : 'OUT OF LIVES') : RU ? RU.done : 'CASE CLOSED'}
        </div>

        {/* THE ONE BIG THING: how many you captured (and how many got away). */}
        <div className="sr-panel sr-hero">
          <div className="sr-hero-row">
            <div className="sr-capt-value sr-print" data-v={fmt(score)} aria-label={`${fmt(finalScore)} captured`}>
              {fmt(score)}
            </div>
            <div className="sr-capt-side">
              <span className="sr-capt-label">
                {finite ? `of ${results.runTotal} ${RU ? RU.captured : 'captured'}` : 'captured'}
              </span>
              <span className="sr-capt-away">
                {finite
                  ? `${fmt(caseFile.length - capturedWords)} ${RU ? RU.away : 'got away'}`
                  : `${fmt(results.missed || 0)} got away`}
                {finite && results.runTotal > caseFile.length ? ` · ${fmt(results.runTotal - caseFile.length)} never reached` : ''}
              </span>
            </div>
          </div>
        </div>

        {/* WINS EARNED — the same second number every mode's run-over card has. */}
        {economy && <div className="sr-winsline" aria-label={`${fmt(finalAnte)} wins earned`}>
          {finalAnte > 0 ? <><b>+{fmt(ante)}</b> wins earned</> : <>no wins earned — capture 3 to start the bounty</>}
        </div>}
        {economy && bonusLines.map((l) => (
          <div className="sr-winsline" key={l.id} data-wins-line={l.label} data-wins-amount={l.amount}>
            <b>+{formatNum(l.amount)}</b> {l.label}
          </div>
        ))}
        {/* GEMS earned this run — always its own line, never hidden (Andy oct5) */}
        {economy && <GemsEarnedLine since={gemsSince} print className="sr-gemsline" />}
        {economy && <MasteryUpLine mode="sat-rush" since={masterySince} className="sr-mastery-up" />}

        {/* The exits never wait for the count-up, and sit RIGHT UNDER the result (fine-tune oct2:
            at 1280x551 / 1366x625 they were below the fold under the study panels). */}
        <div className="sr-results-actions in">
          {/* REBIRTH READY → ×5 FOREVER (Andy oct3): first, when the gate is reached — leaves through
              onExit; the menu runs the rebirth + ceremony. */}
          {economy && <RebirthReadyButton onGo={onExit} className="is-sat" />}
          {/* REPLAY MISSES: the words that did not settle clean, again (BRIEFING re-studies them) */}
          {finite && unsettled > 0 && onReplay && (
            <button type="button" className="sr-btn" onClick={onReplay}>
              {RU ? RU.replay(unsettled) : `Replay the ${unsettled} that got away`}
            </button>
          )}
          <button type="button" className={`sr-btn${finite && unsettled > 0 && onReplay ? ' sr-btn-ghost' : ''}`} onClick={onAgain}>
            {RU ? RU.again : finite ? 'New case' : 'Run it back'}
          </button>
          {/* COPY RESULTS (FRENCH RUSH): a plain-text summary to paste to a teacher */}
          {RU && caseFile.length > 0 && (
            <button
              type="button"
              className="sr-btn sr-btn-ghost"
              onClick={() => {
                const sp = results.spec || {};
                const missed = caseFile.filter((c) => c.outcome !== 'clean').map((c) => c.word);
                const text = [
                  `French Rush — ${capturedWords}/${results.runTotal} correct`,
                  sp.category ? `Theme: ${sp.category}` : 'Theme: all',
                  `Level: ${sp.difficulty || '—'} · ${sp.pace === 'self' ? 'my pace' : 'timed'}`,
                  missed.length ? `To review: ${missed.join(', ')}` : 'No words to review',
                ].join('\n');
                const done = () => {
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 2200);
                };
                try {
                  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, done);
                  else done();
                } catch {
                  done();
                }
              }}
            >
              {copied ? 'Copied!' : 'Copy my results'}
            </button>
          )}
          {/* A deep-link visitor has never seen the menu, so their way on is the OFFER below —
              the whole grid — and the generic Menu button beside it would be a second control
              doing the same thing. Everyone else gets the normal Menu button. */}
          {offerMenu ? null : (
            <button type="button" className="sr-btn sr-btn-ghost" onClick={onExit}>
              {RU ? RU.menu : 'Menu'}
            </button>
          )}
          {/* SECOND ROW (feat/solo-endgame): a DIFFERENT unlocked mode — the one played least —
              so the run ends on a fork, not only "run it back". Nothing renders when every other
              mode is still locked.
              NOT shown to a deep-link visitor: they have seen no modes at all, so "try FUSE next"
              is a narrower, stranger offer than "here are the other four". They get the offer. */}
          {economy && <ClaimPrompt />}
          {economy && <NearMiss mode="sat-rush" onPlay={onAgain} look="print" />}
          {offerMenu || !economy ? null : <TryModeRow current="sat-rush" />}
        </div>

        {/* The mode's own numbers, one ruled line (was three boxed panels + a strip). */}
        {/* FRENCH RUSH keeps its page to the result + the words: no ante / mastery stat line */}
        {!RU && <div className="sr-resline in">
          <span>score <b>{fmt(results.score)}</b></span>
          <span>avg ante <b>{avgAnte}</b></span>
          <span>best streak <b>{results.bestStreak || 0}</b></span>
          <span>mastered <b>{results.mastered || 0}</b></span>
        </div>}

        {/* THE CASE FILE — every word of the run (a list, so it may scroll inside its own panel) */}
        {caseFile.length > 0 && (
          <div className={`sr-panel sr-casefile${revealed ? ' in' : ''}`}>
            <span className="sr-panel-label">{RU ? RU.file : 'case file'}</span>
            <ul className="sr-casefile-list">
              {caseFile.map((c) => (
                <CaseFileRow key={c.word} c={c} outcomes={RU && RU.outcomes} speak={speak} />
              ))}
            </ul>
          </div>
        )}

        {/* runLog film-strip: one small ruled frame per word, in order. */}
        {!RU && results.runLog.length > 0 && (
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
        {!RU && hardest && (
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
        {offerMenu && economy ? (
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
