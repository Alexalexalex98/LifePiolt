import { collect } from '@/lib/analyticsData';
import { dayKey } from '@/lib/format';
import type { WbInput } from '@/lib/wellbeing';
import { useApp } from '@/store/app';
import { useAssistant } from '@/store/assistant';
import { useChat } from '@/store/chat';
import { useFitness } from '@/store/fitness';
import { useHealth } from '@/store/health';
import { useLife } from '@/store/life';
import { useNet } from '@/store/network';

/** Quello che serve per accorgersi di un cambiamento, letto SOLO dal telefono: niente esce, niente va all'AI. */
export function wellbeingInput(): WbInput {
  const today = dayKey();
  const me = useApp.getState().account.name;
  const series = collect(today);
  const by = (id: string) => series.find((s) => s.def.id === id)?.pts ?? [];
  const health = useHealth.getState(), fit = useFitness.getState(), life = useLife.getState();
  const msgs = useChat.getState().messages ?? {};
  const sentDays = Object.values(msgs).flat().filter((m) => m.from === me && m.kind === 'text').map((m) => dayKey(new Date(m.ts)));
  const cutoff = Date.now() - 14 * 86400000;
  return {
    today,
    sleep: by('sleep'), mood: by('mood'), tasksDone: by('tasks'),
    workoutDays: [...health.workouts.map((w) => w.date?.slice(0, 10) ?? ''), ...fit.history.map((w) => ((w as { date?: string }).date ?? '').slice(0, 10))].filter(Boolean),
    sentDays,
    declined: useNet.getState().enrollments.filter((e) => e.status === 'declined' && e.createdAt >= cutoff).length,
    overdueTasks: life.tasks.filter((t) => !t.done && t.due && t.due < today).length,
    mealDays: fit.meals.map((m) => dayKey(new Date(m.ts))),
    texts: useAssistant.getState().log.filter((m) => m.who === 'me' && m.text).map((m) => ({ d: dayKey(new Date(m.ts)), text: m.text })),
  };
}
