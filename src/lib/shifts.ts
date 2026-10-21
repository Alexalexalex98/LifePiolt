/** Turni di lavoro (modulo PURO): ogni turno ha un nome, un orario e i giorni in cui si ripete o le date scelte. */
export type Shift = {
  id: string; name: string;
  /** HH:MM */
  start: string; end: string;
  /** giorni della settimana in cui si ripete, 0 = lunedì … 6 = domenica */
  weekdays: number[];
  /** date singole YYYY-MM-DD */
  dates: string[];
  color?: string;
};
export type Occ = { shift: Shift; date: string; startTs: number; endTs: number };

export const isTime = (s: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const at = (day: Date, hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m, 0, 0).getTime(); };
export const weekdayOf = (d: Date) => (d.getDay() + 6) % 7;

/** I turni da `now` in poi (quello in corso compreso), in ordine, per i prossimi `days` giorni. Un turno che finisce dopo la mezzanotte (es. 22:00-06:00) finisce il giorno dopo. */
export function upcoming(shifts: Shift[], now: number, days = 60): Occ[] {
  const out: Occ[] = [];
  const base = new Date(now);
  for (let i = -1; i <= days; i++) {
    const day = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
    const key = iso(day), wd = weekdayOf(day);
    for (const s of shifts) {
      if (!isTime(s.start) || !isTime(s.end)) continue;
      if (!s.weekdays.includes(wd) && !s.dates.includes(key)) continue;
      const startTs = at(day, s.start);
      let endTs = at(day, s.end);
      if (endTs <= startTs) endTs = at(new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1), s.end);
      if (endTs > now) out.push({ shift: s, date: key, startTs, endTs });
    }
  }
  return out.sort((a, b) => a.startTs - b.startTs);
}

const WD = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'];
const MON = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

/** «Oggi 14:00», «Domani 06:00», «ven 23 ott 06:00»; se è già iniziato, «In corso, finisce alle 22:00». */
export function whenText(o: Occ, now: number): string {
  const hh = (ts: number) => `${String(new Date(ts).getHours()).padStart(2, '0')}:${String(new Date(ts).getMinutes()).padStart(2, '0')}`;
  if (o.startTs <= now) return `In corso, finisce alle ${hh(o.endTs)}`;
  const d = new Date(o.startTs), today = new Date(now);
  const diff = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86400000);
  const day = diff === 0 ? 'Oggi' : diff === 1 ? 'Domani' : `${WD[weekdayOf(d)]} ${d.getDate()} ${MON[d.getMonth()]}`;
  return `${day} ${hh(o.startTs)}`;
}

/** «tra 3 h 20 min», «tra 2 giorni». */
export function countdown(ts: number, now: number): string {
  const m = Math.max(0, Math.round((ts - now) / 60000));
  if (m < 60) return `tra ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `tra ${h} h${m % 60 >= 5 ? ` ${m % 60} min` : ''}`;
  const d = Math.round(h / 24);
  return `tra ${d} ${d === 1 ? 'giorno' : 'giorni'}`;
}

export const hoursOf = (o: Occ) => Math.round(((o.endTs - o.startTs) / 3600000) * 10) / 10;
