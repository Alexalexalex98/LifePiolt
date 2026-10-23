import { useFitness } from '@/store/fitness';
import { useHealth } from '@/store/health';
import { useLife } from '@/store/life';
import { earnedToday, type Earned } from '@/lib/pet';
import { dayKey } from '@/lib/format';

/** I gettoni di oggi, dalle cose vere fatte nell'app: task completati, pasti e acqua segnati, allenamenti, umore. */
export function useEarned(): { earned: Earned; day: string } {
  const day = dayKey();
  const tasksDone = useLife((s) => s.tasks.filter((t) => t.done && t.doneAt === day).length);
  const meals = useFitness((s) => s.meals.filter((m) => dayKey(new Date(m.ts)) === day).length);
  const waterMl = useFitness((s) => (s.water ?? {})[day] ?? 0);
  const workouts = useHealth((s) => s.workouts.filter((w) => w.date?.slice(0, 10) === day).length) + useFitness((s) => s.history.filter((w) => ((w as { date?: string }).date ?? '').slice(0, 10) === day).length);
  const moodLogged = useHealth((s) => s.moods.some((m) => (m.day ?? m.date)?.slice(0, 10) === day));
  return { earned: earnedToday({ tasksDone, mealsLogged: meals, waterMl, workouts, moodLogged }), day };
}
