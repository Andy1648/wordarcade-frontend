// KoHero.jsx — the Word Bomb LOSS hero on the game-over card: the "K.O." sign.
//
// Andy: "horrible KO sign". What it replaced was a 150px mascot over a plain "ELIMINATED" line
// and a "RIVAL WINS" line — three stacked strings with nothing tying them together.
//
// FIGHT BANNER (picked from three treatments; the other two were an impact stamp over a
// starburst and a Y2K "KNOCKOUT.EXE" window). A fighting-game results bar: one skewed slab
// across the card, the panicking mascot hanging off its left end, "K.O." set inside it, and a
// yellow strip under it naming who won. It is horizontal, so it spends the card's WIDTH — which
// every screen has — instead of its height, which a 625px laptop and a phone do not.
//
// ART VS MOTION: the slabs are rectangles (the one shape CSS is allowed to draw); the word is
// LayeredWord (four Bungee faces, no text-shadow); the mascot is the <Mascot> PNG. Static at
// rest. The only motion is ONE finite slam-in on the word (transform/opacity) — under reduced
// motion it is simply there, fully formed.
import Mascot from './Mascot';
import LayeredWord from './LayeredWord';
import './KoHero.css';

export default function KoHero({ winnerName }) {
  const who = winnerName ? `${winnerName.toUpperCase()} WINS` : 'NO WINNER';
  return (
    <div className="ko-hero" role="heading" aria-level={2} aria-label={`Knocked out. ${who}.`}>
      <div className="ko-hero-bar" aria-hidden="true">
        <div className="ko-hero-mascot">
          <Mascot pose="panic" size={150} className="ko-hero-mascot-img" />
        </div>
        <LayeredWord className="ko-hero-word" text="K.O." accent="#2EFFE0" />
      </div>
      <div className="ko-hero-strip" aria-hidden="true">
        <span className="ko-hero-strip-who" translate="no">{who}</span>
      </div>
    </div>
  );
}
