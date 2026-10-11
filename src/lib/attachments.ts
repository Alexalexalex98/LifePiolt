/**
 * Allegati di Theia (come in Claude): tipi, limiti, classificazione e rilevamento bollette. Logica PURA (nessun import dall'app).
 * Niente upload: gli allegati restano nella memoria dell'app. Il testo si legge in locale solo per i formati banali (txt, csv, md, tsv).
 */

export type AttKind = 'image' | 'document' | 'text' | 'location' | 'contact' | 'note' | 'event';
export type DocType = 'pdf' | 'docx' | 'xlsx' | 'csv' | 'txt' | 'md' | 'pptx' | 'zip' | 'other';

export type Att = {
  id: string;
  kind: AttKind;
  /** titolo mostrato nel chip */
  name: string;
  uri?: string;
  mime?: string;
  size?: number;
  width?: number;
  height?: number;
  docType?: DocType;
  /** testo letto in locale o incollato/di una nota (già troncato) */
  text?: string;
  truncated?: boolean;
  /** riga secondaria: telefono, indirizzo, orario... */
  sub?: string;
  lat?: number;
  lng?: number;
  /** sembra una bolletta o una fattura */
  billish?: boolean;
};

export const MAX_ATTACHMENTS = 6;
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_TEXT_CHARS = 8000;

/** Tipi che il selettore di file accetta: documenti sensati, non qualunque cosa. */
export const DOC_PICKER_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain', 'text/csv', 'text/markdown', 'text/tab-separated-values', 'application/zip',
];

export const extOf = (name: string): string => (/\.([a-z0-9]{1,6})$/i.exec(name.trim())?.[1] ?? '').toLowerCase();

export function docTypeOf(name: string, mime?: string): DocType {
  const e = extOf(name), m = (mime ?? '').toLowerCase();
  if (e === 'pdf' || m === 'application/pdf') return 'pdf';
  if (e === 'doc' || e === 'docx' || m.includes('wordprocessingml') || m === 'application/msword') return 'docx';
  if (e === 'xls' || e === 'xlsx' || m.includes('spreadsheetml') || m === 'application/vnd.ms-excel') return 'xlsx';
  if (e === 'ppt' || e === 'pptx' || m.includes('presentationml') || m === 'application/vnd.ms-powerpoint') return 'pptx';
  if (e === 'csv' || e === 'tsv' || m === 'text/csv' || m === 'text/tab-separated-values') return 'csv';
  if (e === 'md' || e === 'markdown' || m === 'text/markdown') return 'md';
  if (e === 'txt' || m === 'text/plain') return 'txt';
  if (e === 'zip' || m === 'application/zip' || m === 'application/x-zip-compressed') return 'zip';
  return 'other';
}

export const DOC_LABEL: Record<DocType, string> = { pdf: 'PDF', docx: 'Word', xlsx: 'Excel', csv: 'CSV', txt: 'Testo', md: 'Testo', pptx: 'PowerPoint', zip: 'ZIP', other: 'File' };

export type FileClass = 'image' | 'video' | 'document' | 'unsupported';

/** Foto/video dalla galleria o documento: tutto il resto (eseguibili, APK...) non si allega. */
export function classifyFile(name: string, mime?: string): FileClass {
  const m = (mime ?? '').toLowerCase(), e = extOf(name);
  if (m.startsWith('image/') || ['jpg', 'jpeg', 'png', 'heic', 'heif', 'webp', 'gif'].includes(e)) return 'image';
  if (m.startsWith('video/') || ['mp4', 'mov', 'm4v', 'webm'].includes(e)) return 'video';
  if (['apk', 'exe', 'bat', 'sh', 'msi', 'dmg', 'jar', 'dll'].includes(e)) return 'unsupported';
  return docTypeOf(name, mime) === 'other' && !m.startsWith('text/') ? 'unsupported' : 'document';
}

/** Si può leggere il contenuto in locale senza inventare nulla (testo semplice)? */
export const canExtractLocally = (name: string, mime?: string) => {
  const t = docTypeOf(name, mime);
  return t === 'txt' || t === 'csv' || t === 'md';
};

export function truncateText(text: string, max = MAX_TEXT_CHARS): { text: string; truncated: boolean } {
  const clean = (text ?? '').replace(/\u0000/g, '').replace(/\r\n?/g, '\n');
  if (clean.length <= max) return { text: clean, truncated: false };
  return { text: clean.slice(0, max).trimEnd(), truncated: true };
}

export function fmtBytes(b?: number): string {
  if (b == null || !Number.isFinite(b) || b < 0) return '';
  if (b >= 1048576) return `${(b / 1048576).toFixed(b >= 10485760 ? 0 : 1)} MB`;
  return `${Math.max(1, Math.round(b / 1024))} kB`;
}

