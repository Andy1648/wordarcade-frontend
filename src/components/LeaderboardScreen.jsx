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
} from '../leaderboard/client.js';
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

// Rebirth stars: one ★ per rebirth up to five, then ★×N so a 40-rebirth row stays one line.
export function rebirthStars(n) {
  const r = Math.max(0, Math.floor(Number(n) || 0));
  if (r === 0) return '';
  return r <= 5 ? '★'.repeat(r) : `★×${r}`;
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
        <span className="lb-name">{row.username}{mine ? ' (YOU)' : ''}</span>
        <span className="lb-lv">
          LV {fmt(row.level)}
          {row.rebirths > 0 && <span className="lb-stars" aria-label={`${row.rebirths} rebirths`}> {rebirthStars(row.rebirths)}</span>}
        </span>
      </span>
      <span className="lb-num lb-words">{fmt(row.lifetime_words)}</span>
      <span className="lb-num lb-rate">{fmtRate(row.wins_per_word)}</span>
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
  const overlayRef = useRef(null);

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
    const local = nameVerdict(draft);
    if (local !== 'ok') { setVerdict(local); return undefined; }
    if (profile && draft.toLowerCase() === profile.username.toLowerCase()) { setVerdict('ok'); return undefined; }
    setVerdict('checking');
    let live = true;
    const t = setTimeout(() => {
      nameStatus(draft).then((v) => { if (live) setVerdict(v); }).catch(() => { if (live) setVerdict('ok'); });
    }, 350);
    return () => { live = false; clearTimeout(t); };
  }, [draft, profile]);

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
                {claimError || (verdict ? VERDICT_COPY[verdict] : 'NO SIGN-IN. JUST A NAME.')}
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
              <span className="lb-you-rank">{meRow ? `#${meRow.rank}` : '—'}</span>
              <button type="button" className="lb-link-btn" onClick={() => setEditing(true)}>CHANGE NAME</button>
            </div>
          ))}

          {LEADERBOARD_ENABLED && (
            <>
              <div className="lb-cols" aria-hidden="true">
                <span>#</span><span>PLAYER</span><span className="lb-num">WORDS</span><span className="lb-num">WINS/WORD</span>
              </div>
              {loading && board.rows.length === 0 && <p className="lb-note">LOADING THE BOARD…</p>}
              {loadError && <p className="lb-note">COULDN’T LOAD THE BOARD. <button type="button" className="lb-link-btn" onClick={load}>RETRY</button></p>}
              <ol className="lb-list">
                {board.rows.map((r) => <Row key={r.id} row={r} mine={!!profile && r.id === profile.id} flash={flash} />)}
                {/* NEVER A DEAD BOARD: open places are invitations, numbered, never invented people.
                    For an unclaimed viewer the first one is a button into the claim field. */}
                {!loading && !loadError && Array.from({ length: Math.max(0, MIN_ROWS - board.rows.length) }, (_, i) => {
                  const n = board.rows.length + i + 1;
                  const first = i === 0 && !profile;
                  return (
                    <li key={`slot-${n}`} className={`lb-slot${first ? ' is-open' : ''}`} data-rank={n}>
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
                  YOU'D SHOW AS LV {fmt(stats.level)} {rebirthStars(stats.rebirths)} · {fmt(stats.lifetimeWords)} WORDS
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
