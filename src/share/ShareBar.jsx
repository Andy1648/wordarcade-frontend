// src/share/ShareBar.jsx
// The reusable SHARE / IMAGE / COPY control dropped onto each results screen.
// Read-only: it takes that screen's EXISTING result data ({mode, outcome, data})
// and renders/shares a card — it never changes score, outcome, WS or anything.
// The card is pre-rendered on mount so the SHARE tap fires navigator.share
// inside the user gesture (Web Share requires it).

import { useEffect, useRef, useState } from 'react';
import { prepareCard, shareFile, downloadPng, copySummary } from './shareCard';
import './ShareBar.css';

export default function ShareBar({ mode, outcome, data, neon }) {
  const preparedRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  // Pre-render the card image once on mount (and whenever the result changes).
  useEffect(() => {
    let alive = true;
    setReady(false);
    prepareCard({ mode, outcome, data })
      .then((p) => {
        if (!alive) return;
        preparedRef.current = p;
        setReady(true);
      })
      .catch(() => {
        /* a render failure just leaves the buttons disabled; never crashes the screen */
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, JSON.stringify(outcome), JSON.stringify(data)]);

  const onShare = async () => {
    if (!ready || busy) return;
    setBusy(true);
    try { await shareFile(preparedRef.current); } finally { setBusy(false); }
  };
  const onDownload = () => {
    if (!ready) return;
    downloadPng(preparedRef.current);
  };
  const onCopy = async () => {
    if (!ready) return;
    await copySummary(preparedRef.current);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="share-bar" style={neon ? { '--share-neon': neon } : undefined}>
      <button className="share-btn share-primary" onClick={onShare} disabled={!ready || busy}>
        📣 SHARE
      </button>
      <button className="share-btn" onClick={onDownload} disabled={!ready}>
        ⬇ IMAGE
      </button>
      <button className="share-btn" onClick={onCopy} disabled={!ready}>
        {copied ? '✓ COPIED' : '⧉ COPY'}
      </button>
    </div>
  );
}
