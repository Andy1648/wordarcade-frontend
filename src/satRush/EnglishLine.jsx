// EnglishLine.jsx — FRENCH RUSH: the English of an example sentence, folded behind one tap.
// Andy oct20: the English line on every card was "too overcrowded" — the French example is the point;
// a student who needs the translation asks for it. Used by the review card, the study cards and the
// results list, so it reads the same everywhere.
import { useState } from 'react';
import { rushLang } from './rushLang';

export default function EnglishLine({ text, className }) {
  const [open, setOpen] = useState(false);
  if (!text) return null;
  // CHINESE RUSH flips it: the example is English and the fold holds the Chinese
  const label = rushLang().englishToggle || 'in English';
  if (open) return <p className={className}>{text}</p>;
  return (
    <button type="button" className="sr-linkbtn sr-en-toggle" onClick={() => setOpen(true)} aria-label={`show ${label}: ${text}`}>
      {label}
    </button>
  );
}
