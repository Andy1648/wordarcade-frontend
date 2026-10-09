// fuseCards.jsx — FUSE death-card content (Job 14). Mirrors chainCards.jsx: a NORMAL card (the
// last fragment + count) and a FIRST-RUN tutorial card (the rule, a worked example, and the goal)
// so a player meeting FUSE for the first time (it unlocks at LV50) is taught, not just scored.
import './Solo.css';

// One word of the worked example with its FRAGMENT highlighted in the accent yellow.
function FuseExample({ pre, frag, post }) {
  return (
    <span className="cx-word">
      {pre}
      <b className="cx-pivot">{frag}</b>
      {post}
    </span>
  );
}

export function FuseNormalCard({ fragment }) {
  return (
    <>
      <h2>OUT OF FUSES</h2>
      <div className="solo-death-killed">the last fragment was “{(fragment || '').toUpperCase()}”</div>
      {/* CLUTTER PASS: no "N words defused" — FUSE's SCORE line below is that same count. */}
    </>
  );
}

export function FuseFirstRunCard() {
  return (
    <>
      <h2>OUT OF FUSES</h2>
      <div className="solo-armhint">SNEAK THOSE LETTERS INTO A WORD</div>
      <div className="solo-chain-example" aria-label="ARM makes CHARM, ALARM, FARMER">
        <b className="cx-pivot">ARM</b>
        <span className="cx-arrow"> → </span>
        <FuseExample pre="CH" frag="ARM" post="" />
        <span className="cx-arrow"> · </span>
        <FuseExample pre="AL" frag="ARM" post="" />
        <span className="cx-arrow"> · </span>
        <FuseExample pre="F" frag="ARM" post="ER" />
      </div>
      <div className="solo-firstrun-goal">FIRST TRY. GET 3 WORDS.</div>
    </>
  );
}
