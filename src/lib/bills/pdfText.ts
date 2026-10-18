/**
 * Estrazione LOCALE del testo da un PDF che ha il livello di testo (fatture e bollette generate da un programma).
 * Nessuna dipendenza: decompressione Flate propria (algoritmo "puff"), lettura degli operatori di testo e delle mappe ToUnicode.
 *
 * LIMITI (dichiarati, non nascosti): non e' OCR. Un PDF che e' una scansione/foto non ha testo e restituisce `no_text`.
 * PDF cifrati, font con codifiche personalizzate senza ToUnicode o impaginazioni molto complesse possono dare testo
 * incompleto o in ordine strano: per questo l'esito e' sempre mostrato all'utente per la revisione.
 */

export type PdfTextResult =
  | { ok: true; text: string; pages: number; quality: 'buona' | 'incerta' }
  | { ok: false; reason: 'not_pdf' | 'encrypted' | 'no_text' | 'error'; pages?: number };

// ---------------------------------------------------------------- inflate (puff)

const LBASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
const LEXT = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
const DBASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
const DEXT = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
const CL_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

type Huff = { count: Uint16Array; symbol: Uint16Array };
function buildHuff(lengths: ArrayLike<number>, n: number): Huff {
  const count = new Uint16Array(16), symbol = new Uint16Array(n), offs = new Uint16Array(16);
  for (let i = 0; i < n; i++) count[lengths[i]]++;
  count[0] = 0;
  for (let l = 1; l < 15; l++) offs[l + 1] = offs[l] + count[l];
  for (let i = 0; i < n; i++) if (lengths[i]) symbol[offs[lengths[i]]++] = i;
  return { count, symbol };
}
let FIXED: { l: Huff; d: Huff } | null = null;
function fixed() {
  if (FIXED) return FIXED;
  const l = new Uint8Array(288);
  for (let i = 0; i < 144; i++) l[i] = 8;
  for (let i = 144; i < 256; i++) l[i] = 9;
  for (let i = 256; i < 280; i++) l[i] = 7;
  for (let i = 280; i < 288; i++) l[i] = 8;
  const d = new Uint8Array(30).fill(5);
  return (FIXED = { l: buildHuff(l, 288), d: buildHuff(d, 30) });
}

/** Decomprime dati zlib (con intestazione di 2 byte) o deflate grezzo. Lancia un errore se i dati sono corrotti. */

/** ASCII85 (con <~ ~> facoltativi). */
export function ascii85(src: Uint8Array): Uint8Array {
  const out: number[] = [];
  let group: number[] = [];
  let i = 0;
  const s = src;
  if (s[0] === 0x3c && s[1] === 0x7e) i = 2;
  const flush = (n: number) => {
    let v = 0;
    for (let k = 0; k < 5; k++) v = v * 85 + ((group[k] ?? 84) );
    const bytes = [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255];
    for (let k = 0; k < n - 1; k++) out.push(bytes[k]);
  };
  for (; i < s.length; i++) {
    const c = s[i];
    if (c === 0x7e) break; // "~>"
    if (c === 0x7a && group.length === 0) { out.push(0, 0, 0, 0); continue; } // 'z'
    if (c <= 0x20) continue;
    if (c < 0x21 || c > 0x75) continue;
    group.push(c - 33);
    if (group.length === 5) { flush(5); group = []; }
  }
  if (group.length > 1) flush(group.length);
  return Uint8Array.from(out);
}

function asciiHex(src: Uint8Array): Uint8Array {
  const out: number[] = [];
  let hi = -1;
  for (const c of src) {
    if (c === 0x3e) break;
    const v = c >= 48 && c <= 57 ? c - 48 : c >= 65 && c <= 70 ? c - 55 : c >= 97 && c <= 102 ? c - 87 : -1;
    if (v < 0) continue;
    if (hi < 0) hi = v; else { out.push(hi * 16 + v); hi = -1; }
  }
  if (hi >= 0) out.push(hi * 16);
  return Uint8Array.from(out);
}

