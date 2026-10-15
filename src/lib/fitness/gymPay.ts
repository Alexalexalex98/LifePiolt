/**
 * Pagamento nei centri con il QR (modulo PURO, sempre in LifePoints). Ogni centro ha un listino (ingresso singolo, corso, pacchetto)
 * e un QR «lp://gym/<centro>?i=<voce>&a=<LP>». Chi scansiona vede il centro e il prezzo, controllati sul listino: un QR con un prezzo
 * diverso dal listino viene rifiutato. Il pagamento dà ingressi (crediti) da usare entro la scadenza.
 */
import type { Gym, GymKind } from './data.ts';

export type PriceItem = { id: 'single' | 'class' | 'pack10' | 'court'; label: string; lp: number; entries: number; validDays: number };
const DAY = 86400000;

const hash = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };
const BASE: Record<GymKind, { id: PriceItem['id']; label: string; lp: number; entries: number; validDays: number }[]> = {
  palestra: [{ id: 'single', label: 'Ingresso singolo', lp: 12, entries: 1, validDays: 7 }, { id: 'class', label: 'Corso di gruppo', lp: 15, entries: 1, validDays: 7 }, { id: 'pack10', label: '10 ingressi', lp: 100, entries: 10, validDays: 90 }],
  piscina: [{ id: 'single', label: 'Ingresso in piscina', lp: 10, entries: 1, validDays: 7 }, { id: 'class', label: 'Acquagym o corso nuoto', lp: 14, entries: 1, validDays: 7 }, { id: 'pack10', label: '10 ingressi', lp: 85, entries: 10, validDays: 90 }],
  centro: [{ id: 'single', label: 'Ingresso singolo', lp: 15, entries: 1, validDays: 7 }, { id: 'court', label: 'Campo per un\'ora', lp: 24, entries: 1, validDays: 7 }, { id: 'pack10', label: '10 ingressi', lp: 120, entries: 10, validDays: 90 }],
};
/** Il listino di un centro: parte dal tipo (palestra, piscina, centro) e varia un po' da centro a centro. */
export function priceList(gym: Pick<Gym, 'id' | 'kind'>): PriceItem[] {
  const k = 0.9 + (hash(gym.id) % 5) * 0.05;
  return BASE[gym.kind].map((b) => ({ ...b, lp: Math.max(1, Math.round(b.lp * k)) }));
}

/* ---------- QR ---------- */
const PREFIX = 'lp://gym/';
export type GymLink = { gymId: string; itemId?: string; lp?: number };
export function buildGymLink(gymId: string, item?: Pick<PriceItem, 'id' | 'lp'>): string {
  return `${PREFIX}${encodeURIComponent(gymId)}${item ? `?i=${item.id}&a=${item.lp}` : ''}`;
}
export function parseGymLink(text: string): GymLink | null {
  const s = (text ?? '').trim();
  if (!s.startsWith(PREFIX)) return null;
  const [idPart, query = ''] = s.slice(PREFIX.length).split('?');
  let gymId = ''; try { gymId = decodeURIComponent(idPart).trim(); } catch { return null; }
  if (!gymId || gymId.length > 60 || /[\u0000-\u001f<>]/.test(gymId)) return null;
  const out: GymLink = { gymId };
  for (const kv of query.split('&').filter(Boolean)) {
    const [k, v = ''] = kv.split('=');
    if (k === 'i' && /^[a-z0-9]{3,12}$/.test(v)) out.itemId = v;
    if (k === 'a') { const n = Number(v); if (Number.isInteger(n) && n > 0 && n <= 5000) out.lp = n; }
  }
  return out;
}
export type Resolved = { ok: true; gym: Gym; items: PriceItem[]; item?: PriceItem } | { ok: false; reason: string };
/** Controlla il QR sul listino: centro esistente, voce valida e prezzo uguale a quello del listino. */
export function resolveGymLink(text: string, gyms: Gym[]): Resolved {
  const l = parseGymLink(text);
  if (!l) return { ok: false, reason: 'Questo non è un codice di pagamento di un centro LifePilot.' };
  const gym = gyms.find((g) => g.id === l.gymId);
  if (!gym) return { ok: false, reason: 'Questo centro non è nel programma LifePass.' };
  const items = priceList(gym);
  if (!l.itemId) return { ok: true, gym, items };
  const item = items.find((x) => x.id === l.itemId);
  if (!item) return { ok: false, reason: 'La voce indicata dal codice non esiste in questo centro.' };
  if (l.lp !== undefined && l.lp !== item.lp) return { ok: false, reason: `Il prezzo nel codice (${l.lp} LP) non corrisponde al listino del centro (${item.lp} LP). Non pago.` };
  return { ok: true, gym, items, item };
}

/* ---------- acquisti e ingressi ---------- */
export type Purchase = { id: string; ts: number; gymId: string; gymName: string; itemId: PriceItem['id']; label: string; lp: number; entries: number; left: number; expires: number };
export function makePurchase(id: string, gym: Pick<Gym, 'id' | 'name'>, item: PriceItem, now: number): Purchase {
  return { id, ts: now, gymId: gym.id, gymName: gym.name, itemId: item.id, label: item.label, lp: item.lp, entries: item.entries, left: item.entries, expires: now + item.validDays * DAY };
}
export const payBlock = (balance: number, lp: number): string | null => (balance < lp ? `Servono ${lp} LifePoints: ne hai ${balance}.` : null);
/** Ingressi ancora validi per un centro. */
export const creditsLeft = (list: Purchase[], gymId: string, now: number): number => list.filter((p) => p.gymId === gymId && p.expires > now).reduce((a, p) => a + p.left, 0);
export const totalCredits = (list: Purchase[], now: number): number => list.filter((p) => p.expires > now).reduce((a, p) => a + p.left, 0);
/** Usa un ingresso: prende prima quello che scade prima. */
export function useCredit(list: Purchase[], gymId: string, now: number): { list: Purchase[]; ok: boolean } {
  const cand = list.filter((p) => p.gymId === gymId && p.expires > now && p.left > 0).sort((a, b) => a.expires - b.expires)[0];
  if (!cand) return { list, ok: false };
  return { ok: true, list: list.map((p) => (p.id === cand.id ? { ...p, left: p.left - 1 } : p)) };
}
