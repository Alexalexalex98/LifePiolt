import { alertsFor } from '@/lib/budgetState';
import { addDays, daysBetween, parseTime, ymd } from '@/lib/calendarLayout';
import { skippedWork } from '@/lib/reschedule';
import { cancel, scheduleDaily, scheduleWeekly } from '@/lib/notify';
import { expoWeekday, type SuggestInput } from '@/lib/automationSuggest';
import { dayKey } from '@/lib/format';
import { useFin } from '@/store/finance';
import { useHealth } from '@/store/health';
import { useLife, type Automation } from '@/store/life';

export const autoNotifId = (id: string) => `lp-auto-${id}`;

/** Programma (o annulla) la notifica locale di un'automazione. Restituisce un messaggio per l'utente. */
export async function syncAutomation(a: Pick<Automation, 'id' | 'on' | 'rule'>): Promise<string> {
  const n = a.rule?.notify;
  if (!n) return a.on ? 'Questa automazione ti avvisa; l\'azione la confermi tu.' : '';
  if (!a.on) { await cancel(autoNotifId(a.id)); return ''; }
  try {
    const r = n.kind === 'weekly'
      ? await scheduleWeekly(autoNotifId(a.id), expoWeekday(n.weekday ?? 0), n.hour, n.minute, n.title, n.body)
      : await scheduleDaily(autoNotifId(a.id), n.hour, n.minute, n.title, n.body);
    return r.ok ? 'Notifica programmata' : r.message;
  } catch { return 'Non sono riuscito a programmare la notifica.'; }
}

export const cancelAutomation = (id: string) => cancel(autoNotifId(id));

/** Fotografia dello stato dell'utente per le proposte di automazione. */
export function suggestInput(now = new Date()): SuggestInput {
  const life = useLife.getState();
  const h = useHealth.getState();
  const today = dayKey(now);
  const open = life.tasks.filter((t) => !(t.subtasks?.length ? t.subtasks.every((s) => s.done) : t.done));
  const sleep = (h.series?.sleep ?? []).slice(-7).filter((v) => v > 0);
  const avgSleep = sleep.length ? sleep.reduce((s, v) => s + v, 0) / sleep.length : null;

  let overBudget = false, budgetSet = false;
  try {
    const f = useFin.getState();
    overBudget = alertsFor(f).some((a) => a.level === 'over');
    budgetSet = Object.keys(f.budget?.alloc ?? {}).length > 0;
  } catch { /* niente finanze */ }

  const last7 = new Set(Array.from({ length: 7 }, (_, i) => dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i))));
  const moodDaysLast7 = new Set((h.moods ?? []).map((m) => m.day).filter((d): d is string => !!d && last7.has(d))).size;

  const flat = Object.entries(life.events).flatMap(([day, l]) => l.map((e) => ({ day, time: e.time, title: e.title, dur: e.dur })));
  const skippedSessions = skippedWork(flat, life.tasks.map((t) => ({ id: t.id, t: t.t, done: t.done })), now).length;

  const stalledGoals = life.goals.filter((g) => { const last = g.hist?.[g.hist.length - 1]?.d; return g.p < 100 && !!last && daysBetween(last, today) >= 7; }).length;

  let daysSinceWorkout: number | null = null;
  (h.workouts ?? []).forEach((w) => {
    const m = /^(\d{1,2})\/(\d{1,2})$/.exec(w.date ?? '');
    if (!m) return;
    let d = new Date(now.getFullYear(), +m[2] - 1, +m[1]);
    if (d.getTime() > now.getTime() + 86400000) d = new Date(now.getFullYear() - 1, +m[2] - 1, +m[1]);
    const n = daysBetween(ymd(d), today);
    if (n >= 0 && (daysSinceWorkout == null || n < daysSinceWorkout)) daysSinceWorkout = n;
  });

  let eveningEvents = 0;
  for (let i = -3; i < 4; i++) eveningEvents += (life.events[addDays(today, i)] ?? []).filter((e) => (parseTime(e.time) ?? 0) >= 19 * 60).length;

  return {
    openTasks: open.length, urgentTasks: open.filter((t) => t.urgent).length, avgSleep, overBudget, budgetSet, moodDaysLast7,
    skippedSessions, stalledGoals, hasGoals: life.goals.length > 0, daysSinceWorkout, eveningEvents,
    existingKeys: life.automations.map((a) => a.rule?.key).filter((k): k is string => !!k),
  };
}
