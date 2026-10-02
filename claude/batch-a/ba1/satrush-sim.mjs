// claude/batch-a/ba1/satrush-sim.mjs — BA1 SAT RUSH bot playtest.
//
// Drives the REAL pure modules (engine.js, config.js stageMs, suspects.js via the engine,
// briefing.js pickBriefing, lexicon.js recordResult, input.js createSlotInput) with a
// 50ms-step clock that mirrors the hook's timers in src/satRush/useSatRushGame.js:
//   - stage delay  = effectiveStageIntervalMs(stageMsForCard(c), {isDeepCut, mode})   (hook L359-365)
//   - briefing final stage: free first letter on entry (L399-401), then a spell-along tick every
//     spellAlongMs up to len-1 (L424-443), then finalHold = 2*tick -> doMiss
//   - lineup final stage: no reveal; doMiss after lineupWindowMs(2800, len) (L387, L408-413)
//   - wrong key -> registerWrongKeystroke; revealedLetter -> input.revealNextLetter; spamMiss -> doMiss (L502-517)
//   - pauses: CLEAR 850 / HEAVY_CLEAR 1800 (revealed>=2) / MISS 3200 / FINAL_MISS 6000 (L31-46, L288, L333)
//   - recent ring (recentWords.js, cap 250, fresh words only, L157) + lexicon persisted across runs
//   - briefing deck: pickBriefing with exclude = last 3 decks (L641-650)
// 50 seeded runs per mode, played as 50 CONSECUTIVE runs of ONE median player (so cross-run
// repeats are real), plus the same 50 seeds as fresh players for run-1 numbers.
//
// Run:  node claude/batch-a/ba1/satrush-sim.mjs            (reads src from ../ba1-wt if present)
//       SAT_SRC=<repo root> node claude/batch-a/ba1/satrush-sim.mjs
//       OVR='{"spellAlongMs":900}' node ...                  (engine config overrides, for re-measure)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const WT = resolve(HERE, '../../../../ba1-wt');
const ROOT = process.env.SAT_SRC || (existsSync(join(WT, 'src/satRush/engine.js')) ? WT : resolve(HERE, '../../..'));
const imp = (p) => import(pathToFileURL(join(ROOT, p)).href);
const { createSatRushEngine, DEFAULT_CONFIG, effectiveStageIntervalMs, lineupWindowMs } = await imp('src/satRush/engine.js');
const { stageMs: stageMsForCard, DEFAULT_STAGE_MS } = await imp('src/satRush/config.js');
const { createSlotInput } = await imp('src/satRush/input.js');
const lexicon = await imp('src/satRush/lexicon.js');
const { pickBriefing } = await imp('src/satRush/briefing.js');
const { suspectsStanding } = await imp('src/satRush/suspects.js');
const WORDS = JSON.parse(readFileSync(join(ROOT, 'src/data/satRush/words.json'), 'utf8'));
const OVR = process.env.OVR ? JSON.parse(process.env.OVR) : {};
const LINEUP_WINDOW_SCALE = Number(process.env.LWS || 1); // hypothetical fix knob (1 = shipped)
// FIX knobs for re-measuring proposals (all OFF = shipped behaviour):
//  FIX_COST=1      stage base reads the ROW's costMs (stageMsForCard(cur.row)) instead of the
//                  presentation, which has no costMs field (engine.js buildPresentation L282-306)
//  LINEUP_BASE=flat  with FIX_COST, lineup keeps the flat 2800 base (per-card only in briefing)
//  LW_PER_LETTER=n   lineup last-call window per-letter ms (shipped 200, engine.js L127)
//  AUTO_LEFT=n       spell-along stops with n letters unrevealed (shipped 1: engine.js L417 autoRevealMax = length-1)
const FIX_COST = process.env.FIX_COST === '1';
const AUTO_LEFT = Number(process.env.AUTO_LEFT || 1);
//  COINFLIP_MISS=1   hypothetical lineup rule: typing the WRONG suspect's first letter at the 2-suspect stage is a miss
const COINFLIP_MISS = process.env.COINFLIP_MISS === '1';
const LINEUP_BASE_FLAT = process.env.LINEUP_BASE === 'flat';
const LW_PER_LETTER = process.env.LW_PER_LETTER ? Number(process.env.LW_PER_LETTER) : null;
const lineupWin = (len) => (LW_PER_LETTER == null ? lineupWindowMs(DEFAULT_STAGE_MS, len) : Math.round(DEFAULT_STAGE_MS * 1.4) + len * LW_PER_LETTER);

