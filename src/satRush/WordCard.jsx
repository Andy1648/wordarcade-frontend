// WordCard.jsx — the item card. Reveals are rendered in the ENGINE's order
// (view.reveals), so the tier-4/5 gloss<->root flip actually shows on screen —
// nothing about stage->content is decided here. State (Deep Cut / Revenant /
// Silver Tongue) is shown with a distinct glyph AND a text label, never colour
// alone.
import Slots from './Slots';

// glyph + label per state — the glyph is the non-colour shape cue.
const TAGS = {
  deep: { glyph: '◆', label: 'Deep Cut', cls: 'deep' },
  rev: { glyph: '↺', label: 'Revenant', cls: 'rev' },
  silver: { glyph: '✦', label: 'Silver Tongue', cls: 'silver' },
};

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
  const { kind, silver, fx, msg } = view;
  // Silver can co-exist with a deep/revenant word; show the rarer overlay's tag
  // but let silver style the card too.
  const tag = kind === 'rev' ? TAGS.rev : kind === 'deep' ? TAGS.deep : silver ? TAGS.silver : null;

  const cardCls = [
    'sr-card',
    silver ? 'silver' : '',
    kind === 'deep' ? 'deep' : '',
    kind === 'rev' ? 'rev' : '',
  ]
    .filter(Boolean)
    .join(' ');

  // Reveals to render as text rows (meta is separate; firstLetter lives in slots).
  const rows = view.reveals.filter((r) => ['sentence', 'gloss', 'root'].includes(r.type));

  return (
    // key on the shake counter so the shake animation restarts on each wrong key
    <div className={`${cardCls}${fx.shake ? ' shake' : ''}`} key={`card-${fx.shake}`}>
      {tag && (
        <div className={`sr-tag ${tag.cls}`}>
          <span aria-hidden="true">{tag.glyph}</span>
          {tag.label}
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
      <Slots slots={view.slots} badIndex={fx.badIndex} badKey={fx.badKey} />
      <div className={`sr-msg${msg ? ` ${msg.kind}` : ''}`}>{msg ? msg.text : ''}</div>
    </div>
  );
}
