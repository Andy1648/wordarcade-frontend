// WordHook.jsx — the phone menu's "TYPE A WORD 👇" hook, for first-time visitors only.
//
// WHY IT EXISTS: typeaword.com ranks ~#1.8 for the search "type a word" (mostly Germany), and
// those visitors arrive from a TikTok trend ("type a word and it shows it as a picture"). They
// land on a phone, see a menu of game modes, and bounce (78–90%). The site's NAME is the
// instruction they came looking for, so the first thing on the screen does what it says: type a
// word, watch it slam in as the house letterform (LayeredWord) while the mascot reacts, then one
// tap starts a solo Word Bomb round.
//
// SCOPE: MobileMenu renders this only while the visitor has never started a game
// (visitHistory.hasPlayedBefore()). Once they play, the menu is the normal menu again.
//
// COST: nothing new on the first paint. The ask state is a label, an input and a button — text
// only. The mascot PNG mounts only after a submit (prefetched on focus so it is cached by then),
// and every effect is a finite one-shot on transform/opacity. The mascot's own idle breathe loop
// is switched off inside the hook (WordHook.css) so the menu's infinite-animation count is
// unchanged.
//
// LOCALE: only the one-line prompt is translated ("TIPP EIN WORT 👇" when navigator.language
// starts with "de") — that is the line a German visitor reads in the first second.
import { useRef, useState } from 'react';
import LayeredWord from './LayeredWord';
import Mascot from './Mascot';
import { stampThud } from '../juice/audio.js';
import { hookWordTyped as evHookWordTyped, hookPlaySolo as evHookPlaySolo } from '../lib/events.js';
import { hookPromptFor, cleanHookWord, HOOK_MAX_LEN } from '../lib/wordHook.js';
import './WordHook.css';

function navigatorLang() {
  try {
    return typeof navigator !== 'undefined' ? navigator.language : '';
  } catch {
    return '';
  }
}

// Warm the image cache on first focus so the reaction's mascot is already decoded when the word
// lands. AVIF is what <picture> picks on every phone browser that can render this menu.
let prefetched = false;
function prefetchMascot() {
  if (prefetched) return;
  prefetched = true;
  try {
    const img = new Image();
    img.src = '/mascot-celebrate.avif';
  } catch {
    /* no Image() — the <picture> just loads it on mount */
  }
}

/**
 * @param onPlay       starts a solo Word Bomb round (Homepage's PLAY SOLO path)
 * @param playLabel    node for the PLAY button (carries the WAKING THE SERVER… state)
 * @param navigating   true once a navigation has fired (locks the controls)
 */
export default function WordHook({ onPlay, playLabel = null, navigating = false }) {
  const [prompt] = useState(() => hookPromptFor(navigatorLang()));
  const [word, setWord] = useState('');
  // Bumped per slam so the letterform + mascot remount and replay their one-shot entrances.
  const [slam, setSlam] = useState(0);
  const [nudge, setNudge] = useState(0);
  const inputRef = useRef(null);

  function submit(e) {
    e.preventDefault();
    const w = cleanHookWord(inputRef.current ? inputRef.current.value : '');
    if (!w) {
      // Nothing usable typed: a quick shake on the field instead of a dead button.
      setNudge((n) => n + 1);
      if (inputRef.current) inputRef.current.focus();
      return;
    }
    // Drop the keyboard so the reaction and the PLAY button are on screen.
    if (inputRef.current) inputRef.current.blur();
    setWord(w);
    setSlam((n) => n + 1);
    stampThud();
    evHookWordTyped(prompt.lang, w.length);
  }

  function again() {
    setWord('');
    // The input remounts with the ask state; focus it on the next frame.
    requestAnimationFrame(() => inputRef.current && inputRef.current.focus());
  }

  function play() {
    if (navigating) return;
    evHookPlaySolo(prompt.lang);
    onPlay && onPlay();
  }

  if (!word) {
    return (
      <form className="hp-m-hook" onSubmit={submit} noValidate>
        <label className="hp-m-hook-ask" htmlFor="hp-m-hook-input" lang={prompt.lang}>
          {prompt.text}
        </label>
        <div key={nudge} className={`hp-m-hook-field${nudge ? ' is-nudged' : ''}`}>
          <input
            ref={inputRef}
            id="hp-m-hook-input"
            className="hp-m-hook-input"
            type="text"
            maxLength={HOOK_MAX_LEN}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="characters"
            spellCheck="false"
            enterKeyHint="go"
            placeholder="ANY WORD"
            onFocus={prefetchMascot}
            disabled={navigating}
          />
          <button type="submit" className="hp-m-hook-go" disabled={navigating} aria-label="Show my word">
            GO
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="hp-m-hook is-reacting" data-hook-slam={slam}>
      <div className="hp-m-hook-stage">
        <Mascot key={`m${slam}`} className="hp-m-hook-mascot" pose="celebrate" emote="bob" size={84} />
        <button
          type="button"
          className="hp-m-hook-again"
          onClick={again}
          aria-label={`${word} — type another word`}
          style={{ '--hook-len': Math.max(word.length, 4) }}
        >
          <LayeredWord key={`w${slam}`} className="hp-m-hook-word" text={word} accent="#FFE94A" />
        </button>
      </div>
      <button type="button" className="hp-m-hook-play" onClick={play} disabled={navigating}>
        {playLabel || (
          <>
            <span className="hp-m-hook-play-main">PLAY SOLO ▶</span>
            <span className="hp-m-hook-play-sub">WORD BOMB VS A BOT</span>
          </>
        )}
      </button>
    </div>
  );
}
