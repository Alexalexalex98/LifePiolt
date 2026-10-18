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

async function call<T>(path: string, body: unknown, timeoutMs = 45000): Promise<T> {
  if (!aiServerConfigured) throw new AiServerError('Il server AI non è collegato (mancano EXPO_PUBLIC_AI_URL ed EXPO_PUBLIC_AI_TOKEN).');
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

/** Immagine pronta da inviare: ridotta (1280 px, JPEG) così parte e torna in fretta e sta nei limiti del server. */
export async function imageForAi(uri: string): Promise<{ base64: string; mime: 'image/jpeg' } | null> {
  try {
    const { manipulateAsync, SaveFormat } = await import('expo-image-manipulator');
    const r = await manipulateAsync(uri, [{ resize: { width: 1280 } }], { compress: 0.7, format: SaveFormat.JPEG, base64: true });
    return r.base64 ? { base64: r.base64, mime: 'image/jpeg' } : null;
  } catch { return null; }
}
