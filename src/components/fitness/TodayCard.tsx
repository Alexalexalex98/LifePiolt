import { Pressable, View } from 'react-native';

import { FIT } from '@/components/fitness/kit';
import { Body, Card, H, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { dayOf, waterGoal } from '@/lib/fitness/mealInsights';
import { dailyTargets, sumMacros } from '@/lib/fitness/nutrition';
import { programById } from '@/lib/fitness/programsExtra';
import { weekView } from '@/lib/fitness/plan';
import { Icon } from '@/lib/icons';
import { go } from '@/lib/nav';
import { useFitness } from '@/store/fitness';

/** Il recap fitness di oggi: allenamento (se c'è un piano), cibo e acqua. Ogni riga apre la sua pagina. Sta in LifeFitness e in LifeHealth. */
export function TodayCard() {
  const t = useTheme();
  const fit = useFitness();
  const todayIso = dayOf(Date.now());
  const active = fit.activeProgram ? programById(fit.activeProgram) ?? null : null;
  const week = active && fit.profile ? weekView(active, fit.profile, fit.history, new Date()) : [];
  const today = week.find((d) => d.date === todayIso);
  const plannedToday = Boolean(active && today?.planned && today.session != null);
  const steps = plannedToday ? active!.sessions[today!.session!].steps.length : 0;
  const doneEx = Math.min(steps, ((fit.exDone ?? {})[todayIso]?.idx ?? []).length);
  const minToday = fit.history.filter((w) => w.date === todayIso).reduce((a, w) => a + w.minutes, 0);
  const tg = fit.body ? dailyTargets(fit.body) : null;
  const water = (fit.water ?? {})[todayIso] ?? 0;
  const wGoal = waterGoal(fit.body?.weightKg);
  const todayMeals = fit.meals.filter((m) => dayOf(m.ts) === todayIso);
  const eaten = sumMacros(todayMeals.map((m) => m.macros));
  const hasFood = todayMeals.length > 0;
  const line = (icon: string, title: string, sub: string, pct: number | null, onPress: () => void, col = FIT) => (
    <Pressable key={title} accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={{ paddingVertical: 10 }}>
      <Row gap={12}>
        <Icon name={icon} size={20} color={col} />
        <View style={{ flex: 1 }}>
          <Body bold>{title}</Body>
          <Body small muted>{sub}</Body>
          {pct !== null ? <View style={{ height: 6, borderRadius: 3, backgroundColor: t.chip, overflow: 'hidden', marginTop: 6 }}><View style={{ width: `${Math.max(3, Math.min(100, Math.round(pct * 100)))}%`, height: 6, backgroundColor: col }} /></View> : null}
        </View>
        <Icon name="chevron" size={18} color={t.muted} />
      </Row>
    </Pressable>
  );
  const rows = [
    fit.profile ? line('lifefitness', 'Allenamento',
      plannedToday ? (today!.done ? tl('Fatto oggi{0}', minToday ? ` · ${minToday} min` : '') : doneEx ? tl('{0} esercizi su {1} fatti', doneEx, steps) : tl('Da fare: {0}', active!.sessions[today!.session!].name)) : tl('Giorno di recupero'),
      plannedToday ? (today!.done ? 1 : steps ? doneEx / steps : 0) : null,
      () => go('fitnessPlanDay', { date: todayIso })) : null,
    line('meal', 'Cibo',
      hasFood ? (tg ? tl('{0} su {1} kcal · {2} pasti', eaten.kcal, tg.kcal, todayMeals.length) : tl('{0} kcal · {1} pasti', eaten.kcal, todayMeals.length)) : tl('Nessun pasto registrato oggi'),
      tg && hasFood ? eaten.kcal / tg.kcal : null, () => go('fitnessDay', { day: todayIso })),
    line('drop', 'Acqua', `${(water / 1000).toFixed(1).replace('.', ',')} / ${(wGoal / 1000).toFixed(1).replace('.', ',')} L`, water / wGoal, () => go('fitnessDay', { day: todayIso, focus: 'water' }), '#6aa8ff'),
  ].filter(Boolean);
  return <Card><H>Il tuo oggi</H>{rows}</Card>;
}
