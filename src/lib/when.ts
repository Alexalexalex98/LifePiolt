import { dayKey, pad2 } from '@/lib/format';

/** Date e orari in italiano per seminari, servizi, post e idee. */
const WD = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
const MON = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
const SLOT_WD: Record<string, number> = { dom: 0, lun: 1, mar: 2, mer: 3, gio: 4, ven: 5, sab: 6 };

export const hhmm = (ts: number) => { const d = new Date(ts); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };
/** "4 ott 2026" */
export const fmtDate = (ts: number) => { const d = new Date(ts); return `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}`; };
/** "lun 12 ott" (con l'anno solo se diverso da quest'anno) */
export const fmtDay = (ts: number) => {
  const d = new Date(ts);
  return `${WD[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}${d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : ''}`;
};
/** "lun 12 ott, 18:30" */
export const fmtDateTime = (ts: number) => `${fmtDay(ts)}, ${hhmm(ts)}`;
/** "lun 12 ott, 18:30 - 19:30" */
export const fmtRange = (ts: number, durationMin: number) => `${fmtDay(ts)}, ${hhmm(ts)} - ${hhmm(ts + durationMin * 60000)}`;
/** "Pubblicato il 4 ott 2026" */
export const fmtPublished = (ts?: number) => (ts ? `Pubblicato il ${fmtDate(ts)}` : '');
/** "3 giorni fa" / "ieri" / "4 ott 2026" */
export function fmtAgo(ts?: number): string {
  if (!ts) return '';
  const diff = Date.now() - ts;
  if (diff < 60000) return 'adesso';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} min fa`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} h fa`;
  const days = Math.floor(diff / 86400000);
  if (days === 1) return 'ieri';
  if (days < 7) return `${days} giorni fa`;
  return fmtDate(ts);
}
export const fmtDuration = (min: number) => (min < 60 ? `${min} min` : min % 60 === 0 ? (min === 60 ? '1 ora' : `${min / 60} ore`) : `${Math.floor(min / 60)} h ${min % 60} min`);
export const dayKeyOf = (ts: number) => dayKey(new Date(ts));

/** Traduce "Lun 16:00" nella prossima occorrenza reale (timestamp). Se l'orario di oggi è già passato, sale alla settimana dopo. */
export function nextOccurrence(slot: string, from = Date.now()): number | null {
  const m = slot.trim().toLowerCase().match(/^([a-zàù]{3})\w*\s+(\d{1,2}):(\d{2})$/);
  if (!m || SLOT_WD[m[1]] === undefined) return null;
  const target = SLOT_WD[m[1]];
  const base = new Date(from);
  for (let i = 0; i < 8; i++) {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i, Number(m[2]), Number(m[3]), 0, 0);
    if (d.getDay() === target && d.getTime() > from) return d.getTime();
  }
  return null;
}

/** Costruisce un timestamp locale da "YYYY-MM-DD" e "HH:MM". */
export function tsOf(day: string, time: string): number {
  const [y, mo, d] = day.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  return new Date(y, (mo || 1) - 1, d || 1, h || 0, mi || 0, 0, 0).getTime();
}

/** Giorni di calendario a partire da oggi, per i selettori. */
export function nextDays(n: number): { key: string; label: string; ts: number }[] {
  const out: { key: string; label: string; ts: number }[] = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, 12);
    out.push({ key: dayKey(d), label: (i === 0 ? 'Oggi · ' : i === 1 ? 'Domani · ' : '') + `${WD[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}${d.getFullYear() !== now.getFullYear() ? ' ' + d.getFullYear() : ''}`, ts: d.getTime() });
  }
  return out;
}

export const timeOptions = (from = 6, to = 22): string[] => {
  const o: string[] = [];
  for (let h = from; h <= to; h++) { o.push(`${pad2(h)}:00`); if (h < to) o.push(`${pad2(h)}:30`); }
  return o;
};

/** "Pubblicata 3 giorni fa" / "Pubblicato il 4 ott 2026" (word = Pubblicato | Pubblicata | Pubblicati...) */
export function pubLabel(ts: number | undefined, word = 'Pubblicato'): string {
  if (!ts) return '';
  const ago = fmtAgo(ts);
  return `${word} ${/ fa$|^ieri$|^adesso$/.test(ago) ? ago : 'il ' + ago}`;
}
