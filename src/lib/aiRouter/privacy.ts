import { tx } from './tx.ts';
import type { TaskKind } from './types.ts';

/**
 * Privacy del contesto: cosa puo' uscire dal telefono verso un fornitore. Tutto locale.
 * Regole: minimo necessario per il compito; solo cio' che l'utente ha scelto di condividere con l'assistente AI (Cosa condivido);
 * i dati critici (carte, IBAN, CSV bancari, dati clinici, documenti fiscali e d'identita', conti e movimenti) NON escono mai.
 */

/** Cosa non esce MAI, qualunque sia la scelta. */
export const NEVER_SENT = ['carte e IBAN', 'conti e movimenti', 'dati clinici', 'documenti fiscali e d\'identità', 'posizione', 'contatti'] as const;

// --- redaction ---
export type RedactKind = 'carta' | 'iban' | 'email' | 'telefono' | 'indirizzo';
const TAG: Record<RedactKind, string> = { carta: '[CARTA]', iban: '[IBAN]', email: '[EMAIL]', telefono: '[TELEFONO]', indirizzo: '[INDIRIZZO]' };
export const REDACT_LABEL: Record<RedactKind, string> = { carta: 'numeri di carta', iban: 'IBAN', email: 'email', telefono: 'numeri di telefono', indirizzo: 'indirizzi' };

const luhn = (d: string): boolean => {
  let sum = 0, alt = false;
  for (let i = d.length - 1; i >= 0; i--) { let n = d.charCodeAt(i) - 48; if (alt) { n *= 2; if (n > 9) n -= 9; } sum += n; alt = !alt; }
  return sum % 10 === 0;
};
const DATE_LIKE = /^(\d{4}[-./]\d{1,2}[-./]\d{1,2}|\d{1,2}[-./]\d{1,2}[-./]\d{2,4})$/;

export type Redaction = { text: string; found: { kind: RedactKind; label: string; count: number }[]; total: number };

