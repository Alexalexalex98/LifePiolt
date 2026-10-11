/**
 * Generatore QR minimale (modo byte, correzione errori L, versioni 1-5: fino a 106 byte, basta per un link al profilo).
 * Modulo PURO. Restituisce la matrice di moduli (true = scuro) o null se il testo è troppo lungo.
 * Verificato in tests/profileQr.test.mjs contro un codificatore di riferimento e decodificando l'immagine.
 */
const VERSIONS = [
  { v: 1, data: 19, ec: 7, align: 0 }, { v: 2, data: 34, ec: 10, align: 18 }, { v: 3, data: 55, ec: 15, align: 22 },
  { v: 4, data: 80, ec: 20, align: 26 }, { v: 5, data: 108, ec: 26, align: 30 },
];
const EXP = new Array<number>(512), LOG = new Array<number>(256);
(() => { let x = 1; for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d; } for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]; })();
const mul = (a: number, b: number) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);

function rsEncode(data: number[], ecLen: number): number[] {
  let gen = [1];
  for (let i = 0; i < ecLen; i++) { const next = new Array(gen.length + 1).fill(0); gen.forEach((c, j) => { next[j] ^= c; next[j + 1] ^= mul(c, EXP[i]); }); gen = next; }
  const res = new Array(ecLen).fill(0);
  for (const b of data) {
    const factor = b ^ res[0];
    res.shift(); res.push(0);
    if (factor) gen.slice(1).forEach((g, j) => { res[j] ^= mul(g, factor); });
  }
  return res;
}

function utf8(s: string): number[] {
  const out: number[] = [];
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return out;
}

