import { t } from '@/i18n/core';
import { scheduleAt } from '@/lib/notify';
import { ovenLeadMin, planBackwards, type FullRecipe } from './book';

/** Programma le notifiche per mangiare all'ora scelta: quando iniziare e, se serve, quando accendere il forno. */
export async function remindPlan(r: FullRecipe, eatAt: number): Promise<boolean> {
  const pb = planBackwards(r, eatAt);
  const res = await scheduleAt(`lp-rplan-${r.id}`, new Date(pb.start), `${t('Ora di cucinare')}: ${r.name}`, t('Per mangiare all\'ora scelta, inizia adesso.'), { screen: 'recipes' }).catch(() => ({ ok: false } as { ok: boolean }));
  const oi = r.steps.findIndex((s) => s.oven);
  if (oi >= 0) { const o = r.steps[oi]!.oven!; await scheduleAt(`lp-roven-${r.id}`, new Date(pb.at[oi]! - ovenLeadMin(o) * 60000), t('Accendi il forno'), `${r.name}: ${o.temp}° ${t(o.mode)}`, { screen: 'recipes' }).catch(() => undefined); }
  return !!res.ok;
}
