// SettingsPanel.jsx — the v2 SETTINGS (claude/mockups/v2/RoomSettings.dc.html). TRIMMED (Andy oct9: "honestly too much
// useless settings") to what matters — three rows, each a label + a one-line "what it does" + one control, then the
// RANK PLATE picker and SAVE PROGRESS:
//
//   SOUND            MUTE + a 10-step bar = the master volume (0 = sound off)     audio/audioCore + gameSounds + clack
//   MUSIC            ON / OFF (App owns the music; it ducks it per screen)        onToggleMusic
//   REDUCE MOTION    ON / OFF, live (<html data-reduce-motion>) — accessibility    lib/reduceMotion
//
// NUMBER STYLE and KEYBOARD SOUNDS have no UI any more; their stored values (format.js taw.numStyle, clack taw.clack)
// still apply exactly as saved. MUTE silences the keyboard clack too, so a save that had it on is never stuck with it.
//
// It lives where the app's settings already live — the ONE sound/settings control (AudioControls), which renders this
// panel in its popover under SEASON2 (CLAUDE.md NO ORPHAN FIXED UI: no new fixed element). Every control is a real
// ≥ 44 px button; nothing animates but the press.
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { getMasterVolume, setMasterVolume, ensureCtx } from '../audio/audioCore';
import { enableEventSounds, disableEventSounds, isEventSoundsEnabled } from '../audio/gameSounds';
import { disableClack } from '../progress/clack';
import { setReduceMotion } from '../lib/reduceMotion';
import { useReduceMotion } from '../lib/useReduceMotion';
import { formatNum } from '../format';
import { exportSave, importSave } from '../save/saveBackup';
import { V3 } from '../progress/season';
import { getPlatePick, setPlatePick } from '../progress/platePick';
import './kit/tokens.css';
import './SettingsPanel.css';

const STEPS = 10;

function Row({ tone, label, sub, wide = false, children }) {
  return (
    <div className={`sp-row${wide ? ' sp-row--wide' : ''}`} style={{ '--sp-c': tone }}>
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
  // the level MUTE returns to (the last one heard; a fresh save un-mutes to the stored master volume)
  const [back, setBack] = useState(() => Math.max(1, Math.round(getMasterVolume() * STEPS)) || STEPS);
  const reduceOn = useReduceMotion();

  const setLevel = (n) => {
    ensureCtx(); // a user gesture: safe to warm the context so the change is audible
    if (n <= 0) {
      disableEventSounds();
      disableClack(); // MUTE = quiet: the (no-longer-shown) keyboard clack goes too
    } else {
      if (!isEventSoundsEnabled()) enableEventSounds();
      setMasterVolume(n / STEPS);
      setBack(n);
    }
    setVol(n);
    if (onChange) onChange();
  };

  const rows = (
    <div className="sp" role="group" aria-label="Settings">
      <Row tone="#FFE94A" label="SOUND" sub="BOOMS, DINGS, BUZZERS" wide>
        <button
          type="button"
          role="switch"
          aria-checked={vol === 0}
          aria-label="Mute sound"
          className={`sp-mute${vol === 0 ? ' is-on' : ''}`}
          onClick={() => setLevel(vol === 0 ? back : 0)}
        >
          {vol === 0 ? 'MUTED' : 'MUTE'}
        </button>
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
        <span className="sp-val">{vol === 0 ? 'OFF' : formatNum(vol * 10)}</span>
      </Row>
      <Row tone="#B04BFF" label="MUSIC" sub="LOBBY + MATCH TRACKS">
        <OnOff on={!musicMuted} onClick={onToggleMusic} label="Music" />
      </Row>
      <Row tone="#2EFFE0" label="REDUCE MOTION" sub="ON = CALMER">
        <OnOff on={reduceOn} onClick={() => setReduceMotion(!reduceOn)} label="Reduce motion" />
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