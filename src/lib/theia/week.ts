/**
 * La settimana proposta da Theia (modulo PURO, a regole: nessuna AI, nessuna invenzione).
 * Mette nel Plan, nei momenti liberi: gli allenamenti previsti, i task più importanti e il ricordo per andare a letto prima di un turno presto.
 * I turni e gli impegni sono sempre occupati (con un'ora di margine attorno ai turni) e ogni giorno resta del tempo libero. È solo una proposta: l'utente sceglie cosa tenere.
 */
import { fmtMin, freeSlots, toMin, type Ev } from '../availability.ts';
import { upcoming, type Shift } from '../shifts.ts';
import { addDay, dayKeyOf } from './core.ts';

export type WKind = 'allenamento' | 'task' | 'sonno';
export type WItem = { id: string; day: string; time: string; dur: number; title: string; kind: WKind };
export type WeekInput = {
  now: Date;
  events: Record<string, { time: string; dur?: number; title?: string }[]>;
  shifts: Shift[];
  workStart: string; workEnd: string;
  /** già in ordine d'importanza */
  tasks: { id: string; t: string }[];
  /** allenamenti previsti, non ancora fatti */
  workouts: { day: string; name: string; minutes: number }[];
  opts?: { workouts?: boolean; tasks?: boolean; sleep?: boolean };
};
export type WeekPlan = { days: string[]; items: WItem[]; notes: string[] };

const MARGIN = 60; // minuti attorno a un turno
const KEEP_FREE = 90; // minuti liberi da lasciare ogni giorno

const WD = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
export const dayLabel = (key: string, today: string) => (key === today ? 'oggi' : key === addDay(today, 1) ? 'domani' : `${WD[new Date(key + 'T00:00:00').getDay()]} ${Number(key.slice(8))}`);

export function planWeek(i: WeekInput): WeekPlan {
  const opts = { workouts: true, tasks: true, sleep: true, ...(i.opts ?? {}) };
  const today = dayKeyOf(i.now.getTime());
  const days = Array.from({ length: 7 }, (_, k) => addDay(today, k));
  const notes: string[] = [];
  // occupato: impegni + turni (con margine). Un turno che passa la mezzanotte occupa anche l'inizio del giorno dopo.
  const busy: Record<string, Ev[]> = {};
  for (const d of days) busy[d] = (i.events[d] ?? []).map((e) => ({ time: e.time, dur: e.dur }));
  const occ = upcoming(i.shifts, new Date(today + 'T00:00:00').getTime(), 8);
  const shiftDays = new Set<string>();
  for (const o of occ) {
    const sd = dayKeyOf(o.startTs), ed = dayKeyOf(o.endTs);
    const s = new Date(o.startTs), e = new Date(o.endTs);
    const startMin = s.getHours() * 60 + s.getMinutes(), endMin = e.getHours() * 60 + e.getMinutes();
    if (busy[sd]) { shiftDays.add(sd); busy[sd].push({ time: fmtMin(Math.max(0, startMin - MARGIN)), dur: (ed === sd ? endMin : 1440) - Math.max(0, startMin - MARGIN) + (ed === sd ? MARGIN : 0) }); }
    if (ed !== sd && busy[ed]) { shiftDays.add(ed); busy[ed].push({ time: '00:00', dur: endMin + MARGIN }); }
  }
  const nowMin = (day: string) => (day === today ? i.now.getHours() * 60 + Math.ceil(i.now.getMinutes() / 15) * 15 : 0);
  const items: WItem[] = [];
  let n = 0;
  const put = (day: string, start: number, dur: number, title: string, kind: WKind) => { busy[day].push({ time: fmtMin(start), dur }); items.push({ id: `w${n++}`, day, time: fmtMin(start), dur, title, kind }); };

  if (shiftDays.size) notes.push(`Nella settimana hai ${shiftDays.size === 1 ? 'un giorno' : `${shiftDays.size} giorni`} con turni: li ho considerati occupati, con un'ora di margine prima e dopo.`);

  // 1) allenamenti
  if (opts.workouts) {
    for (const w of i.workouts.filter((x) => days.includes(x.day))) {
      const slots = freeSlots(busy[w.day], '06:30', '21:00', w.minutes, 60, nowMin(w.day));
      const pick = slots.find((s) => Math.max(s.from, 17 * 60) + w.minutes <= s.to) ?? slots[0];
      if (!pick) { notes.push(`Non ho trovato un momento libero per «${w.name}» ${dayLabel(w.day, today)}: la giornata è piena.`); continue; }
      const start = Math.max(pick.from, Math.min(pick.to - w.minutes, Math.max(17 * 60, pick.from)));
      put(w.day, start, w.minutes, `Allenamento: ${w.name}`, 'allenamento');
    }
  }
  // 2) i task più importanti, uno al giorno, dentro l'orario di lavoro
  if (opts.tasks) {
    const ts = [...i.tasks];
    for (const d of days) {
      if (!ts.length) break;
      const slots = freeSlots(busy[d], i.workStart, i.workEnd, 60, 60, nowMin(d));
      const slot = slots[0];
      if (!slot) continue;
      const free = slots.reduce((s, x) => s + (x.to - x.from), 0);
      if (free - 60 < KEEP_FREE) continue;
      const t = ts.shift()!;
      put(d, Math.max(slot.from, toMin('09:30') <= slot.to - 60 ? Math.max(slot.from, toMin('09:30')) : slot.from), 60, `Lavoro su: ${t.t}`, 'task');
    }
    if (ts.length) notes.push(`${ts.length === 1 ? 'Un task importante non ha trovato posto' : `${ts.length} task non hanno trovato posto`} questa settimana: lascio i giorni con tempo libero per non riempirti.`);
  }
  // 3) a letto prima di un turno presto
  if (opts.sleep) {
    for (const o of occ) {
      const s = new Date(o.startTs);
      const startMin = s.getHours() * 60 + s.getMinutes();
      const sd = dayKeyOf(o.startTs);
      if (startMin > 7 * 60 + 30 || !days.includes(sd)) continue;
      const bedMs = new Date(sd + 'T00:00:00').getTime() + (startMin - 9 * 60) * 60000;
      if (bedMs <= i.now.getTime()) continue;
      const bd = dayKeyOf(bedMs); const b = new Date(bedMs);
      if (!busy[bd]) continue;
      items.push({ id: `w${n++}`, day: bd, time: fmtMin(b.getHours() * 60 + b.getMinutes()), dur: 15, title: `A letto: domani il turno «${o.shift.name}» inizia alle ${fmtMin(startMin)}`, kind: 'sonno' });
    }
  }
  items.sort((a, b) => (a.day + a.time).localeCompare(b.day + b.time));
  // ogni giorno deve restare del tempo libero: se non è così lo dico
  for (const d of days) {
    const free = freeSlots(busy[d], '08:00', '20:00', 30, 60, nowMin(d)).reduce((s, x) => s + (x.to - x.from), 0);
    if (free < KEEP_FREE && (i.events[d]?.length ?? 0) + items.filter((x) => x.day === d).length >= 4 && !notes.some((x) => x.includes(dayLabel(d, today)))) notes.push(`${dayLabel(d, today)} è già molto pieno: non ho aggiunto altro.`);
  }
  return { days, items, notes };
}