// hook constants (useSatRushGame.js L31-46)
const CLEAR_PAUSE_MS = 850, MISS_PAUSE_MS = 3200, FINAL_MISS_PAUSE_MS = 6000, HEAVY_REVEAL_MIN = 2, HEAVY_CLEAR_PAUSE_MS = 1800;
const RECENT_CAP = 250; // recentWords.js L14

// ---------- RNG ----------
function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const logn = (r, med, sig) => { // lognormal via Box-Muller
  const u = Math.max(1e-9, r()), v = r();
  return med * Math.exp(sig * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v));
};

// ---------- median player model ----------
// Vocabulary: words.recall.txt is frequency-ranked (31.5k tokens, space-separated). A median adult
// knows roughly the top 10-20k. P(know) = 1/(1+(rank/18000)^2.5): rank 5k .96, 10k .82, 15k .61,
// 20k .43, 30k .22. A word absent from the list (beyond rank ~31k, i.e. rare) gets a TIER floor
// [.40,.30,.18,.10,.04] — a few tier-1/2 words are missing only through list quirks, while
// absent tier-4/5 words are genuinely obscure (abecedarian, crapulous, defalcation...).
const RECALL = readFileSync(join(ROOT, 'src/solo/words.recall.txt'), 'utf8').split(/\s+/).filter(Boolean);
const RANK = new Map(); RECALL.forEach((w, i) => { w = w.toLowerCase(); if (!RANK.has(w)) RANK.set(w, i + 1); });
const ABSENT_P = { 1: 0.4, 2: 0.3, 3: 0.18, 4: 0.1, 5: 0.04 };
function pKnow(row) {
  const r = RANK.get(row.word);
  if (!r) return ABSENT_P[row.tier] ?? 0.05;
  return 1 / (1 + Math.pow(r / 18000, 2.5));
}
const READ_CPS = 16.7; // 200 wpm, the build-sat-costs median
const KEY_MS = 60000 / (35 * 5); // 35 wpm -> 343ms/key
const TYPO = 0.04;