export function inflate(src: Uint8Array, maxOut = 64 * 1024 * 1024): Uint8Array {
  let pos = 0;
  if (src.length > 2 && (src[0] & 0x0f) === 8 && ((src[0] << 8) | src[1]) % 31 === 0) pos = 2;
  let bitBuf = 0, bitCnt = 0;
  let out = new Uint8Array(Math.max(1024, src.length * 4)), op = 0;
  const bits = (need: number): number => {
    let v = bitBuf;
    while (bitCnt < need) {
      if (pos >= src.length) throw new Error('fine dati');
      v |= src[pos++] << bitCnt;
      bitCnt += 8;
    }
    bitBuf = v >>> need;
    bitCnt -= need;
    return v & ((1 << need) - 1);
  };
  const decode = (h: Huff): number => {
    let code = 0, first = 0, index = 0;
    for (let len = 1; len <= 15; len++) {
      code |= bits(1);
      const c = h.count[len];
      if (code - c < first) return h.symbol[index + (code - first)];
      index += c; first += c; first <<= 1; code <<= 1;
    }
    throw new Error('codice non valido');
  };
  const ensure = (n: number) => {
    if (op + n <= out.length) return;
    if (op + n > maxOut) throw new Error('troppo grande');
    const next = new Uint8Array(Math.min(maxOut, Math.max(out.length * 2, op + n)));
    next.set(out.subarray(0, op));
    out = next;
  };
  let last = 0;
  do {
    last = bits(1);
    const type = bits(2);
    if (type === 0) {
      bitBuf = 0; bitCnt = 0;
      if (pos + 4 > src.length) throw new Error('fine dati');
      const len = src[pos] | (src[pos + 1] << 8);
      pos += 4;
      if (pos + len > src.length) throw new Error('fine dati');
      ensure(len);
      out.set(src.subarray(pos, pos + len), op);
      op += len; pos += len;
    } else if (type === 1 || type === 2) {
      let lh: Huff, dh: Huff;
      if (type === 1) { const f = fixed(); lh = f.l; dh = f.d; }
      else {
        const nlen = bits(5) + 257, ndist = bits(5) + 1, ncode = bits(4) + 4;
        const lengths = new Uint8Array(320);
        for (let i = 0; i < ncode; i++) lengths[CL_ORDER[i]] = bits(3);
        const cl = buildHuff(lengths.subarray(0, 19), 19);
        const all = new Uint8Array(nlen + ndist);
        let i = 0;
        while (i < nlen + ndist) {
          const sym = decode(cl);
          if (sym < 16) all[i++] = sym;
          else {
            let prev = 0, rep: number;
            if (sym === 16) { if (i === 0) throw new Error('ripetizione'); prev = all[i - 1]; rep = 3 + bits(2); }
            else if (sym === 17) rep = 3 + bits(3);
            else rep = 11 + bits(7);
            if (i + rep > nlen + ndist) throw new Error('lunghezze');
            while (rep--) all[i++] = prev;
          }
        }
        lh = buildHuff(all.subarray(0, nlen), nlen);
        dh = buildHuff(all.subarray(nlen), ndist);
      }
      for (;;) {
        let sym = decode(lh);
        if (sym < 256) { ensure(1); out[op++] = sym; }
        else if (sym === 256) break;
        else {
          sym -= 257;
          if (sym >= 29) throw new Error('simbolo');
          const len = LBASE[sym] + bits(LEXT[sym]);
          const ds = decode(dh);
          if (ds >= 30) throw new Error('distanza');
          const dist = DBASE[ds] + bits(DEXT[ds]);
          if (dist > op) throw new Error('distanza');
          ensure(len);
          for (let k = 0; k < len; k++) { out[op] = out[op - dist]; op++; }
        }
      }
    } else throw new Error('blocco non valido');
  } while (!last);
  return out.subarray(0, op);
}

