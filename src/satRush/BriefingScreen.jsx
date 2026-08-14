// Briefing.jsx — THE BRIEFING: the pre-run study screen. Same retro-print / bounty
// paper language as the rest of the mode, but this is a STUDY SURFACE, so it is
// CALM: no timer, no countdown, no drain bar, no pressure. It's the one screen in
// SAT RUSH that isn't rushing anyone.
//
// Each of the (up to) five cards leads with the WORD, then the SENTENCE WITH THE
// WORD FILLED IN AND HIGHLIGHTED — that filled sentence is the encode step and the
// most important element on the card; we never show a bare word–definition pair.
// The definition is secondary; the root and its cousins come next (cousins the
// player has already met wear a "you know this one" tick — the transfer moment made
// visible); a review word is quietly marked as one they've faced before.
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

      {/* the encode step — the most important element on the card */}
      <FilledSentence context={context} word={word} />

      <p className="sr-brief-def">“{gloss}”</p>

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

export default function Briefing({ briefing, onStart }) {
  if (!briefing) return null;
  const { familyMorpheme, cards } = briefing;

  return (
    <div className="sr-screen sr-brief-screen">
      <div className="sr-brief-page">
        <div className="sr-brief-head">
          <div className="sr-brief-title sr-print" data-v={'THE BRIEFING'}>
            THE&nbsp;BRIEFING
          </div>
          {familyMorpheme ? (
            <div className="sr-brief-family">
              TWO SHARE A ROOT — <b>{familyMorpheme}</b> — grouped below
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
