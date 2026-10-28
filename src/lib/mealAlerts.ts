import { t } from '@/i18n/core';
import { upcomingMealAlerts } from '@/lib/fitness/mealStock';
import { cancelByPrefix, isSupported, native, scheduleAt } from '@/lib/notify';
import { usePantry } from '@/store/pantry';

export const MEAL_ALERT_PREFIX = 'lp-meal-';
const SLOT: Record<string, string> = { colazione: 'Colazione', spuntino: 'Spuntino', pranzo: 'Pranzo', merenda: 'Merenda', cena: 'Cena' };

/**
 * Avvisi prima di un pasto del piano se in frigo mancano gli ingredienti (come i promemoria per bere). Si riprogrammano
 * all'apertura dell'app e quando cambiano piano, frigo o impostazioni; si spengono dal Piano alimentare o in chat.
 */
export async function refreshMealAlerts(): Promise<void> {
  if (!isSupported()) return;
  try {
    const N = native(); if (!N) return;
    await cancelByPrefix(MEAL_ALERT_PREFIX);
    if ((await N.getPermissionsAsync()).status !== 'granted') return;
    const p = usePantry.getState();
    for (const a of upcomingMealAlerts(p.plan, p.items, new Date(), p.mealAlert, 2)) {
      const more = a.missing.length > 4 ? ` ${t('e altri {0}', a.missing.length - 4)}` : '';
      await scheduleAt(a.id, a.at, t('{0} alle {1}: ti mancano degli ingredienti', t(SLOT[a.slot] ?? a.slot), a.time), t('«{0}»: in frigo non hai {1}{2}. Tocca per vedere la lista della spesa.', a.mealName, a.missing.slice(0, 4).join(', '), more), { ref: 'reminder:food' }, 'promemoria');
    }
  } catch { /* mai bloccare l'app per una notifica */ }
}