// ---------------------------------------------------------------- lettura degli oggetti PDF

const latin1 = (b: Uint8Array, a = 0, z = b.length): string => {
  let s = '';
  for (let i = a; i < z; i += 8192) s += String.fromCharCode.apply(null, Array.from(b.subarray(i, Math.min(z, i + 8192))));
  return s;
};

type PdfObj = { num: number; dict: string; data?: Uint8Array };

function readObjects(bytes: Uint8Array): { objs: Map<number, PdfObj>; encrypted: boolean } {
  const s = latin1(bytes);
  const objs = new Map<number, PdfObj>();
  const re = /(\d+)\s+(\d+)\s+obj\b/g;
  let m: RegExpExecArray | null;
  const starts: { num: number; at: number; bodyAt: number }[] = [];
  while ((m = re.exec(s))) starts.push({ num: +m[1], at: m.index, bodyAt: m.index + m[0].length });
  for (let i = 0; i < starts.length; i++) {
    const st = starts[i];
    const end = i + 1 < starts.length ? starts[i + 1].at : s.length;
    const body = s.slice(st.bodyAt, end);
    const si = body.indexOf('stream');
    if (si >= 0 && /^[\s\S]*?>>\s*stream/.test(body.slice(0, si + 6))) {
      const dict = body.slice(0, si);
      let a = st.bodyAt + si + 6;
      if (bytes[a] === 13) a++;
      if (bytes[a] === 10) a++;
      const lenM = /\/Length\s+(\d+)(?!\s+\d+\s+R)/.exec(dict);
      let z = -1;
      if (lenM) { const cand = a + +lenM[1]; if (s.slice(cand, cand + 12).replace(/^[\r\n ]+/, '').startsWith('endstream')) z = cand; }
      if (z < 0) { const e = s.indexOf('endstream', a); z = e < 0 ? end : e; if (bytes[z - 1] === 10) z--; if (bytes[z - 1] === 13) z--; }
      let data: Uint8Array | undefined = bytes.subarray(a, z);
      /* filtri in cascata (es. [/ASCII85Decode /FlateDecode] di ReportLab): si applicano nell'ordine in cui sono scritti */
      const fm = /\/Filter\s*(\[[^\]]*\]|\/[A-Za-z0-9]+)/.exec(dict);
      const filters = fm ? (fm[1].match(/\/[A-Za-z0-9]+/g) ?? []).map((x) => x.slice(1)) : [];
      try {
        for (const f of filters) {
          if (!data) break;
          if (f === 'FlateDecode' || f === 'Fl') data = inflate(data);
          else if (f === 'ASCII85Decode' || f === 'A85') data = ascii85(data);
          else if (f === 'ASCIIHexDecode' || f === 'AHx') data = asciiHex(data);
          else data = undefined;
        }
      } catch { data = undefined; }
      objs.set(st.num, { num: st.num, dict, data });
    } else objs.set(st.num, { num: st.num, dict: body.replace(/endobj[\s\S]*$/, '') });
  }
  // flussi di oggetti compressi (PDF 1.5+)
  for (const o of [...objs.values()]) {
    if (!o.data || !/\/Type\s*\/ObjStm/.test(o.dict)) continue;
    const n = +(/\/N\s+(\d+)/.exec(o.dict)?.[1] ?? 0), first = +(/\/First\s+(\d+)/.exec(o.dict)?.[1] ?? 0);
    const txt = latin1(o.data);
    const head = txt.slice(0, first).trim().split(/\s+/).map(Number);
    for (let i = 0; i < n; i++) {
      const num = head[i * 2], off = head[i * 2 + 1];
      if (!Number.isFinite(num) || !Number.isFinite(off)) continue;
      const next = i + 1 < n ? head[(i + 1) * 2 + 1] : txt.length - first;
      objs.set(num, { num, dict: txt.slice(first + off, first + next) });
    }
  }
  return { objs, encrypted: /\/Encrypt\s+\d+\s+\d+\s+R|\/Encrypt\s*<</.test(s.slice(-4096)) || [...objs.values()].some((o) => /\/Filter\s*\/Standard/.test(o.dict)) };
}

