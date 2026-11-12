// SayButton.jsx — FRENCH RUSH's 🔊: reads the word aloud with the device's French voice (speak.js). Renders
// NOTHING when the device has no French voice (useFrVoice) — never a dead button. `hint` lets the first 🔊
// a player meets carry the one-time "TAP 🔊 TO HEAR IT" note (sayHint.js); tapping the 🔊 retires it.
import { useEffect, useState } from 'react';
import { speakFr } from './speak';
import { useFrVoice } from './useFrVoice';
import { sayHintDue, markSayHintSeen } from './sayHint';

export default function SayButton({ word, hint = false }) {
  const canSay = useFrVoice();
  const [showHint, setShowHint] = useState(() => hint && sayHintDue());
  useEffect(() => {
    if (showHint && canSay) markSayHintSeen();
  }, [showHint, canSay]);
  if (!canSay) return null;
  const say = () => {
    speakFr(word);
    if (showHint) setShowHint(false);
  };
  return (
    <>
      <button type="button" className="sr-say" onClick={say} aria-label={`say ${word}`} title="hear it">
        🔊
      </button>
      {showHint && (
        <span className="sr-say-hint" role="note" data-testid="say-hint">
          {/* beside the 🔊 it points left; on a phone the note sits UNDER the 🔊 and points up (FrenchRush.css) */}
          <span className="sr-say-hint-arrow side" aria-hidden="true">◀ </span>
          <span className="sr-say-hint-arrow up" aria-hidden="true">▲ </span>
          TAP 🔊 TO HEAR IT
        </span>
      )}
    </>
  );
}
