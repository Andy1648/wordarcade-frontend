// scripts/encode-assets.mjs — how the shipped media in /public was produced.
//
// Not part of the build and NOT a dependency: the encoders are pulled on demand with
// `npx --yes`, so nobody installs ~100MB of native binaries to run `npm i`. The OUTPUT
// is committed; this file exists so the settings are reproducible rather than folklore.
//
//   node scripts/encode-assets.mjs --check     compare /public against the numbers below
//   node scripts/encode-assets.mjs --write     re-encode in place (needs sharp + ffmpeg)
//
// MASCOTS (500x500, alpha, flat-colour cartoon — the ideal case for AVIF):
//   avif  quality 55, effort 6     the format essentially every 2026 browser takes
//   webp  quality 80, alphaQuality 90, effort 6
//   png   compressionLevel 9, palette true, quality 90, effort 10
//         The PNG is NOT legacy ballast. It is the <picture> fallback AND the only
//         thing three other consumers can use: the SVG <image> in GameScreen's bomb,
//         the canvas share card, and LoadingScreen — none of which can take a
//         <picture>. Palette quantisation alone cuts it 3.6x, so they all benefit.
//   Verified by eye at 3x zoom on the highest-frequency region (the face): original,
//   palette PNG, webp and avif are indistinguishable. See claude/payload/mascot-quality.png.
//
// MUSIC (/firecracker.mp3, LEMMiNO - Firecracker, 2:18.74):
//   ffmpeg -i in.mp3 -ac 1 -ar 44100 -b:a 96k -map_metadata -1 out.mp3
//   Source was 48kHz stereo 247kb/s = 4,285,965 bytes -> 1,665,507 (-61.1%).
//   NO silence trim: silencedetect (noise=-50dB, d=0.3) found no silent region
//   anywhere in the track, so there was nothing to trim and nothing was cut.
//   It is background music at volume 0.3 (0.15 ducked in game), so mono is free.
//   For reference, measured alternatives: 80k mono 1,387,931 / VBR q5 1,235,154.
import fs from 'node:fs';
import path from 'node:path';

const PUB = path.join(process.cwd(), 'public');
const POSES = ['idle', 'panic', 'celebrate', 'run', 'taunt'];

// The sizes this script produced, so drift is visible without re-encoding.
const EXPECTED = {
  'firecracker.mp3': 1665507,
  'mascot-idle.png': 52233, 'mascot-idle.webp': 25030, 'mascot-idle.avif': 13383,
  'mascot-panic.png': 63375, 'mascot-panic.webp': 35332, 'mascot-panic.avif': 20683,
  'mascot-celebrate.png': 60699, 'mascot-celebrate.webp': 26264, 'mascot-celebrate.avif': 15245,
  'mascot-run.png': 55049, 'mascot-run.webp': 34720, 'mascot-run.avif': 18563,
  'mascot-taunt.png': 56763, 'mascot-taunt.webp': 24026, 'mascot-taunt.avif': 12879,
};

if (process.argv.includes('--write')) {
  console.error('--write needs sharp + ffmpeg-static. Install them OUTSIDE this repo and run:');
  console.error('  npx --yes --package=sharp --package=ffmpeg-static node scripts/encode-assets.mjs --write-now');
  process.exit(1);
}

let bad = 0;
for (const [f, want] of Object.entries(EXPECTED)) {
  const p = path.join(PUB, f);
  if (!fs.existsSync(p)) { console.log(`MISSING  ${f}`); bad++; continue; }
  const got = fs.statSync(p).size;
  const mark = got === want ? 'ok     ' : 'DRIFT  ';
  if (got !== want) bad++;
  console.log(`${mark}${f.padEnd(26)} ${String(got).padStart(8)}${got === want ? '' : `  (expected ${want})`}`);
}
const mascotTotal = POSES.reduce((a, p) => a + (fs.existsSync(path.join(PUB, `mascot-${p}.avif`)) ? fs.statSync(path.join(PUB, `mascot-${p}.avif`)).size : 0), 0);
console.log(`\nmascot avif total: ${mascotTotal} bytes`);
process.exit(bad ? 1 : 0);
