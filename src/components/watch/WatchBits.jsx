// WatchBits.jsx — the SPECTATE pieces every game screen shares (Andy nov9: "indicators, separate players"). A watcher is
// never a player: their screen says SPECTATING in its header cluster and has one static line where the input would be;
// a player's screen says how many are watching. Each joins its screen's EXISTING header cluster / input slot (no fixed
// orphans). Static: no loops.
import './WatchBits.css';

/** The watcher's badge, in the game header's action cluster. */
export function WatchPill() {
  return <span className="watch-pill" role="status" data-testid="watch-chip">SPECTATING</span>;
}

/** Where a player's input sits: one line that says what watching means. */
export function WatchBar({ children }) {
  return <div className="watch-bar" data-testid="watch-bar">{children}</div>;
}

/** How many are watching this game (a player sees it, and so does a watcher). Hidden at zero. */
export function WatchersChip({ n }) {
  const count = Number(n) || 0;
  if (count <= 0) return null;
  return (
    <span className="watch-count" data-testid="watchers-chip" aria-label={`${count} watching`}>
      <b>{count}</b> WATCHING
    </span>
  );
}
