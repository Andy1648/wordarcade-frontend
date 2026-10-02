// LeaderboardScreen.jsx — STEP 24, the global board (Andy A13: no Google sign-in, username only,
// block bad names).
//
// One overlay, two jobs: CLAIM a name (if this browser has none) and SHOW the board: rank, username,
// level + rebirth stars, lifetime words, WINS/WORD. The claim form gives the client filter's verdict
// instantly and asks the server (lb_name_status) for "taken" after a 350 ms pause; the server is
// what actually refuses a name (DB trigger + lb_claim), so a bypassed client can't put one on the
// board. Moderation beyond that is Andy editing rows in the Supabase Table Editor.
import { useEffect, useRef, useState } from 'react';
import {
  LEADERBOARD_ENABLED,
  claimName,
  fetchBoard,
  getMyProfile,
  myStats,
  nameStatus,
  submitStats,
  setLastRank,
  setRankNews,
  boardCaps,
  getSecret,
  adoptRecoveryCode,
} from '../leaderboard/client.js';
import { formatRecoveryCode } from '../save/cloudSave.js';
import { nameVerdict } from '../leaderboard/nameFilter.js';
import './LeaderboardScreen.css';

const VERDICT_COPY = {
  shape: '3–16 LETTERS, NUMBERS OR _',
  blocked: 'NOT THAT ONE. PICK ANOTHER NAME.',
  taken: 'TAKEN. TRY ANOTHER.',
  ok: 'NICE. THAT ONE’S FREE.',
  checking: 'CHECKING…',
};
const ERROR_COPY = {
  username_taken: 'SOMEONE JUST TOOK THAT ONE.',
  username_blocked: 'NOT THAT ONE. PICK ANOTHER NAME.',
  username_shape: '3–16 LETTERS, NUMBERS OR _',
  unavailable: 'THE BOARD IS OFFLINE RIGHT NOW.',
  rate_limited: 'TOO MANY NEW NAMES FROM HERE. TRY LATER.',
  rename_cooldown: 'ONE NAME CHANGE PER DAY. TRY TOMORROW.',
};

// STEP 47: a board under this many rows is padded with invitations, never fake players.
export const MIN_ROWS = 10;

// STEP 51 (Andy oct2): no rebirth stars — the REBIRTH TIER is the name's colour and frame.
// R0 plain white · R1-2 cyan · R3-4 yellow · R5-9 orange · R10-19 pink · R20+ purple, framed.
export const REBIRTH_TIERS = [
  { min: 0, name: 'R0', colour: '#ffffff', frame: false },
  { min: 1, name: 'REBORN', colour: '#2EFFE0', frame: false },
  { min: 3, name: 'TWICE-BORN', colour: '#FFE94A', frame: false },
  { min: 5, name: 'PHOENIX', colour: '#FF6B3D', frame: true },
  { min: 10, name: 'ETERNAL', colour: '#FF4FA3', frame: true },
  { min: 20, name: 'ASCENDED', colour: '#C58BFF', frame: true },
];
export function rebirthTier(n) {
  const r = Math.max(0, Math.floor(Number(n) || 0));
  let t = REBIRTH_TIERS[0];
  for (const x of REBIRTH_TIERS) if (r >= x.min) t = x;
  return t;
}
function NameTag({ name, rebirths }) {
  const t = rebirthTier(rebirths);
  return (
    <span
      className={`lb-name${t.frame ? ' is-framed' : ''}`}
      style={{ color: t.colour, '--rb': t.colour }}
      title={rebirths > 0 ? `${rebirths} rebirth${rebirths === 1 ? '' : 's'} — ${t.name}` : undefined}
    >
      {name}
    </span>
  );
}

const fmt = (n) => Number(n || 0).toLocaleString('en-US');
const fmtRate = (n) => {
  const v = Number(n || 0);
  return v >= 1000 ? `${(v / 1000).toFixed(1)}K` : v.toFixed(1);
};


