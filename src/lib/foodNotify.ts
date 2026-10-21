import { t } from '@/i18n/core';
import { cancel, cancelByPrefix, isSupported, native, parseHM, scheduleDaily } from '@/lib/notify';
import { dayOf, groupByDay, waterTimes } from '@/lib/fitness/mealInsights';
import { useFitness } from '@/store/fitness';

export const FOOD_EVENING_ID = 'lp-food-evening';
export const WATER_PREFIX = 'lp-water-';

/**
 * Notifiche locali del cibo: la domanda serale («com'è andata con il cibo, quanta acqua hai bevuto?») e i promemoria per bere.
 * Si riprogrammano all'apertura dell'app e quando cambi le impostazioni. Mai bloccanti; senza permesso non fanno nulla.
 */
export async function refreshFoodReminders(): Promise<void> {
  if (!isSupported()) return;
  try {
    const N = native();
    if (!N) return;
    const st = await N.getPermissionsAsync();
    const allowed = st.status === 'granted';
    const fit = useFitness.getState();
    if (!allowed || !fit.eveningCheck?.on) await cancel(FOOD_EVENING_ID);
    else {
      const [h, m] = parseHM(fit.eveningCheck.at, [20, 45]);
      const today = groupByDay(fit.meals).find((g) => g.key === dayOf(Date.now()));
      const body = today
        ? t('Oggi hai registrato {0} pasti (circa {1} kcal). Quanta acqua hai bevuto?', today.meals.length, today.total.kcal)
        : t('Oggi non hai registrato pasti. Vuoi aggiungerli e dirmi quanta acqua hai bevuto?');
      await scheduleDaily(FOOD_EVENING_ID, h, m, t('Com’è andata con il cibo oggi?'), body, { ref: 'reminder:food' });
    }
    await cancelByPrefix(WATER_PREFIX);
    const w = fit.waterRemind;
    if (allowed && w?.on) {
      const times = waterTimes(w.everyMin, w.from, w.to);
      for (let i = 0; i < times.length; i++) {
        const [hh, mm] = parseHM(times[i], [12, 0]);
        await scheduleDaily(`${WATER_PREFIX}${i}`, hh, mm, t('Un po’ d’acqua?'), t('Bevi un bicchiere d’acqua: tocca per segnarlo.'), { ref: 'reminder:water' });
      }
    }
  } catch { /* mai bloccare l'app per una notifica */ }
}
