// SettingsPanel.jsx — SETTINGS. FRIENDLY PASS (Andy oct28: "make settings a bit more user friendly (tf why is it at the
// corner....) too ai tell"): a centred sheet over a dimmed menu, in FOUR labelled groups instead of a wall of rows —
//
//   SOUND        VOLUME (MUTE + a 10-step bar = the master volume, 0 = sound off) · MUSIC · GAME SFX (in a match)
//   GAMEPLAY     REDUCE MOTION (<html data-reduce-motion>, live) · BEAT SYNC (the menu bouncing to the music)
//   SAVE CODE    the short code + COPY, a paste box + RESTORE, UNDO LAST RESTORE (see SaveRow)
//   DANGER ZONE  RESET ACCOUNT, two steps — its own red card, apart from everything else
//
// No one-line "what it does" taglines (every label says it). CREDITS sits in the title bar beside CLOSE. Chunky house
// switches (a knob that slides — transform only), thick coloured outlines, hard black offset shadows. NUMBER STYLE and
// KEYBOARD SOUNDS have no UI; their stored values still apply. MUTE silences the keyboard clack too.
//
// It opens from the ONE settings control (AudioControls: the desktop menu's named SETTINGS button in the left rail, the
// phone rail's cog, the in-game cog) — no new fixed element of its own (CLAUDE.md NO ORPHAN FIXED UI).
import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { getMasterVolume, setMasterVolume, ensureCtx } from '../audio/audioCore';
import { enableEventSounds, disableEventSounds, isEventSoundsEnabled } from '../audio/gameSounds';
import { disableClack } from '../progress/clack';
import { setReduceMotion } from '../lib/reduceMotion';
import { useReduceMotion } from '../lib/useReduceMotion';
import { formatNum } from '../format';
import { exportSave } from '../save/saveBackup';
import { exportSaveCode, parseAnySave, readPreRestore, applySave, issueShortCode, fetchShortSave, normalizeShort, formatShort, rememberShortCode, copyText } from '../save/saveCode';
import { LEADERBOARD_ENABLED, getMyProfile, peekSecret, rpc } from '../leaderboard/client';
import { progressScoreFromKeys, localScore } from '../save/cloudSave';
import { resolveXpState } from '../progress/xp';
import './kit/tokens.css';
import './SettingsPanel.css';
import { beatSyncOn, setBeatSync } from '../lib/beatSync';

const STEPS = 10;

function Group({ title, tone, edge, className = '', children, ...rest }) {
  return (
    <section className={`sp-group${className ? ` ${className}` : ''}`} style={{ '--g': tone, '--g-edge': edge }} aria-label={title} {...rest}>
      <h3 className="sp-group-title">{title}</h3>
      {children}
    </section>
  );
}

function Row({ label, className = '', children }) {
  return (
    <div className={`sp-row${className ? ` ${className}` : ''}`}>
      <span className="sp-label">{label}</span>
      <div className="sp-ctl">{children}</div>
    </div>
  );
}

function OnOff({ on, onClick, label }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className={`sp-switch${on ? ' is-on' : ''}`} onClick={onClick}>
      <span className="sp-switch-k" aria-hidden="true">{on ? 'ON' : 'OFF'}</span>
      <span className="sp-switch-box" aria-hidden="true" />
    </button>
  );
}

