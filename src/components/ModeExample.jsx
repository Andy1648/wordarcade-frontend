// ModeExample.jsx — the static worked-example block shared by ModeDialog (unlocked) and
// LockedPreviewDialog (locked). Shows the actual mechanic (not a description), the per-word
// wins rate, and the typical round length. Newgrounds treatment (thick black border, hard
// offset shadow, flat fill) lives in ModeExample.css. STATIC — no animation.
import './kit/tokens.css';
import './ModeExample.css';
import { MODE_EXAMPLES } from './modeExamples';
import { perWordRateNow } from '../progress/wins';
import { formatRate } from '../format';
import { frenzyShort, formatFrenzy, frenzyMinutes } from '../progress/frenzy';
import { useFrenzyClock } from '../frenzy/useFrenzyClock';
import KitIcon from './kit/KitIcon.jsx';
import { V3 } from '../progress/season';

/** WHERE THIS MODE'S GEMS COME FROM (Andy oct10: "ABSOLUTELY know where the gems come from") — the season-2 gem
 *  table (v3/econ), so every number here is the one the payout uses. [big, what] rows; [] outside season 2. */
export function modeGemRows(mode) {
  const E = V3.econ;
  if (!E) return [];
  const words = [`+${E.DROP_MIN}–${E.DROP_MAX}`, `1 IN ${Math.round(1 / E.DROP_CHANCE)} WORDS`];
  const b = E.BOT_WIN_BY_DIFF;
  const pot = [`${E.POT_PER_PLAYER} × PLAYERS`, 'WIN VS PEOPLE'];
  if (mode === 'word-bomb' || mode === 'category-blitz') return [[`+${b.easy} / ${b.medium} / ${b.hard}`, 'BEAT A BOT'], pot, words];
  if (mode === 'word-race') return [[`${E.POT_PER_PLAYER} × PLAYERS`, 'WIN'], [`+1 / ${Math.round(1 / E.RACE_GEMS_PER_WPM)} WPM`, 'SPEED'], words];
  return [words];
}

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
  const ex = MODE_EXAMPLES[mode];
  if (!ex) return null;
  const rateNow = perWordRateNow({ mode });
  const gemRows = modeGemRows(mode);

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
      {/* Andy oct10 ("the win gain … is so unclear (text is tiny and there's just too much)"): ONE big WINS line with
          its icon, then the mode's GEM sources, each with the gem. No formula, no bonus tag, no round-length row. */}
      <div className="mode-ex-pay2" data-testid="mode-ex-wins">
        <KitIcon name="wins" size={36} shadow={2} extras={false} />
        <b className="mode-ex-pay2-n">{formatRate(rateNow.rate)}</b>
        <span className="mode-ex-pay2-u">{mode === 'fuse' ? 'WINS / WORD' : 'BASE WINS / WORD'}</span>
      </div>
      {gemRows.length ? (
        <ul className="mode-ex-gems" data-testid="mode-ex-gems">
          {gemRows.map(([big, what]) => (
            <li key={what} className="mode-ex-gem">
              <KitIcon name="gems" size={30} shadow={2} extras={false} />
              <b className="mode-ex-gem-n">{big}</b>
              <span className="mode-ex-gem-u">{what}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {mode === 'fuse' && (
        <div className={`mode-ex-frenzy${frenzy.active ? ' is-live' : ''}`}>
          {frenzy.active ? (
            <>FRENZY LIVE — {frenzyShort().includes('XP') ? frenzyShort() : `${frenzyShort()} WINS`} FOR {formatFrenzy(frenzy.ms)}</>
          ) : (
            <>LIGHT ALL LETTERS → <b>FRENZY {frenzyShort()}</b> FOR {frenzyMinutes()} MIN</>
          )}
        </div>
      )}
    </div>
  );
}