function Row({ row, mine, flash }) {
  const top = row.rank <= 3 ? ` is-top${row.rank}` : '';
  return (
    <li className={`lb-row${top}${mine ? ' is-me' : ''}${mine && flash ? ' is-flash' : ''}`} data-rank={row.rank}>
      <span className="lb-rank">{row.rank}</span>
      <span className="lb-who">
        <span className="lb-name-line">
          <NameTag name={row.username} rebirths={row.rebirths} />
          {mine && <span className="lb-you-badge">YOU</span>}
        </span>
        {/* words are SECONDARY now (Andy oct2, later: the board ranks by LEVEL) */}
        <span className="lb-lv lb-words-sub">{fmt(row.lifetime_words)} WORDS</span>
      </span>
      {/* LV is the headline — the board ranks by rebirths, then LEVEL (rebirth = the name's colour). */}
      <span className="lb-num lb-level">LV {fmt(row.level)}</span>
      <span className="lb-num lb-rate">{Number(row.lifetime_words) > 0 ? fmtRate(row.wins_per_word) : '—'}</span>
    </li>
  );
}

export default function LeaderboardScreen({ onBack }) {
  const [board, setBoard] = useState({ rows: [], me: null });
  const [loading, setLoading] = useState(LEADERBOARD_ENABLED);
  const [loadError, setLoadError] = useState(false);
  const [profile, setProfile] = useState(() => getMyProfile());
  const [editing, setEditing] = useState(() => !getMyProfile());
  const [draft, setDraft] = useState('');
  const [verdict, setVerdict] = useState(null);
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState(null);
  const [flash, setFlash] = useState(false);
  const [caps, setCaps] = useState({ letters: false, cjk: false, cloud: false });
  // STEP 52: the recovery code is shown ONCE, right after a claim (and on demand after that).
  const [showCode, setShowCode] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoreDraft, setRestoreDraft] = useState('');
  const [restoreMsg, setRestoreMsg] = useState(null);
  const overlayRef = useRef(null);
  useEffect(() => {
    let live = true;
    boardCaps().then((c) => { if (live) setCaps(c); });
    return () => { live = false; };
  }, []);

  async function load() {
    if (!LEADERBOARD_ENABLED) return;
    setLoading(true);
    try {
      await submitStats();
      const b = await fetchBoard();
      setBoard(b);
      setLoadError(false);
      // Reading the board is reading the news: clear the trophy badge and remember this rank as
      // the baseline the next rank-up is measured from.
      setRankNews(false);
      const mine = getMyProfile();
      const meNow = mine && (b.rows.find((r) => r.id === mine.id) || b.me);
      if (meNow) setLastRank(Number(meNow.rank));
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    if (overlayRef.current) overlayRef.current.focus();
    const onKey = (e) => { if (e.key === 'Escape') onBack && onBack(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Instant client verdict; the server's "taken" after a short pause.
  useEffect(() => {
    if (!draft) { setVerdict(null); return undefined; }
    const local = nameVerdict(draft, { cjk: caps.cjk });
    if (local !== 'ok') { setVerdict(local); return undefined; }
    if (profile && draft.toLowerCase() === profile.username.toLowerCase()) { setVerdict('ok'); return undefined; }
    setVerdict('checking');
    let live = true;
    const t = setTimeout(() => {
      nameStatus(draft).then((v) => { if (live) setVerdict(v); }).catch(() => { if (live) setVerdict('ok'); });
    }, 350);
    return () => { live = false; clearTimeout(t); };
  }, [draft, profile, caps.cjk]);

  async function claim(e) {
    e.preventDefault();
    if (claiming || verdict !== 'ok') return;
    setClaiming(true);
    setClaimError(null);
    try {
      const row = await claimName(draft);
      setProfile({ id: row.id, username: row.username });
      setEditing(false);
      setDraft('');
      setFlash(true);
      setTimeout(() => setFlash(false), 900);
      if (caps.cloud) setShowCode(true);
      setBoard(await fetchBoard());
    } catch (err) {
      setClaimError(ERROR_COPY[err.code] || 'COULDN’T SAVE THAT. TRY AGAIN.');
      if (err.code === 'username_taken') setVerdict('taken');
      if (err.code === 'username_blocked') setVerdict('blocked');
    } finally {
      setClaiming(false);
    }
  }

  const stats = myStats();
  const meRow = profile && (board.rows.find((r) => r.id === profile.id) || board.me);

  return (
    <div className="lb-overlay" role="dialog" aria-modal="true" aria-label="Leaderboard" tabIndex={-1} ref={overlayRef}>
      <div className="lb-panel">
        <div className="lb-header">
          <h2 className="lb-title">LEADERBOARD</h2>
          <button type="button" className="lb-close" onClick={onBack} aria-label="Back to menu">✕</button>
        </div>

        <div className="lb-body">
          {!LEADERBOARD_ENABLED && <p className="lb-note">THE BOARD IS OFFLINE RIGHT NOW.</p>}

          {LEADERBOARD_ENABLED && (editing ? (
            <form className="lb-claim" onSubmit={claim} noValidate>
              <label className="lb-claim-label" htmlFor="lb-name-input">
                {profile ? 'NEW NAME' : 'CLAIM YOUR NAME'}
              </label>
              <div className="lb-claim-row">
                <input
                  id="lb-name-input"
                  className="lb-claim-input"
                  value={draft}
                  onChange={(e) => { setDraft(e.target.value.replace(/\s/g, '_').slice(0, 16)); setClaimError(null); }}
                  lang={caps.cjk ? 'zh' : undefined}
                  maxLength={16}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck="false"
                  enterKeyHint="done"
                  placeholder="YOUR_NAME"
                  aria-describedby="lb-claim-verdict"
                />
                <button type="submit" className="lb-claim-btn" disabled={claiming || verdict !== 'ok'}>
                  {claiming ? '…' : 'CLAIM'}
                </button>
              </div>
              <p id="lb-claim-verdict" className={`lb-verdict is-${claimError ? 'blocked' : verdict || 'idle'}`} aria-live="polite">
                {claimError || (verdict === 'shape' && caps.cjk ? '3–16 LETTERS, NUMBERS OR _ · 中文 2–12 字' : verdict ? VERDICT_COPY[verdict] : 'NO SIGN-IN. JUST A NAME.')}
              </p>
              {profile && (
                <button type="button" className="lb-link-btn" onClick={() => { setEditing(false); setDraft(''); setClaimError(null); }}>
                  KEEP {profile.username}
                </button>
              )}
            </form>
          ) : (
            <div className="lb-you">
              <span className="lb-you-name">{profile.username}</span>
              {caps.cloud && (
                <button type="button" className="lb-link-btn" onClick={() => setShowCode((v) => !v)}>
                  {showCode ? 'HIDE CODE' : 'RECOVERY CODE'}
                </button>
              )}
              <span className="lb-you-rank">{meRow ? `#${meRow.rank}` : '—'}</span>
              <button type="button" className="lb-link-btn" onClick={() => setEditing(true)}>CHANGE NAME</button>
            </div>
          ))}

          {/* STEP 52 — CLOUD SAVE. The code restores this progress on any device / after a wipe. */}
          {LEADERBOARD_ENABLED && caps.cloud && profile && showCode && (
            <div className="lb-code">
              <div className="lb-code-title">YOUR RECOVERY CODE</div>
              <code className="lb-code-value">{formatRecoveryCode(getSecret())}</code>
              <div className="lb-code-note">YOUR PROGRESS IS BACKED UP. ON A NEW PHONE OR AFTER SAFARI WIPES IT, ENTER THIS CODE HERE TO GET IT BACK. KEEP IT PRIVATE.</div>
              <button
                type="button"
                className="lb-claim-btn"
                onClick={() => {
                  try {
                    navigator.clipboard.writeText(formatRecoveryCode(getSecret()));
                  } catch {
                    /* clipboard blocked */
                  }
                }}
              >
                COPY
              </button>
            </div>
          )}
          {LEADERBOARD_ENABLED && caps.cloud && !profile && (
            restoreOpen ? (
              <form
                className="lb-claim lb-restore"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setRestoreMsg('RESTORING…');
                  const r = await adoptRecoveryCode(restoreDraft);
                  if (!r.ok) {
                    setRestoreMsg(r.error === 'bad_code' ? 'THAT CODE IS 12 GROUPS OF 4.' : 'NO SAVE FOR THAT CODE.');
                    return;
                  }
                  setRestoreMsg(r.restored ? 'RESTORED — RELOADING…' : `WELCOME BACK, ${r.username || ''}`);
                  setTimeout(() => window.location.reload(), 900);
                }}
              >
                <label className="lb-claim-label" htmlFor="lb-restore-input">RECOVERY CODE</label>
                <div className="lb-claim-row">
                  <input
                    id="lb-restore-input"
                    className="lb-claim-input"
                    value={restoreDraft}
                    onChange={(e) => setRestoreDraft(e.target.value.slice(0, 80))}
                    autoComplete="off"
                    spellCheck="false"
                    placeholder="XXXX-XXXX-…"
                  />
                  <button type="submit" className="lb-claim-btn">RESTORE</button>
                </div>
                {restoreMsg && <p className="lb-verdict" aria-live="polite">{restoreMsg}</p>}
              </form>
            ) : (
              <button type="button" className="lb-link-btn lb-restore-open" onClick={() => setRestoreOpen(true)}>
                HAVE A RECOVERY CODE?
              </button>
            )
          )}

          {LEADERBOARD_ENABLED && (
            <>
              <div className="lb-cols" aria-hidden="true">
                <span>#</span><span>PLAYER</span><span className="lb-num">LEVEL</span><span className="lb-num">WINS/WORD</span>
              </div>
              {loading && board.rows.length === 0 && <p className="lb-note">LOADING THE BOARD…</p>}
              {loadError && <p className="lb-note">COULDN’T LOAD THE BOARD. <button type="button" className="lb-link-btn" onClick={load}>RETRY</button></p>}
              <ol className="lb-list">
                {board.rows.map((r) => <Row key={r.id} row={r} mine={!!profile && r.id === profile.id} flash={flash} />)}
                {/* NEVER A DEAD BOARD: open places are invitations, numbered, never invented people.
                    For an unclaimed viewer the first one is a button into the claim field. */}
                {!loading && !loadError && Array.from({ length: Math.max(0, MIN_ROWS - board.rows.length) }, (_, i) => {
                  const n = board.rows.length + i + 1;
                  const first = !profile; // every open place is a way in for an unclaimed viewer
                  return (
                    <li key={`slot-${n}`} className={`lb-slot${first && i === 0 ? ' is-open' : ''}`} data-rank={n}>
                      <span className="lb-rank">{n}</span>
                      {first ? (
                        <button type="button" className="lb-slot-btn" onClick={() => { setEditing(true); const el = document.getElementById('lb-name-input'); if (el) el.focus(); }}>
                          YOUR NAME HERE?
                        </button>
                      ) : (
                        <span className="lb-slot-text">YOUR NAME HERE?</span>
                      )}
                    </li>
                  );
                })}
              </ol>
              {board.me && (
                <ol className="lb-list lb-list--me" aria-label="Your rank">
                  <Row row={board.me} mine flash={flash} />
                </ol>
              )}
              {!profile && (
                <p className="lb-note lb-preview">
                  YOU'D SHOW AS LV {fmt(stats.level)} · {fmt(stats.lifetimeWords)} WORDS
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
