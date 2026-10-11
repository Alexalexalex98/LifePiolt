/** Date in formato ISO (YYYY-MM-DD) senza fusi orari: aritmetica di calendario pura, giorni lavorativi e festività CH/IT semplificate. */

const p2 = (n: number) => String(n).padStart(2, '0');
export const mkIso = (y: number, m: number, d: number) => `${String(y).padStart(4, '0')}-${p2(m)}-${p2(d)}`;
export const isIso = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && validYmd(+s.slice(0, 4), +s.slice(5, 7), +s.slice(8, 10));

export function validYmd(y: number, m: number, d: number): boolean {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d) || m < 1 || m > 12 || d < 1 || y < 1900 || y > 2200) return false;
  return d <= daysInMonth(y, m);
}
export const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const toUtc = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
const fromUtc = (ms: number) => { const d = new Date(ms); return mkIso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()); };

export const addDays = (iso: string, n: number) => fromUtc(toUtc(iso) + n * 86400000);
/** Giorni da a a b (positivo se b e' dopo a). */
export const diffDays = (a: string, b: string) => Math.round((toUtc(b) - toUtc(a)) / 86400000);
/** 0 = domenica ... 6 = sabato. */
export const weekdayOf = (iso: string) => new Date(toUtc(iso)).getUTCDay();

export function addMonths(iso: string, n: number): string {
  const y0 = +iso.slice(0, 4), m0 = +iso.slice(5, 7) - 1, d0 = +iso.slice(8, 10);
  const t = y0 * 12 + m0 + n;
  const y = Math.floor(t / 12), m = (t % 12) + 1;
  return mkIso(y, m, Math.min(d0, daysInMonth(y, m)));
}

export function todayIso(now: number | Date = Date.now()): string {
  const d = new Date(now);
  return mkIso(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

/** Pasqua (calendario gregoriano, algoritmo di Meeus/Jones/Butcher). */
export function easter(y: number): string {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return mkIso(y, month, day);
}

export type Country = 'CH' | 'IT';
/** Festività nazionali semplificate (le cantonali/regionali si aggiungono con `extra`). */
export function holidaysOf(y: number, countries: Country[] = ['CH', 'IT']): string[] {
  const e = easter(y);
  const out = new Set<string>();
  if (countries.includes('CH')) {
    [mkIso(y, 1, 1), addDays(e, -2), addDays(e, 1), addDays(e, 39), addDays(e, 50), mkIso(y, 8, 1), mkIso(y, 12, 25), mkIso(y, 12, 26)].forEach((x) => out.add(x));
  }
  if (countries.includes('IT')) {
    [mkIso(y, 1, 1), mkIso(y, 1, 6), addDays(e, 1), mkIso(y, 4, 25), mkIso(y, 5, 1), mkIso(y, 6, 2), mkIso(y, 8, 15), mkIso(y, 11, 1), mkIso(y, 12, 8), mkIso(y, 12, 25), mkIso(y, 12, 26)].forEach((x) => out.add(x));
  }
  return [...out].sort();
}

export type Calendar = { countries?: Country[]; extra?: string[] };
const cache = new Map<string, Set<string>>();
function holidaySet(y: number, cal?: Calendar): Set<string> {
  const key = `${y}|${(cal?.countries ?? ['CH', 'IT']).join(',')}|${(cal?.extra ?? []).join(',')}`;
  let s = cache.get(key);
  if (!s) { s = new Set([...holidaysOf(y, cal?.countries), ...(cal?.extra ?? [])]); if (cache.size > 40) cache.clear(); cache.set(key, s); }
  return s;
}
export function isBusinessDay(iso: string, cal?: Calendar): boolean {
  const w = weekdayOf(iso);
  if (w === 0 || w === 6) return false;
  return !holidaySet(+iso.slice(0, 4), cal).has(iso);
}
/** Sposta di n giorni lavorativi (n negativo = indietro). Con n = 0 e giorno non lavorativo, arretra al precedente lavorativo. */
export function addBusinessDays(iso: string, n: number, cal?: Calendar): string {
  let d = iso;
  if (n === 0) { while (!isBusinessDay(d, cal)) d = addDays(d, -1); return d; }
  const step = n > 0 ? 1 : -1;
  let left = Math.abs(n);
  while (left > 0) { d = addDays(d, step); if (isBusinessDay(d, cal)) left--; }
  return d;
}
/** Ultimo giorno lavorativo <= iso. */
export const prevBusinessDay = (iso: string, cal?: Calendar) => addBusinessDays(iso, 0, cal);
