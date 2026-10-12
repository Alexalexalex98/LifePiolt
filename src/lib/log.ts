/**
 * Log locale dell'app: ring buffer in memoria + persistenza limitata (file, tramite un adattatore) + redazione automatica
 * dei dati sensibili. Modulo PURO (niente react-native, niente alias '@/'): testabile con node.
 *
 *  - livelli debug < info < warn < error, categorie libere ('domain', 'notify', 'background', 'app'...);
 *  - ogni messaggio e ogni dato allegato passa da redact() (email, IBAN, carte, telefoni, indirizzi: aiRouter/privacy.ts)
 *    e da scrubExtra() (percorsi utente, token lunghi): nel log non finiscono dati personali;
 *  - memoria: ultime MEM_MAX voci; su disco: ultime DISK_MAX voci di livello >= info, scritte al massimo ogni SAVE_MS.
 */
import { redact } from './aiRouter/privacy.ts';

export type Level = 'debug' | 'info' | 'warn' | 'error';
export const LEVELS: Level[] = ['debug', 'info', 'warn', 'error'];
const RANK: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 };
export type LogEntry = { id: number; ts: number; level: Level; cat: string; msg: string; data?: string };
export type LogStorage = { load: () => Promise<string | null>; save: (text: string) => Promise<void> };

export const MEM_MAX = 500;
export const DISK_MAX = 300;
export const SAVE_MS = 3000;
const MSG_MAX = 400;
const DATA_MAX = 800;

/** Toglie percorsi utente, token lunghi e URL con parametri. */
export function scrubExtra(s: string): string {
  return s
    .replace(/(\/Users|\/home|\/data\/user\/\d+|C:\\Users)[/\\][^\s/\\:)]+/g, '$1/[utente]')
    .replace(/(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi, '$1 [TOKEN]')
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, '[TOKEN]')
    .replace(/(https?:\/\/[^\s?#]+)\?[^\s#]*/g, '$1?[...]');
}
/** Redazione completa di un testo per il log e per l'esportazione. */
export function sanitize(s: string): string { return scrubExtra(redact(String(s ?? '')).text); }

export function errToString(e: unknown): string {
  if (e instanceof Error) return `${e.name}: ${e.message}`;
  if (typeof e === 'string') return e;
  try { return JSON.stringify(e) ?? String(e); } catch { return String(e); }
}

let entries: LogEntry[] = [];
let nextId = 1;
let minLevel: Level = 'debug';
let storage: LogStorage | null = null;
let loaded = false;
let dirty = false;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();
let version = 0;

const notify = () => { version++; listeners.forEach((l) => { try { l(); } catch { /* ignore */ } }); };
export const subscribeLog = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
export const logVersion = () => version;

export function setMinLevel(l: Level) { minLevel = l; }

export function add(level: Level, cat: string, msg: unknown, data?: unknown): LogEntry | null {
  if (RANK[level] < RANK[minLevel]) return null;
  let d: string | undefined;
  if (data !== undefined) d = sanitize(typeof data === 'string' ? data : errToString(data)).slice(0, DATA_MAX);
  const e: LogEntry = { id: nextId++, ts: Date.now(), level, cat: String(cat || 'app').slice(0, 24), msg: sanitize(typeof msg === 'string' ? msg : errToString(msg)).slice(0, MSG_MAX), ...(d ? { data: d } : {}) };
  entries.push(e);
  if (entries.length > MEM_MAX) entries = entries.slice(entries.length - MEM_MAX);
  if (RANK[level] >= RANK.info) schedule();
  notify();
  return e;
}

export const log = {
  debug: (cat: string, msg: unknown, data?: unknown) => add('debug', cat, msg, data),
  info: (cat: string, msg: unknown, data?: unknown) => add('info', cat, msg, data),
  warn: (cat: string, msg: unknown, data?: unknown) => add('warn', cat, msg, data),
  error: (cat: string, msg: unknown, data?: unknown) => add('error', cat, msg, data),
};

export type LogFilter = { level?: Level; cat?: string; text?: string; limit?: number };
/** Voci filtrate, dalla piu' recente. `level` = livello minimo. */
export function getEntries(f: LogFilter = {}): LogEntry[] {
  const q = f.text?.trim().toLowerCase();
  const out: LogEntry[] = [];
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i];
    if (f.level && RANK[e.level] < RANK[f.level]) continue;
    if (f.cat && e.cat !== f.cat) continue;
    if (q && !(`${e.cat} ${e.msg} ${e.data ?? ''}`.toLowerCase().includes(q))) continue;
    out.push(e);
    if (f.limit && out.length >= f.limit) break;
  }
  return out;
}
export const categories = () => [...new Set(entries.map((e) => e.cat))].sort();
export const counts = (): Record<Level, number> => {
  const c: Record<Level, number> = { debug: 0, info: 0, warn: 0, error: 0 };
  for (const e of entries) c[e.level]++;
  return c;
};

// --------------------------------------------------------------- persistenza

export function setStorage(s: LogStorage | null) { storage = s; loaded = false; }

function schedule() {
  if (!storage) return;
  dirty = true;
  if (timer) return;
  timer = setTimeout(() => { timer = null; void flush(); }, SAVE_MS);
}

export const serialize = (list: LogEntry[]) => JSON.stringify(list.filter((e) => RANK[e.level] >= RANK.info).slice(-DISK_MAX));

/** Scrive subito su disco (se c'e' un adattatore). Non lancia. */
export async function flush(): Promise<void> {
  if (!storage || !dirty) return;
  dirty = false;
  try { await storage.save(serialize(entries)); } catch { dirty = true; }
}

/** Carica il log del precedente avvio (una volta). Le voci salvate vanno prima di quelle di questa sessione. */
export async function loadPersisted(): Promise<number> {
  if (!storage || loaded) return 0;
  loaded = true;
  try {
    const raw = await storage.load();
    const saved = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(saved)) return 0;
    const ok: LogEntry[] = saved
      .filter((e) => e && typeof e.msg === 'string' && typeof e.ts === 'number' && e.level in RANK)
      .map((e) => ({ id: 0, ts: e.ts, level: e.level as Level, cat: String(e.cat ?? 'app'), msg: sanitize(e.msg), ...(typeof e.data === 'string' ? { data: sanitize(e.data) } : {}) }));
    const merged = [...ok, ...entries].sort((a, b) => a.ts - b.ts).slice(-MEM_MAX);
    merged.forEach((e) => { e.id = nextId++; });
    entries = merged;
    notify();
    return ok.length;
  } catch { return 0; }
}

export function clearLog() {
  entries = [];
  dirty = true;
  if (storage) { dirty = false; void storage.save('[]').catch(() => undefined); }
  notify();
}

/** Solo per i test. */
export function resetLog() { entries = []; nextId = 1; minLevel = 'debug'; storage = null; loaded = false; dirty = false; if (timer) { clearTimeout(timer); timer = null; } listeners.clear(); version = 0; }

export const fmtEntry = (e: LogEntry) => `${new Date(e.ts).toISOString()} ${e.level.toUpperCase().padEnd(5)} [${e.cat}] ${e.msg}${e.data ? ' | ' + e.data : ''}`;
export function formatLog(list: LogEntry[] = getEntries({ limit: 200 }).reverse()): string { return list.map(fmtEntry).join('\n'); }
