// SettingsPanel.jsx — the v2 SETTINGS (claude/mockups/v2/RoomSettings.dc.html, SEASON2-QUEUE 9d: "5-row settings
// (REDUCE MOTION, NUMBER STYLE)"). FIVE rows, each a label + a one-line "what it does" + one control:
//
//   SOUND            10-step bar = the master volume (0 = event sounds off)      audio/audioCore + gameSounds
//   MUSIC            ON / OFF (App owns the music; it ducks it per screen)        onToggleMusic
//   REDUCE MOTION    ON / OFF, live (<html data-reduce-motion>)                    lib/reduceMotion
//   NUMBER STYLE     1.2M | 1,200,000 (format.js NUMBER STYLE, persisted)          format.js
//   KEYBOARD SOUNDS  ON / OFF (the per-key clack)                                  progress/clack
//
// It lives where the app's settings already live — the ONE sound/settings control (AudioControls), which renders this
// panel in its popover under SEASON2 (CLAUDE.md NO ORPHAN FIXED UI: no new fixed element). Every control is a real
// ≥ 44 px button; nothing animates but the press.
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { getMasterVolume, setMasterVolume, ensureCtx } from '../audio/audioCore';
import { enableEventSounds, disableEventSounds, isEventSoundsEnabled } from '../audio/gameSounds';
import { enableClack, disableClack, isClackEnabled } from '../progress/clack';
import { setReduceMotion } from '../lib/reduceMotion';
import { useReduceMotion } from '../lib/useReduceMotion';
import { formatNum, getNumberStyle, setNumberStyle } from '../format';
import { exportSave, importSave } from '../save/saveBackup';
import { V3 } from '../progress/season';
import { getPlatePick, setPlatePick } from '../progress/platePick';
import './kit/tokens.css';
import './SettingsPanel.css';

const STEPS = 10;

function Row({ tone, label, sub, children }) {
  return (
    <div className="sp-row" style={{ '--sp-c': tone }}>
      <div className="sp-text">
        <span className="sp-label">{label}</span>
        <span className="sp-sub">{sub}</span>
      </div>
      <div className="sp-ctl">{children}</div>
    </div>
  );
}

function OnOff({ on, onClick, label }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className={`sp-switch${on ? ' is-on' : ''}`} onClick={onClick}>
      <span className="sp-switch-k">{on ? 'ON' : 'OFF'}</span>
      <span className="sp-switch-box" aria-hidden="true">{on ? '✓' : '✕'}</span>
    </button>
  );
}

// SAVE PROGRESS (Andy oct8: "you need a button for people to save their progress — remember the restore code"): the
// save CODE (save/saveBackup — every progress key incl. season 2's taw.s2.*) to COPY, and a box to paste one back.
function SaveRow() {
  const [code, setCode] = useState('');
  const [draft, setDraft] = useState('');
  const [msg, setMsg] = useState('');
  const copy = () => {
    const c = exportSave();
    setCode(c);
    try {
      navigator.clipboard.writeText(c).then(() => setMsg('COPIED — KEEP IT SOMEWHERE SAFE'), () => setMsg('SELECT THE CODE BELOW AND COPY IT'));
    } catch {
      setMsg('SELECT THE CODE BELOW AND COPY IT');
    }
  };
  const restore = (e) => {
    e.preventDefault();
    const r = importSave(draft);
    if (!r.ok) {
      setMsg(String(r.error || 'THAT CODE DID NOT WORK').toUpperCase());
      return;
    }
    setMsg('RESTORED — RELOADING…');
    setTimeout(() => {
      try { window.location.reload(); } catch { /* */ }
    }, 700);
  };
  return (
    <div className="sp-save" style={{ '--sp-c': '#2EFFE0' }}>
      <div className="sp-text">
        <span className="sp-label">SAVE PROGRESS</span>
        <span className="sp-sub">COPY YOUR SAVE CODE · PASTE IT ON ANY DEVICE TO GET EVERYTHING BACK</span>
      </div>
      <button type="button" className="sp-btn" onClick={copy} data-testid="sp-save-copy">COPY SAVE CODE</button>
      {code ? <textarea className="sp-code" readOnly value={code} rows={2} aria-label="Your save code" onFocus={(e) => e.target.select()} /> : null}
      <form className="sp-restore" onSubmit={restore}>
        <input className="sp-input" value={draft} onChange={(e) => setDraft(e.target.value.slice(0, 200000))} placeholder="PASTE A SAVE CODE" aria-label="Paste a save code" autoComplete="off" spellCheck="false" />
        <button type="submit" className="sp-btn sp-btn--ghost" disabled={!draft.trim()}>RESTORE</button>
      </form>
      {msg ? <p className="sp-msg" role="status" aria-live="polite">{msg}</p> : null}
    </div>
  );
}

