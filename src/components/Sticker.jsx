// Sticker.jsx — the reusable Flat-Pop / Sticker-Bomb primitive (see Sticker.css).
// Renders any element as a die-cut sticker. Spreads all extra props through, so a
// sticker can still be a real <button> with onClick / disabled / data-juice-self /
// onMouseEnter etc. — the menu's existing logic + juice survive untouched.
//
//   <Sticker as="button" color="#FF2EC4" rotate={-2} onClick={fn} data-juice-self>
//     CREATE ROOM
//   </Sticker>
//
// Prefer the palette modifier classes (sticker--pink/cyan/…) for on-system colours;
// `color`/`edge` props are an escape hatch. The three game-mode identities reuse
// this component, so keep it generic — no menu-specific logic here.
import './Sticker.css';

export default function Sticker({
  as: Tag = 'div',
  color,
  edge,
  rotate,
  className = '',
  style,
  children,
  ...rest
}) {
  const css = { ...style };
  if (color) css['--st-fill'] = color;
  if (edge) css['--st-edge'] = edge;
  if (rotate != null) css['--st-rot'] = typeof rotate === 'number' ? `${rotate}deg` : rotate;
  return (
    <Tag className={`sticker ${className}`.trim()} style={css} {...rest}>
      {children}
    </Tag>
  );
}
