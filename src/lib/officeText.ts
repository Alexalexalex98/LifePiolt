import { strFromU8, unzipSync } from 'fflate';

/**
 * Legge il testo di file Office moderni (xlsx, pptx, docx) in locale, senza mandare il file da nessuna parte (modulo PURO: si prova con node:test).
 * Sono archivi ZIP di XML. I formati vecchi (xls, ppt, doc) non si leggono: restituisce null.
 */
const xmlText = (s: string) => s.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const attr = (tag: string, name: string) => new RegExp(`${name}="([^"]*)"`).exec(tag)?.[1];
const num = (a: string, b: string) => (parseInt(a.replace(/\D/g, ''), 10) || 0) - (parseInt(b.replace(/\D/g, ''), 10) || 0);

function colIndex(ref: string): number {
  const letters = /^[A-Z]+/.exec(ref)?.[0] ?? 'A';
  let n = 0; for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

export const MAX_ROWS = 300;
export const MAX_COLS = 40;

export function xlsxText(files: Record<string, Uint8Array>): string {
  const get = (p: string) => (files[p] ? strFromU8(files[p]!) : '');
  const shared = [...get('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => xmlText(m[1]!));
  const names = [...get('xl/workbook.xml').matchAll(/<sheet\b[^>]*>/g)].map((m) => attr(m[0], 'name') ?? '');
  const sheets = Object.keys(files).filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k)).sort(num);
  const out: string[] = [];
  sheets.forEach((p, si) => {
    const rows: string[][] = [];
    for (const rm of get(p).matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
      if (rows.length >= MAX_ROWS) break;
      const cells: string[] = [];
      for (const cm of rm[1]!.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const ref = attr(cm[1]!, 'r') ?? ''; const type = attr(cm[1]!, 't');
        const body = cm[2] ?? '';
        let v = '';
        if (type === 's') v = shared[Number(/<v>(\d+)<\/v>/.exec(body)?.[1])] ?? '';
        else if (type === 'inlineStr') v = xmlText(/<is>([\s\S]*?)<\/is>/.exec(body)?.[1] ?? '');
        else v = xmlText(/<v>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? '');
        const ci = Math.min(colIndex(ref), MAX_COLS - 1);
        cells[ci] = v;
      }
      if (cells.some((c) => c)) rows.push(Array.from(cells, (c) => c ?? ''));
    }
    if (rows.length) out.push(`## ${names[si] || `Foglio ${si + 1}`}\n${rows.map((r) => r.join(' | ')).join('\n')}`);
  });
  return out.join('\n\n');
}

export function pptxText(files: Record<string, Uint8Array>): string {
  const slides = Object.keys(files).filter((k) => /^ppt\/slides\/slide\d+\.xml$/.test(k)).sort(num);
  const notes = (n: string) => { const f = files[`ppt/notesSlides/notesSlide${n}.xml`]; return f ? [...strFromU8(f).matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((m) => xmlText(m[1]!)).join(' ').trim() : ''; };
  return slides.map((p, i) => {
    const paras = [...strFromU8(files[p]!).matchAll(/<a:p>([\s\S]*?)<\/a:p>/g)].map((m) => [...m[1]!.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((t) => xmlText(t[1]!)).join('')).filter((x) => x.trim());
    const n = /slide(\d+)\.xml/.exec(p)?.[1] ?? String(i + 1);
    const nt = notes(n);
    return `## Diapositiva ${i + 1}\n${paras.join('\n')}${nt ? `\n(Note: ${nt})` : ''}`;
  }).join('\n\n');
}

export function docxText(files: Record<string, Uint8Array>): string {
  const doc = files['word/document.xml']; if (!doc) return '';
  return [...strFromU8(doc).matchAll(/<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g)].map((m) => [...m[1]!.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)].map((t) => xmlText(t[1]!)).join('')).filter((x) => x.trim()).join('\n');
}

export function officeText(bytes: Uint8Array, kind: 'xlsx' | 'pptx' | 'docx'): string | null {
  let files: Record<string, Uint8Array>;
  try { files = unzipSync(bytes); } catch { return null; }
  const t = kind === 'xlsx' ? xlsxText(files) : kind === 'pptx' ? pptxText(files) : docxText(files);
  return t.trim() ? t : null;
}