// SHORT CODES + THE ACCOUNT (daan oct27): COPY gives a 10-character code (save/saveCode issueShortCode — the save lives on
// the server, 071) and every code carries the board account, so loading it on a wiped / new device brings the NAME back
// with the progress. Offline / 071 not run → the long code, exactly as before. The one-line tagline is gone (Andy).
// SAVE PROGRESS (Andy oct8: "you need a button for people to save their progress — remember the restore code"): the
// save CODE (save/saveCode — every progress key incl. season 2's taw.s2.*) to COPY, and a box to paste one back.
// SAVE CODE FIX (Andy oct22 "fix save code - its buggy (people complaining)"):
//   * the code is the compact TAW2 code (gzip + a checksum, ~3× shorter) and the paste box has no length cap (it cut
//     every code past 200,000 characters — every heavy save — and then called it "corrupted");
//   * a pasted code is READ first and the player confirms what it holds against this device ("R7 · LV 44 vs R2 · LV 5");
//     a code BEHIND this device says so and needs LOAD ANYWAY — a paste can no longer quietly lower a save;
//   * the save it replaced is kept (taw.preRestore): UNDO LAST RESTORE puts it back, through the same confirm;
//   * COPY falls back to a hidden-textarea copy where the Clipboard API is missing or refused (in-app browsers, some
//     Chromebook policies), and the code box selects ALL of itself on a tap.
const UNDO_FOR_MS = 7 * 86400000;
const S2_DUP = ['taw.xp', 'taw.xpv10', 'taw.rebirths'];
/** A save's headline (★ · R · LV) and its progress score — the same score the cloud restore compares. */
function headline(get) {
  const keys = {};
  for (const k of ['taw.xp', 'taw.xpv10', 'taw.econ', 'taw.rebirths', 'taw.letters', 'taw.s2.stars']) {
    const v = get(k);
    if (v != null) keys[k] = v;
  }
  let lv = 1;
  try { lv = resolveXpState((k) => keys[k] ?? null).level || 1; } catch { lv = 1; }
  const rb = Math.max(0, Math.floor(Number(keys['taw.rebirths']) || 0));
  const st = Math.max(0, Math.floor(Number(keys['taw.s2.stars']) || 0));
  return { text: `${st > 0 ? `★${formatNum(st)} · ` : ''}R${formatNum(rb)} · LV ${formatNum(Math.floor(lv))}`, keys };
}
function codeHeadline(keys, acct = null) {
  // a season-2 code carries the mapped keys twice (taw.xp AND taw.s2.xp); fall back to the s2 copy if one is missing
  const get = (k) => (keys[k] != null ? keys[k] : S2_DUP.includes(k) ? keys[`taw.s2.${k.slice(4)}`] ?? null : null);
  const h = headline(get);
  // a code from ANOTHER board account names it (loading it switches this device to that name — daan oct27)
  const me = getMyProfile();
  const other = acct && acct.profile && (!me || me.id !== acct.profile.id) ? `${String(acct.profile.username).toUpperCase()} · ` : '';
  return { ...h, text: `${other}${h.text}`, score: progressScoreFromKeys(h.keys, { asConverted: true }) };
}
function deviceHeadline() {
  const h = headline((k) => { try { return localStorage.getItem(k); } catch { return null; } });
  return { ...h, score: localScore(undefined, { asConverted: true }) };
}
function recentUndo() {
  const p = readPreRestore();
  return p && p.src === 'code' && Date.now() - p.at < UNDO_FOR_MS ? p : null;
}
const selectAll = (e) => {
  try { e.target.select(); e.target.setSelectionRange(0, e.target.value.length); } catch { /* */ }
};
const loud = (s) => String(s || 'THAT CODE DID NOT WORK').toUpperCase();

