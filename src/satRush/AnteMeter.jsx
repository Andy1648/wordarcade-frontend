// AnteMeter.jsx — the SECOND-largest thing on screen (after the sentence). The
// whole "answer earlier = more points" read lives here: a big multiplier that
// pops on every drop, a pip row that empties as the multiplier falls, and an
// always-visible drain bar counting down to the next reveal.
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
  const litPips = maxStage + 1 - stage; // more lit = more multiplier still on offer
  // Re-key the drain on each stage so it restarts cleanly. The multiplier node is
  // deliberately STABLE (no key) so the juice squash/flash animate it in place
  // (the number's text just updates) — see juice.multiplierDrop.
  const stageKey = `${wordNumber}-${stage}`;
  return (
    <div className="sr-ante">
      <div>
        <div className="sr-mult" aria-label={`multiplier ${multiplier} times`}>
          {multiplier}×
        </div>
        <div className="sr-pips" aria-hidden="true">
          {Array.from({ length: maxStage + 1 }, (_, i) => (
            <div key={i} className={`sr-pip${i < litPips ? ' on' : ''}`} />
          ))}
        </div>
      </div>
      <div className="sr-anteright">
        <div className="sr-antelabel">
          {atFinal ? 'last chance — answer now' : 'ante — answer now for more'}
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
