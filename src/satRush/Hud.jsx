// Hud.jsx — top status row: one ruled arcade strip fused to the page's top edge.
// SCORE (zero-padded to 6) / STREAK / WORD # / LIVES (ink hearts) / HEAT (five
// flat blocks), and — at the far end — the WAY OUT. Pure display: every value
// reads as text/shape, not colour alone. `onExit` (present only mid-run) wires
// the exit to a clean abandon + go-home.
//
// THE EXIT WAS A BARE ✕ AT 40px WIDE — under the 44px touch minimum and naming
// nothing. That is the identical defect fix/solo-exit removed from CHAIN and FUSE
// (see solo/SoloExit.jsx), and it matters most here for the same reason: a visitor
// who arrived on a /sat-rush/play link has never seen the menu, and this control is
// the only door to the other five modes. It is now labelled with its destination at
// >=44x44, in SAT RUSH's own paper-and-ink language — NOT the neon house chip.
export default function Hud({ score, streak, wordNumber, lives, maxLives, heat, heatCap, onExit }) {
  return (
    <div className="sr-hud">
      <div className="sr-hcell">
        <span className="sr-hlabel">score</span>
        <b className="sr-hval">{String(score).padStart(6, '0')}</b>
      </div>
      <div className="sr-hcell">
        <span className="sr-hlabel">streak</span>
        <b className="sr-hval">{String(streak).padStart(2, '0')}</b>
      </div>
      <div className="sr-hcell">
        <span className="sr-hlabel">word</span>
        <b className="sr-hval">#{String(wordNumber).padStart(2, '0')}</b>
      </div>
      <div className="sr-hcell">
        <span className="sr-hlabel">lives</span>
        <div className="sr-lives" aria-label={`${lives} of ${maxLives} lives left`}>
          {Array.from({ length: maxLives }, (_, i) => (
            <span key={i} className={`sr-life${i < lives ? '' : ' gone'}`} aria-hidden="true">
              ♥
            </span>
          ))}
        </div>
      </div>
      <div className="sr-hcell">
        <span className="sr-hlabel">heat</span>
        <div className="sr-heat" aria-label={`heat ${heat} of ${heatCap}`}>
          {Array.from({ length: heatCap }, (_, i) => (
            <span key={i} className={`sr-heatblock${i < heat ? ' on' : ''}`} />
          ))}
        </div>
      </div>
      {onExit && (
        <button type="button" className="sr-hud-exit" onClick={onExit} aria-label="Exit to menu">
          {/* Counter-skewed like the .sr-hcell contents — .sr-hud is skewX(-6deg). */}
          <span className="sr-hud-exit-inner">
            <span aria-hidden="true">←</span> MENU
          </span>
        </button>
      )}
    </div>
  );
}
