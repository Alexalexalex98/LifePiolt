import { challengesReachedCount } from '@/lib/petStats';
import { levelOf } from '@/lib/pet';
import type { Stats } from '@/lib/petMilestones';
import { useFin } from '@/store/finance';
import { useFitness } from '@/store/fitness';
import { useHealth } from '@/store/health';
import { useLife } from '@/store/life';
import { useMindSpace } from '@/store/mindSpace';
import { usePet } from '@/store/pet';

/** I numeri veri da cui nascono i traguardi di Theia, letti dall'app. */
export function petStats(): Stats {
  const life = useLife.getState(), fit = useFitness.getState(), health = useHealth.getState(), fin = useFin.getState(), pet = usePet.getState().pet;
  const savingMonths = fin.months.slice(1).filter((m) => { const inc = m.movements.filter((x) => x.amount > 0).reduce((a, x) => a + x.amount, 0), out = -m.movements.filter((x) => x.amount < 0).reduce((a, x) => a + x.amount, 0); return inc > 0 && (inc - out) / inc >= 0.1; }).length;
  return {
    tasksDone: life.tasks.filter((t) => t.done).length,
    workouts: health.workouts.length + fit.history.length,
    goalsDone: life.goals.filter((g) => g.p >= 100).length,
    meals: fit.meals.length,
    mindEntries: useMindSpace.getState().entries.length,
    challengesReached: challengesReachedCount(),
    careDays: pet.streak,
    savingMonths,
    level: levelOf(pet.xp),
  };
}
