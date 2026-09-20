// MissedWordHold.jsx — the run ends on the word you didn't get. Hold on it.
//
// SAT Rush has done this for a while: on a miss it shows the word large, the sentence with the
// answer filled in, the definition and a root cousin, and holds long enough to read it. The other
// four modes ended on a prompt and cut straight to a score.
//
// THE THING THAT MAKES THIS HARDER THAN SAT. SAT knows the answer — it served the word. CHAIN,
// FUSE, Word Bomb and Blitz end on a PROMPT the player could not satisfy: a letter, a fragment, a
// category. There is no answer word to show, only the question. So the word here is "one you
// could have played", derived from the final prompt against the same list the mode judges with
// (progress/teachExample.js), or for Blitz taken from the server's own sample of missed answers.
// That is a real, checkable word — not a guess and not a canned example.
//
// AND IT DOES NOT FAKE A DEFINITION. Coverage is 1.0% of the acceptance set (see
// progress/glossary.js), so most words have no gloss. When there is one it is shown; when there
// is not, the panel shows the word and what it would have satisfied, and says nothing it cannot
// support. On a game about words, an invented definition is worse than a missing one.
//
// IN PLACE, not a modal: it renders inside the card that was going to be shown anyway.
import './MissedWordHold.css';

export default function MissedWordHold({ word, gloss, prompt, promptLabel = 'IT NEEDED' }) {
  if (!word) return null;
  return (
    <div className="missed-hold" role="status">
      <div className="missed-hold-tag">YOU COULD HAVE PLAYED</div>
      <div className="missed-hold-word" translate="no">{String(word).toUpperCase()}</div>
      {prompt ? (
        <div className="missed-hold-prompt">
          {promptLabel} <b translate="no">{String(prompt).toUpperCase()}</b>
        </div>
      ) : null}
      {gloss ? (
        <p className="missed-hold-gloss">“{gloss}”</p>
      ) : (
        // NOT a placeholder for a definition — a different, true statement. See the header.
        <p className="missed-hold-nogloss">A REAL WORD. NEXT TIME IT COUNTS.</p>
      )}
    </div>
  );
}