// ---------- one run ----------
function playRun({ mode, rng, player, runIdx }) {
  // briefing deck (hook chooseMode L641-650)
  let briefed = [];
  const lex = player.lex;
  lex.session = (lex.session || 0) + 1; // startGame L605
  if (mode === 'briefing') {
    const recentDecks = lex.lastBriefed || [];
    const b = pickBriefing({ state: lex, session: lex.session, words: WORDS, rng, exclude: recentDecks.flat() });
    briefed = b.words.map((r) => r.word);
    lex.lastBriefed = [...recentDecks, briefed].slice(-3);
    for (const w of briefed) player.studied.set(w, runIdx);
  }
  const eng = createSatRushEngine({
    words: WORDS, rng, recent: new Set(player.recent), briefed,
    config: { mode, stageIntervalMs: DEFAULT_STAGE_MS, spellAlongMs: OVR.spellAlongMs ?? DEFAULT_CONFIG.spellAlongMs, ...OVR },
  });
  const cfg = eng.config;
  const spellMs = cfg.spellAlongMs;
  const R = { mode, words: [], wallMs: 0, silverReached: false, silverAt: null, deathCause: null };
  let t = 0; // run wall clock (ms)
  const MAX_WORDS = 150, MAX_MS = 30 * 60 * 1000; // a long sitting; reaching it = the run never ended
  let prevWasMiss = false;
  for (;;) {
    const cur = eng.nextWord();
    if (!cur) { R.deathCause = R.deathCause || 'pool'; break; }
    if (!cur.isRevenant) { player.recent.push(cur.word); if (player.recent.length > RECENT_CAP) player.recent.shift(); }
    const row = cur.row;
    // knowledge draw — learning across encounters: prior study (briefing / miss re-encode) lifts recall
    let p = pKnow(row);
    const enc = player.encounters.get(row.word) || 0;
    if (cur.isBriefed) p = Math.max(p, 0.7); // studied 30-60s ago: immediate retrieval
    else if (cur.isRevenant) p = Math.max(p, 0.45); // the miss re-encode just taught it
    else if (enc > 0) p = Math.min(0.95, p + 0.12 * enc);
    player.encounters.set(row.word, enc + 1);
    const u = rng();
    let know;
    if (u < p * 0.6) know = 'cold'; else if (u < p) know = 'gloss';
    else if (u < p + (1 - p) * 0.35) know = 'partial'; else know = 'none';
    const partialK = 1 + Math.floor(rng() * 3); // letters (beyond first) needed to recognize
    // lineup recognition (no spell-along): known -> at stage 0/1; some 'partial' recognize from the
    // lineup at stage 1 (gloss + 4 standing); otherwise the 2-suspect coin-flip at stage 2.

    // hook L360 passes the PRESENTATION (eng.getState().current) — it carries no costMs, so the
    // shipped game falls back to DEFAULT_STAGE_MS for every card. FIX_COST re-measures the intent.
    const B = FIX_COST && !(mode === 'lineup' && LINEUP_BASE_FLAT) ? stageMsForCard(cur.row) : stageMsForCard(cur);
    const I = effectiveStageIntervalMs(B, { isDeepCut: cur.isDeepCut, mode }, cfg);
    const input = createSlotInput({ target: cur.word });
    const L = cur.length;
    const ctxRead = ((cur.context || '').length / READ_CPS) * 1000;
    const glossRead = ((cur.gloss || '').length / READ_CPS) * 1000;
    const scan = mode === 'lineup' ? 6 * 350 : 0;
    // stage timeline
    const s1At = cur.stage >= 1 ? 0 : I;
    const s2At = cur.stage >= 1 ? I : 2 * I;
    // player readiness time (ms from word start), or null = waits on reveals
    let readyAt = null;
    let lineupPick = null; // for the stage-2 coin flip: which suspect the player types first
    const readDone = (cur.stage >= 1 ? ctxRead + glossRead : ctxRead) * logn(rng, 1, 0.2);
    if (know === 'cold') readyAt = readDone + logn(rng, 1100, 0.4) + scan * 0.5;
    else if (know === 'gloss') readyAt = Math.max(readDone, s1At + glossRead * logn(rng, 1, 0.2)) + logn(rng, 1300, 0.4) + scan * 0.5;
    else if (mode === 'lineup' && know === 'partial') readyAt = s1At + glossRead + 4 * 350 + logn(rng, 1800, 0.4);
    else if (mode === 'lineup') {
      // 2 standing at stage 2: notice + read both + pick
      readyAt = s2At + logn(rng, 1600, 0.35);
      const standing = cur.suspects.lineup.filter((s) => s.eliminatedAtStage == null);
      lineupPick = standing[Math.floor(rng() * standing.length)].word;
    }
    // simulate
    let ms = 0, stage = cur.stage, nextKeyAt = readyAt, nextTick = null, missAt = null;
    let wrongKeys = 0, typoWrong = 0, guessWrong = 0, outcome = null, cause = null;
    let idle = 0; // ms the player had nothing useful to do (finished reading, not ready, waiting)
    let typingStart = null, typingAgain = null;
    let pickWord = lineupPick;
    const startedAtStage = cur.stage;
    let guessNextAt = null;
    const DT = 50;
    while (!outcome) {
      // --- game clock (hook stage effect) ---
      if (stage < 2 && ms >= (stage === 0 ? s1At : s2At)) {
        eng.advanceStage(); stage = cur.stage;
        if (stage === 2) {
          if (mode !== 'lineup') {
            if (input.getState().revealed === 0) input.revealNextLetter();
            if (input.getState().complete) { outcome = 'clear'; break; }
            nextTick = input.getState().revealed < L - AUTO_LEFT ? ms + spellMs : null;
            missAt = nextTick == null ? ms + 2 * spellMs : null;
          } else {
            missAt = ms + lineupWin(L) * LINEUP_WINDOW_SCALE;
          }
        }
      }
      if (stage === 2 && mode !== 'lineup' && startedAtStage === 2 && nextTick == null && missAt == null) {
        nextTick = ms + spellMs;
      }
      if (nextTick != null && ms >= nextTick) {
        const rev = input.revealNextLetter();
        if (rev.complete) { outcome = 'clear'; break; }
        if (input.getState().revealed < L - AUTO_LEFT) nextTick = ms + spellMs; else { nextTick = null; missAt = ms + 2 * spellMs; }
      }
      if (missAt != null && ms >= missAt) { outcome = 'miss'; cause = 'walked-away'; break; }
      // --- player readiness on reveals (briefing partial/none) ---
      if (readyAt == null && mode !== 'lineup' && stage === 2) {
        const rv = input.getState().revealed;
        if (know === 'partial' && rv >= 1 + partialK) readyAt = ms + logn(rng, 700, 0.3);
        else if (know === 'none' && rv >= L - AUTO_LEFT) readyAt = ms + logn(rng, 650, 0.3);
        // tip-of-tongue / pattern guessing while letters drip: ~1 guess per 2.5s, predictability rises
        if (readyAt == null) {
          if (guessNextAt == null) guessNextAt = ms + logn(rng, 2500, 0.4);
          if (ms >= guessNextAt) {
            guessNextAt = ms + logn(rng, 2500, 0.4);
            const st = input.getState();
            const pc = 0.15 + 0.6 * (st.typed.length / L);
            const letter = rng() < pc ? cur.word[st.typed.length] : 'q';
            const res = input.typeLetter(letter);
            if (!res.accepted) {
              guessWrong++; wrongKeys++;
              const k = eng.registerWrongKeystroke();
              if (k.spamMiss) { outcome = 'miss'; cause = 'spam-miss(guess)'; break; }
              if (k.revealedLetter) { const rv2 = input.revealNextLetter(); if (rv2.complete) { outcome = 'clear'; break; } }
            } else if (res.complete) { outcome = 'clear'; break; }
          }
        }
      }
      // --- player typing ---
      if (readyAt != null && ms >= readyAt && ms >= nextKeyAt) {
        if (typingStart == null) typingStart = ms;
        const st = input.getState();
        let intended = cur.word[st.typed.length];
        if (pickWord && pickWord !== cur.word && st.typed.length === 0) intended = pickWord[0]; // wrong coin-flip
        if (know === 'none' && mode !== 'lineup' && rng() < (st.typed.length === L - 1 ? 0.2 : 0.45)) intended = 'q'; // guessing an unrevealed letter of a word you don't know
        if (rng() < TYPO) intended = 'z' === intended ? 'x' : 'z';
        const res = input.typeLetter(intended);
        if (res.accepted) {
          if (res.complete) { outcome = 'clear'; break; }
          nextKeyAt = ms + logn(rng, KEY_MS, 0.25);
        } else {
          wrongKeys++;
          if (pickWord && pickWord !== cur.word && st.typed.length === 0 && intended === pickWord[0]) { if (COINFLIP_MISS) { outcome = 'miss'; cause = 'wrong-suspect'; break; } pickWord = null; guessWrong++; nextKeyAt = ms + logn(rng, 500, 0.3); }
          else { typoWrong++; nextKeyAt = ms + logn(rng, 450, 0.3); }
          const k = eng.registerWrongKeystroke();
          if (k.spamMiss) { outcome = 'miss'; cause = 'spam-miss(typo)'; break; }
          if (k.revealedLetter) { const rv2 = input.revealNextLetter(); if (rv2.complete) { outcome = 'clear'; break; } }
        }
      }
      // idle: finished reading, not yet able to act
      if (ms > readDone && (readyAt == null || ms < readyAt)) idle += DT;
      ms += DT;
      if (ms > 600000) { outcome = 'miss'; cause = 'bug-timeout'; break; }
    }
    const revealed = input.getState().revealed;
    let gained = 0, silverNow = false;
    if (outcome === 'clear') {
      const r = eng.submitCorrect({ revealed });
      gained = r.gained; silverNow = r.silverTongue;
      lexicon.recordResult(lex, cur.word, { cleared: true, stage: r.breakdown.stage, revealedCount: revealed });
      if (silverNow && !R.silverReached) { R.silverReached = true; R.silverAt = eng.getState().wordNumber; }
    } else {
      eng.miss();
      lexicon.recordResult(lex, cur.word, { cleared: false, stage, revealedCount: revealed });
    }
    const st = eng.getState();
    R.words.push({
      n: st.wordNumber, word: cur.word, tier: cur.tier, len: L, deep: cur.isDeepCut, rev: cur.isRevenant, briefed: cur.isBriefed,
      missCount: cur.missCount, p: +pKnow(row).toFixed(3), pEff: +p.toFixed(3), know, B, I, stage, revealed, outcome, cause,
      ms, idle, typoWrong, guessWrong, gained, heat: st.heat, lives: st.lives, tStart: t,
      seenPrevRun: player.lastRunWords.has(cur.word), seenEver: player.everSeen.has(cur.word), seenLast3: player.last3.some((st) => st.has(cur.word)),
      standing: cur.suspects ? suspectsStanding(cur.suspects.lineup, stage) : null,
      typingStart,
    });
    t += ms;
    if (outcome === 'clear') t += revealed >= HEAVY_REVEAL_MIN ? HEAVY_CLEAR_PAUSE_MS : CLEAR_PAUSE_MS;
    else t += st.gameOver ? FINAL_MISS_PAUSE_MS : MISS_PAUSE_MS;
    if (st.gameOver) { R.deathCause = 'lives'; break; }
    if (st.wordNumber >= MAX_WORDS || t > MAX_MS) { R.deathCause = 'cap'; break; }
  }
  R.wallMs = t;
  R.results = eng.results();
  player.lastRunWords = new Set(R.words.map((w) => w.word));
  player.last3 = [...player.last3, player.lastRunWords].slice(-3);
  for (const w of R.words) player.everSeen.add(w.word);
  return R;
}

