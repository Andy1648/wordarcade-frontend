// chainCards.jsx — the two CHAIN death-card BODIES, pulled out so they're pure and
// importable on their own (no engine / word-data imports). SoloShell wraps whichever
// body it's given with the restart button (and, for the normal card, the score line).
//
//   ChainNormalCard    — the usual "CHAIN BROKE" + killed-letter reason + recent links.
//   ChainFirstRunCard  — the run-1 tutorial: the rule, a worked example, and the goal.
//                        NO score / BEST / share (SoloShell drops the score line via
//                        over.bare).

export function ChainNormalCard({ killedLetter, lastLinks, deadEnd = false }) {
  // Branch on WHY the run ended (fix/logic-pass #7). The reroute keeps the required letter off
  // genuine dead ends, so a death is almost always the clock — say so ("RAN OUT OF TIME ON X")
  // instead of claiming "nothing left starting with X" when there always was. The dead-end line
  // shows only when the letter truly had no common continuations left.
  const blame = !killedLetter
    ? 'time ran out'
    : deadEnd
    ? `nothing left starting with "${killedLetter.toUpperCase()}"`
    : `ran out of time on "${killedLetter.toUpperCase()}"`;
  return (
    <>
      <h2>CHAIN BROKE</h2>
      <div className="solo-death-killed">{blame}</div>
      <div className="solo-death-links">
        {lastLinks.map((l, i) => (
          <span key={i}>
            {l.word.toUpperCase()} · +{l.score}
          </span>
        ))}
      </div>
    </>
  );
}

// One word of the worked example, with its PIVOT (last letter — the one the next word
// must start with) drawn in the accent cyan.
function ChainLink({ word }) {
  return (
    <span className="cx-word">
      {word.slice(0, -1)}
      <b className="cx-pivot">{word.slice(-1)}</b>
    </span>
  );
}

export function ChainFirstRunCard() {
  return (
    <>
      <h2>CHAIN BROKE</h2>
      <div className="solo-armhint">EVERY WORD STARTS WITH THE LAST LETTER OF THE ONE BEFORE</div>
      <div className="solo-chain-example" aria-label="E to EAGLE to ELEPHANT to TIGER to RIVER">
        <b className="cx-pivot">E</b>
        <span className="cx-arrow"> → </span>
        <ChainLink word="EAGLE" />
        <span className="cx-arrow"> → </span>
        <ChainLink word="ELEPHANT" />
        <span className="cx-arrow"> → </span>
        <ChainLink word="TIGER" />
        <span className="cx-arrow"> → </span>
        <ChainLink word="RIVER" />
      </div>
      <div className="solo-firstrun-goal">FIRST TRY. GET 3 WORDS.</div>
    </>
  );
}
