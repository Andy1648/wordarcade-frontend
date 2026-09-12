// Num.jsx — a formatted number, typeset.
//
// Every economy number the player reads is `formatNum`'s output, but a string cannot express that
// "47.1K" is a NUMERAL followed by a UNIT. Set at one size in one face they read as a single word
// and the suffix competes with the digits for attention — which is exactly the digit you skim to
// tell 47.1K from 47.1M. So: the numeral in the display face (Bungee), the unit in Space Mono at
// 0.45× beside it.
//
// Wrap any wins / XP / price figure in this rather than interpolating formatNum() into a string,
// unless the number is inside a sentence (where a size change mid-line reads as a typo).
import { formatNumParts } from '../format';
import './Num.css';

export default function Num({ value, className = '', prefix = '', title }) {
  const { num, suffix } = formatNumParts(value);
  return (
    <span className={`num ${className}`.trim()} title={title}>
      {prefix}
      <span className="num-fig">{num}</span>
      {suffix && <span className="num-unit">{suffix}</span>}
    </span>
  );
}
