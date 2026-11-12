// JackpotCoins.jsx — the JACKPOT frame's payout (jackpotCoins.js): a fixed pool of three coins, one finite WAAPI one-shot
// each, played once as the frame appears and again when its host is hovered (never over a run in flight). No timer, no
// loop, nothing at rest; never played under reduced motion.
import { useEffect, useRef } from 'react';
import { reduceMotion } from '../lib/reduceMotion';
import { COIN_SRC, COIN_COUNT, COIN_MS, COIN_STAGGER_MS, coinFrames } from './jackpotCoins.js';
import './JackpotCoins.css';

const SLOTS = Array.from({ length: COIN_COUNT }, (_, k) => k);

export default function JackpotCoins({ box }) {
  const root = useRef(null);
  useEffect(() => {
    const el = root.current;
    if (!el || reduceMotion()) return undefined;
    const coins = [...el.children];
    let running = 0;
    const play = () => {
      if (running) return;
      coins.forEach((c, k) => {
        running += 1;
        c.style.willChange = 'transform, opacity';
        const a = c.animate(coinFrames(k), { duration: COIN_MS, delay: k * COIN_STAGGER_MS, easing: 'linear' });
        const off = () => { running -= 1; c.style.willChange = ''; };
        a.finished.then(off, off);
      });
    };
    play();
    const host = el.parentElement;
    host.addEventListener('pointerenter', play);
    return () => {
      host.removeEventListener('pointerenter', play);
      coins.forEach((c) => c.getAnimations().forEach((a) => a.cancel()));
    };
  }, []);
  return (
    <span className="avf-coins" ref={root} style={box} aria-hidden="true">
      {SLOTS.map((k) => <img key={k} className="avf-coin" src={COIN_SRC} alt="" draggable="false" />)}
    </span>
  );
}
