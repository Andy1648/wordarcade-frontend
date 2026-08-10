// AnteMeter.jsx — the REWARD footer of the bounty poster. The bounty IS the ante:
// a "REWARD" label + the big Bungee INK multiplier with the violet plate printed
// OFF-REGISTER (the ::before renders the same glyphs, shifted), the ante note
// ("CAPTURE NOW FOR MORE" / the final "IT'S PRINTING"), a row of ink stage-pips,
// and the always-visible drain bar. It sits at the foot of WordCard, under a
// double rule — no longer a separate panel. The "capture earlier = bigger reward"
// story lives here. (Class names sr-mult / sr-tickfill are load-bearing: juice
// squashes .sr-mult in place and the drain animates sr-tickfill.)
export default function AnteMeter({
  multiplier,
  stage,
  maxStage,
  wordNumber,
  interval,
  graceMs,
  atFinal,
  running,
}) {
  const litPips = maxStage + 1 - stage; // more lit = more reward still on offer
  // Re-key the drain on each stage so it restarts cleanly. The multiplier node is
  // deliberately STABLE (no key) so juice.multiplierDrop can squash it in place.
  const stageKey = `${wordNumber}-${stage}`;
  const mult = `${multiplier}×`;
  return (
    <div className="sr-reward">
      <div className="sr-reward-label">Reward</div>
      <div className="sr-mult sr-print" data-v={mult} aria-label={`reward ${multiplier} times`}>
        {mult}
      </div>
      <div className="sr-anteright">
        <div className={`sr-antebox${atFinal ? ' final' : ''}`}>
          {atFinal ? (
            <>
              <span className="sr-accent">LAST CALL</span> — IT&rsquo;S PRINTING
            </>
          ) : (
            <>
              <span className="sr-accent">ANTE</span> — CAPTURE NOW FOR MORE
            </>
          )}
        </div>
        <div className="sr-pips" aria-hidden="true">
          {Array.from({ length: maxStage + 1 }, (_, i) => (
            <div key={i} className={`sr-pip${i < litPips ? ' on' : ''}`} />
          ))}
        </div>
        <div className="sr-tick">
          {running ? (
            <div
              className={`sr-tickfill run${atFinal ? ' grace' : ''}`}
              key={stageKey + (atFinal ? '-g' : '')}
              style={{ animationDuration: `${atFinal ? graceMs : interval}ms` }}
            />
          ) : (
            <div className="sr-tickfill" />
          )}
        </div>
      </div>
    </div>
  );
}
