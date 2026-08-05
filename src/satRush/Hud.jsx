// Hud.jsx — top status row: score, streak, word #, lives, heat. Pure display.
export default function Hud({ score, streak, wordNumber, lives, maxLives, heat, heatCap }) {
  return (
    <div className="sr-hud">
      <div className="sr-stat">
        <b>{score}</b>
        <span>score</span>
      </div>
      <div className="sr-stat">
        <b>{streak}</b>
        <span>streak</span>
      </div>
      <div className="sr-stat">
        <b>{wordNumber}</b>
        <span>word</span>
      </div>
      <div className="sr-stat">
        <div className="sr-lives" aria-label={`${lives} of ${maxLives} lives left`}>
          {Array.from({ length: maxLives }, (_, i) => (
            <div key={i} className={`sr-life${i < lives ? '' : ' gone'}`} />
          ))}
        </div>
        <span>lives</span>
      </div>
      <div className="sr-stat sr-heatwrap">
        <div className="sr-heatbar" aria-label={`heat ${heat} of ${heatCap}`}>
          <div className="sr-heatfill" style={{ width: `${(heat / heatCap) * 100}%` }} />
        </div>
        <span>heat {heat}/{heatCap}</span>
      </div>
    </div>
  );
}
