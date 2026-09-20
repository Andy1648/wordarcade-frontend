// TeachStrip.jsx — the first-run teach, IN PLACE, per mode.
//
// WHAT WAS WRONG. The old teach was a single Spotlight with a one-line caption, gated on ONE
// flag shared by every game surface (`taw.seenGameSpotlight`). So the first mode a player opened
// was the only mode that ever explained itself; every mode after it dropped them onto a live
// clock with a prompt and no rule. Andy: "People aren't getting the gist of randomly typing."
// That is not a copy problem — it is four modes that never got a turn to speak.
//
// WHAT THIS IS. A strip that sits IN the layout next to the input (not a modal, not an overlay,
// nothing to dismiss before you can play) and says the three things a first-timer needs, in the
// order they need them:
//   1. WHAT THE ACT IS      — "TYPE A REAL WORD" — the thing players were not getting.
//   2. WHAT THIS MODE WANTS — the one rule, in this mode's own words.
//   3. WHAT IT IS WORTH     — that answering sooner pays more.
// plus a WORKED EXAMPLE the player can literally copy.
//
// THE EXAMPLE IS DERIVED FROM THE LIVE PROMPT, not canned. A canned example ("TRAIN contains
// TRA") teaches the shape but cannot be copied — the prompt on screen is a different fragment,
// so a player who types it gets rejected by the teach itself. `example` is computed by the
// caller from the CURRENT prompt against the SAME accept set the mode judges with, so copying it
// always works. That is also what makes it testable: a scripted run that types the example must
// succeed.
//
// It disappears on the first accepted word (the player has demonstrated the gist) or when
// dismissed. It does NOT auto-hide on a timer: a player who types nothing for ten seconds is
// exactly the player who still needs it.
import './TeachStrip.css';

export default function TeachStrip({ rule, example, onDismiss, payLine = 'ANSWER SOONER, EARN MORE' }) {
  return (
    <div className="teach-strip" role="note" aria-label="How to play this mode">
      <div className="teach-strip-main">
        <span className="teach-strip-act">TYPE A REAL WORD</span>
        <span className="teach-strip-rule">{rule}</span>
      </div>
      {example ? (
        <div className="teach-strip-eg">
          <span className="teach-strip-eg-tag">LIKE</span>
          {/* The example is a valid answer to the prompt that is on screen right now, so a
              player can copy it character for character and it will be accepted. */}
          <b className="teach-strip-eg-word">{example}</b>
        </div>
      ) : null}
      <div className="teach-strip-pay">{payLine}</div>
      {onDismiss ? (
        <button type="button" className="teach-strip-close" onClick={onDismiss} aria-label="Got it">
          GOT IT
        </button>
      ) : null}
    </div>
  );
}