const refOf = (s: string, key: string): number | null => {
  const m = new RegExp('/' + key + '\\s+(\\d+)\\s+\\d+\\s+R').exec(s);
  return m ? +m[1] : null;
};

/** Contenuto di <<...>> bilanciato a partire dalla chiave. */
function dictAfter(s: string, key: string): string | null {
  const i = s.indexOf('/' + key);
  if (i < 0) return null;
  let j = s.indexOf('<<', i);
  const k = s.indexOf('/', i + key.length + 1);
  if (j < 0 || (k >= 0 && k < j && !/^\s*$/.test(s.slice(i + key.length + 1, j)))) return null;
  let depth = 0;
  const a = j;
  for (; j < s.length - 1; j++) {
    if (s[j] === '<' && s[j + 1] === '<') { depth++; j++; }
    else if (s[j] === '>' && s[j + 1] === '>') { depth--; j++; if (depth === 0) return s.slice(a, j + 1); }
  }
  return null;
}

type CMap = { map: Map<number, string>; two: boolean };
function parseCMap(txt: string): CMap {
  const map = new Map<number, string>();
  const hex = (h: string) => { let o = ''; const c = h.replace(/\s/g, ''); for (let i = 0; i + 3 < c.length + 1; i += 4) { const u = parseInt(c.slice(i, i + 4), 16); if (!Number.isNaN(u)) o += String.fromCharCode(u); } return c.length <= 2 ? String.fromCharCode(parseInt(c, 16)) : o; };
  let two = false;
  const cs = /begincodespacerange\s*<([0-9a-fA-F]+)>/.exec(txt);
  if (cs && cs[1].length >= 4) two = true;
  const bf = /beginbfchar([\s\S]*?)endbfchar/g;
  let m: RegExpExecArray | null;
  while ((m = bf.exec(txt))) {
    const pr = /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g;
    let p: RegExpExecArray | null;
    while ((p = pr.exec(m[1]))) map.set(parseInt(p[1], 16), hex(p[2]));
  }
  const br = /beginbfrange([\s\S]*?)endbfrange/g;
  while ((m = br.exec(txt))) {
    const re = /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*(?:<([0-9a-fA-F]+)>|\[([^\]]*)\])/g;
    let p: RegExpExecArray | null;
    while ((p = re.exec(m[1]))) {
      const lo = parseInt(p[1], 16), hi = parseInt(p[2], 16);
      if (hi - lo > 65535) continue;
      if (p[3]) {
        const base = parseInt(p[3], 16), width = p[3].length;
        for (let c = lo; c <= hi; c++) map.set(c, hex((base + (c - lo)).toString(16).padStart(width, '0')));
      } else if (p[4]) {
        const items = [...p[4].matchAll(/<([0-9a-fA-F]+)>/g)].map((x) => x[1]);
        for (let c = lo; c <= hi && c - lo < items.length; c++) map.set(c, hex(items[c - lo]));
      }
    }
  }
  return { map, two };
}

type Font = { cmap?: CMap; two: boolean };

// WinAnsi 0x80-0x9f -> Unicode
const WIN: Record<number, string> = { 0x80: '€', 0x82: '‚', 0x84: '„', 0x85: '…', 0x91: '‘', 0x92: '’', 0x93: '“', 0x94: '”', 0x95: '•', 0x96: '–', 0x97: '—' };

function decodeBytes(codes: number[], f: Font | undefined): string {
  let out = '';
  if (f?.two) {
    for (let i = 0; i + 1 < codes.length; i += 2) {
      const c = (codes[i] << 8) | codes[i + 1];
      const u = f.cmap?.map.get(c);
      if (u !== undefined) out += u;
      else if (!f.cmap) out += c > 31 && c < 0xd800 ? String.fromCharCode(c) : '';
    }
    return out;
  }
  for (const c of codes) {
    const u = f?.cmap?.map.get(c);
    if (u !== undefined) out += u;
    else out += WIN[c] ?? (c >= 32 ? String.fromCharCode(c) : c === 9 ? ' ' : '');
  }
  return out;
}

