/** Utilita' di tempo locale (fuso del telefono). Pure: usano solo Date. */
import { DAY_MS } from './types.ts';

const p2 = (n: number) => String(n).padStart(2, '0');
export const dayKey = (ts: number) => { const d = new Date(ts); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; };
export const minOfDay = (ts: number) => { const d = new Date(ts); return d.getHours() * 60 + d.getMinutes(); };
export const weekdayOf = (ts: number) => new Date(ts).getDay();
/** Inizio (00:00 locale) del giorno che contiene ts. */
export const startOfDay = (ts: number) => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); };
/** Timestamp locale di un giorno 'YYYY-MM-DD' alle HH:MM. */
export const atLocal = (day: string, hhmm: string) => { const [y, m, d] = day.split('-').map(Number); const [h, mi] = hhmm.split(':').map(Number); return new Date(y, m - 1, d, h || 0, mi || 0, 0, 0).getTime(); };
export const fmtMin = (m: number) => { const x = ((Math.round(m) % 1440) + 1440) % 1440; return `${p2(Math.floor(x / 60))}:${p2(x % 60)}`; };
export const isWorkday = (ts: number) => { const w = weekdayOf(ts); return w >= 1 && w <= 5; };
/** Giorni locali coperti dall'intervallo [a,b] (chiavi). */
export function daysBetween(a: number, b: number): string[] {
  const out: string[] = [];
  for (let t = startOfDay(a); t <= b; t = startOfDay(t + DAY_MS + 3 * 3600000)) out.push(dayKey(t));
  return out;
}
/** Sovrapposizione in ms tra [a1,a2] e [b1,b2]. */
export const overlap = (a1: number, a2: number, b1: number, b2: number) => Math.max(0, Math.min(a2, b2) - Math.max(a1, b1));
export const WEEKDAYS = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
