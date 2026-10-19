// JuiceLab.jsx — PREVIEW-ONLY (/?juicelab=1, never on typeaword.com). Fires each feat/reward-juice prototype on demand
// so Andy can feel them without grinding to the real trigger: P1 the XP bar's goal plate, P2 the FRENZY / OVERDRIVE
// hero power-up, P3 the NEW BEST chase. Removed before anything ships.
import { useState } from 'react';
import { KitXpBar } from '../../components/kit/KitXpBar.jsx';
import FrenzyBurst from '../../frenzy/FrenzyBurst.jsx';
import BestPass from '../BestPass.jsx';
import '../../solo/Solo.css';
import './JuiceLab.css';

const HEROES = ['riot', 'glitch', 'hype', 'brawl', 'hex', 'boo', 'lexi', 'mecha'];
const NEED = 1000;

export default function JuiceLab() {
  // P1
  const [lv, setLv] = useState(20);
  const [frac, setFrac] = useState(0.42);
  const [gateNext, setGateNext] = useState(false);
  const gain = (d) => {
    const f = frac + d;
    if (f >= 1) {
      setLv((l) => l + 1);
      setFrac(f - 1);
    } else setFrac(f);
  };
  // P2
  const [hero, setHero] = useState('riot');
  const [burst, setBurst] = useState(null); // { k, kind }
  // P3
  const [pass, setPass] = useState(0);

  return (
    <div className="jl">
      <header className="jl-head">
        <h1>JUICE LAB</h1>
        <p>Preview only. Each button fires one prototype moment.</p>
      </header>

      <section className="jl-sec">
        <h2><b>1</b> XP BAR — NEXT REWARD + ALMOST THERE</h2>
        <p>The right end shows what you are climbing toward. In the last 10% it lights up and every gain bumps it.</p>
        <div className="jl-bar">
          <KitXpBar level={lv} frac={frac} need={NEED} lvInside goal={{ lv: lv + 1, rebirth: gateNext, r: 2 }} />
        </div>
        <div className="jl-btns">
          <button type="button" onClick={() => gain(0.03)}>+3% XP</button>
          <button type="button" onClick={() => gain(0.15)}>+15% XP</button>
          <button type="button" onClick={() => setFrac(0.88)}>JUMP TO 88%</button>
          <button type="button" className={gateNext ? 'is-on' : ''} onClick={() => setGateNext((v) => !v)}>NEXT LEVEL = REBIRTH</button>
        </div>
      </section>

      <section className="jl-sec">
        <h2><b>2</b> FRENZY / OVERDRIVE — YOUR HERO POWERS UP</h2>
        <p>Your equipped hero bursts up behind the slab. Pick a hero, then fire.</p>
        <div className="jl-btns jl-heroes">
          {HEROES.map((h) => (
            <button key={h} type="button" className={hero === h ? 'is-on' : ''} onClick={() => setHero(h)}>{h.toUpperCase()}</button>
          ))}
        </div>
        <div className="jl-btns">
          <button type="button" className="jl-go" onClick={() => setBurst({ k: Date.now(), kind: 'frenzy' })}>FIRE FRENZY</button>
          <button type="button" className="jl-go jl-go--pink" onClick={() => setBurst({ k: Date.now(), kind: 'overdrive' })}>FIRE OVERDRIVE</button>
          <button type="button" onClick={() => setBurst({ k: Date.now(), kind: 'old' })}>OLD FRENZY (BEFORE)</button>
        </div>
      </section>

      <section className="jl-sec">
        <h2><b>3</b> BEST CHASE — CHAIN / FUSE</h2>
        <p>Passing your best mid-run drops the trophy in the corner, once per run. The game-over card names a near miss.</p>
        <div className="jl-mock">
          <div className="jl-mock-hud">SCORE 1,412 · BEST 1,390</div>
          {pass > 0 && (
            <div className="solo-bestpass">
              <BestPass key={pass} sub="OLD 1,390" />
            </div>
          )}
        </div>
        <div className="jl-btns">
          <button type="button" className="jl-go" onClick={() => setPass((n) => n + 1)}>PASS YOUR BEST</button>
        </div>
        <div className="jl-over">
          <div className="solo-scoreline">
            <span>SCORE 1,240</span>
            <span>BEST 1,390</span>
            <span className="solo-pbline is-near">JUST 150 SHORT OF YOUR BEST</span>
          </div>
          <div className="solo-scoreline">
            <span>SCORE 1,412</span>
            <span>BEST 1,412</span>
            <span className="solo-pbline is-new">NEW BEST · +22</span>
          </div>
        </div>
      </section>

      {burst && burst.kind === 'frenzy' && <FrenzyBurst key={burst.k} hero={hero} line="×5 XP · 5 MIN" />}
      {burst && burst.kind === 'overdrive' && <FrenzyBurst key={burst.k} hero={hero} variant="overdrive" title="OVERDRIVE" line="×5 · 5 MIN" />}
      {burst && burst.kind === 'old' && <FrenzyBurst key={burst.k} hero={false} line="×5 WINS · 5 MIN" />}
    </div>
  );
}
