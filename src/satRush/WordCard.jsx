// WordCard.jsx — the item card. Reveals are rendered in the ENGINE's order
// (view.reveals), so the tier-4/5 gloss<->root flip actually shows on screen —
// nothing about stage->content is decided here. Event state is now expressed in
// print: Deep Cut = a black corner ribbon, Revenant/clear/miss = a paper STAMP
// (view.stamp), Silver Tongue = the page reprinting in negative (a class on
// .sr-app, handled in SatRushGame). Every state still carries a text label.
import Slots from './Slots';

// The blank's dash run matches the word's letter count EXACTLY (no cap), so it
// never contradicts the "N letters" meta line or the slot count.
function Blank({ length }) {
  return (
    <span className="sr-blank" aria-label={`${length}-letter blank`}>
      {'–'.repeat(length)}
    </span>
  );
}

function RevealRow({ type, visible, view }) {
  const cls = `sr-reveal${visible ? ' in' : ''}`;
  if (type === 'sentence') {
    const [before, after] = view.context.split(/_+/);
    return (
      <div className={`sr-sentence ${cls}`}>
        {before}
        <Blank length={view.wordLength} />
        {after}
      </div>
    );
  }
  if (type === 'gloss') {
    return (
      <div className={`sr-gloss ${cls}`}>
        {visible ? (
          <>
            <span className="sr-tagchip" aria-hidden="true">
              DEF
            </span>
            “{view.gloss}”
          </>
        ) : (
          ''
        )}
      </div>
    );
  }
  if (type === 'root') {
    if (!view.root) {
      return (
        <div className={`sr-root ${cls}`}>
          {visible ? (
            <>
              <span className="sr-tagchip" aria-hidden="true">
                ROOT
              </span>
              <span className="cz">no shared root — this one stands alone</span>
            </>
          ) : (
            ''
          )}
        </div>
      );
    }
    return (
      <div className={`sr-root ${cls}`}>
        {visible ? (
          <>
            <span className="sr-tagchip" aria-hidden="true">
              ROOT
            </span>
            <b>{view.root.morpheme}</b> — {view.root.meaning}{' '}
            <span className="cz">· {view.root.cousins.join(' · ')}</span>
          </>
        ) : (
          ''
        )}
      </div>
    );
  }
  return null;
}

export default function WordCard({ view }) {
  const { kind, fx, msg, stamp, atFinal } = view;

  // Reveals to render as text rows (meta is separate; firstLetter lives in slots).
  const rows = view.reveals.filter((r) => ['sentence', 'gloss', 'root'].includes(r.type));

  return (
    // key on the shake counter so the shake animation restarts on each wrong key
    <div className={`sr-card${fx.shake ? ' shake' : ''}`} key={`card-${fx.shake}`}>
      {/* Deep Cut: a straight black corner ribbon that holds for the whole word. */}
      {kind === 'deep' && <div className="sr-ribbon">DEEP CUT</div>}
      {/* The paper STAMP (clear / miss / revenant). One at a time; re-keyed per
          event so the PUNCH-in replays. The only tilted element in the mode. */}
      {stamp && (
        <div className={`sr-stamp ${stamp.tone}`} key={`stamp-${stamp.id}`} aria-label={stamp.text}>
          {stamp.text}
        </div>
      )}
      <div className="sr-meta">{view.meta}</div>
      {/* Reveals scroll inside this region on a small screen; the slots below
          stay pinned and always visible. */}
      <div className="sr-card-reveals">
        {rows.map((r) => (
          <RevealRow key={r.type} type={r.type} visible={r.visible} view={view} />
        ))}
      </div>
      <div className="sr-slotwrap">
        {/* wrong key: a tiny "TCH!" tick near the typing row (re-keyed per reject) */}
        {fx.badKey ? (
          <span className="sr-tch" key={`tch-${fx.badKey}`} aria-hidden="true">
            TCH!
          </span>
        ) : null}
        <Slots slots={view.slots} badIndex={fx.badIndex} badKey={fx.badKey} />
      </div>
      {/* Spell-along endgame: the word prints itself out for scraps. */}
      {atFinal && (
        <div className="sr-spell">
          <div className="sr-spell-head">
            <span className="sr-spell-label">SPELLING ITSELF OUT…</span>
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
      <div className={`sr-msg${msg ? ` ${msg.kind}` : ''}`}>{msg ? msg.text : ''}</div>
    </div>
  );
}
