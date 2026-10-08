/**
 * Pianificatore PURO (nessuna AI): riempie il piano dentro l'orario di lavoro lasciando sempre degli slot liberi,
 * e sceglie da solo il momento migliore per un impegno quando l'utente dice "scegli tu".
 */
import { fmtMin, freeSlots, toMin } from './availability.ts';
import type { Ranked } from './priority.ts';

export type PEv = { time: string; title?: string; dur?: number };
export type PlanItem = { day: string; time: string; title: string; dur: number; kind: 'task' | 'routine' };

const pad = (n: number) => String(n).padStart(2, '0');
export const keyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const isWork = (d: Date) => d.getDay() >= 1 && d.getDay() <= 5;
const clone = (m: Record<string, PEv[]>) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, v.map((x) => ({ ...x }))]));

type Base = { now: Date; workStart: string; workEnd: string; events: Record<string, PEv[]> };

function nowMin(now: Date, day: string) { return keyOf(now) === day ? now.getHours() * 60 + Math.ceil(now.getMinutes() / 15) * 15 : 0; }

function place(evs: Record<string, PEv[]>, o: Base, day: string, pref: string, dur: number, title: string, keepFree: number): PlanItem | null {
  const list = evs[day] ?? [];
  const from = nowMin(o.now, day);
  const slots = freeSlots(list, o.workStart, o.workEnd, dur, 60, from);
  let start = -1;
  for (const s of slots) {
    const st = Math.max(s.from, toMin(pref));
    if (st + dur <= s.to) { start = st; break; }
  }
  if (start < 0 && slots[0]) start = slots[0].from;
  if (start < 0) return null;
  const after = [...list, { time: fmtMin(start), dur }];
  const remaining = freeSlots(after, o.workStart, o.workEnd, 30, 60, from).reduce((s, x) => s + (x.to - x.from), 0);
  if (remaining < keepFree) return null;
  (evs[day] ??= []).push({ time: fmtMin(start), dur, title });
  return { day, time: fmtMin(start), title, dur, kind: 'routine' };
}

export function planMonth(o: Base & { ranked: Ranked[]; keepFreeMin?: number }): PlanItem[] {
  const evs = clone(o.events);
  const window = toMin(o.workEnd) - toMin(o.workStart);
  const keep = o.keepFreeMin ?? Math.max(150, Math.round(window * 0.3));
  // da oggi (se c'è ancora tempo) a fine mese; negli ultimi giorni del mese si arriva a fine mese successivo
  const start = new Date(o.now.getFullYear(), o.now.getMonth(), o.now.getDate());
  let end = new Date(o.now.getFullYear(), o.now.getMonth() + 1, 0);
  if (end.getTime() - start.getTime() < 4 * 86400000) end = new Date(o.now.getFullYear(), o.now.getMonth() + 2, 0);
  const days: Date[] = [];
  for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) if (isWork(d)) days.push(new Date(d));
  const out: PlanItem[] = [];
  // 1) i task: i più importanti prima possibile, gli altri distribuiti; se collegati a un impegno, prima di quel giorno
  o.ranked.slice(0, 12).forEach((r, k) => {
    const urgentish = r.score >= 60;
    let idx = urgentish ? Math.min(k, 2) : Math.min(days.length - 1, 1 + k * 2);
    if (r.link) { const li = days.findIndex((d) => keyOf(d) >= r.link!.day); if (li > 0) idx = Math.min(idx, li - 1); }
    for (let j = idx; j < days.length && j < idx + 6; j++) {
      const it = place(evs, o, keyOf(days[j]), '10:30', 60, `Lavoro su: ${r.task.t}`, keep);
      if (it) { out.push({ ...it, kind: 'task' }); break; }
    }
  });
  // 2) abitudini ricorrenti, sempre dentro l'orario di lavoro
  days.forEach((d) => {
    const wd = d.getDay(), day = keyOf(d);
    const add = (pref: string, dur: number, title: string) => { const it = place(evs, o, day, pref, dur, title, keep); if (it) out.push(it); };
    add('12:30', 60, 'Pausa pranzo');
    if ([1, 3, 4].includes(wd)) add('09:30', 90, 'Lavoro profondo');
    if ([2, 4].includes(wd)) add('15:00', 30, 'Pausa movimento');
    if (wd === 5) add('16:00', 60, 'Revisione della settimana');
  });
  return out.sort((a, b) => (a.day + a.time).localeCompare(b.day + b.time));
}

/** Sceglie il momento migliore: urgente = il prima possibile; altrimenti nei giorni più leggeri, verso metà mattina. */
export function pickSlot(o: Base & { dur: number; urgent?: boolean; fromDay?: string; maxDays?: number; anyDay?: boolean }): { day: string; time: string } | null {
  const first = o.fromDay ? new Date(o.fromDay + 'T00:00:00') : new Date(o.now.getFullYear(), o.now.getMonth(), o.now.getDate());
  let best: { day: string; time: string; score: number } | null = null;
  for (let i = 0; i < (o.maxDays ?? 14); i++) {
    const d = new Date(first); d.setDate(d.getDate() + i);
    if (!o.anyDay && !isWork(d)) continue;
    const day = keyOf(d);
    const slots = freeSlots(o.events[day] ?? [], o.workStart, o.workEnd, o.dur, 60, nowMin(o.now, day));
    if (!slots.length) continue;
    const s = slots.find((x) => x.from >= 9 * 60 + 30 && x.from + o.dur <= x.to) ?? slots[0];
    const start = s.from >= 9 * 60 + 30 || !slots.some((x) => x.from >= 9 * 60 + 30) ? s.from : Math.max(s.from, 9 * 60 + 30);
    const load = (o.events[day] ?? []).length;
    const score = o.urgent ? i * 1000 + start : load * 100 + i * 10 + Math.abs(start - 10 * 60) / 60;
    if (!best || score < best.score) best = { day, time: fmtMin(Math.min(start, s.to - o.dur)), score };
    if (o.urgent) break;
  }
  return best ? { day: best.day, time: best.time } : null;
}