/** Operatori di testo di un flusso di contenuto -> righe di testo. */
export type PdfRun = { x: number; y: number; text: string };
export type PdfRect = { x: number; y: number; w: number; h: number };
export type PdfLayoutPage = { runs: PdfRun[]; rects: PdfRect[] };

function contentText(src: string, fonts: Map<string, Font>, sink?: PdfLayoutPage): string {
  const lines: string[] = [];
  let cur = '';
  let font: Font | undefined;
  let y = 0;
  let tx = 0, ty = 0; // posizione del testo (solo per il layout)
  const flush = () => { if (cur.trim()) lines.push(cur.replace(/[ ]{2,}/g, ' ').trimEnd()); cur = ''; };
  const stack: unknown[] = [];
  let i = 0;
  const n = src.length;
  const readLiteral = (): number[] => {
    const codes: number[] = [];
    let depth = 1;
    i++;
    while (i < n && depth > 0) {
      const ch = src[i];
      if (ch === '\\') {
        const nx = src[i + 1];
        if (nx >= '0' && nx <= '7') { let o = nx, k = 2; while (k < 4 && src[i + k] >= '0' && src[i + k] <= '7') { o += src[i + k]; k++; } codes.push(parseInt(o, 8) & 255); i += k; continue; }
        const map: Record<string, number> = { n: 10, r: 13, t: 9, b: 8, f: 12, '(': 40, ')': 41, '\\': 92 };
        if (nx === '\n' || nx === '\r') { i += nx === '\r' && src[i + 2] === '\n' ? 3 : 2; continue; }
        if (nx in map) codes.push(map[nx]); else codes.push(nx.charCodeAt(0));
        i += 2; continue;
      }
      if (ch === '(') depth++;
      else if (ch === ')') { depth--; if (depth === 0) { i++; break; } }
      codes.push(src.charCodeAt(i) & 255);
      i++;
    }
    return codes;
  };
  const showStr = (codes: number[]) => { cur += decodeBytes(codes, font); };
  while (i < n) {
    const ch = src[i];
    if (ch === '(') { stack.push(readLiteral()); continue; }
    if (ch === '<' && src[i + 1] !== '<') {
      const e = src.indexOf('>', i);
      if (e < 0) break;
      let h = src.slice(i + 1, e).replace(/\s/g, '');
      if (h.length % 2) h += '0';
      const codes: number[] = [];
      for (let k = 0; k < h.length; k += 2) codes.push(parseInt(h.slice(k, k + 2), 16));
      stack.push(codes); i = e + 1; continue;
    }
    if (ch === '[') { stack.push('['); i++; continue; }
    if (ch === ']') {
      const arr: unknown[] = [];
      while (stack.length) { const v = stack.pop(); if (v === '[') break; arr.unshift(v); }
      stack.push(arr); i++; continue;
    }
    if (ch === '%') { while (i < n && src[i] !== '\n' && src[i] !== '\r') i++; continue; }
    if (/\s/.test(ch) || ch === '<' || ch === '>') { i += ch === '<' || ch === '>' ? 2 : 1; continue; }
    // token
    let j = i;
    while (j < n && !/[\s()<>[\]/%]/.test(src[j])) j++;
    if (src[i] === '/') { j = i + 1; while (j < n && !/[\s()<>[\]/%]/.test(src[j])) j++; stack.push(src.slice(i, j)); i = j; continue; }
    const tok = src.slice(i, j);
    i = j || i + 1;
    if (!tok) continue;
    if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(tok)) { stack.push(parseFloat(tok)); continue; }
    switch (tok) {
      case 'Tf': { const nm = stack[stack.length - 2]; if (typeof nm === 'string') font = fonts.get(nm.slice(1)); break; }
      case 'Tj': { const v = stack[stack.length - 1]; if (Array.isArray(v)) { const b = cur.length; showStr(v as number[]); if (sink && cur.length > b) sink.runs.push({ x: tx, y: ty, text: cur.slice(b) }); } break; }
      case "'": case '"': { flush(); const v = stack[stack.length - 1]; if (Array.isArray(v)) showStr(v as number[]); break; }
      case 'TJ': {
        const arr = stack[stack.length - 1];
        const b = cur.length;
        if (Array.isArray(arr)) for (const it of arr) { if (typeof it === 'number') { if (it < -180 && cur && !cur.endsWith(' ')) cur += ' '; } else if (Array.isArray(it)) showStr(it as number[]); }
        if (sink && cur.length > b) sink.runs.push({ x: tx, y: ty, text: cur.slice(b) });
        break;
      }
      case 're': { const [rx, ry, rw, rh] = stack.slice(-4); if (sink && [rx, ry, rw, rh].every((v) => typeof v === 'number')) sink.rects.push({ x: rx as number, y: ry as number, w: rw as number, h: rh as number }); break; }
      case 'Td': case 'TD': { const dty = stack[stack.length - 1]; const dtx = stack[stack.length - 2]; if (typeof dtx === 'number' && typeof dty === 'number') { tx += dtx; ty += dty; } if (typeof dty === 'number' && dty !== 0) { flush(); y += dty; } else if (typeof dtx === 'number' && dtx > 0 && cur && !cur.endsWith(' ')) cur += ' '; break; }
      case 'T*': flush(); break;
      case 'Tm': { const tmY = stack[stack.length - 1]; const tmX = stack[stack.length - 2]; if (typeof tmX === 'number' && typeof tmY === 'number') { tx = tmX; ty = tmY; } if (typeof tmY === 'number') { if (Math.abs(tmY - y) > 1) flush(); else if (cur && !cur.endsWith(' ')) cur += ' '; y = tmY; } break; }
      case 'ET': flush(); break;
      case 'BT': flush(); break;
      default: break;
    }
    stack.length = 0; // dopo ogni operatore gli operandi sono consumati
  }
  flush();
  return lines.join('\n');
}

