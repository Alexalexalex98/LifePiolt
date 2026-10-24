/**
 * Il nostro server AI (un Cloudflare Worker che tiene la chiave di Gemini): l'app parla solo con lui.
 *   EXPO_PUBLIC_AI_URL    indirizzo del Worker, es. https://lifepilot-ai.tuoaccount.workers.dev
 *   EXPO_PUBLIC_AI_TOKEN  la parola d'ordine (APP_TOKEN del Worker)
 * Endpoint: POST /chat {message}, /vision {image, mime, prompt}, /analyze {files, question, context}, /translate {lang, texts}.
 * ATTENZIONE: tutto ciò che è EXPO_PUBLIC_ finisce dentro l'app. Il token va bene per le prove tue; per il pubblico serve un accesso per utente.
 */
import { File } from 'expo-file-system';
import { useAiServerCfg } from '@/store/aiServerCfg';
import * as ImageManipulator from 'expo-image-manipulator';
import { humanize } from './aiPersona';
import { bytesToBase64, readUriBytes } from './readUri';
import { useAccount } from '@/store/account';
import { getSupabase } from '@/sync/supabaseClient';
import { loadServerConfig } from '@/sync/secure';
/** Versione del collegamento al server AI: compare negli errori, cosi' si vede quale codice sta girando sul telefono. */
export const AI_BUILD = 'ai-v5';
/* Indirizzo e token: prima quelli inseriti nell'app (Impostazioni > Intelligenza di Theia), altrimenti quelli della build. I valori cambiano da soli quando li modifichi. */
/** Il server IA di LifePilot (modelli aperti, niente Google). L'indirizzo è pubblico; l'accesso è col tuo account. */
export const DEFAULT_AI_URL = 'https://lifepilot-ai2.alex-stefanovic1998.workers.dev';
const ENV_URL = process.env.EXPO_PUBLIC_AI_URL ?? DEFAULT_AI_URL;
const ENV_TOKEN = process.env.EXPO_PUBLIC_AI_TOKEN ?? '';
const OLD_SERVER = /lifepilot-api\./i;
let URL_BASE = '';
let TOKEN = '';
/** Indirizzo del server AI senza il token (per mostrarlo nelle impostazioni). */
export let aiServerHost = '';
export let aiServerConfigured = false;
function applyCfg() {
  const c = useAiServerCfg.getState();
  /* il vecchio server (lifepilot-api) non capisce piu' l'accesso con l'account: se e' rimasto salvato sul telefono si passa al nuovo */
  const old = OLD_SERVER.test(c.url) || OLD_SERVER.test(ENV_URL);
  URL_BASE = (old ? DEFAULT_AI_URL : (c.url || ENV_URL)).trim().replace(/\/+$/, '');
  TOKEN = old ? '' : (c.token || ENV_TOKEN).trim();
  aiServerHost = URL_BASE.replace(/^https?:\/\//, '');
  /* basta l'indirizzo: le chiavi stanno sul server. Con un account il server ti da' il tuo limite, senza ti da' quello degli ospiti */
  aiServerConfigured = Boolean(URL_BASE);
}
applyCfg();
useAiServerCfg.subscribe(applyCfg);
useAccount.subscribe(applyCfg);

/** Il tuo accesso su Supabase: il server IA verifica che sia vero e ti dà il tuo limite. Se non c'è, resta la parola d'ordine di prova. */
async function userToken(refresh = false): Promise<string> {
  try {
    const c = await loadServerConfig();
    const url = c.url || process.env.EXPO_PUBLIC_SUPABASE_URL || ''; const key = c.anonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
    if (!url || !key) return '';
    const auth = (getSupabase(url, key) as unknown as { auth: { getSession(): Promise<{ data: { session: { access_token?: string } | null } }>; refreshSession(): Promise<{ data: { session: { access_token?: string } | null } }> } }).auth;
    const { data } = refresh ? await auth.refreshSession() : await auth.getSession();
    return data.session?.access_token ?? '';
  } catch { return ''; }
}

/** Piano e messaggi "completi" rimasti oggi, come li ha detti il server nell'ultima risposta (finiti, Theia risponde in modo piu' breve). */
export let lastAiInfo: { plan: string; lite: boolean; left?: number; limit?: number } | null = null;

export class AiServerError extends Error {
  status: number;
  constructor(message: string, status = 0) { super(message); this.status = status; }
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const BUSY = /high demand|overloaded|unavailable|try again later|quota|rate/i;

async function call<T>(path: string, body: unknown, timeoutMs = 45000): Promise<T> {
  if (!aiServerConfigured) throw new AiServerError('Il server AI non è collegato: manca l\'indirizzo del server.');
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

type Reply = { ok: boolean; status: number; json: unknown };
/** Invio con XMLHttpRequest: non passa dal fetch di Expo (che in Expo Go puo' mancare di «ExpoFetchModule»). */
function postXhr(url: string, headers: Record<string, string>, body: string, signal: AbortSignal): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open('POST', url);
    for (const [k, v] of Object.entries(headers)) x.setRequestHeader(k, v);
    x.onload = () => { let json: unknown = {}; try { json = JSON.parse(x.responseText); } catch { /* risposta non JSON */ } resolve({ ok: x.status >= 200 && x.status < 300, status: x.status, json }); };
    x.onerror = () => reject(new Error('rete non raggiungibile'));
    x.ontimeout = () => reject(new Error('tempo scaduto'));
    signal.addEventListener('abort', () => { x.abort(); reject(new Error('tempo scaduto')); });
    x.send(body);
  });
}
async function post(url: string, body: string, signal: AbortSignal, refresh = false): Promise<{ r: Reply; via: string }> {
  /* l'accesso del tuo account va solo al nostro server: a un server scelto da te si manda solo la sua parola d'ordine */
  const ours = url.startsWith(DEFAULT_AI_URL);
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${(ours ? await userToken(refresh) : '') || TOKEN}` };
  try {
    const r = await fetch(url, { method: 'POST', headers, body, signal });
    return { r: { ok: r.ok, status: r.status, json: await r.json().catch(() => ({})) }, via: 'fetch' };
  } catch (e) {
    if (signal.aborted) throw e;
    return { r: await postXhr(url, headers, body, signal), via: 'xhr' };
  }
}

async function callOnce<T>(path: string, body: unknown, timeoutMs: number): Promise<T> {
  const ctl = new AbortController();
  const h = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    let { r } = await post(`${URL_BASE}${path}`, JSON.stringify(body), ctl.signal);
    /* l'accesso puo' essere scaduto: lo rinnovo e riprovo una volta */
    if (r.status === 401) ({ r } = await post(`${URL_BASE}${path}`, JSON.stringify(body), ctl.signal, true));
    const j = r.json as { error?: string; details?: { error?: { message?: string } }; plan?: string; lite?: boolean; left?: number; limit?: number };
    if (r.ok && j.plan) lastAiInfo = { plan: j.plan, lite: !!j.lite, left: j.left, limit: j.limit };
    if (!r.ok) {
      const why = j.details?.error?.message ?? j.error ?? `errore ${r.status}`;
      throw new AiServerError(r.status === 401 ? 'Il server AI non riconosce il tuo accesso: esci e accedi di nuovo dal tuo account. (' + aiServerHost + ')' : `Il server AI ha risposto: ${why}`, r.status);
    }
    return j as T;
  } catch (e) {
    if (e instanceof AiServerError) throw e;
    const why = e instanceof Error ? e.message : String(e);
    if (ctl.signal.aborted || /cancel|abort|tempo scaduto/i.test(why)) throw new AiServerError(`Il servizio AI ci mette troppo a rispondere (probabilmente è molto richiesto). Riprova tra poco. · ${AI_BUILD}`, 504);
    throw new AiServerError(`Non riesco a raggiungere il server AI. Controlla la connessione e l’indirizzo. (${why.slice(0, 120)}) · ${AI_BUILD}`);
  } finally { clearTimeout(h); }
}

/** Come aiChat ma senza togliere il grassetto e gli elenchi (la chat li mostra bene). */
export const aiChatRaw = async (message: string) => String((await call<{ reply: string }>('/chat', { message })).reply ?? '');
export const aiChat = async (message: string) => humanize((await call<{ reply: string }>('/chat', { message })).reply);
export const aiVision = async (image: string, mime: string, prompt: string) => humanize((await call<{ reply: string }>('/vision', { image, mime, prompt }, 90000)).reply);
export const aiAnalyze = (files: { data: string; mime: string }[], question?: string, context?: string) => call<{ reply: string; result: unknown }>('/analyze', { files, question, context }, 90000);
export const aiTranslate = async (lang: string, texts: string[]) => {
  const r = await call<{ reply: string }>('/translate', { lang, texts });
  try { const a = JSON.parse(r.reply) as unknown; return Array.isArray(a) ? a.map(String) : []; } catch { return []; }
};

/** Perche' l'ultima preparazione di un'immagine e' fallita (serve a capire il problema invece di un messaggio generico). */
let lastImageError = '';
/** Immagine pronta da inviare: ridotta (1280 px, JPEG) così parte e torna in fretta e sta nei limiti del server. Prova piu' strade. */
export async function imageForAi(uri: string, maxW = 1280, quality = 0.7): Promise<{ base64: string; mime: 'image/jpeg' } | null> {
  lastImageError = '';
  const note = (where: string, e: unknown) => { lastImageError += `${lastImageError ? ' · ' : ''}${where}: ${e instanceof Error ? e.message : String(e)}`.slice(0, 160); };
  const M = ImageManipulator;
  if (M?.manipulateAsync) {
    for (const actions of [[{ resize: { width: maxW } }], []]) {
      try {
        const r = await M.manipulateAsync(uri, actions, { compress: quality, format: M.SaveFormat.JPEG, base64: true });
        if (r.base64) return { base64: r.base64, mime: 'image/jpeg' };
      } catch (e) { note('manipolatore', e); }
    }
  }
  try {
    const b = await new File(uri).base64();
    if (b) return { base64: b, mime: 'image/jpeg' };
  } catch (e) { note('file', e); }
  try {
    return { base64: bytesToBase64(await readUriBytes(uri)), mime: 'image/jpeg' };
  } catch (e) { note('copia', e); }
  return null;
}

/** File pronti per il server: immagini ridotte, altri file (PDF) in base64. */
async function prepFiles(files: { uri: string; mime: string }[], maxW = 1280): Promise<{ data: string; mime: string }[]> {
  const ready: { data: string; mime: string }[] = [];
  for (const f of files) {
    if (f.mime.startsWith('image/')) {
      const img = await imageForAi(f.uri, maxW, maxW < 1280 ? 0.6 : 0.7);
      if (img) ready.push({ data: img.base64, mime: img.mime });
    } else {
      try {
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
export async function aiReadFilesFull(prompt: string, files: { uri: string; mime: string }[], timeoutMs = 45000, maxW = 1280): Promise<{ reply: string; result?: unknown }> {
  const ready = await prepFiles(files, maxW);
  if (ready.length === 1 && ready[0].mime.startsWith('image/')) return { reply: (await call<{ reply: string }>('/vision', { image: ready[0].data, mime: ready[0].mime, prompt }, timeoutMs)).reply };
  return aiAnalyze(ready, prompt);
}

export const aiReadFiles = async (prompt: string, files: { uri: string; mime: string }[], timeoutMs?: number, maxW?: number): Promise<string> => (await aiReadFilesFull(prompt, files, timeoutMs, maxW)).reply;

/** Un PDF letto in testo libero (niente schema fisso): serve quando la risposta e' un elenco o un JSON deciso da noi. */
export async function aiReadPdfFree(prompt: string, uri: string, timeoutMs = 90000): Promise<string> {
  const [f] = await prepFiles([{ uri, mime: 'application/pdf' }]);
  return (await call<{ reply: string }>('/vision', { image: f.data, mime: f.mime, prompt }, timeoutMs)).reply;
}

/** Prova il collegamento col server AI (nessun dato inviato): tempo di risposta o motivo dell'errore. */
export async function pingAiServer(): Promise<{ ok: boolean; ms: number; message: string }> {
  const t0 = Date.now();
  if (!aiServerConfigured) return { ok: false, ms: 0, message: 'Non collegato: in questa versione dell\'app mancano l\'indirizzo e il token del server AI (EXPO_PUBLIC_AI_URL ed EXPO_PUBLIC_AI_TOKEN).' };
  const ctl = new AbortController();
  const h = setTimeout(() => ctl.abort(), 15000);
  try {
    const r = await fetch(`${URL_BASE}/`, { signal: ctl.signal });
    const j = (await r.json().catch(() => ({}))) as { ok?: boolean };
    return { ok: r.ok && j.ok !== false, ms: Date.now() - t0, message: r.ok ? 'Il server risponde.' : `Il server ha risposto con errore ${r.status}.` };
  } catch (e) { return { ok: false, ms: Date.now() - t0, message: `Non raggiungo il server (${e instanceof Error ? e.message.slice(0, 100) : 'errore di rete'}).` }; }
  finally { clearTimeout(h); }
}