// RANK PLATE (Andy oct8: "choose which rank plate shows next to your name"): any rank already reached.
function PlateRow() {
  const R = V3.ranks;
  const [pick, setPick] = useState(() => getPlatePick());
  if (!R || !R.RANKS_V3 || typeof R.liveRankV3 !== 'function') return null;
  const reached = R.RANKS_V3.indexOf(R.liveRankV3());
  const opts = R.RANKS_V3.slice(0, Math.max(0, reached) + 1);
  const shown = pick != null && pick <= reached ? pick : reached;
  const choose = (i) => {
    const v = i === reached ? null : i; // the current rank = "no pick" (it moves up with you)
    setPlatePick(v);
    setPick(v);
  };
  return (
    <div className="sp-plates" style={{ '--sp-c': '#FFC23D' }}>
      <div className="sp-text">
        <span className="sp-label">RANK PLATE</span>
        <span className="sp-sub">WHICH RANK SHOWS NEXT TO YOUR NAME · HIGHEST = DEFAULT</span>
      </div>
      <div className="sp-plate-list" role="radiogroup" aria-label="Rank plate">
        {opts.map((r, i) => (
          <button key={r.name} type="button" role="radio" aria-checked={shown === i} className={`sp-plate${shown === i ? ' is-on' : ''}`} onClick={() => choose(i)}>
            {r.name}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function SettingsPanel({ musicMuted = false, onToggleMusic, sheet = false, sfxMuted = false, onToggleSfx = null, onClose, onChange }) {
  const [vol, setVol] = useState(() => (isEventSoundsEnabled() ? Math.round(getMasterVolume() * STEPS) : 0));
  const [clack, setClack] = useState(() => isClackEnabled());
  const [style, setStyle] = useState(() => getNumberStyle());
  const reduceOn = useReduceMotion();

  const setLevel = (n) => {
    ensureCtx(); // a user gesture: safe to warm the context so the change is audible
    if (n <= 0) {
      disableEventSounds();
    } else {
      if (!isEventSoundsEnabled()) enableEventSounds();
      setMasterVolume(n / STEPS);
    }
    setVol(n);
    if (onChange) onChange();
  };
  const toggleClack = () => {
    if (clack) disableClack();
    else enableClack();
    setClack(!clack);
    if (onChange) onChange();
  };
  const pickStyle = (s) => setStyle(setNumberStyle(s));

  const rows = (
    <div className="sp" role="group" aria-label="Settings">
      <Row tone="#FFE94A" label="SOUND" sub="BOOMS, DINGS, BUZZERS">
        <div className="sp-bars" role="radiogroup" aria-label={`Sound ${vol * 10}`}>
          {Array.from({ length: STEPS }, (_, i) => (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={vol === i + 1}
              aria-label={`Sound ${(i + 1) * 10}`}
              className={`sp-bar${i < vol ? ' is-on' : ''}`}
              style={{ '--sp-h': `${40 + i * 6}%` }}
              onClick={() => setLevel(vol === i + 1 ? 0 : i + 1)}
            />
          ))}
        </div>
        <span className="sp-val">{formatNum(vol * 10)}</span>
      </Row>
      <Row tone="#B04BFF" label="MUSIC" sub="LOBBY + MATCH TRACKS">
        <OnOff on={!musicMuted} onClick={onToggleMusic} label="Music" />
      </Row>
      <Row tone="#2EFFE0" label="REDUCE MOTION" sub="ON = CALMER">
        <OnOff on={reduceOn} onClick={() => setReduceMotion(!reduceOn)} label="Reduce motion" />
      </Row>
      <Row tone="#FFC23D" label="NUMBER STYLE" sub={<>SCORE <b>{style === 'full' ? '1,200,000' : '1.2M'}</b></>}>
        <div className="sp-seg" role="radiogroup" aria-label="Number style">
          <button type="button" role="radio" aria-checked={style === 'short'} className={`sp-seg-b${style === 'short' ? ' is-on' : ''}`} onClick={() => pickStyle('short')}>1.2M</button>
          <button type="button" role="radio" aria-checked={style === 'full'} className={`sp-seg-b${style === 'full' ? ' is-on' : ''}`} onClick={() => pickStyle('full')}>1,200,000</button>
        </div>
      </Row>
      <Row tone="#FF3D7F" label="KEYBOARD SOUNDS" sub="CLICK ON EVERY KEY">
        <OnOff on={clack} onClick={toggleClack} label="Keyboard sounds" />
      </Row>
      <PlateRow />
      <SaveRow />
    </div>
  );
  if (!sheet || typeof document === 'undefined') return rows;
  // the SHEET: season 2's sound-control popover (AudioControls opens/closes it; it never opens on its own)
  return createPortal(
    <div className="audio-panel--v2 sp-sheet" role="group" aria-label="Sound settings">
      {rows}
      {onToggleSfx ? (
        <Row tone="#FF6B3D" label="GAME SFX" sub="THIS MATCH">
          <OnOff on={!sfxMuted} onClick={onToggleSfx} label="Game sound effects" />
        </Row>
      ) : null}
      <button type="button" className="sp-close" onClick={onClose} aria-label="Close settings">CLOSE</button>
    </div>,
    document.body,
  );
}