function fontsOf(objs: Map<number, PdfObj>, resDict: string): Map<string, Font> {
  const out = new Map<string, Font>();
  let fd = dictAfter(resDict, 'Font');
  if (!fd) {
    const r = refOf(resDict, 'Font');
    if (r && objs.get(r)) fd = objs.get(r)!.dict;
  }
  if (!fd) return out;
  const re = /\/([A-Za-z0-9_.+-]+)\s+(\d+)\s+\d+\s+R/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(fd))) {
    const fo = objs.get(+m[2]);
    if (!fo) continue;
    const two = /\/Subtype\s*\/Type0/.test(fo.dict) || /\/Encoding\s*\/Identity-H/.test(fo.dict);
    const tu = refOf(fo.dict, 'ToUnicode');
    const tuo = tu ? objs.get(tu) : undefined;
    const cmap = tuo?.data ? parseCMap(latin1(tuo.data)) : undefined;
    out.set(m[1], { cmap, two: two && (cmap ? cmap.two || two : true) });
  }
  return out;
}

/** Estrae il testo di un PDF (byte). Mai una eccezione: se non riesce restituisce `ok: false` col motivo. */
export function extractPdfText(bytes: Uint8Array): PdfTextResult {
  try {
    if (!(bytes.length > 8 && latin1(bytes, 0, 1024).includes('%PDF-'))) return { ok: false, reason: 'not_pdf' };
    const { objs, encrypted } = readObjects(bytes);
    if (encrypted) return { ok: false, reason: 'encrypted' };
    const pages = [...objs.values()].filter((o) => /\/Type\s*\/Page\b(?!s)/.test(o.dict));
    const chunks: string[] = [];
    let used = 0;
    const doPage = (page: PdfObj) => {
      let res = dictAfter(page.dict, 'Resources') ?? '';
      if (!res) { const r = refOf(page.dict, 'Resources'); if (r && objs.get(r)) res = objs.get(r)!.dict; }
      const fonts = fontsOf(objs, res);
      const cm = /\/Contents\s*(?:(\d+)\s+\d+\s+R|\[([^\]]*)\])/.exec(page.dict);
      const ids: number[] = [];
      if (cm) { if (cm[1]) ids.push(+cm[1]); else for (const x of cm[2].matchAll(/(\d+)\s+\d+\s+R/g)) ids.push(+x[1]); }
      const parts = ids.map((id) => objs.get(id)?.data).filter((d): d is Uint8Array => !!d).map((d) => latin1(d));
      if (parts.length) { chunks.push(contentText(parts.join('\n'), fonts)); used++; }
    };
    if (pages.length) pages.sort((a, b) => a.num - b.num).forEach(doPage);
    if (!used) {
      // PDF "strano": ogni flusso con operatori di testo
      const fonts = new Map<string, Font>();
      for (const o of objs.values()) if (/\/Type\s*\/Font\b/.test(o.dict)) { const f = fontsOf(objs, `/Font << /F${o.num} ${o.num} 0 R >>`); f.forEach((v, k) => fonts.set(k, v)); }
      for (const o of objs.values()) if (o.data && !o.dict.includes('/Image')) { const t = latin1(o.data); if (/\bBT\b/.test(t) && /\bET\b/.test(t)) chunks.push(contentText(t, fonts)); }
    }
    const text = chunks.join('\n\n').trim();
    const letters = (text.match(/[A-Za-zÀ-ÿ]/g) ?? []).length;
    if (letters < 25) return { ok: false, reason: 'no_text', pages: pages.length };
    const weird = (text.match(/[^\x20-\x7e -ɏ€–—‘’“”•\n]/g) ?? []).length;
    const quality = weird / Math.max(1, text.length) > 0.05 || letters / Math.max(1, text.length) < 0.3 ? 'incerta' : 'buona';
    return { ok: true, text, pages: Math.max(1, pages.length), quality };
  } catch {
    return { ok: false, reason: 'error' };
  }
}