/** Sostituisce dati personali evidenti nel testo con segnaposto. Euristico: dichiarato come tale nell'interfaccia. */
export function redact(input: string, enabled = true): Redaction {
  const counts: Partial<Record<RedactKind, number>> = {};
  if (!enabled) return { text: input, found: [], total: 0 };
  const bump = (k: RedactKind) => { counts[k] = (counts[k] ?? 0) + 1; return TAG[k]; };
  let t = input;
  t = t.replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, () => bump('email'));
  t = t.replace(/\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){2,7}(?:[ ]?[A-Z0-9]{1,3})?\b/g, () => bump('iban'));
  t = t.replace(/\b(?:\d[ -]?){12,18}\d\b/g, (m) => {
    const d = m.replace(/\D/g, '');
    if (d.length >= 13 && d.length <= 19 && (luhn(d) || /^\d{4}([ -])\d{4}\1\d{4}\1\d{3,4}$/.test(m))) return bump('carta');
    return m;
  });
  t = t.replace(/\b(?:via|viale|piazza|corso|vicolo|largo|street|avenue|ave|road|rue|calle|avenida|strasse|straße|rua|jalan)\.?\s+[\p{L}'’. -]{2,40}?,?\s*\d{1,4}[a-zA-Z]?\b/giu, () => bump('indirizzo'));
  t = t.replace(/\b\p{Lu}\p{L}+\s+(?:street|avenue|road|strasse|straße)\s+\d{1,4}\b/gu, () => bump('indirizzo'));
  t = t.replace(/(?<![\w\d])\+?\d[\d ().-]{6,}\d(?![\w\d])/g, (m) => {
    const d = m.replace(/\D/g, '');
    if (d.length < 8 || d.length > 15 || DATE_LIKE.test(m.trim())) return m;
    return bump('telefono');
  });
  const found = (Object.keys(counts) as RedactKind[]).map((kind) => ({ kind, label: REDACT_LABEL[kind], count: counts[kind]! }));
  return { text: t, found, total: found.reduce((a, f) => a + f.count, 0) };
}

// --- contesto ---
export type ShareFlags = {
  /** "Memoria per l'assistente AI": task, note e obiettivi */
  memory: boolean;
  /** riassunto salute */
  health: boolean;
  /** riepilogo finanze (mai i movimenti) */
  finance: boolean;
};
export type AiData = { tasks?: string[]; goals?: string[]; notes?: string[]; health?: string; finance?: string };
export type ContextKey = 'lang' | 'style' | 'tasks' | 'goals' | 'notes' | 'health' | 'finance';
export type ContextItem = { key: ContextKey; label: string; value: string; sensitive: boolean; count: number };
export type ContextSettings = { lang: string; answerStyle: string; share: ShareFlags; data: AiData; redact?: boolean };
export type Context = { items: ContextItem[]; excluded: string[]; redactions: number };

/** Compiti che non ricevono NESSUN dato personale. */
const NO_CONTEXT: TaskKind[] = ['image_generate', 'image_edit', 'music_generate', 'speech_to_text', 'text_to_speech', 'translate', 'vision_read', 'web_search'];
const STYLE_KINDS: TaskKind[] = ['chat', 'reasoning', 'summarize', 'document_create', 'agent_task'];

const NEEDS: [ContextKey, RegExp][] = [
  ['tasks', /(cosa devo fare|i miei task|le mie attivit|to-?do|what should i do|my tasks|da fare oggi)/i],
  ['goals', /(obiettiv|goals?\b)/i],
  ['notes', /(le mie note|mie note|my notes|appunti)/i],
  ['health', /(sonno|dormit|passi|allenament|salute|sleep|steps|workout|health)/i],
  ['finance', /(spes[ae]|budget|soldi|risparmi|money|expenses|spending)/i],
];
export const contextNeeds = (text: string): ContextKey[] => NEEDS.filter(([, re]) => re.test(text)).map(([k]) => k);

const CAP = { items: 5, len: 80 };
const clip = (s: string) => (s.length > CAP.len ? s.slice(0, CAP.len - 1) + '…' : s);

/** Il minimo necessario per il compito, rispettando le scelte di condivisione. Nessun dato critico puo' entrare. */
export function buildContext(kind: TaskKind, text: string, s: ContextSettings): Context {
  const items: ContextItem[] = [];
  const excluded: string[] = [];
  let redactions = 0;
  const clean = (v: string) => { const r = redact(v, s.redact !== false); redactions += r.total; return r.text; };
  if (NO_CONTEXT.includes(kind)) return { items, excluded: [tx('tutti i dati personali (non servono a questo compito)')], redactions };
  items.push({ key: 'lang', label: tx('lingua'), value: s.lang, sensitive: false, count: 1 });
  if (STYLE_KINDS.includes(kind)) items.push({ key: 'style', label: tx('stile delle risposte'), value: s.answerStyle, sensitive: false, count: 1 });
  if (!STYLE_KINDS.includes(kind)) return { items, excluded, redactions };
  const want = contextNeeds(text);
  const list = (key: 'tasks' | 'goals' | 'notes', label: string, sensitive: boolean) => {
    if (!want.includes(key)) return;
    if (!s.share.memory) { excluded.push(label); return; }
    const arr = (s.data[key] ?? []).slice(0, CAP.items).map((x) => clean(clip(x)));
    if (arr.length) items.push({ key, label, value: arr.join('; '), sensitive, count: arr.length });
  };
  list('tasks', tx('task'), false);
  list('goals', tx('obiettivi'), false);
  list('notes', tx('note'), true);
  if (want.includes('health')) { if (s.share.health && s.data.health) items.push({ key: 'health', label: tx('riassunto salute'), value: clean(clip(s.data.health)), sensitive: true, count: 1 }); else excluded.push(tx('salute')); }
  if (want.includes('finance')) { if (s.share.finance && s.data.finance) items.push({ key: 'finance', label: tx('riepilogo finanze'), value: clean(clip(s.data.finance)), sensitive: true, count: 1 }); else excluded.push(tx('finanze')); }
  return { items, excluded, redactions };
}

// --- anteprima di cio' che esce ---
export type Outgoing = { providerShort: string; images: number; context: Context; redactions: Redaction['found'] };
export type OutgoingSummary = { headline: string; notSent: string; sensitive: boolean };

export function describeOutgoing(o: Outgoing): OutgoingSummary {
  const parts: string[] = [tx('il tuo testo')];
  if (o.images > 0) parts.push(o.images === 1 ? tx('1 immagine') : tx('{0} immagini', o.images));
  for (const it of o.context.items) {
    if (it.key === 'lang' || it.key === 'style') continue;
    parts.push(it.count === 1 ? it.label : `${it.count} ${it.label}`);
  }
  const head = parts.length === 1 ? parts[0] : parts.slice(0, -1).join(', ') + tx(' e ') + parts[parts.length - 1];
  const has = (k: ContextKey) => o.context.items.some((i) => i.key === k);
  const not: string[] = [];
  if (!has('finance')) not.push(tx('finanze'));
  if (!has('health')) not.push(tx('salute'));
  if (!has('notes')) not.push(tx('note'));
  if (!has('tasks')) not.push(tx('task'));
  if (!has('goals')) not.push(tx('obiettivi'));
  for (const n of NEVER_SENT) not.push(tx(n));
  const red = o.redactions.length ? ' ' + tx('Ho nascosto: {0}.', o.redactions.map((r) => `${r.count} ${r.label}`).join(', ')) : '';
  return {
    headline: tx('Sto per inviare a {0}: {1}.', o.providerShort, head) + red,
    notSent: tx('Non invio: {0}.', not.join(', ')),
    sensitive: o.images > 0 || o.context.items.some((i) => i.sensitive),
  };
}

// --- consenso ---
export type Consents = Record<string, { always: boolean; at: number }>;
export type ConsentCheck = { needed: boolean; why: string };

/** Serve chiedere: fornitore nuovo (nessun "sempre") oppure dati sensibili (immagini, salute, finanze, note), ogni volta. */
export function needsConsent(providerId: string, consents: Consents, sensitive: boolean): ConsentCheck {
  if (sensitive) return { needed: true, why: tx('Sono inclusi dati sensibili: te lo chiedo ogni volta.') };
  if (!consents[providerId]?.always) return { needed: true, why: tx('È la prima volta con questo fornitore.') };
  return { needed: false, why: '' };
}

// --- cronologia "Cosa e' stato inviato" ---
/** Mai il contenuto: solo tipo, fornitore, data e dimensione. */
export type SendLogEntry = { id: string; ts: number; kind: TaskKind; provider: string; bytes: number; parts: string[]; redacted: number };
export const SEND_LOG_MAX = 200;
export const appendSendLog = (log: SendLogEntry[], e: SendLogEntry): SendLogEntry[] => [e, ...log].slice(0, SEND_LOG_MAX);
export const byteLength = (s: string): number => { let n = 0; for (const ch of s) { const c = ch.codePointAt(0)!; n += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4; } return n; };
