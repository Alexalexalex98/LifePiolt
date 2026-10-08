import { dayKey } from '@/lib/format';
import { ddmmToIso, type GoalInputs } from '@/lib/goalData';
import { monthNet, useFin } from '@/store/finance';
import { pointsOf, useHealth } from '@/store/health';

/** Raccoglie dagli store i dati che servono a calcolare l'avanzamento degli obiettivi collegati. */
export function goalInputsNow(): GoalInputs {
  const today = dayKey();
  const h = useHealth.getState();
  const fin = useFin.getState();
  const cur = fin.months[0];
  return {
    today,
    series: { steps: pointsOf(h, 'steps'), sleep: pointsOf(h, 'sleep'), mindful: pointsOf(h, 'mindful'), exercise: pointsOf(h, 'exercise') },
    workoutDays: h.workouts.map((w) => ddmmToIso(w.date, today)).filter((d): d is string => !!d),
    monthNet: cur ? monthNet(cur) : null,
  };
}
