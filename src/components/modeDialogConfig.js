// modeDialogConfig.js — per-mode copy + accent/background for the mode dialog. Split out of the
// old animated-canvas module so it carries no rAF/draw code. `bg` is a 2-stop static gradient
// (NOT repeating); `anim` is retained as data only (the animation itself was removed).
export const MODES = {
  bomb: {
    accent: '#FF6B3D', bg: ['#3a1206', '#160503'], anim: 'flame',
    chip: 'SOLO/MULTI', t1: 'WORD', t2: 'BOMB',
    liner: 'Beat the bomb. Combo or choke.',
    sub: 'Turn-based · 1–8 players · Type a word with the letters before it blows.',
    create: 'CREATE',
  },
  blitz: {
    accent: '#3DA8FF', bg: ['#052a4a', '#03101f'], anim: 'streaks',
    chip: 'SOLO · MULTI', t1: 'CATEGORY', t2: 'BLITZ',
    liner: 'AI judges you. Get creative.',
    sub: 'Speed round · Name as many as you can before time runs out.',
    create: 'CREATE',
  },
  // Solo modes (CHAIN / FUSE). `solo: true` flips ModeDialog to a single PLAY
  // button. `name` is the whole-word title (these aren't a two-word split).
  chain: {
    accent: '#2EFFE0', bg: ['#052a2a', '#02100f'], anim: 'streaks', solo: true,
    chip: 'SOLO', name: 'CHAIN', t1: 'CHAIN', t2: '',
    liner: 'Each word starts where the last one ended.',
    sub: 'Solo · Keep the chain alive — every answer begins with the previous word\'s last letter.',
    create: 'PLAY',
  },
  fuse: {
    accent: '#FFE94A', bg: ['#3a2a06', '#160f03'], anim: 'flame', solo: true,
    chip: 'SOLO', name: 'FUSE', t1: 'FUSE', t2: '',
    liner: 'Type a word that contains the piece.',
    sub: 'Solo · Race the burning fuse — every word must contain the given fragment.',
    create: 'PLAY',
  },
};