function newPlayer() {
  return { lex: lexicon.freshState(), recent: [], encounters: new Map(), studied: new Map(), lastRunWords: new Set(), everSeen: new Set(), last3: [] };
}

// ---------- drive ----------
const out = {};
for (const mode of ['briefing', 'lineup']) {
  const runsSeq = [], runsFresh = [];
  const seqPlayer = newPlayer();
  for (let i = 0; i < 50; i++) {
    runsSeq.push(playRun({ mode, rng: mulberry32(1000 + i), player: seqPlayer, runIdx: i }));
    runsFresh.push(playRun({ mode, rng: mulberry32(5000 + i), player: newPlayer(), runIdx: 0 }));
  }
  out[mode] = { runsSeq, runsFresh };
}

// ---------- metrics ----------
const pct = (a, b) => (b ? ((100 * a) / b).toFixed(1) + '%' : '-');
const q = (arr, p) => { const s = [...arr].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * p))] : null; };
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const lines = [];
const log = (...a) => lines.push(a.join(' '));
const summary = {};
log(`SAT RUSH BA1 sim — src=${ROOT} overrides=${JSON.stringify(OVR)} FIX_COST=${FIX_COST} LINEUP_BASE_FLAT=${LINEUP_BASE_FLAT} LW_PER_LETTER=${LW_PER_LETTER}`);
for (const mode of ['briefing', 'lineup']) {
  for (const kind of ['runsFresh', 'runsSeq']) {
    const runs = out[mode][kind];
    const W = runs.flatMap((r) => r.words);
    const S = {};
    log(`\n=== ${mode.toUpperCase()} — ${kind === 'runsFresh' ? '50 fresh players (run 1 each)' : '1 player, 50 consecutive runs'} ===`);
    const lens = runs.map((r) => r.words.length), secs = runs.map((r) => r.wallMs / 1000);
    S.runWordsP50 = q(lens, 0.5); S.runSecP50 = q(secs, 0.5);
    log(`run length words p10/p50/p90 = ${q(lens, .1)}/${q(lens, .5)}/${q(lens, .9)} ; seconds p10/p50/p90 = ${q(secs, .1).toFixed(0)}/${q(secs, .5).toFixed(0)}/${q(secs, .9).toFixed(0)}`);
    const causes = {}; for (const r of runs) causes[r.deathCause] = (causes[r.deathCause] || 0) + 1;
    log(`run end cause: ${JSON.stringify(causes)}`);
    const early30 = runs.filter((r) => r.deathCause === 'lives' && r.wallMs < 30000).length;
    const early5 = runs.filter((r) => r.deathCause === 'lives' && r.words.length <= 5).length;
    const early10 = runs.filter((r) => r.deathCause === 'lives' && r.words.length <= 10).length;
    log(`runs dead in <30s: ${early30}/50 ; dead within 5 words: ${early5}/50 ; within 10 words: ${early10}/50`);
    S.early30 = early30; S.early10 = early10;
    // unknowable words
    const unk = W.filter((w) => w.p < 0.1);
    log(`words shown: ${W.length}; median-unknowable (P(know)<0.10): ${unk.length} = ${pct(unk.length, W.length)}`);
    for (const tier of [1, 2, 3, 4, 5]) {
      const tw = W.filter((w) => w.tier === tier && !w.rev);
      log(`  tier ${tier}: served ${tw.length} (${pct(tw.length, W.filter((w) => !w.rev).length)}), unknowable ${pct(tw.filter((w) => w.p < 0.1).length, tw.length)}, mean P(know) ${mean(tw.map((w) => w.p)).toFixed(2)}, clear ${pct(tw.filter((w) => w.outcome === 'clear').length, tw.length)}`);
    }
    const dc = W.filter((w) => w.deep && !w.rev);
    log(`  deep cuts: ${dc.length}, unknowable ${pct(dc.filter((w) => w.p < 0.1).length, dc.length)}, clear ${pct(dc.filter((w) => w.outcome === 'clear').length, dc.length)}, cleared at x5 ${pct(dc.filter((w) => w.outcome === 'clear' && w.stage === 0).length, dc.length)}`);
    S.unknowablePct = (100 * unk.length) / W.length;
    // knowledge mix + ante
    const km = {}; for (const w of W) km[w.know] = (km[w.know] || 0) + 1;
    log(`knowledge mix: ${Object.entries(km).map(([k, v]) => `${k} ${pct(v, W.length)}`).join(', ')}`);
    const cl = W.filter((w) => w.outcome === 'clear');
    log(`clears ${pct(cl.length, W.length)}; ante at clear x5 ${pct(cl.filter((w) => w.stage === 0).length, cl.length)} x3 ${pct(cl.filter((w) => w.stage === 1).length, cl.length)} x1 ${pct(cl.filter((w) => w.stage === 2).length, cl.length)}; clears with revealed>=2 (spell-along carried) ${pct(cl.filter((w) => w.revealed >= 2).length, cl.length)}`);
    // misses by cause
    const ms = W.filter((w) => w.outcome === 'miss');
    const mc = {}; for (const w of ms) mc[w.cause] = (mc[w.cause] || 0) + 1;
    log(`misses ${ms.length} (${pct(ms.length, W.length)}): ${JSON.stringify(mc)}`);
    S.misses = mc; S.missPct = (100 * ms.length) / W.length;
    // misses where the player KNEW the word (cold/gloss) — timer too tight
    const knewMiss = ms.filter((w) => w.know === 'cold' || w.know === 'gloss');
    log(`misses on words the player KNEW (cold/gloss): ${knewMiss.length} = ${pct(knewMiss.length, ms.length)} of misses`);
    if (mode === 'lineup') {
      const tight = ms.filter((w) => w.cause === 'walked-away' && w.typingStart != null);
      log(`lineup walked-away misses where player was ALREADY TYPING at the buzzer: ${tight.length}/${ms.filter((w) => w.cause === 'walked-away').length}`);
      const len = (lo, hi) => { const g = W.filter((w) => w.len >= lo && w.len <= hi); const m = g.filter((w) => w.outcome === 'miss'); return `${lo}-${hi}: ${pct(m.length, g.length)} miss (n=${g.length})`; };
      log(`lineup miss rate by length: ${len(3, 7)} | ${len(8, 10)} | ${len(11, 20)}`);
      S.tightMisses = tight.length;
      const s2 = W.filter((w) => w.stage === 2);
      log(`lineup words reaching the 2-suspect stage: ${pct(s2.length, W.length)}; their miss rate ${pct(s2.filter((w) => w.outcome === 'miss').length, s2.length)}`);
    }
    // repeats
    const typoHeat = W.filter((w) => w.typoWrong >= 3).length;
    log(`words where TYPOS alone hit 3 wrong keys (spam reveal, heat zeroed): ${typoHeat} = ${pct(typoHeat, W.length)}`);
    const guessPunish = W.filter((w) => w.guessWrong + w.typoWrong >= 3 && w.guessWrong > 0).length;
    log(`words where honest GUESSING hit a spam reveal (heat zeroed, pays less): ${guessPunish} = ${pct(guessPunish, W.length)}`);
    // idle
    const idleS = W.map((w) => w.idle / 1000), wordS = W.map((w) => w.ms / 1000);
    const idleTot = idleS.reduce((a, b) => a + b, 0), playTot = runs.reduce((a, r) => a + r.wallMs / 1000, 0);
    log(`IDLE (read the card, can't act, waiting on reveals): ${idleTot.toFixed(0)}s of ${playTot.toFixed(0)}s run time = ${pct(idleTot, playTot)}; per word p50/p90/max = ${q(idleS, .5).toFixed(1)}/${q(idleS, .9).toFixed(1)}/${q(idleS, 1).toFixed(1)}s`);
    log(`word duration p50/p90/max = ${q(wordS, .5).toFixed(1)}/${q(wordS, .9).toFixed(1)}/${q(wordS, 1).toFixed(1)}s`);
    const longIdle = W.filter((w) => w.idle >= 15000).length;
    log(`words with >=15s idle wait: ${longIdle} = ${pct(longIdle, W.length)}; >=25s: ${pct(W.filter((w) => w.idle >= 25000).length, W.length)}`);
    const unkIdle = W.filter((w) => w.know === 'none').map((w) => w.idle / 1000);
    log(`idle on 'none' words p50/p90 = ${q(unkIdle, .5)?.toFixed(1)}/${q(unkIdle, .9)?.toFixed(1)}s`);
    S.idlePct = (100 * idleTot) / playTot; S.idleP50 = q(idleS, .5); S.idleP90 = q(idleS, .9); S.longIdlePct = (100 * longIdle) / W.length;
    // known-word wait ("I know it, give me the next stage")—cold words are instant; gloss words wait
    const gl = W.filter((w) => w.know === 'gloss');
    log(`'gloss' words (need the definition): ${pct(gl.length, W.length)}; mean idle ${mean(gl.map((w) => w.idle / 1000)).toFixed(1)}s`);
    // dead stretches: consecutive words with no x5/x3 (i.e., carried by reveals or missed)
    let maxStretch = 0, stretches5 = 0;
    for (const r of runs) { let s = 0; for (const w of r.words) { if (w.outcome === 'clear' && w.stage < 2) { if (s >= 5) stretches5++; s = 0; } else { s++; maxStretch = Math.max(maxStretch, s); } } if (s >= 5) stretches5++; }
    log(`dead stretches (>=5 consecutive words with no x5/x3 capture): ${stretches5} across 50 runs; longest ${maxStretch}`);
    S.deadStretch5 = stretches5; S.maxStretch = maxStretch;
    // heat/silver
    const sil = runs.filter((r) => r.silverReached).length;
    log(`SILVER TONGUE reached: ${sil}/50 runs (${pct(sil, 50)}); at word p50 ${q(runs.filter((r) => r.silverReached).map((r) => r.silverAt), .5)}`);
    S.silver = sil;
    if (mode === 'lineup') {
      // post-hoc: replay heat if a final-stage (2-suspect coin-flip) clear did NOT bump heat
      let hyp = 0;
      for (const r of runs) { let h = 0, hit = false; for (const w of r.words) { if (w.outcome === 'clear') { if (w.stage < 2) h = Math.min(5, h + 1); } else h = 0; if (h >= 5) hit = true; } if (hit) hyp++; }
      log(`  hypothetical: if a stage-2 (2-suspect) clear did not bump heat, SILVER reached in ${hyp}/50 runs`);
    }
    // revenants
    const rv = W.filter((w) => w.rev);
    const loops = W.filter((w) => w.rev && w.missCount >= 2).length;
    log(`revenants: ${rv.length} (${pct(rv.length, W.length)} of words); revenant clear ${pct(rv.filter((w) => w.outcome === 'clear').length, rv.length)}; 3rd+ appearance of the same word in a run: ${loops}`);
    // repeats within / across runs
    const fresh = W.filter((w) => !w.rev);
    log(`cross-run: fresh words served that were also served the PREVIOUS run: ${pct(fresh.filter((w) => w.seenPrevRun).length, fresh.length)}; seen in the last 3 runs: ${pct(fresh.filter((w) => w.seenLast3).length, fresh.length)}; seen in ANY earlier run: ${pct(fresh.filter((w) => w.seenEver).length, fresh.length)}`);
    if (kind === 'runsSeq') {
      const firstN = (r, n) => r.words.slice(0, n);
      const opens = runs.slice(1).map((r) => firstN(r, 10).filter((w) => w.seenEver && !w.briefed).length);
      const opens3 = runs.slice(1).map((r) => firstN(r, 10).filter((w) => w.seenLast3 && !w.briefed).length);
      log(`first 10 words of runs 2-50 (excl. briefed): mean ${mean(opens).toFixed(2)} seen in any earlier run, ${mean(opens3).toFixed(2)} seen in the last 3 runs`);
      // per-run-block repeat rate
      for (const [a, b] of [[1, 10], [11, 25], [26, 50]]) {
        const ws = runs.slice(a - 1, b).flatMap((r) => r.words.filter((w) => !w.rev));
        log(`  runs ${a}-${b}: previously-seen fresh draws ${pct(ws.filter((w) => w.seenEver).length, ws.length)}`);
      }
      S.seenEverPct = (100 * fresh.filter((w) => w.seenEver).length) / fresh.length;
    }
    const livesBy60 = runs.map((r) => r.words.filter((w) => w.n <= 60 && w.outcome === 'miss').length);
    log(`lives lost in the first 60 words: mean ${mean(livesBy60).toFixed(2)} of 3; runs losing 0: ${livesBy60.filter((x) => x === 0).length}/50`);
    const x5known = W.filter((w) => w.know === 'cold');
    log(`'cold' (knew it from the sentence) words cleared at x5: ${pct(x5known.filter((w) => w.outcome === 'clear' && w.stage === 0).length, x5known.length)}`);
    const coinSilver = W.filter((w) => w.outcome === 'clear' && w.stage === 2 && (w.know === 'none' || w.know === 'partial') && w.heat >= 5).length;
    log(`clears at heat cap (SILVER) that were stage-2 coin-flips/give-aways: ${coinSilver} = ${pct(coinSilver, W.filter((w) => w.outcome === 'clear' && w.heat >= 5).length)} of silver clears`);
    // first-seconds: first miss
    const firstMissN = runs.map((r) => (r.words.find((w) => w.outcome === 'miss') || {}).n || null).filter(Boolean);
    log(`first miss at word p10/p50 = ${q(firstMissN, .1)}/${q(firstMissN, .5)} (runs with a miss: ${firstMissN.length}/50)`);
    // score
    log(`score p10/p50/p90 = ${q(runs.map((r) => r.results.score), .1)}/${q(runs.map((r) => r.results.score), .5)}/${q(runs.map((r) => r.results.score), .9)}`);
    summary[`${mode}.${kind}`] = S;
  }
}
// card beat distribution (shipped)
const beats = WORDS.map((c) => stageMsForCard(c));
log(`\ncard beat (stageMs) p10/p50/p90 = ${q(beats, .1)}/${q(beats, .5)}/${q(beats, .9)} ms; lineup stage = x${DEFAULT_CONFIG.lineupStageScale} -> p50 ${q(beats, .5) * DEFAULT_CONFIG.lineupStageScale}ms per stage`);
log(`lineup decision window (final stage) for len 6/9/12 = ${lineupWin(6)}/${lineupWin(9)}/${lineupWin(12)} ms; typing alone at 35wpm = ${Math.round(6*KEY_MS)}/${Math.round(9*KEY_MS)}/${Math.round(12*KEY_MS)} ms`);
// worst cards: unknowable + long
const tag = process.env.TAG || '';
writeFileSync(join(HERE, `satrush-sim${tag}.txt`), lines.join('\n') + '\n');
writeFileSync(join(HERE, `satrush-sim${tag}.json`), JSON.stringify({ summary, sample: { briefing: out.briefing.runsSeq.slice(0, 3), lineup: out.lineup.runsSeq.slice(0, 3) } }, null, 1));
console.log(lines.join('\n'));
