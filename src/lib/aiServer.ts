/**
 * Il nostro server AI (un Cloudflare Worker che tiene la chiave di Gemini): l'app parla solo con lui.
 *   EXPO_PUBLIC_AI_URL    indirizzo del Worker, es. https://lifepilot-ai.tuoaccount.workers.dev
 *   EXPO_PUBLIC_AI_TOKEN  la parola d'ordine (APP_TOKEN del Worker)
 * Endpoint: POST /chat {message}, /vision {image, mime, prompt}, /analyze {files, question, context}, /translate {lang, texts}.
 * ATTENZIONE: tutto ciò che è EXPO_PUBLIC_ finisce dentro l'app. Il token va bene per le prove tue; per il pubblico serve un accesso per utente.
 */
const URL_BASE = (process.env.EXPO_PUBLIC_AI_URL ?? '').replace(/\/+$/, '');
const TOKEN = process.env.EXPO_PUBLIC_AI_TOKEN ?? '';
import { humanize } from './aiPersona';
export const aiServerConfigured = Boolean(URL_BASE && TOKEN);

export class AiServerError extends Error {
  status: number;
  constructor(message: string, status = 0) { super(message); this.status = status; }
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const BUSY = /high demand|overloaded|unavailable|try again later|quota|rate/i;

async function call<T>(path: string, body: unknown, timeoutMs = 45000): Promise<T> {
  if (!aiServerConfigured) throw new AiServerError('Il server AI non è collegato (mancano EXPO_PUBLIC_AI_URL ed EXPO_PUBLIC_AI_TOKEN).');
  /* il servizio AI è a volte sovraccarico (503/429): si riprova due volte con una pausa, poi si spiega in italiano */
  for (let attempt = 0; ; attempt++) {
    try { return await callOnce<T>(path, body, timeoutMs); }
    catch (e) {
      const busy = e instanceof AiServerError && (e.status === 503 || e.status === 429 || e.status === 500 || e.status === 502 || BUSY.test(e.message));
      if (!busy || attempt >= 2) {
        if (busy) throw new AiServerError('Il servizio AI è molto richiesto in questo momento. Ho riprovato più volte: riprova tra qualche minuto, oppure scegli tu gli alimenti qui sotto.', 503);
        throw e;
      }
      await wait(attempt === 0 ? 2500 : 6000);
    }
  }
}

async function callOnce<T>(path: string, body: unknown, timeoutMs: number): Promise<T> {
  const ctl = new AbortController();
  const h = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(`${URL_BASE}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` }, body: JSON.stringify(body), signal: ctl.signal });
    const j = (await r.json().catch(() => ({}))) as { error?: string; details?: { error?: { message?: string } } };
    if (!r.ok) {
      const why = j.details?.error?.message ?? j.error ?? `errore ${r.status}`;
      throw new AiServerError(r.status === 401 ? 'Il token dell’app non è quello del server (non autorizzato).' : `Il server AI ha risposto: ${why}`, r.status);
    }
    return j as T;
  } catch (e) {
    if (e instanceof AiServerError) throw e;
    throw new AiServerError('Non riesco a raggiungere il server AI. Controlla la connessione e l’indirizzo.');
  } finally { clearTimeout(h); }
}

export const aiChat = async (message: string) => humanize((await call<{ reply: string }>('/chat', { message })).reply);
export const aiVision = async (image: string, mime: string, prompt: string) => humanize((await call<{ reply: string }>('/vision', { image, mime, prompt })).reply);
export const aiAnalyze = (files: { data: string; mime: string }[], question?: string, context?: string) => call<{ reply: string; result: unknown }>('/analyze', { files, question, context }, 90000);
export const aiTranslate = async (lang: string, texts: string[]) => {
  const r = await call<{ reply: string }>('/translate', { lang, texts });
  try { const a = JSON.parse(r.reply) as unknown; return Array.isArray(a) ? a.map(String) : []; } catch { return []; }
};

