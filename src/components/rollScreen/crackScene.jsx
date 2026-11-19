// crackScene.jsx — DEV-ONLY preview of the CRACK ROLL prototype (/?crack=1, src/main.jsx; compiled out of production like
// the kit gallery). ?roll=common|climb|max picks a scripted outcome so the previews are repeatable; a tap anywhere drives
// it like the real thing. ?roll=random rolls the real table (markRolls.roll with a fresh state) for feel-testing.
import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import CrackRoll from './CrackRoll.jsx';
import { roll, freshState } from '../../progress/markRolls';
import '../../index.css';

const SCRIPTS = {
  common: { result: { markId: 'mk-cyclone', tier: 'rare' }, path: ['rare', 'rare', 'rare'] },
  climb: { result: { markId: 'mk-eclipse', tier: 'legendary' }, path: ['epic', 'epic', 'legendary'] },
  max: { result: { markId: 'mk-paradox', tier: 'secret' }, path: ['epic', 'mythic', 'secret'] },
};

function Scene() {
  const q = new URLSearchParams(location.search);
  const key = q.get('roll') || 'climb';
  const [n, setN] = useState(0);
  // mount once the webfonts are in, so the entrance plays in Bungee (never a fallback-font flash)
  const [ready, setReady] = useState(false);
  useEffect(() => { document.fonts.load('40px Bungee').then(() => document.fonts.ready).then(() => setReady(true), () => setReady(true)); }, []);
  if (!ready) return null;
  const s = SCRIPTS[key] || (() => { const r = roll(Math.random, freshState()).result; return { result: { markId: r.markId, tier: r.tier }, path: null }; })();
  return <CrackRoll key={n} result={s.result} path={s.path} onDone={() => setN((k) => k + 1)} />;
}

ReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><Scene /></React.StrictMode>);
