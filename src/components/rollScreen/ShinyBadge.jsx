// ShinyBadge — a SHINY mark's one small badge (an asset, no text). Shared by the ROLL screen's result card and the
// MARKS INDEX tiles. Styles: .mr-shiny in RollScreen.css.
import './RollScreen.css';

export default function ShinyBadge({ className = '' }) {
  return <img className={`mr-shiny ${className}`} src="/art/rolls/shiny.svg" alt="" aria-hidden="true" width="22" height="22" draggable="false" />;
}
export { ShinyBadge };