/** Perche' l'ultima preparazione di un'immagine e' fallita (serve a capire il problema invece di un messaggio generico). */
let lastImageError = '';
/** Immagine pronta da inviare: ridotta (1280 px, JPEG) così parte e torna in fretta e sta nei limiti del server. Prova piu' strade. */
export async function imageForAi(uri: string): Promise<{ base64: string; mime: 'image/jpeg' } | null> {
  lastImageError = '';
  const note = (where: string, e: unknown) => { lastImageError += `${lastImageError ? ' · ' : ''}${where}: ${e instanceof Error ? e.message : String(e)}`.slice(0, 160); };
  let M: typeof import('expo-image-manipulator') | null = null;
  try { M = await import('expo-image-manipulator'); } catch (e) { note('manipolatore', e); }
  if (M) {
    for (const actions of [[{ resize: { width: 1280 } }], []]) {
      try {
        const r = await M.manipulateAsync(uri, actions, { compress: 0.7, format: M.SaveFormat.JPEG, base64: true });
        if (r.base64) return { base64: r.base64, mime: 'image/jpeg' };
      } catch (e) { note('manipolatore', e); }
    }
  }
  try {
    const { File } = await import('expo-file-system');
    const b = await new File(uri).base64();
    if (b) return { base64: b, mime: 'image/jpeg' };
  } catch (e) { note('file', e); }
  try {
    const { readUriBytes, bytesToBase64 } = await import('./readUri');
    return { base64: bytesToBase64(await readUriBytes(uri)), mime: 'image/jpeg' };
  } catch (e) { note('copia', e); }
  return null;
}

/** File pronti per il server: immagini ridotte, altri file (PDF) in base64. */
async function prepFiles(files: { uri: string; mime: string }[]): Promise<{ data: string; mime: string }[]> {
  const ready: { data: string; mime: string }[] = [];
  for (const f of files) {
    if (f.mime.startsWith('image/')) {
      const img = await imageForAi(f.uri);
      if (img) ready.push({ data: img.base64, mime: img.mime });
    } else {
      try {
        const { File } = await import('expo-file-system');
        ready.push({ data: await new File(f.uri).base64(), mime: f.mime });
      } catch { /* file non leggibile: si prosegue con gli altri */ }
    }
  }
  if (!ready.length) throw new AiServerError(`Non riesco a leggere il file: provane un altro.${lastImageError ? ` (${lastImageError})` : ''}`);
  return ready;
}

/**
 * Legge immagini (anche piu' d'una) o un PDF con il server AI. Una sola immagine va su /vision (testo libero),
 * il resto su /analyze (risposta strutturata in `result`, con `reply` in JSON). Il testo e' grezzo (senza humanize).
 */
export async function aiReadFilesFull(prompt: string, files: { uri: string; mime: string }[], timeoutMs = 45000): Promise<{ reply: string; result?: unknown }> {
  const ready = await prepFiles(files);
  if (ready.length === 1 && ready[0].mime.startsWith('image/')) return { reply: (await call<{ reply: string }>('/vision', { image: ready[0].data, mime: ready[0].mime, prompt }, timeoutMs)).reply };
  return aiAnalyze(ready, prompt);
}

export const aiReadFiles = async (prompt: string, files: { uri: string; mime: string }[], timeoutMs?: number): Promise<string> => (await aiReadFilesFull(prompt, files, timeoutMs)).reply;

/** Un PDF letto in testo libero (niente schema fisso): serve quando la risposta e' un elenco o un JSON deciso da noi. */
export async function aiReadPdfFree(prompt: string, uri: string, timeoutMs = 90000): Promise<string> {
  const [f] = await prepFiles([{ uri, mime: 'application/pdf' }]);
  return (await call<{ reply: string }>('/vision', { image: f.data, mime: f.mime, prompt }, timeoutMs)).reply;
}
