// modeDialogConfig.js — per-mode copy + accent/background for the mode dialog. Split out of the
// old animated-canvas module so it carries no rAF/draw code. `bg` is a 2-stop static gradient
// (NOT repeating); `anim` is retained as data only (the animation itself was removed).
export const MODES = {
  bomb: {
    accent: '#FF6B3D', bg: ['#3a1206', '#160503'], anim: 'flame',
    chip: 'SOLO/MULTI', t1: 'WORD', t2: 'BOMB',
    liner: 'BEAT THE BOMB. COMBO OR CHOKE.',
    sub: 'TURN-BASED · 1–8 PLAYERS · TYPE A WORD WITH THE LETTERS BEFORE IT BLOWS.',
    // Primary CTA reads PLAY, not CREATE: it opens a room you can play solo immediately (and
    // share the code to add friends). A newcomer shouldn't have to decode CREATE-vs-JOIN just to
    // start (audit #4). JOIN (with a code) stays as the secondary action in ModeDialog.
    create: 'PLAY',
  },
  blitz: {
    accent: '#3DA8FF', bg: ['#052a4a', '#03101f'], anim: 'streaks',
    chip: 'SOLO/MULTI', t1: 'CATEGORY', t2: 'BLITZ',
    liner: 'AI JUDGES YOU. GET CREATIVE.',
    sub: 'SPEED ROUND · NAME AS MANY AS YOU CAN BEFORE TIME RUNS OUT.',
    // PLAY (not CREATE) — see the note on bomb above.
    create: 'PLAY',
  },
  // Solo modes (CHAIN / FUSE). `solo: true` flips ModeDialog to a single PLAY
  // button. `name` is the whole-word title (these aren't a two-word split).
  chain: {
    accent: '#2EFFE0', bg: ['#052a2a', '#02100f'], anim: 'streaks', solo: true,
    chip: 'SOLO', name: 'CHAIN', t1: 'CHAIN', t2: '',
    liner: "EACH WORD STARTS ON THE LAST ONE'S LETTER.",
    sub: "SOLO · KEEP THE CHAIN ALIVE — EVERY WORD STARTS ON THE PREVIOUS WORD'S LAST LETTER.",
    create: 'PLAY',
  },
  fuse: {
    accent: '#FFE94A', bg: ['#3a2a06', '#160f03'], anim: 'flame', solo: true,
    chip: 'SOLO', name: 'FUSE', t1: 'FUSE', t2: '',
    liner: 'SNEAK THE LETTERS INTO A WORD. BEAT THE FUSE.',
    sub: 'SOLO · RACE THE BURNING FUSE — EVERY WORD MUST CONTAIN THE LETTERS.',
    create: 'PLAY',
  },
};
