// Briefing.jsx — THE BRIEFING: the pre-run study screen. Same retro-print / bounty
// paper language as the rest of the mode, but this is a STUDY SURFACE, so it is
// CALM: no timer, no countdown, no drain bar, no pressure. It's the one screen in
// SAT RUSH that isn't rushing anyone.
//
// Each of the (up to) five cards reads WORD → DEFINITION → filled example SENTENCE:
// the definition sits directly under the word so the meaning lands first, then the
// example sentence (the word filled in and highlighted) shows it in use. The root
// and its cousins come next (cousins the player has already met wear a "you know
// this one" tick — the transfer moment made visible); a review word is quietly
// marked as one they've faced before.
//
// If the run is built around a root family, the screen is headed by that morpheme
// so the framing is "here's one root and its family," not "here are five words".

// The sentence with the blank filled by the answer and highlighted. The blank in
// the data is a run of underscores; everything around it is kept verbatim.
function FilledSentence({ context, word }) {
  const [before, after] = context.split(/_+/);
  return (
    <p className="sr-brief-sentence">
      {before}
      <mark className="sr-brief-fill">{word}</mark>
      {after}
    </p>
  );
}

function BriefCard({ card }) {
  const { word, pos, length, context, gloss, root, isReview, knownCousins } = card;
  const known = new Set(knownCousins);
  return (
    <li className={`sr-brief-card${isReview ? ' review' : ''}`}>
      {isReview && (
        <div className="sr-brief-review" aria-label="you missed this before">
          SEEN BEFORE — you let this one get away
        </div>
      )}
      <div className="sr-brief-wordrow">
        <span className="sr-brief-word">{word}</span>
        <span className="sr-brief-meta">
          {pos} · {length} letters
        </span>
      </div>

      {/* definition first — the meaning lands directly under the word */}
      <p className="sr-brief-def">“{gloss}”</p>

      {/* then the word in use — the example sentence, filled in and highlighted */}
      <FilledSentence context={context} word={word} />

      {root && (
        <div className="sr-brief-root">
          <span className="sr-brief-morph">{root.morpheme}</span>
          <span className="sr-brief-mean"> — {root.meaning}</span>
          {root.cousins && root.cousins.length > 0 && (
            <span className="sr-brief-cousins">
              {' · '}
              {root.cousins.map((c, i) => (
                <span key={c} className={`sr-brief-cousin${known.has(c) ? ' known' : ''}`}>
                  {c}
                  {known.has(c) && (
                    <span className="sr-brief-tick" aria-label="you know this one">
                      ✓
                    </span>
                  )}
                  {i < root.cousins.length - 1 ? ' · ' : ''}
                </span>
              ))}
            </span>
          )}
        </div>
      )}
    </li>
  );
}

export default function Briefing({ briefing, onStart, onExit }) {
  if (!briefing) return null;
  const { familyMorpheme, familyCount, cards } = briefing;
  // Spell the count so the header matches how many words actually share the root (was a
  // hardcoded "TWO" even when three-plus shared it). Falls back to the digit past five.
  const COUNT_WORD = { 2: 'TWO', 3: 'THREE', 4: 'FOUR', 5: 'FIVE' };
  const familyCountWord = COUNT_WORD[familyCount] || String(familyCount || 0);

  return (
    <div className="sr-screen sr-brief-screen">
      <div className="sr-brief-page">
        {/* EXIT to menu (item 4) — top-right, away from the bottom Start button, so the one
            SAT Rush screen that lacked a way back now has one, consistent with the others. */}
        {onExit && (
          <button type="button" className="sr-brief-exit" onClick={onExit} aria-label="Exit to menu">
            EXIT
          </button>
        )}
        <div className="sr-brief-head">
          <div className="sr-brief-title sr-print" data-v={'THE BRIEFING'}>
            THE&nbsp;BRIEFING
          </div>
          {familyMorpheme ? (
            <div className="sr-brief-family">
              {familyCountWord} SHARE A ROOT — <b>{familyMorpheme}</b> — grouped below
            </div>
          ) : (
            <div className="sr-brief-family">Five words to know before the run</div>
          )}
        </div>

        <ul className="sr-brief-list">
          {cards.map((card) => (
            <BriefCard key={card.word} card={card} />
          ))}
        </ul>

        <div className="sr-brief-actions">
          <button type="button" className="sr-btn" onClick={onStart}>
            Start the run
          </button>
        </div>
      </div>
    </div>
  );
}