export function qrMatrix(text: string): boolean[][] | null {
  const bytes = utf8(text);
  const ver = VERSIONS.find((x) => bytes.length <= x.data - 2);
  if (!ver) return null;
  const bits: number[] = [];
  const push = (val: number, n: number) => { for (let i = n - 1; i >= 0; i--) bits.push((val >> i) & 1); };
  push(4, 4); push(bytes.length, 8); bytes.forEach((b) => push(b, 8));
  push(0, Math.min(4, ver.data * 8 - bits.length));
  while (bits.length % 8) bits.push(0);
  const cw: number[] = [];
  for (let i = 0; i < bits.length; i += 8) cw.push(parseInt(bits.slice(i, i + 8).join(''), 2));
  for (let p = 0; cw.length < ver.data; p++) cw.push(p % 2 ? 0x11 : 0xec);
  const all = [...cw, ...rsEncode(cw, ver.ec)];
  const stream: number[] = [];
  all.forEach((b) => push2(stream, b));
  const remainder = ver.v === 1 ? 0 : 7;
  for (let i = 0; i < remainder; i++) stream.push(0);

  const n = 17 + 4 * ver.v;
  const m: (boolean | null)[][] = Array.from({ length: n }, () => new Array(n).fill(null));
  const fn: boolean[][] = Array.from({ length: n }, () => new Array(n).fill(false));
  const set = (r: number, c: number, v: boolean) => { m[r][c] = v; fn[r][c] = true; };
  const finder = (r0: number, c0: number) => {
    for (let dr = -1; dr <= 7; dr++) for (let dc = -1; dc <= 7; dc++) {
      const r = r0 + dr, c = c0 + dc;
      if (r < 0 || c < 0 || r >= n || c >= n) continue;
      const on = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6 && (dr === 0 || dr === 6 || dc === 0 || dc === 6 || (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4));
      set(r, c, on);
    }
  };
  finder(0, 0); finder(0, n - 7); finder(n - 7, 0);
  for (let i = 8; i < n - 8; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  if (ver.align) {
    const a = ver.align;
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) set(a + dr, a + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
  }
  set(n - 8, 8, true);
  // aree del formato riservate
  for (let i = 0; i < 9; i++) { if (!fn[8][i]) set(8, i, false); if (!fn[i][8]) set(i, 8, false); }
  for (let i = 0; i < 8; i++) { if (!fn[8][n - 1 - i]) set(8, n - 1 - i, false); if (!fn[n - 1 - i][8]) set(n - 1 - i, 8, false); }
  set(n - 8, 8, true);

  const coords: [number, number][] = [];
  for (let right = n - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < n; vert++) for (let j = 0; j < 2; j++) {
      const c = right - j;
      const up = ((right + 1) & 2) === 0;
      const r = up ? n - 1 - vert : vert;
      if (!fn[r][c]) coords.push([r, c]);
    }
  }
  const maskFns = [
    (r: number, c: number) => (r + c) % 2 === 0, (r: number) => r % 2 === 0, (_r: number, c: number) => c % 3 === 0, (r: number, c: number) => (r + c) % 3 === 0,
    (r: number, c: number) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0, (r: number, c: number) => ((r * c) % 2) + ((r * c) % 3) === 0,
    (r: number, c: number) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0, (r: number, c: number) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
  ];
  const build = (mask: number): boolean[][] => {
    const g = m.map((row) => row.map((x) => !!x));
    coords.forEach(([r, c], i) => { const bit = stream[i] === 1; g[r][c] = maskFns[mask](r, c) ? !bit : bit; });
    // formato: EC L = 01
    let data = (1 << 3) | mask, rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >> 9) * 0x537);
    const fmt = ((data << 10) | rem) ^ 0x5412;
    const bit = (i: number) => ((fmt >> i) & 1) === 1;
    for (let i = 0; i <= 5; i++) g[i][8] = bit(i);
    g[7][8] = bit(6); g[8][8] = bit(7); g[8][7] = bit(8);
    for (let i = 9; i < 15; i++) g[8][14 - i] = bit(i);
    for (let i = 0; i < 8; i++) g[8][n - 1 - i] = bit(i);
    for (let i = 8; i < 15; i++) g[n - 15 + i][8] = bit(i);
    g[n - 8][8] = true;
    return g;
  };
  let best: boolean[][] = [], bestScore = Infinity;
  for (let k = 0; k < 8; k++) { const g = build(k); const s = penalty(g); if (s < bestScore) { bestScore = s; best = g; } }
  return best;
}
function push2(arr: number[], b: number) { for (let i = 7; i >= 0; i--) arr.push((b >> i) & 1); }

function penalty(g: boolean[][]): number {
  const n = g.length;
  let score = 0;
  const run = (line: boolean[]) => {
    let s = 0, cnt = 1;
    for (let i = 1; i <= line.length; i++) {
      if (i < line.length && line[i] === line[i - 1]) cnt++;
      else { if (cnt >= 5) s += cnt - 2; cnt = 1; }
    }
    const str = line.map((x) => (x ? '1' : '0')).join('');
    for (let i = 0; i + 11 <= str.length; i++) { const w = str.slice(i, i + 11); if (w === '10111010000' || w === '00001011101') s += 40; }
    return s;
  };
  for (let i = 0; i < n; i++) { score += run(g[i]); score += run(g.map((row) => row[i])); }
  for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) if (g[r][c] === g[r][c + 1] && g[r][c] === g[r + 1][c] && g[r][c] === g[r + 1][c + 1]) score += 3;
  const dark = g.flat().filter(Boolean).length;
  score += Math.floor(Math.abs((dark * 100) / (n * n) - 50) / 5) * 10;
  return score;
}

/** Path SVG unico (un rettangolo per modulo scuro) in unità di modulo, con bordo silenzioso di 2 moduli. */
export function qrPath(m: boolean[][], quiet = 2): { d: string; size: number } {
  let d = '';
  m.forEach((row, r) => row.forEach((on, c) => { if (on) d += `M${c + quiet} ${r + quiet}h1v1h-1z`; }));
  return { d, size: m.length + quiet * 2 };
}
