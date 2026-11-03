import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';

import { t } from '@/i18n/core';
import { cancel, scheduleAt } from '@/lib/notify';
import { useRecipes, type KTimer } from '@/store/recipes';
import { toast } from '@/store/toast';

const uid = () => Math.random().toString(36).slice(2, 9);
const nid = (id: string) => `lp-rt-${id}`;

/** Avvia un timer da cucina: continua anche con lo schermo spento (notifica) e al riavvio dell'app. */
export function startTimer(label: string, sec: number, recipeId?: string): string {
  const id = uid(); const endAt = Date.now() + sec * 1000;
  useRecipes.getState().addTimer({ id, recipeId, label, sec, endAt });
  void scheduleAt(nid(id), new Date(endAt), `${t('Timer')}: ${label}`, t('È ora! Controlla la pentola o il forno.'), { screen: 'recipes' }).catch(() => undefined);
  return id;
}
export function stopTimer(id: string) { useRecipes.getState().removeTimer(id); void cancel(nid(id)).catch(() => undefined); }
export function addMinutes(id: string, min: number) {
  const tm = useRecipes.getState().timers.find((x) => x.id === id); if (!tm) return;
  const endAt = Math.max(Date.now(), tm.endAt) + min * 60000;
  useRecipes.getState().patchTimer(id, { endAt, fired: false });
  void scheduleAt(nid(id), new Date(endAt), `${t('Timer')}: ${tm.label}`, t('È ora! Controlla la pentola o il forno.'), { screen: 'recipes' }).catch(() => undefined);
}
export const secLeft = (tm: KTimer, now = Date.now()): number => Math.max(0, Math.ceil((tm.endAt - now) / 1000));

/** I timer attivi con un orologio che scatta ogni secondo; quando uno finisce vibra e avvisa (una volta sola). */
export function useKitchenTimers(): { timers: KTimer[]; now: number } {
  const timers = useRecipes((s) => s.timers);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { if (!timers.length) return; const h = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(h); }, [timers.length]);
  useEffect(() => {
    for (const tm of timers) if (!tm.fired && tm.endAt <= now) {
      useRecipes.getState().patchTimer(tm.id, { fired: true });
      toast(`${t('Timer finito')}: ${tm.label}`);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    }
  }, [now, timers]);
  return { timers, now };
}
