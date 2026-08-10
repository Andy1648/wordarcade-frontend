// WordCard.jsx — the BOUNTY POSTER. The ante row and the word panel are now ONE
// wanted poster: the word is a fugitive, the multiplier is its REWARD, a missed
// word returns as an ESCAPEE. Anatomy, top to bottom:
//   overline → WANTED header (off-register violet plate) → case id (the meta) →
//   FIELDS (LAST SEEN / DESCRIPTION / KNOWN ALIASES) → mugshot SLOTS →
//   REWARD footer (AnteMeter — the bounty is the ante) → fine print.
// Reveals are still rendered in the ENGINE's order (view.reveals) so the tier-4/5
// gloss<->root flip shows on screen. Event state stays in print: Deep Cut = the
// MOST WANTED header + red overline; Revenant = the ESCAPED overprint slapped
// across the header (a held state marker, not the corner stamp); clear/miss = a
// paper STAMP; Silver Tongue = the page reprinting in negative (class on .sr-app).
// Every state still carries a text label. The root .sr-card class is load-bearing
// (juice centres bursts on it and the wrong-key shake keys off .sr-card.shake).
import Slots from './Slots';
import AnteMeter from './AnteMeter';

// The blank's dash run matches the word's letter count EXACTLY (no cap), so it
// never contradicts the "N letters" case-id line or the slot count.
function Blank({ length }) {
  return (
    <span className="sr-blank" aria-label={`${length}-letter blank`}>
      {'–'.repeat(length)}
    </span>
  );
}

// One reveal -> its bounty FIELD (a bordered label chip + the content). Content
// stays hidden (opacity) until its stage, exactly like before. A root-null
// fugitive has no KNOWN ALIASES row at all.
function FieldRow({ type, visible, view }) {
  const cls = `sr-field sr-reveal${visible ? ' in' : ''}`;
  if (type === 'sentence') {
    const [before, after] = view.context.split(/_+/);
    return (
      <div className={cls}>
        <span className="sr-fieldlabel" aria-hidden="true">Last seen</span>
        <div className="sr-fieldbody sr-sentence">
          {before}
          <Blank length={view.wordLength} />
          {after}
        </div>
      </div>
    );
  }
  if (type === 'gloss') {
    return (
      <div className={cls}>
        <span className="sr-fieldlabel" aria-hidden="true">Description</span>
        <div className="sr-fieldbody sr-gloss">{visible ? `“${view.gloss}”` : ''}</div>
      </div>
    );
  }
  if (type === 'root') {
    if (!view.root) return null; // no shared root -> the fugitive has no known aliases
    return (
      <div className={cls}>
        <span className="sr-fieldlabel" aria-hidden="true">Known aliases</span>
        <div className="sr-fieldbody sr-root">
          {visible ? (
            <>
              <b>{view.root.morpheme}</b> — {view.root.meaning}{' '}
              <span className="cz">· {view.root.cousins.join(' · ')}</span>
            </>
          ) : (
            ''
          )}
        </div>
      </div>
    );
  }
  return null;
}

export default function WordCard({ view }) {
  const { fx, msg, stamp, atFinal, deepCut, revenant, missCount } = view;

  // Reveals to render as fields (meta is the case id; firstLetter lives in slots).
  const rows = view.reveals.filter((r) => ['sentence', 'gloss', 'root'].includes(r.type));

  return (
    // key on the shake counter so the shake animation restarts on each wrong key
    <div className={`sr-card sr-poster${fx.shake ? ' shake' : ''}`} key={`card-${fx.shake}`}>
      {/* The paper STAMP (clear / miss only — revenant now uses the ESCAPED
          overprint below). One at a time; re-keyed per event so the PUNCH-in
          replays. The only tilted corner element in the mode. */}
      {stamp && (
        <div className={`sr-stamp ${stamp.tone}`} key={`stamp-${stamp.id}`} aria-label={stamp.text}>
          {stamp.text}
        </div>
      )}

      {/* Overline: the gazette masthead line normally; the deep-cut notice (red). */}
      <div className={`sr-overline${deepCut ? ' deep' : ''}`}>
        {deepCut ? 'TIER 5 — DEEP CUT · REWARD +150' : 'TYPE A WORD GAZETTE — BOUNTY DIV.'}
      </div>

      {/* WANTED header (off-register violet plate); MOST WANTED on a deep cut. */}
      <div className="sr-wanted-wrap">
        <div className="sr-wanted sr-print" data-v={deepCut ? 'MOST WANTED' : 'WANTED'}>
          {deepCut ? 'MOST WANTED' : 'WANTED'}
        </div>
        {/* Revenant = an ESCAPED overprint: a red double-ruled stamp across the
            header at a slight tilt, held for the whole word. */}
        {revenant && (
          <div className="sr-escaped" aria-label={`escaped ${missCount} times — reward doubled`}>
            ESCAPED ×{missCount} — REWARD DOUBLED
          </div>
        )}
      </div>

      {/* Case id: the existing meta, in a double-ruled band. */}
      <div className="sr-caseid">{view.meta}</div>

      {/* Fields scroll inside this region on a small screen; the mugshot slots
          below stay pinned and always visible. */}
      <div className="sr-fields">
        {rows.map((r) => (
          <FieldRow key={r.type} type={r.type} visible={r.visible} view={view} />
        ))}
      </div>

      {/* Mugshot slots, centred. */}
      <div className="sr-slotwrap">
        {/* wrong key: a tiny "TCH!" tick near the typing row (re-keyed per reject) */}
        {fx.badKey ? (
          <span className="sr-tch" key={`tch-${fx.badKey}`} aria-hidden="true">
            TCH!
          </span>
        ) : null}
        <Slots slots={view.slots} badIndex={fx.badIndex} badKey={fx.badKey} />
      </div>

      {/* Spell-along endgame: the fugitive's mugshot prints itself out for scraps. */}
      {atFinal && (
        <div className="sr-spell">
          <div className="sr-spell-head">
            <span className="sr-spell-label">MUGSHOT PRINTING…</span>
            <span className="sr-scraps">1× SCRAPS</span>
          </div>
          <div className="sr-spell-bar" aria-hidden="true">
            <div
              className="sr-spell-fill"
              key={`spell-${view.wordNumber}`}
              style={{ animationDuration: `${view.graceMs}ms` }}
            />
          </div>
        </div>
      )}

      {/* REWARD footer — the bounty is the ante (replaces the old separate row). */}
      <AnteMeter
        multiplier={view.multiplier}
        stage={view.stage}
        maxStage={view.maxStage}
        wordNumber={view.wordNumber}
        interval={view.interval}
        graceMs={view.graceMs}
        atFinal={view.atFinal}
        running={view.pending === 'idle'}
      />

      <div className={`sr-msg${msg ? ` ${msg.kind}` : ''}`}>{msg ? msg.text : ''}</div>

      {/* Fine print. */}
      <div className="sr-fineprint" aria-hidden="true">
        ISSUED BY TYPEAWORD.COM · SAT RUSH DIVISION
      </div>
    </div>
  );
}