/* ---------- limiti ---------- */

export type Reject = { name: string; reason: 'too_big' | 'limit' | 'unsupported' | 'empty'; message: string };

/** Quanti allegati si possono ancora aggiungere. */
export const roomFor = (current: number, max = MAX_ATTACHMENTS) => Math.max(0, max - current);

/**
 * Filtra i file in arrivo secondo i limiti (max 6 allegati, 20 MB ciascuno, solo tipi sensati).
 * I messaggi sono in italiano: l'interfaccia li traduce.
 */
export function admit<T extends { name: string; size?: number; mime?: string }>(current: number, incoming: T[], opts?: { max?: number; maxBytes?: number; skipClassify?: boolean }): { ok: T[]; rejected: Reject[] } {
  const max = opts?.max ?? MAX_ATTACHMENTS, maxBytes = opts?.maxBytes ?? MAX_FILE_BYTES;
  const ok: T[] = [], rejected: Reject[] = [];
  for (const f of incoming) {
    if (!opts?.skipClassify && classifyFile(f.name, f.mime) === 'unsupported') { rejected.push({ name: f.name, reason: 'unsupported', message: `«${f.name}»: questo tipo di file non si può allegare.` }); continue; }
    if (f.size != null && f.size === 0) { rejected.push({ name: f.name, reason: 'empty', message: `«${f.name}» è vuoto.` }); continue; }
    if (f.size != null && f.size > maxBytes) { rejected.push({ name: f.name, reason: 'too_big', message: `«${f.name}» pesa ${fmtBytes(f.size)}: il massimo è ${fmtBytes(maxBytes)}.` }); continue; }
    if (current + ok.length >= max) { rejected.push({ name: f.name, reason: 'limit', message: `Puoi allegare al massimo ${max} elementi.` }); continue; }
    ok.push(f);
  }
  return { ok, rejected };
}

/** Un solo messaggio riassuntivo per i rifiuti (senza ripetere il limite). */
export function rejectSummary(rej: Reject[]): string {
  if (!rej.length) return '';
  const seen = new Set<string>();
  return rej.filter((r) => (seen.has(r.message) ? false : (seen.add(r.message), true))).slice(0, 2).map((r) => r.message).join(' ');
}

/* ---------- bollette e fatture ---------- */

const BILL_WORDS = ['fattura', 'bolletta', 'scadenza', 'importo', 'iban', 'avviso', 'pagamento', 'invoice', 'bill', 'rechnung', 'facture', 'factura', 'utenza', 'canone', 'totale da pagare', 'amount due', 'due date'];

/** Nome file o testo con parole da bolletta/fattura. Almeno una nel nome, o due diverse nel testo, per non scattare a caso. */
export function looksLikeBill(name: string, text?: string): boolean {
  const n = (name ?? '').toLowerCase().replace(/[_\-.]+/g, ' ');
  if (BILL_WORDS.some((w) => new RegExp(`(^|\\s)${w}`).test(n))) return true;
  const t = (text ?? '').toLowerCase();
  if (!t) return false;
  const found = new Set(BILL_WORDS.filter((w) => t.includes(w)));
  return found.size >= 2;
}

/* ---------- testo per l'assistente ---------- */

/** Riga che descrive un allegato (per il messaggio dell'utente e per il router). Testo sorgente in italiano. */
export function describeAttachment(a: Att): string {
  switch (a.kind) {
    case 'image': return `Immagine ${a.name}`;
    case 'document': return `Documento ${a.name}${a.size ? ` (${fmtBytes(a.size)})` : ''}`;
    case 'text': return `Testo «${a.name}»`;
    case 'location': return `Posizione ${a.name}`;
    case 'contact': return `Contatto ${a.name}${a.sub ? `, ${a.sub}` : ''}`;
    case 'note': return `Nota «${a.name}»`;
    case 'event': return `Impegno ${a.name}${a.sub ? `, ${a.sub}` : ''}`;
  }
}

/** Contenuto testuale utile da passare al router (nota, testo incollato, file di testo letto in locale). */
export function textPayload(atts: Att[]): string {
  return atts.filter((a) => a.text).map((a) => `--- ${a.name} ---\n${a.text}${a.truncated ? '\n[...]' : ''}`).join('\n\n');
}

/** Allegati che il telefono non sa leggere da solo (PDF, Word, Excel, immagini): richiedono il servizio di analisi, oggi non collegato. */
export const needsAnalysis = (a: Att) => a.kind === 'image' || (a.kind === 'document' && !a.text);

/** Titolo breve per un testo incollato. */
export function titleFromText(text: string, max = 36): string {
  const first = (text ?? '').split('\n').map((l) => l.trim()).find(Boolean) ?? 'Testo';
  return first.length > max ? `${first.slice(0, max - 1).trimEnd()}…` : first;
}
