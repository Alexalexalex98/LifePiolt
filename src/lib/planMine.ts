import { t as tl } from '@/i18n/core';
import { pushWorkEvent, today } from '@/lib/teamWork';
import { evRange, planTasks } from '@/lib/workHours';
import { WORK_COLOR_ID, newEventId } from '@/lib/workPlan';
import { waitingOn } from '@/lib/workTasks';
import { useLife } from '@/store/life';
import { useWTasks } from '@/store/tasks';
import { scheduleOf, useWork } from '@/store/work';

/** Mette i miei task aperti nelle fasce libere del mio orario di lavoro, rispettando le scadenze. */
export function planMyTasks(team: string, me: string | null): { planned: number; message: string } {
  const all = useWTasks.getState().tasks[team] ?? [];
  const mine = all.filter((x) => x.assignee === me && x.status !== 'done' && !x.parent && waitingOn(x, all).length === 0);
  const already = new Set(Object.values(useLife.getState().events).flat().map((e) => e.ref).filter(Boolean));
  const todo = mine.filter((x) => !already.has('wt:' + x.id));
  if (!todo.length) return { planned: 0, message: mine.length ? tl('I tuoi task sono già nel Plan') : tl('Non hai task da pianificare') };
  const sch = scheduleOf(team, useWork.getState().schedules); const now = new Date(); const t0 = today();
  const busy = (d: string) => (useLife.getState().events[d] ?? []).filter((e) => e.team === team).map(evRange);
  const plan = planTasks(sch, todo.map((x) => ({ id: x.id, dur: x.est_min ?? 60, due: x.due ?? undefined, urgent: x.priority === 'urgent' })), t0, now.getHours() * 60 + now.getMinutes(), busy);
  for (const p of plan) {
    const task = todo.find((x) => x.id === p.id)!;
    const ev = { time: p.time, title: task.title, dur: p.dur, color: WORK_COLOR_ID, team, wid: newEventId(), by: me ?? undefined, ref: 'wt:' + task.id };
    useLife.getState().addEvent(p.day, ev); void pushWorkEvent(p.day, ev);
  }
  const left = todo.length - plan.length;
  return { planned: plan.length, message: plan.length ? `${tl('{0} task nel tuo Plan, dentro il tuo orario di lavoro', plan.length)}${left ? ` · ${tl('{0} non entrano prima della scadenza', left)}` : ''}` : tl('Non c\'è posto prima delle scadenze: controlla il tuo orario') };
}