function SaveRow() {
  const [code, setCode] = useState(''); // the LONG code on screen (the fallback)
  const [short, setShort] = useState(null); // { code } once the server holds this save (071) — the code COPY gives
  const [draft, setDraft] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState(null); // { parsed, mine, here, lower, undo } while the player confirms a load
  const [undo] = useState(recentUndo);
  // SHORT CODE (daan oct27): the save goes up the moment SETTINGS opens, so COPY can put the 10-character code on the
  // clipboard inside the tap (Safari drops the permission after an await). Offline / no name / 071 not run → the long code.
  const refresh = useCallback(() => {
    const me = LEADERBOARD_ENABLED ? getMyProfile() : null;
    const secret = me ? peekSecret() : null;
    if (!secret) return Promise.resolve(null);
    // save-safety (oct28): a code that holds a save AHEAD of this device is kept, never overwritten (saveCode.js)
    return issueShortCode({ rpc, secret, profileId: me.id }).then((r) => {
      if (r.ok) setShort({ code: r.code });
      if (r.ok && r.kept) setMsg(r.held ? `YOUR CODE HOLDS A HIGHER SAVE (${codeHeadline(r.held.keys).text}) — RESTORE IT BELOW` : 'YOUR CODE HOLDS A HIGHER SAVE — RESTORE IT BELOW');
      return r;
    });
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);
  const copy = () => {
    if (short) {
      const shown = formatShort(short.code);
      setCode('');
      copyText(shown).then((ok) => setMsg(ok ? 'COPIED' : 'COPY THE CODE ABOVE'), () => setMsg('COPY THE CODE ABOVE'));
      refresh(); // the code stays the same; what it holds becomes this exact moment's save
      return;
    }
    let c = '';
    try { c = exportSaveCode(); } catch { c = exportSave(undefined, { account: true }); }
    setCode(c);
    copyText(c).then(
      (ok) => setMsg(ok ? 'COPIED — PASTE THE WHOLE CODE ON YOUR OTHER DEVICE' : 'TAP THE CODE BELOW TO SELECT IT ALL, THEN COPY'),
      () => setMsg('TAP THE CODE BELOW TO SELECT IT ALL, THEN COPY'),
    );
  };
  const confirmParsed = (r, isUndo) => {
    if (!r.ok) {
      setMsg(loud(isUndo ? 'THE OLD SAVE CAN NOT BE PUT BACK' : r.error));
      return;
    }
    const mine = codeHeadline(r.keys, r.acct);
    const here = deviceHeadline();
    setAsk({ parsed: r, mine, here, lower: mine.score < here.score, undo: !!isUndo });
    setMsg('');
  };
  const offer = (text, isUndo) => {
    if (!isUndo && normalizeShort(text)) {
      setBusy(true);
      setMsg('LOADING…');
      fetchShortSave(text, { rpc }).then((r) => {
        setBusy(false);
        confirmParsed(r.ok ? { ...r, short: normalizeShort(text) } : r, false);
      });
      return;
    }
    confirmParsed(parseAnySave(text), isUndo);
  };
  const check = (e) => {
    e.preventDefault();
    if (!busy) offer(draft, false);
  };
  const load = () => {
    if (!ask) return;
    // UNDO puts back EXACTLY the replaced save (and its bare device secret when it had no claimed account)
    applySave(ask.parsed, undefined, ask.undo ? { source: 'code', exact: true, secret: undo && undo.secret } : { source: 'code' });
    // this device now knows its account's code: its next SETTINGS open can't overwrite a higher save the code holds
    if (ask.parsed.short && ask.parsed.acct) rememberShortCode(ask.parsed.acct.profile.id, ask.parsed.short);
    setAsk(null);
    setMsg(ask.undo ? 'PUT BACK — RELOADING…' : 'RESTORED — RELOADING…');
    setTimeout(() => {
      try { window.location.reload(); } catch { /* */ }
    }, 700);
  };
  return (
    <Group title="SAVE CODE" tone="#FF4FA3" edge="#b0206a" className="sp-save">
      {ask ? (
        <div className="sp-load-confirm" role="alertdialog" aria-label="Confirm restore" data-testid="sp-load-confirm">
          <p className="sp-msg" data-testid="sp-load-compare">{ask.undo ? 'PUT BACK' : 'THIS CODE'}: {ask.mine.text} · THIS DEVICE: {ask.here.text}</p>
          {ask.lower ? <p className="sp-msg sp-reset-warn">THAT IS BEHIND THIS DEVICE — LOADING IT LOWERS YOUR PROGRESS</p> : null}
          <div className="sp-restore">
            <button type="button" className={`sp-btn${ask.lower ? ' sp-btn--danger' : ''}`} onClick={load} data-testid="sp-load-yes">{ask.lower ? 'LOAD ANYWAY' : 'LOAD IT'}</button>
            <button type="button" className="sp-btn sp-btn--ghost" onClick={() => setAsk(null)}>CANCEL</button>
          </div>
        </div>
      ) : (
        <>
          <div className="sp-restore">
            {short ? <span className="sp-short" data-testid="sp-save-short">{formatShort(short.code)}</span> : null}
            <button type="button" className={`sp-btn${short ? '' : ' sp-btn--wide'}`} onClick={copy} data-testid="sp-save-copy">{short ? 'COPY' : 'COPY SAVE CODE'}</button>
          </div>
          {code ? <textarea className="sp-code" readOnly value={code} rows={2} aria-label="Your save code" data-testid="sp-save-code" onFocus={selectAll} onClick={selectAll} /> : null}
          <form className="sp-restore" onSubmit={check}>
            <input className="sp-input" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="PASTE A CODE" aria-label="Paste a save code" autoComplete="off" autoCorrect="off" autoCapitalize="characters" spellCheck="false" />
            <button type="submit" className="sp-btn sp-btn--ghost" disabled={!draft.trim() || busy}>RESTORE</button>
          </form>
          {undo && !code ? (
            <button type="button" className="sp-btn sp-btn--ghost sp-btn--wide" onClick={() => offer(undo.code, true)} data-testid="sp-undo">UNDO LAST RESTORE</button>
          ) : null}
        </>
      )}
      {msg ? <p className="sp-msg" role="status" aria-live="polite">{msg}</p> : null}
    </Group>
  );
}

// RESET ACCOUNT (Andy oct11 "settings needs a reset function (for account)"): wipes every progress key on this device
// AND (with a claimed name) the board row + the cloud save — progress/resetAll.js, the same path the season-1 Stats
// panel used. Two steps so it is never a mis-tap: the button opens a confirm that names what goes and what stays.
function ResetRow() {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const go = () => {
    if (busy) return;
    setBusy(true);
    setMsg('');
    const fail = () => { setBusy(false); setMsg('NO CONNECTION — NOTHING WAS RESET'); };
    import('../progress/resetAll').then((m) => m.resetAllProgress()).then((r) => { if (r && r.aborted) fail(); }, fail);
  };
  return (
    <Group title="DANGER ZONE" tone="#FF5C5C" edge="#a82424" className="sp-reset" data-testid="sp-reset">
      {confirming ? (
        <div className="sp-reset-confirm" role="alertdialog" aria-label="Confirm account reset">
          <p className="sp-msg sp-reset-warn">THIS WIPES YOUR LEVEL, REBIRTHS, GEARS, GEMS AND STATS — ON THIS DEVICE AND THE LEADERBOARD. YOUR NAME STAYS. IT CANNOT BE UNDONE.</p>
          <div className="sp-restore">
            <button type="button" className="sp-btn sp-btn--danger" onClick={go} disabled={busy} data-testid="sp-reset-yes">{busy ? 'RESETTING…' : 'YES, RESET'}</button>
            <button type="button" className="sp-btn sp-btn--ghost" onClick={() => setConfirming(false)} disabled={busy}>CANCEL</button>
          </div>
        </div>
      ) : (
        <button type="button" className="sp-btn sp-btn--danger sp-btn--wide" onClick={() => setConfirming(true)} data-testid="sp-reset-open">RESET ACCOUNT</button>
      )}
      {msg ? <p className="sp-msg" role="status" aria-live="polite">{msg}</p> : null}
    </Group>
  );
}

export default function SettingsPanel({ musicMuted = false, onToggleMusic, sheet = false, sfxMuted = false, onToggleSfx = null, onClose, onChange, onCredits = null }) {
  const [vol, setVol] = useState(() => (isEventSoundsEnabled() ? Math.round(getMasterVolume() * STEPS) : 0));
  // the level MUTE returns to (the last one heard; a fresh save un-mutes to the stored master volume)
  const [back, setBack] = useState(() => Math.max(1, Math.round(getMasterVolume() * STEPS)) || STEPS);
  const reduceOn = useReduceMotion();
  const [beatOn, setBeatOn] = useState(() => beatSyncOn());
  // the sheet is a modal: Esc closes it (the dim behind it does too)
  useEffect(() => {
    if (!sheet || !onClose) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sheet, onClose]);

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
      {/* two columns on desktop (the switches | the save code + the danger zone), one stack on a phone — same order */}
      <div className="sp-col">
      <Group title="SOUND" tone="#FFE94A" edge="#b8a300" className="sp-sound">
        <Row label="VOLUME" className="sp-row--vol">
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
                style={{ '--sp-h': `${34 + i * 7.3}%` }}
                onClick={() => setLevel(vol === i + 1 ? 0 : i + 1)}
              />
            ))}
          </div>
          {/* PHONES: ten bars can't each be a 44 px target in 300 px, so the phone steps the level with − / + (each a full
              44 px button) around a read-only meter; the bars stay the desktop's control */}
          <button type="button" className="sp-step" aria-label="Volume down" disabled={vol === 0} onClick={() => setLevel(Math.max(0, vol - 1))}>−</button>
          <span className="sp-meter" aria-hidden="true">
            {Array.from({ length: STEPS }, (_, i) => <span key={i} className={`sp-seg${i < vol ? ' is-on' : ''}`} style={{ '--sp-h': `${34 + i * 7.3}%` }} />)}
          </span>
          <button type="button" className="sp-step" aria-label="Volume up" disabled={vol === STEPS} onClick={() => setLevel(Math.min(STEPS, vol + 1))}>+</button>
          <span className="sp-val">{vol === 0 ? 'OFF' : formatNum(vol * 10)}</span>
        </Row>
        <Row label="MUSIC">
          <OnOff on={!musicMuted} onClick={onToggleMusic} label="Music" />
        </Row>
        {onToggleSfx ? (
          <Row label="GAME SFX">
            <OnOff on={!sfxMuted} onClick={onToggleSfx} label="Game sound effects" />
          </Row>
        ) : null}
      </Group>
      <Group title="GAMEPLAY" tone="#2EFFE0" edge="#129e8a" className="sp-play">
        <Row label="REDUCE MOTION">
          <OnOff on={reduceOn} onClick={() => setReduceMotion(!reduceOn)} label="Reduce motion" />
        </Row>
        {/* Andy oct14: the music bounce (cards, title, tiles) is its own switch, separate from REDUCE MOTION */}
        <Row label="BEAT SYNC">
          <OnOff on={beatOn} onClick={() => { setBeatSync(!beatOn); setBeatOn(!beatOn); }} label="Beat sync" />
        </Row>
      </Group>
      </div>
      <div className="sp-col">
        <SaveRow />
        <ResetRow />
      </div>
    </div>
  );
  if (!sheet || typeof document === 'undefined') return rows;
  // the SHEET: centred over a dimmed screen (a tap on the dim or Esc closes it). AudioControls opens/closes it.
  return createPortal(
    <div className="sp-scrim" onClick={(e) => { if (e.target === e.currentTarget && onClose) onClose(); }}>
      <div className="audio-panel--v2 sp-sheet" role="dialog" aria-modal="true" aria-label="Settings">
        <div className="sp-head">
          <h2 className="sp-title">SETTINGS</h2>
          {/* CREDITS (Andy oct24 "put credits in settings"): in the title bar, beside CLOSE — no row of its own */}
          {onCredits ? <button type="button" className="sp-credits" onClick={() => { if (onClose) onClose(); onCredits(); }}>CREDITS</button> : null}
          <button type="button" className="sp-close" onClick={onClose} aria-label="Close settings">CLOSE</button>
        </div>
        {rows}
      </div>
    </div>,
    document.body,
  );
}
