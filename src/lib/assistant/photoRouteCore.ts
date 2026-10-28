/** Smistamento delle foto mandate a Theia (modulo PURO e testabile): a cosa serve la foto, se si sta già parlando di quell'argomento, quale vista del corpo è. */
import type { BodySlot } from '../fitness/bodyCheck.ts';

export type PhotoKind = 'corpo' | 'frigo' | 'piatto' | 'scontrino' | 'altro';
export type PhotoGuess = { kind: PhotoKind; view?: BodySlot };

const KINDS: PhotoKind[] = ['corpo', 'frigo', 'piatto', 'scontrino', 'altro'];
const VIEW: [RegExp, BodySlot][] = [[/front|davant|fronte|petto/, 'front'], [/back|dietro|schiena|retro/, 'back'], [/sinist|left|\bsx\b/, 'left'], [/destr|right|\bdx\b/, 'right']];

export const classifyPrompt = (n: number): string =>
  `Ti mando ${n} foto in ordine. Per ognuna dimmi cosa e': "corpo" (una persona vista per intero o a meta' per controllare la forma fisica, in abiti sportivi o aderenti), "frigo" (interno di un frigo o di una dispensa con alimenti), "piatto" (un piatto o un pasto pronto da mangiare), "scontrino" (uno scontrino o una ricevuta della spesa), "altro" (qualsiasi altra cosa: documenti, bollette, paesaggi, selfie, screenshot). Per le foto del corpo indica anche la vista: "fronte", "retro", "sinistra" o "destra". Rispondi SOLO con JSON compatto, niente altro testo: {"f":[{"t":"corpo","v":"fronte"},{"t":"frigo"}]} con un elemento per foto, nello stesso ordine. Nel dubbio scrivi "altro".`;

/** Legge la risposta: sempre n elementi, "altro" per ciò che non e' chiaro. */
export function parseClassify(reply: string, n: number): PhotoGuess[] {
  const out: PhotoGuess[] = Array.from({ length: n }, () => ({ kind: 'altro' as PhotoKind }));
  const m = /\{[\s\S]*\}/.exec(reply ?? ''); if (!m) return out;
  try {
    const o = JSON.parse(m[0]) as { f?: unknown; foto?: unknown };
    const list = (Array.isArray(o.f) ? o.f : Array.isArray(o.foto) ? o.foto : []) as { t?: unknown; v?: unknown; tipo?: unknown; vista?: unknown }[];
    list.slice(0, n).forEach((x, i) => {
      const k = String(x?.t ?? x?.tipo ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      const kind = KINDS.find((y) => k.startsWith(y)) ?? 'altro';
      const v = String(x?.v ?? x?.vista ?? '').toLowerCase();
      const view = kind === 'corpo' ? VIEW.find(([re]) => re.test(v))?.[1] : undefined;
      out[i] = { kind, ...(view ? { view } : {}) };
    });
  } catch { /* risposta non leggibile: tutto "altro" */ }
  return out;
}

const TOPICS: [PhotoKind, RegExp][] = [
  ['corpo', /\b(foto del corpo|controllo del corpo|forma fisica|composizione corporea|massa grassa|postura|il mio fisico|davanti dietro|dimagrit\w*|addominali|gonfiore|mi vedo|come sto fisicamente)\b/i],
  ['frigo', /\b(frigo|dispensa|cosa ho in casa|cosa posso cucinare|ricetta|ricette|svuota frigo|cosa cucino)\b/i],
  ['scontrino', /\b(scontrino|scontrini|ricevuta della spesa|ho fatto la spesa|la spesa di oggi)\b/i],
  ['piatto', /\b(piatto|pranzo|cena|colazione|ho mangiato|sto mangiando|calorie del|quante calorie|pasto|merenda)\b/i],
];
/** Di cosa si sta parlando (testo della foto e ultimi messaggi): se c'e' un argomento chiaro, la foto va nel discorso e non si sposta da sola. */
export function topicFromTalk(texts: string[]): PhotoKind | null {
  const hay = texts.filter(Boolean).slice(-6).join(' \n ');
  for (const [k, re] of TOPICS) if (re.test(hay)) return k;
  return null;
}

/** Una didascalia generica («ecco», «guarda», «analizza») o vuota: la foto parla da sola. Una domanda vera (con «?» o tante parole) no. */
export function genericCaption(text: string): boolean {
  const s = text.trim().toLowerCase();
  if (!s) return true;
  if (s.includes('?')) return false;
  if (s.split(/\s+/).length > 6) return false;
  return /^(ecco|guarda|guardala|guardale|queste|questa|questo|ti mando|ti invio|analizza|analizzala|analizzale|foto|ciao|eccole|eccola|vedi|controlla)\b/.test(s) || s.split(/\s+/).length <= 2;
}

const ORDER: BodySlot[] = ['front', 'back', 'left', 'right'];
/** Assegna le foto del corpo alle viste libere: prima quelle riconosciute, poi le altre in ordine davanti, dietro, sinistra, destra. */
export function assignBodySlots(items: { uri: string; view?: BodySlot }[], taken: Partial<Record<BodySlot, string>> = {}): Partial<Record<BodySlot, string>> {
  const out: Partial<Record<BodySlot, string>> = {};
  const used = new Set<BodySlot>();
  const rest: string[] = [];
  for (const it of items) {
    if (it.view && !used.has(it.view)) { out[it.view] = it.uri; used.add(it.view); } else rest.push(it.uri);
  }
  for (const uri of rest) { const free = ORDER.find((s) => !used.has(s) && !(s in taken)) ?? ORDER.find((s) => !used.has(s)); if (!free) break; out[free] = uri; used.add(free); }
  return out;
}
export const missingSlots = (photos: Partial<Record<BodySlot, string>>): BodySlot[] => ORDER.filter((s) => !photos[s]);
export const SLOT_NAME: Record<BodySlot, string> = { front: 'davanti', back: 'dietro', left: 'lato sinistro', right: 'lato destro' };
