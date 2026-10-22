import { addDay, dayKeyOf } from './core';
import type { WeekInput, WItem } from './week';
import { dayInfo } from '@/lib/fitness/dayPlan';
import { sessionMinutes } from '@/lib/fitness/plan';
import { programById } from '@/lib/fitness/programsExtra';
import { rankTasks, type PEvent } from '@/lib/priority';
import { useApp } from '@/store/app';
import { useFitness } from '@/store/fitness';
import { useLife } from '@/store/life';
import { useShifts } from '@/store/shifts';

/** I dati dell'app che servono a proporre la settimana. */
export function collectWeekInput(opts?: WeekInput['opts'], nowDate = new Date()): WeekInput {
  const life = useLife.getState();
  const fit = useFitness.getState();
  const wh = useApp.getState().workHours;
  const today = dayKeyOf(nowDate.getTime());
  const active = fit.activeProgram ? programById(fit.activeProgram) ?? null : null;
  const workouts: WeekInput['workouts'] = [];
  for (let k = 0; k < 7; k++) {
    const day = addDay(today, k);
    const info = dayInfo(day, { program: active, profile: fit.profile, history: fit.history, plans: fit.plans ?? {}, now: nowDate });
    const p = info.programId ? programById(info.programId) : null;
    if (info.planned && !info.done && p && info.session != null) workouts.push({ day, name: p.sessions[info.session].name, minutes: Math.max(20, sessionMinutes(p, info.session, fit.edits)) });
  }
  const events: PEvent[] = Object.entries(life.events).flatMap(([day, l]) => l.map((e) => ({ day, time: e.time, title: e.title, important: e.important })));
  const ranked = rankTasks(life.tasks.map((t) => ({ id: t.id, t: t.t, done: t.done, urgent: t.urgent, due: t.due })), events, nowDate);
  return {
    now: nowDate,
    events: Object.fromEntries(Object.entries(life.events).map(([k, l]) => [k, l.map((e) => ({ time: e.time, dur: e.dur, title: e.title }))])),
    shifts: useShifts.getState().shifts,
    workStart: wh.start, workEnd: wh.end,
    tasks: ranked.slice(0, 8).map((r) => ({ id: r.task.id, t: r.task.t })),
    workouts, opts,
  };
}

const COLOR: Record<WItem['kind'], string> = { allenamento: '#ff9d6e', task: '#8fb3ff', sonno: '#c9b6ff' };

/** Mette nel Plan le voci scelte. Ritorna la sigla del gruppo: serve ad annullare tutto in un colpo. */
export function applyWeekPlan(items: WItem[]): string {
  const batch = `wk${Date.now().toString(36)}`;
  const life = useLife.getState();
  for (const it of items) life.addEvent(it.day, { time: it.time, title: it.title, dur: it.dur, ref: batch, color: COLOR[it.kind], reminder: it.kind === 'sonno' });
  return batch;
}

/** Toglie dal Plan tutto ciò che quel gruppo ha aggiunto (e solo quello). */
export function undoWeekPlan(batch: string): number {
  const life = useLife.getState();
  let n = 0;
  for (const [day, list] of Object.entries(useLife.getState().events)) {
    for (let i = list.length - 1; i >= 0; i--) if (list[i].ref === batch) { life.delEvent(day, i); n++; }
  }
  return n;
}
