// WordCard.jsx — the MANGA PANEL / bounty notice. The ante row and the word panel
// are ONE wanted notice: the word is a fugitive, the multiplier is its REWARD, a
// missed word returns as an ESCAPEE. Anatomy, top to bottom:
//   WANTED header (screentone plate) → case id (the meta) →
//   FIELDS (LAST SEEN / DESCRIPTION / KNOWN ALIASES) → mugshot SLOTS →
//   REWARD footer (AnteMeter — the bounty is the ante).
// Reveals are driven by the ENGINE's 3-stage schedule (view.reveals): meta +
// sentence at stage 0, gloss + root at stage 1, first letter at stage 2. Several
// types share a stage, so the fields light up in groups.
// STATE READS THROUGH THE PANEL'S SHAPE (the deep/revenant/atfinal classes on the
// root reshape .sr-cardframe): Deep Cut = a jagged starburst frame + the MOST
// WANTED header; Revenant = a wavy/broken frame + the ESCAPED overprint; final
// stage = the frame tightens + tone rises; Silver Tongue = the panel inverts
// (class on .sr-app); clear/miss = an SFX burst that breaks past the edge. Every
// state still carries a text label. The root .sr-card class is load-bearing (juice
// centres bursts on it and the wrong-key shake keys off .sr-card.shake).
import Slots from './Slots';
import AnteMeter from './AnteMeter';

// The re-encode BEAT (a miss, or a clear that leaned on the spell-along). The old
// flow flashed the word for half a second; this teaches instead — the SENTENCE
// with the answer filled in and highlighted (the same encode step as the
// briefing), the definition, and ONE cousin from the root if there is one. Held
// for the between-word pause, or dismissed early by any key (handled in the hook).
function ReEncode({ data }) {
  const { word, context, gloss, cousin, kind } = data;
  const [before, after] = context.split(/_+/);
  return (
    <div className={`sr-reencode ${kind}`} role="status">
      <div className="sr-reencode-tag">{kind === 'miss' ? 'IT WAS' : 'BARELY — REMEMBER IT'}</div>
      <div className="sr-reencode-word">{word}</div>
      <p className="sr-reencode-sentence">
        {before}
        <mark className="sr-brief-fill">{word}</mark>
        {after}
      </p>
      <p className="sr-reencode-def">“{gloss}”</p>
      {cousin && (
        <p className="sr-reencode-cousin">
          same root as <b>{cousin}</b>
        </p>
      )}
      <div className="sr-reencode-hint" aria-hidden="true">press any key</div>
    </div>
  );
}

// The SUSPECT LINEUP (LINEUP mode only). Every word is served with a lineup of
// same-length suspects, one of which is the fugitive; the player still TYPES the
// answer into the slots — this is a recognition aid, not the input. The lineup
// NARROWS with the ante (6 → 4 → 2), which is the whole point: it makes the
// multiplier visible, so answering early literally means answering with more
// suspects still standing. Eliminated suspects are crossed out IN PLACE with a
// CLEARED alibi treatment (a strikethrough + stamp; positions never move). No copy
// explains any of this — the narrowing does.
function SuspectLineup({ suspects }) {
  const { lineup, standing, count } = suspects;
  const cols = count >= 6 ? 3 : 2; // 6 → 3×2, 4 → 2×2, 2 → 2×1
  return (
    <div className="sr-lineup">
      <div className="sr-lineup-head">
        <span className="sr-lineup-label" aria-hidden="true">Suspects</span>
        <span className="sr-lineup-count" aria-label={`${standing} suspects still standing`}>
          {standing} STANDING
        </span>
      </div>
      <ul className="sr-lineup-grid" style={{ '--cols': cols }}>
        {lineup.map((s) => (
          <li key={s.word} className={`sr-suspect${s.eliminated ? ' cleared' : ''}`}>
            <span className="sr-suspect-word">{s.word.toUpperCase()}</span>
            {s.eliminated && (
              <span className="sr-suspect-alibi" aria-hidden="true">CLEARED</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

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
  const { fx, msg, stamp, atFinal, deepCut, revenant, missCount, reEncode, mode, suspects } = view;
  const isLineup = mode === 'lineup';

  // Reveals to render as fields (meta is the case id; firstLetter lives in slots).
  const rows = view.reveals.filter((r) => ['sentence', 'gloss', 'root'].includes(r.type));

  return (
    // The OUTER .sr-card is an unclipped positioning shell: the SFX burst is its
    // child so it can break PAST the panel edge (see .sr-stamp), while the visible
    // panel is the inner .sr-cardframe — that's what carries the state SHAPE
    // (deep = starburst, revenant = wavy/broken, atfinal = tightened) via clip-path,
    // so clipping the frame never clips the overflowing SFX. .sr-card stays load-
    // bearing (juice centres bursts on it; the wrong-key shake keys off .sr-card.shake).
    // key on the shake counter so the shake animation restarts on each wrong key.
    <div
      className={`sr-card sr-poster${deepCut ? ' deep' : ''}${revenant ? ' revenant' : ''}${
        atFinal ? ' atfinal' : ''
      }${fx.shake ? ' shake' : ''}`}
      key={`card-${fx.shake}`}
    >
      {/* The SFX BURST (clear / miss only). It's a child of the UNCLIPPED outer card
          so it overflows/breaks past the panel edge, rotated, with a heavy ink
          outline + offset fill. Re-keyed per event so the PUNCH-in replays. */}
      {stamp && (
        <div className={`sr-stamp ${stamp.tone}`} key={`stamp-${stamp.id}`} aria-label={stamp.text}>
          {stamp.text}
        </div>
      )}

      {/* The visible panel: the manga PANEL whose EDGE reads the state (narrator
          rectangle → deep-cut starburst → revenant wavy break → tightened final). */}
      <div className="sr-cardframe">
      {/* WANTED header; MOST WANTED on a deep cut. */}
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

      {/* LINEUP mode: the suspect lineup, narrowing with the ante. Replaces the
          spell-along block (lineup has no spell-along — the lineup is the aid). */}
      {isLineup && suspects && <SuspectLineup suspects={suspects} />}

      {/* Spell-along endgame (BRIEFING mode only): the fugitive's mugshot prints
          itself out for scraps. */}
      {!isLineup && atFinal && (
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
        lineup={isLineup}
      />

      <div className={`sr-msg${msg ? ` ${msg.kind}` : ''}`}>{msg ? msg.text : ''}</div>
      </div>
      {/* /.sr-cardframe */}

      {/* The re-encode teaching beat sits over the poster during the pause. */}
      {reEncode && <ReEncode data={reEncode} />}
    </div>
  );
}