/** Testo del PDF CON le posizioni (x, y) e i rettangoli delle celle: serve a leggere le tabelle (colonne Addebito / Accredito). */
export function extractPdfLayout(bytes: Uint8Array): PdfLayoutPage[] | null {
  try {
    if (!(bytes.length > 8 && latin1(bytes, 0, 1024).includes('%PDF-'))) return null;
    const { objs, encrypted } = readObjects(bytes);
    if (encrypted) return null;
    const pages = [...objs.values()].filter((o) => /\/Type\s*\/Page\b(?!s)/.test(o.dict)).sort((a, b) => a.num - b.num);
    const out: PdfLayoutPage[] = [];
    for (const page of pages) {
      let res = dictAfter(page.dict, 'Resources') ?? '';
      if (!res) { const r = refOf(page.dict, 'Resources'); if (r && objs.get(r)) res = objs.get(r)!.dict; }
      const fonts = fontsOf(objs, res);
      const cm = /\/Contents\s*(?:(\d+)\s+\d+\s+R|\[([^\]]*)\])/.exec(page.dict);
      const ids: number[] = [];
      if (cm) { if (cm[1]) ids.push(+cm[1]); else for (const x of cm[2].matchAll(/(\d+)\s+\d+\s+R/g)) ids.push(+x[1]); }
      const parts = ids.map((id) => objs.get(id)?.data).filter((d): d is Uint8Array => !!d).map((d) => latin1(d));
      if (!parts.length) continue;
      const sink: PdfLayoutPage = { runs: [], rects: [] };
      contentText(parts.join('\n'), fonts, sink);
      out.push(sink);
    }
    return out.length ? out : null;
  } catch { return null; }
}
