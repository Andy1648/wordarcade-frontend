// qr.js — a tiny, dependency-free QR code encoder for the CLASS ROOM join link (the lobby draws the
// matrix as an SVG; nothing leaves the page). Byte mode, error correction level M, versions 1–10
// (up to 213 bytes — a join URL is ~50–90). Follows the structure of Project Nayuki's QR Code
// generator (MIT License, https://www.nayuki.io/page/qr-code-generator-library), trimmed to what the
// join link needs.
//
// qrMatrix(text) → boolean[][] (true = dark), indexed [y][x], no quiet zone; null if it won't fit.

// level M, index = version (0 unused)
const ECC_PER_BLOCK = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
const NUM_BLOCKS = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
const MAX_VERSION = 10;
const FORMAT_BITS_M = 0;

function rawModules(ver) {
  let n = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const align = Math.floor(ver / 7) + 2;
    n -= (25 * align - 10) * align - 55;
    if (ver >= 7) n -= 36;
  }
  return n;
}

const dataCodewords = (ver) => Math.floor(rawModules(ver) / 8) - ECC_PER_BLOCK[ver] * NUM_BLOCKS[ver];

function gfMul(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i -= 1) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}

function rsDivisor(degree) {
  const out = new Array(degree).fill(0);
  out[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i += 1) {
    for (let j = 0; j < out.length; j += 1) {
      out[j] = gfMul(out[j], root);
      if (j + 1 < out.length) out[j] ^= out[j + 1];
    }
    root = gfMul(root, 0x02);
  }
  return out;
}

function rsRemainder(data, divisor) {
  const out = divisor.map(() => 0);
  for (const b of data) {
    const factor = b ^ out.shift();
    out.push(0);
    divisor.forEach((coef, i) => {
      out[i] ^= gfMul(coef, factor);
    });
  }
  return out;
}

function utf8(text) {
  if (typeof TextEncoder !== 'undefined') return Array.from(new TextEncoder().encode(text));
  return Array.from(unescape(encodeURIComponent(text)), (c) => c.charCodeAt(0));
}

function codewordsFor(bytes) {
  let ver = 1;
  for (; ver <= MAX_VERSION; ver += 1) {
    const ccBits = ver < 10 ? 8 : 16;
    if (4 + ccBits + 8 * bytes.length <= dataCodewords(ver) * 8) break;
  }
  if (ver > MAX_VERSION) return null;
  const bits = [];
  const put = (val, len) => {
    for (let i = len - 1; i >= 0; i -= 1) bits.push((val >>> i) & 1);
  };
  put(0x4, 4); // byte mode
  put(bytes.length, ver < 10 ? 8 : 16);
  bytes.forEach((b) => put(b, 8));
  const cap = dataCodewords(ver) * 8;
  put(0, Math.min(4, cap - bits.length));
  put(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < cap; pad ^= 0xec ^ 0x11) put(pad, 8);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));

  // split into blocks, add ECC, interleave
  const nBlocks = NUM_BLOCKS[ver];
  const eccLen = ECC_PER_BLOCK[ver];
  const raw = Math.floor(rawModules(ver) / 8);
  const nShort = nBlocks - (raw % nBlocks);
  const shortLen = Math.floor(raw / nBlocks);
  const div = rsDivisor(eccLen);
  const blocks = [];
  for (let i = 0, k = 0; i < nBlocks; i += 1) {
    const dat = data.slice(k, k + shortLen - eccLen + (i < nShort ? 0 : 1));
    k += dat.length;
    const ecc = rsRemainder(dat, div);
    if (i < nShort) dat.push(0);
    blocks.push(dat.concat(ecc));
  }
  const out = [];
  for (let i = 0; i < blocks[0].length; i += 1) {
    blocks.forEach((blk, j) => {
      if (i !== shortLen - eccLen || j >= nShort) out.push(blk[i]);
    });
  }
  return { ver, codewords: out };
}

function alignPositions(ver, size) {
  if (ver === 1) return [];
  const n = Math.floor(ver / 7) + 2;
  const step = Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2;
  const out = [6];
  for (let pos = size - 7; out.length < n; pos -= step) out.splice(1, 0, pos);
  return out;
}

