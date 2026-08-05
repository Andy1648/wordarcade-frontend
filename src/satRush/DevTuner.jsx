// DevTuner.jsx — dev-only. The stage interval is the number that needs tuning
// against a real build, so it is a live slider (no reload) on top of the
// ?stage= query-param override. The structural knobs apply on the next game.
// Scene buttons jump straight to each state for tuning / QA / screenshots.
export default function DevTuner({ cfg, setStageMs, setKnob, scene, debugRevealTwo }) {
  return (
    <div className="sr-tuner">
      <span className="hint">tune</span>
      <label>
        stage interval
        <input
          type="range"
          min="400"
          max="3000"
          step="50"
          value={cfg.stageMs}
          onChange={(e) => setStageMs(Number(e.target.value))}
        />
        <b>{cfg.stageMs}ms</b>
      </label>
      <label>
        deep cut every
        <input
          type="range"
          min="4"
          max="20"
          step="1"
          value={cfg.deepEvery}
          onChange={(e) => setKnob('deepEvery', Number(e.target.value))}
        />
        <b>{cfg.deepEvery}</b>
      </label>
      <label>
        revenant gap
        <input
          type="range"
          min="2"
          max="14"
          step="1"
          value={cfg.revGap}
          onChange={(e) => setKnob('revGap', Number(e.target.value))}
        />
        <b>{cfg.revGap}</b>
      </label>
      <label>
        tier climb every
        <input
          type="range"
          min="3"
          max="20"
          step="1"
          value={cfg.climb}
          onChange={(e) => setKnob('climb', Number(e.target.value))}
        />
        <b>{cfg.climb}</b>
      </label>
      <span className="hint">scene</span>
      <button type="button" className="scene" onClick={() => scene('normal')}>
        normal
      </button>
      <button type="button" className="scene" onClick={() => scene('deep')}>
        deep cut
      </button>
      <button type="button" className="scene" onClick={() => scene('revenant')}>
        revenant
      </button>
      <button type="button" className="scene" onClick={() => scene('silver')}>
        silver
      </button>
      <button type="button" className="scene" onClick={debugRevealTwo}>
        lock 2
      </button>
    </div>
  );
}
