// ModeExample.jsx — the static worked-example block shared by ModeDialog (unlocked) and
// LockedPreviewDialog (locked). Shows the actual mechanic (not a description), the per-word
// wins rate, and the typical round length. Newgrounds treatment (thick black border, hard
// offset shadow, flat fill) lives in ModeExample.css. STATIC — no animation.
import './ModeExample.css';
import { MODE_EXAMPLES, MODE_ROUND_LENGTH } from './modeExamples';
import { perWordRateNow } from '../progress/wins';
import { formatRate, formatMultExact } from '../format';
import { modePower } from '../progress/xp';
import { FRENZY_MULT, formatFrenzy, frenzyMinutes } from '../progress/frenzy';
import { useFrenzyClock } from '../frenzy/useFrenzyClock';

// Highlight the first occurrence of `sub` within `word` in `color`.
function hiSub(word, sub, color) {
  const i = word.indexOf(sub);
  if (i < 0) return word;
  return (
    <>
      {word.slice(0, i)}
      <span style={{ color }}>{sub}</span>
      {word.slice(i + sub.length)}
    </>
  );
}

// Highlight the first & last letter (the pivot letters in a CHAIN) in `color`.
function hiEnds(word, color) {
  if (word.length === 1) return <span style={{ color }}>{word}</span>;
  return (
    <>
      <span style={{ color }}>{word[0]}</span>
      {word.slice(1, -1)}
      <span style={{ color }}>{word[word.length - 1]}</span>
    </>
  );
}

export default function ModeExample({ mode, accent = '#2EFFE0' }) {
  const frenzy = useFrenzyClock();
  const power = modePower(mode);
  const ex = MODE_EXAMPLES[mode];
  if (!ex) return null;
  const rateNow = perWordRateNow({ mode });
  const round = MODE_ROUND_LENGTH[mode];

  let body = null;
  if (ex.kind === 'chain') {
    body = (
      <div className="mode-ex-line">
        {ex.words.map((w, i) => (
          <span key={i} className="mode-ex-tok">
            {i > 0 && <span className="mode-ex-arrow" aria-hidden="true">→</span>}
            <span className="mode-ex-word">{hiEnds(w, accent)}</span>
          </span>
        ))}
      </div>
    );
  } else if (ex.kind === 'fuse') {
    body = (
      <div className="mode-ex-line">
        <span className="mode-ex-word" style={{ color: accent }}>{ex.fragment}</span>
        <span className="mode-ex-arrow" aria-hidden="true">→</span>
        {ex.answers.map((w, i) => (
          <span key={i} className="mode-ex-tok">
            {i > 0 && <span className="mode-ex-sep" aria-hidden="true">·</span>}
            <span className="mode-ex-word">{hiSub(w, ex.fragment, accent)}</span>
          </span>
        ))}
      </div>
    );
  } else if (ex.kind === 'words') {
    body = (
      <div className="mode-ex-line">
        {ex.words.map((w, i) => (
          <span key={i} className="mode-ex-tok">
            {i > 0 && <span className="mode-ex-sep" aria-hidden="true">·</span>}
            <span className="mode-ex-word" style={i === 0 ? { color: accent } : undefined}>{w}</span>
          </span>
        ))}
      </div>
    );
  } else if (ex.kind === 'combo') {
    body = (
      <div className="mode-ex-line">
        <span className="mode-ex-word" style={{ color: accent }}>{ex.combo}</span>
        <span className="mode-ex-arrow" aria-hidden="true">→</span>
        <span className="mode-ex-word">{hiSub(ex.word, ex.combo, accent)}</span>
      </div>
    );
  } else if (ex.kind === 'category') {
    body = (
      <div className="mode-ex-line">
        <span className="mode-ex-word" style={{ color: accent }}>“{ex.prompt}”</span>
        <span className="mode-ex-arrow" aria-hidden="true">→</span>
        <span className="mode-ex-word">{ex.answers.join(', ')}</span>
      </div>
    );
  } else if (ex.kind === 'define') {
    body = (
      <div className="mode-ex-line mode-ex-define">
        <span className="mode-ex-word" style={{ color: accent }}>{ex.word}</span>
        <span className="mode-ex-arrow" aria-hidden="true">→</span>
        <span className="mode-ex-def">{ex.definition}</span>
      </div>
    );
  }

  return (
    <div className="mode-ex">
      <div className="mode-ex-tag" style={{ color: accent, borderColor: accent }}>EXAMPLE</div>
      {body}
      <div className="mode-ex-meta">
        <span className="mode-ex-pay">
          {/* The RESOLVED rate, like the mode card — not the base with a rebirth chip bolted on
              for the player to multiply out (and momentum/level/mark missing from both). */}
          <b style={{ color: accent }}>{formatRate(rateNow.rate)}</b> WINS / WORD
          {Math.abs(rateNow.mult / (rateNow.factors.mode || 1) - 1) > 1e-9 && (
            <span className="mode-ex-mult" title="YOUR BONUS: REBIRTH × MARK × BOOST"> (×{formatMultExact(((b) => (b >= 10 ? Math.round(b) : b))(rateNow.mult / (rateNow.factors.mode || 1)))} BONUS)</span>
          )}
        </span>
        <span className="mode-ex-round">{round}</span>
      </div>
      {/* WHAT MAKES A WORD WORTH MORE (Andy oct2). The rate above is the BASE — a 5-letter word. */}
      <div className="mode-ex-perks">
        {power > 1 && (
          <span className="mode-ex-power" style={{ color: accent }}>
            POWER ×{formatMultExact(power)} <span className="mode-ex-power-vs">VS WORD BOMB</span>
          </span>
        )}
        <span className="mode-ex-longer">BASE 10 WINS / WORD · BASE 10 XP / LETTER × KEY × REBIRTH</span>
      </div>
      {mode === 'fuse' && (
        <div className={`mode-ex-frenzy${frenzy.active ? ' is-live' : ''}`}>
          {frenzy.active ? (
            <>FRENZY LIVE — ×{FRENZY_MULT} WINS FOR {formatFrenzy(frenzy.ms)}</>
          ) : (
            <>LIGHT ALL LETTERS → <b>FRENZY ×{FRENZY_MULT}</b> FOR {frenzyMinutes()} MIN</>
          )}
        </div>
      )}
    </div>
  );
}
