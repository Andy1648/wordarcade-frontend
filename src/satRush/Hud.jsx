// Hud.jsx — top status row: one ruled arcade strip fused to the page's top edge.
// SCORE (zero-padded to 6) / STREAK / WORD # / LIVES (ink hearts) / HEAT (five
// flat blocks), and — at the far end — an EXIT ✕ that abandons the run. Pure
// display: every value reads as text/shape, not colour alone. `onExit` (present
// only mid-run) wires the ✕ to a clean abandon + go-home.
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
        <button type="button" className="sr-hud-exit" onClick={onExit} aria-label="Exit run">
          ✕
        </button>
      )}
    </div>
  );
}
