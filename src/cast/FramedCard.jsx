// FramedCard.jsx — your hero as a CARD in the FRAME you wear (kit.js FRAMES). The painted frame sits on top; behind its
// two cut-out windows are plain fills (the art window in the hero's dark colour, the name plate in its colour) — flat
// rectangles only, every shape is the painted frame. `children` fill the art window (the live HeroShowcase). Static: the
// frame itself never moves (the hero inside carries the life).
import { kitById } from './kit.js';
import FitText from '../components/kit/FitText.jsx';
import './FramedCard.css';

const box = ([x, y, w, h]) => ({ left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%` });

export default function FramedCard({ frame, hero, className = '', children }) {
  const f = kitById(frame);
  if (!f || f.slot !== 'frame') return children;
  return (
    <div className={`fc ${className}`} style={{ aspectRatio: f.ar, '--fc-c': hero.color, '--fc-d': hero.dark }} data-frame={f.id}>
      <div className="fc-art" style={box(f.art)}>{children}</div>
      <div className="fc-plate" style={box(f.plate)} aria-hidden="true" />
      <img className="fc-frame" src={`/cards/frame-${f.id}.webp`} alt="" aria-hidden="true" draggable="false" />
      <FitText className="fc-name fit-center" style={box(f.plate)}>{hero.name}</FitText>
    </div>
  );
}
