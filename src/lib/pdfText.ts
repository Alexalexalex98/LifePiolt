/**
 * Testo di un PDF «semplice» (modulo PURO, nessuna AI): legge i flussi di contenuto e raccoglie ciò che è scritto con Tj/TJ.
 * Funziona con i PDF di solo testo con caratteri normali (come quello che genera LifePilot, o export semplici).
 * NON legge i PDF con font incorporati a codici speciali (molti export di Word o del browser), né le scansioni: lì serve l'AI o il testo incollato.
 */
import { unzlibSync } from 'fflate';

const CP1252: Record<number, string> = { 0x80: '€', 0x85: '…', 0x91: '‘', 0x92: '’', 0x93: '“', 0x94: '”', 0x95: '•', 0x96: '–', 0x97: '—' };
const latin1 = (b: Uint8Array): string => { let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); return s; };

function decodeLiteral(raw: string): string {
  let out = '';
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i]!;
    if (c !== '\\') { out += CP1252[c.charCodeAt(0)] ?? c; continue; }
    const n = raw[++i];
    if (n === undefined) break;
    if (n === 'n') out += '\n'; else if (n === 'r') out += '\r'; else if (n === 't') out += '\t'; else if (n === 'b') out += '\b'; else if (n === 'f') out += '\f';
    else if (n === '\n') { /* a capo nel sorgente */ } else if (n === '\r') { if (raw[i + 1] === '\n') i++; }
    else if (/[0-7]/.test(n)) { let o = n; while (o.length < 3 && /[0-7]/.test(raw[i + 1] ?? '')) o += raw[++i]; const code = parseInt(o, 8) & 255; out += CP1252[code] ?? String.fromCharCode(code); }
    else out += n;
  }
  return out;
}
const decodeHex = (h: string): string => { const x = h.replace(/\s/g, ''); let o = ''; for (let i = 0; i < x.length; i += 2) { const code = parseInt(x.slice(i, i + 2).padEnd(2, '0'), 16); o += CP1252[code] ?? String.fromCharCode(code); } return o; };

function streamsOf(bytes: Uint8Array): string[] {
  const s = latin1(bytes); const out: string[] = [];
  let pos = 0;
  while (true) {
    const k = s.indexOf('stream', pos); if (k < 0) break;
    if (s.slice(k - 3, k) === 'end') { pos = k + 6; continue; }
    let start = k + 6; if (s[start] === '\r') start++; if (s[start] === '\n') start++;
    const end = s.indexOf('endstream', start); if (end < 0) break;
    const dictStart = s.lastIndexOf('obj', k); const dict = dictStart >= 0 ? s.slice(dictStart, k) : '';
    pos = end + 9;
    if (/\/(Image|XObject|FontFile|Subtype\s*\/Image)/.test(dict) && !/\/Contents/.test(dict) && /\/Subtype\s*\/Image/.test(dict)) continue;
    let data = bytes.subarray(start, end);
    if (/\/FlateDecode/.test(dict)) { try { data = unzlibSync(data); } catch { try { data = unzlibSync(data.subarray(0, Math.max(0, data.length - 1))); } catch { continue; } } }
    else if (/\/(ASCII85Decode|LZWDecode|RunLengthDecode|DCTDecode)/.test(dict)) continue;
    const text = latin1(data);
    if (/\bBT\b/.test(text) && /\bET\b/.test(text)) out.push(text);
  }
  return out;
}

const TOKEN = /(\[(?:[^\]\\]|\\.)*\]|\((?:\\.|[^\\)])*\)|<[0-9A-Fa-f\s]*>|-?\d*\.?\d+|\/[^\s/[\]()<>]+|[A-Za-z*'"]+)/g;
function textOf(content: string): string[] {
  const lines: string[] = []; let cur = ''; let lastY: number | null = null; let inText = false;
  const nl = () => { if (cur.trim()) lines.push(cur.replace(/\s+/g, ' ').trim()); cur = ''; };
  const arrText = (arr: string): string => { let o = ''; for (const m of arr.slice(1, -1).matchAll(/\((?:\\.|[^\\)])*\)|<[0-9A-Fa-f\s]*>|-?\d*\.?\d+/g)) { const t = m[0]; if (t[0] === '(') o += decodeLiteral(t.slice(1, -1)); else if (t[0] === '<') o += decodeHex(t.slice(1, -1)); else if (Number(t) < -250) o += ' '; } return o; };
  let stack: string[] = [];
  for (const m of content.matchAll(TOKEN)) {
    const tok = m[0];
    if (tok === 'BT') { inText = true; stack = []; continue; }
    if (tok === 'ET') { nl(); inText = false; stack = []; continue; }
    if (!inText) continue;
    switch (tok) {
      case 'Tj': { const a = stack[stack.length - 1]; if (a) cur += a[0] === '(' ? decodeLiteral(a.slice(1, -1)) : a[0] === '<' ? decodeHex(a.slice(1, -1)) : ''; stack = []; break; }
      case 'TJ': { const a = stack[stack.length - 1]; if (a && a[0] === '[') cur += arrText(a); stack = []; break; }
      case "'": case '"': { nl(); const a = stack[stack.length - 1]; if (a && a[0] === '(') cur += decodeLiteral(a.slice(1, -1)); stack = []; break; }
      case 'T*': nl(); stack = []; break;
      case 'Td': case 'TD': { const y = Number(stack[stack.length - 1]); if (y) nl(); stack = []; break; }
      case 'Tm': { const y = Number(stack[stack.length - 1]); if (lastY !== null && Math.abs(y - lastY) > 0.5) nl(); lastY = y; stack = []; break; }
      default: stack.push(tok); if (stack.length > 8) stack.shift();
    }
  }
  nl();
  return lines;
}

/** Il testo del PDF, una riga per riga di testo, nell'ordine del file. Stringa vuota se non si riesce a leggerlo. */
export function pdfToText(bytes: Uint8Array): string {
  try {
    if (latin1(bytes.subarray(0, 5)) !== '%PDF-') return '';
    return streamsOf(bytes).flatMap(textOf).join('\n');
  } catch { return ''; }
}
