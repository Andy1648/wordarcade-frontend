// src/share/CopyResultButton.jsx
// ONE-TAP shareable result (Job 1). Builds the exact spoiler-free receipt from
// resultCard.js, deep-links into the mode, and copies it (Clipboard API + a
// text-selection fallback). Renders NOTHING when the run is suppressed (< 3
// accepted words) so a 0/1/2-word share never appears. Read-only: touches no
// game state, no WebSocket.
import { useEffect, useRef, useState } from 'react';
import { buildResultCard } from './resultCard';
import { modeShareLink } from './links';
import { copyToClipboard } from './copyText';
import { loadProgress } from '../progress/xp';
import { track } from '../lib/analytics';
import './CopyResultButton.css';

export default function CopyResultButton({
  mode,
  words,
  points = null,
  level = null,
  tiers = [],
  killed = false,
  className = '',
}) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef(0);
  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  // Level is read live from the XP store at game-over (it isn't otherwise on these screens).
  const lvl = Number.isFinite(level) ? level : loadProgress().level;
  const text = buildResultCard({ mode, words, points, level: lvl, tiers, killed, link: modeShareLink(mode) });
  if (!text) return null; // suppression rule — an anti-ad

  async function onClick() {
    const ok = await copyToClipboard(text);
    try { track('result_copied', { mode, ok }); } catch { /* analytics only */ }
    setCopied(true);
    window.clearTimeout(timerRef.current);
    // Finite feedback flip — no infinite animation.
    timerRef.current = window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <button
      type="button"
      className={`copy-result-btn${copied ? ' is-copied' : ''}${className ? ` ${className}` : ''}`}
      onClick={onClick}
      aria-live="polite"
    >
      {copied ? 'COPIED!' : 'COPY RESULT'}
    </button>
  );
}
