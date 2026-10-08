/**
 * Calendario del telefono -> eventi del Plan. Modulo PURO e testabile (nessun import dell'app né di expo).
 * Ogni evento importato porta ref 'ical:<id>'; la deduplica usa la coppia (giorno, ref), così gli eventi
 * ricorrenti (stesso id, istanze in giorni diversi) non si fondono e una seconda importazione non crea doppioni.
 */
export type RawCalEvent = {
  id: string; title?: string | null; startDate: string | number | Date; endDate?: string | number | Date | null;
  allDay?: boolean; calendarId?: string | null;
};
export type PlanEvent = { time: string; title: string; important?: boolean; reminder?: boolean; dur?: number; ref?: string };
export type Existing = Record<string, PlanEvent[]>;
export type SyncPlan = {
  add: { day: string; ev: PlanEvent }[];
  update: { day: string; idx: number; patch: Partial<PlanEvent> }[];
  remove: { day: string; idx: number }[];
  unchanged: number;
};

const pad = (n: number) => String(n).padStart(2, '0');
export const dayOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const timeOf = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const ICAL_PREFIX = 'ical:';
export const icalRef = (id: string) => ICAL_PREFIX + id;
export const isIcalRef = (ref?: string) => !!ref && ref.startsWith(ICAL_PREFIX);

/** Evento del telefono -> uno o più eventi del Plan (uno per giorno se dura più giorni, al massimo 14). */
export function mapEvent(raw: RawCalEvent): { day: string; ev: PlanEvent }[] {
  const start = new Date(raw.startDate);
  if (!raw.id || Number.isNaN(start.getTime())) return [];
  let end = raw.endDate != null ? new Date(raw.endDate) : new Date(start.getTime() + 3600000);
  if (Number.isNaN(end.getTime()) || end <= start) end = new Date(start.getTime() + 3600000);
  const title = (raw.title ?? '').trim() || 'Evento senza titolo';
  const ref = icalRef(String(raw.id));
  const out: { day: string; ev: PlanEvent }[] = [];
  if (raw.allDay) {
    // i giorni "tutto il giorno" finiscono alle 00:00 del giorno dopo: l'ultimo giorno incluso è quello precedente
    const last = new Date(end.getTime() - 1);
    const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    for (let i = 0; i < 14 && cur <= last; i++) {
      out.push({ day: dayOf(cur), ev: { time: '00:00', title, dur: 1440, ref } });
      cur.setDate(cur.getDate() + 1);
    }
    return out.length ? out : [{ day: dayOf(start), ev: { time: '00:00', title, dur: 1440, ref } }];
  }
  const sameDay = dayOf(start) === dayOf(end) || (end.getHours() === 0 && end.getMinutes() === 0 && dayOf(new Date(end.getTime() - 1)) === dayOf(start));
  if (sameDay) {
    const dur = Math.max(5, Math.round((end.getTime() - start.getTime()) / 60000));
    out.push({ day: dayOf(start), ev: { time: timeOf(start), title, dur: Math.min(dur, 1440), ref } });
    return out;
  }
  // evento su più giorni: primo giorno dall'ora d'inizio a mezzanotte, intermedi tutto il giorno, ultimo da mezzanotte alla fine
  const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  for (let i = 0; i < 14 && cur <= end; i++) {
    const k = dayOf(cur);
    if (i === 0) out.push({ day: k, ev: { time: timeOf(start), title, dur: Math.max(5, 1440 - (start.getHours() * 60 + start.getMinutes())), ref } });
    else if (k === dayOf(end)) { if (end.getHours() || end.getMinutes()) out.push({ day: k, ev: { time: '00:00', title, dur: end.getHours() * 60 + end.getMinutes(), ref } }); }
    else out.push({ day: k, ev: { time: '00:00', title, dur: 1440, ref } });
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

const same = (a: PlanEvent, b: PlanEvent) => a.time === b.time && a.title === b.title && (a.dur ?? 60) === (b.dur ?? 60);

/**
 * Confronta gli eventi del telefono con quelli già nel Plan.
 *  - nuovi: da aggiungere; già presenti identici: ignorati; presenti ma modificati sul telefono: da aggiornare
 *  - con `prune` gli eventi 'ical:' del Plan dentro la finestra che non esistono più sul telefono (o di un calendario non più scelto) vengono rimossi
 */
export function planSync(raws: RawCalEvent[], existing: Existing, win: { from: string; to: string }, opts: { prune?: boolean } = {}): SyncPlan {
  const mapped = raws.flatMap(mapEvent).filter((m) => m.day >= win.from && m.day <= win.to);
  const plan: SyncPlan = { add: [], update: [], remove: [], unchanged: 0 };
  const seen = new Set<string>();
  const wanted = new Set<string>();
  for (const m of mapped) {
    const key = m.day + '|' + m.ev.ref;
    if (seen.has(key)) continue;
    seen.add(key); wanted.add(key);
    const list = existing[m.day] ?? [];
    const idx = list.findIndex((e) => e.ref === m.ev.ref);
    if (idx < 0) { plan.add.push(m); continue; }
    if (same(list[idx], m.ev)) { plan.unchanged++; continue; }
    plan.update.push({ day: m.day, idx, patch: { time: m.ev.time, title: m.ev.title, dur: m.ev.dur } });
  }
  if (opts.prune) {
    for (const [day, list] of Object.entries(existing)) {
      if (day < win.from || day > win.to) continue;
      list.forEach((e, idx) => { if (isIcalRef(e.ref) && !wanted.has(day + '|' + e.ref)) plan.remove.push({ day, idx }); });
    }
  }
  return plan;
}

export const addDaysIso = (d: string, n: number) => { const x = new Date(d + 'T00:00:00'); x.setDate(x.getDate() + n); return dayOf(x); };

/** Riassunto leggibile dell'esito. */
export function describeSync(p: SyncPlan): string {
  const parts: string[] = [];
  if (p.add.length) parts.push(`${p.add.length} ${p.add.length === 1 ? 'nuovo' : 'nuovi'}`);
  if (p.update.length) parts.push(`${p.update.length} ${p.update.length === 1 ? 'aggiornato' : 'aggiornati'}`);
  if (p.remove.length) parts.push(`${p.remove.length} ${p.remove.length === 1 ? 'rimosso' : 'rimossi'}`);
  if (!parts.length) return p.unchanged ? 'Già tutto aggiornato: nessuna novità.' : 'Nessun evento nel periodo scelto.';
  return 'Eventi ' + parts.join(', ') + (p.unchanged ? `, ${p.unchanged} già presenti` : '') + '.';
}