const MASKS = [
  (x, y) => (x + y) % 2 === 0,
  (x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

function build(ver, codewords, mask) {
  const size = ver * 4 + 17;
  const m = Array.from({ length: size }, () => new Array(size).fill(false));
  const fn = Array.from({ length: size }, () => new Array(size).fill(false));
  const set = (x, y, dark) => {
    m[y][x] = dark;
    fn[y][x] = true;
  };
  for (let i = 0; i < size; i += 1) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }
  [
    [3, 3],
    [size - 4, 3],
    [3, size - 4],
  ].forEach(([cx, cy]) => {
    for (let dy = -4; dy <= 4; dy += 1)
      for (let dx = -4; dx <= 4; dx += 1) {
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        const x = cx + dx;
        const y = cy + dy;
        if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, d !== 2 && d !== 4);
      }
  });
  const al = alignPositions(ver, size);
  al.forEach((ay, i) =>
    al.forEach((ax, j) => {
      if ((i === 0 && j === 0) || (i === 0 && j === al.length - 1) || (i === al.length - 1 && j === 0)) return;
      for (let dy = -2; dy <= 2; dy += 1) for (let dx = -2; dx <= 2; dx += 1) set(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }),
  );
  // format bits
  const fdata = (FORMAT_BITS_M << 3) | mask;
  let rem = fdata;
  for (let i = 0; i < 10; i += 1) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const fbits = ((fdata << 10) | rem) ^ 0x5412;
  const fb = (i) => ((fbits >>> i) & 1) !== 0;
  for (let i = 0; i <= 5; i += 1) set(8, i, fb(i));
  set(8, 7, fb(6));
  set(8, 8, fb(7));
  set(7, 8, fb(8));
  for (let i = 9; i < 15; i += 1) set(14 - i, 8, fb(i));
  for (let i = 0; i < 8; i += 1) set(size - 1 - i, 8, fb(i));
  for (let i = 8; i < 15; i += 1) set(8, size - 15 + i, fb(i));
  set(8, size - 8, true);
  // version bits (7+)
  if (ver >= 7) {
    let r = ver;
    for (let i = 0; i < 12; i += 1) r = (r << 1) ^ ((r >>> 11) * 0x1f25);
    const vbits = (ver << 12) | r;
    for (let i = 0; i < 18; i += 1) {
      const bit = ((vbits >>> i) & 1) !== 0;
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      set(a, b, bit);
      set(b, a, bit);
    }
  }
  // data, zigzag
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert += 1) {
      for (let j = 0; j < 2; j += 1) {
        const x = right - j;
        const up = ((right + 1) & 2) === 0;
        const y = up ? size - 1 - vert : vert;
        if (!fn[y][x] && i < codewords.length * 8) {
          m[y][x] = ((codewords[i >>> 3] >>> (7 - (i & 7))) & 1) !== 0;
          i += 1;
        }
      }
    }
  }
  const mk = MASKS[mask];
  for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) if (!fn[y][x] && mk(x, y)) m[y][x] = !m[y][x];
  return m;
}

// The mask penalty (rules 1, 2 and 4 of the spec; any mask decodes, this only picks a cleaner one).
function penalty(m) {
  const size = m.length;
  let p = 0;
  for (let pass = 0; pass < 2; pass += 1) {
    for (let a = 0; a < size; a += 1) {
      let run = 1;
      for (let b = 1; b <= size; b += 1) {
        const cur = b < size ? (pass ? m[b][a] : m[a][b]) : null;
        const prev = pass ? m[b - 1][a] : m[a][b - 1];
        if (cur === prev) run += 1;
        else {
          if (run >= 5) p += run - 2;
          run = 1;
        }
      }
    }
  }
  let dark = 0;
  for (let y = 0; y < size; y += 1)
    for (let x = 0; x < size; x += 1) {
      if (m[y][x]) dark += 1;
      if (x < size - 1 && y < size - 1 && m[y][x] === m[y][x + 1] && m[y][x] === m[y + 1][x] && m[y][x] === m[y + 1][x + 1]) p += 3;
    }
  const total = size * size;
  p += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
  return p;
}

export function qrMatrix(text) {
  const cw = codewordsFor(utf8(String(text)));
  if (!cw) return null;
  let best = null;
  let bestP = Infinity;
  for (let mask = 0; mask < 8; mask += 1) {
    const m = build(cw.ver, cw.codewords, mask);
    const p = penalty(m);
    if (p < bestP) {
      best = m;
      bestP = p;
    }
  }
  return best;
}

/** One SVG path ("M x y h1 v1 h-1 z" per dark module) and the viewBox size incl. a 4-module quiet zone. */
export function qrPath(text, quiet = 4) {
  const m = qrMatrix(text);
  if (!m) return null;
  let d = '';
  m.forEach((row, y) =>
    row.forEach((on, x) => {
      if (on) d += `M${x + quiet} ${y + quiet}h1v1h-1z`;
    }),
  );
  return { d, size: m.length + quiet * 2 };
}
