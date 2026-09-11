// src/share/CopyResultButton.jsx
// ONE-TAP shareable result (Job 1). Builds the exact spoiler-free receipt from
// resultCard.js, deep-links into the mode, and copies it (Clipboard API + a
// text-selection fallback). Renders NOTHING when the run is suppressed (< 3
// accepted words) so a 0/1/2-word share never appears. Read-only: touches no
// game state, no WebSocket.
import { useEffect, useRef, useState } from 'react';
import { buildResultCard, buildResultCardPlain, describeGlyphRow } from './resultCard';
import { modeShareLink } from './links';
import { copyToClipboard } from './copyText';
import { loadProgress } from '../progress/xp';
import { track } from '../lib/analytics';
import { shareCopied as evShareCopied } from '../lib/events.js';
import './CopyResultButton.css';

export default function CopyResultButton({
  mode,
  words,
  points = null,
  level = null,
  tiers = [],
  killed = false,
  suffix = null, // optional stat rendered on the glyph row (FUSE: "LETTERS 22/26")
  className = '',
}) {
  const [copied, setCopied] = useState(false);
  const [copiedPlain, setCopiedPlain] = useState(false);
  const timerRef = useRef(0);
  const plainTimerRef = useRef(0);
  useEffect(() => () => {
    window.clearTimeout(timerRef.current);
    window.clearTimeout(plainTimerRef.current);
  }, []);

  // Level is read live from the XP store at game-over (it isn't otherwise on these screens).
  const lvl = Number.isFinite(level) ? level : loadProgress().level;
  const shared = { mode, words, points, level: lvl, tiers, killed, suffix, link: modeShareLink(mode) };
  const text = buildResultCard(shared);
  // PLAIN-TEXT ALTERNATIVE. The emoji grid is a known screen-reader failure - a row of
  // squares is announced as "green square green square …" and is useless as a result -
  // so both shapes are always offered, never the grid alone.
  const plain = buildResultCardPlain(shared);
  const altText = describeGlyphRow(tiers, { killed });
  if (!text) return null; // suppression rule — an anti-ad

  async function onClick() {
    const ok = await copyToClipboard(text);
    try { track('result_copied', { mode, ok }); } catch { /* analytics only */ }
    if (ok) evShareCopied(`result:${mode}`); // canonical funnel event
    setCopied(true);
    window.clearTimeout(timerRef.current);
    // Finite feedback flip — no infinite animation.
    timerRef.current = window.setTimeout(() => setCopied(false), 1600);
  }

  async function onClickPlain() {
    const ok = await copyToClipboard(plain);
    try { track('result_copied', { mode, ok, plain: true }); } catch { /* analytics only */ }
    if (ok) evShareCopied(`result-plain:${mode}`);
    setCopiedPlain(true);
    window.clearTimeout(plainTimerRef.current);
    plainTimerRef.current = window.setTimeout(() => setCopiedPlain(false), 1600);
  }

  return (
    <span className="copy-result-pair">
      <button
        type="button"
        className={`copy-result-btn${copied ? ' is-copied' : ''}${className ? ` ${className}` : ''}`}
        onClick={onClick}
        aria-live="polite"
      >
        {copied ? 'COPIED!' : 'COPY RESULT'}
      </button>
      {/* The same receipt without the emoji grid. Its aria-description carries the ALT
          TEXT for the grid, so the row is never the only account of itself. */}
      <button
        type="button"
        className={`copy-result-alt${copiedPlain ? ' is-copied' : ''}`}
        onClick={onClickPlain}
        aria-live="polite"
        title={altText || 'Copy the result as plain text'}
      >
        {copiedPlain ? 'COPIED!' : 'COPY AS TEXT'}
      </button>
    </span>
  );
}
