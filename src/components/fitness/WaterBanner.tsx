import { useEffect, useState } from 'react';
import { AppState, Pressable, View } from 'react-native';

import { FIT } from '@/components/fitness/kit';
import { Body, Btn, Card, Pill, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { dayOf, waterGoal } from '@/lib/fitness/mealInsights';
import { FOOD, macrosFor } from '@/lib/fitness/nutrition';
import { bannerMinutes, DRINKS, GLASS_ML, sinceText, type Drink } from '@/lib/fitness/waterBanner';
import { Icon } from '@/lib/icons';
import { useFitness } from '@/store/fitness';
import { toast } from '@/store/toast';

/** «Hai bevuto?»: compare quando apri l'app e non hai segnato acqua da un po'. Segni i bicchieri o un'altra bevanda; si spegne dal diario. */
export function WaterBanner() {
  const t = useTheme();
  const fit = useFitness();
  const [other, setOther] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => { const s = AppState.addEventListener('change', (st) => { if (st === 'active') setTick((n) => n + 1); }); return () => s.remove(); }, []);
  const used = !!(fit.profile || fit.body || fit.meals.length || Object.keys(fit.water ?? {}).length);
  const wb = fit.waterBanner ?? { on: true, afterMin: 120, snoozeUntil: 0 };
  const wr = fit.waterRemind ?? { from: '09:00', to: '21:00' };
  const now = Date.now();
  const min = used ? bannerMinutes({ now, on: wb.on, afterMin: wb.afterMin, from: wr.from, to: wr.to, lastDrink: fit.lastDrink ?? 0, snoozeUntil: wb.snoozeUntil, todayMl: (fit.water ?? {})[dayOf(now)] ?? 0, goalMl: waterGoal(fit.body?.weightKg) }) : null;
  void tick;
  if (min === null && !other) return null;

  const add = (glasses: number) => { fit.addWater(glasses * GLASS_ML); toast(glasses === 1 ? tl('Segnato: 1 bicchiere') : tl('Segnato: {0} bicchieri', glasses)); };
  const drink = (d: Drink) => {
    if (d.hydrate > 0) fit.addWater(Math.round(d.ml * d.hydrate));
    else fit.set({ lastDrink: Date.now() });
    const f = d.food ? FOOD(d.food) : undefined;
    if (f) fit.addMeal({ ts: Date.now(), name: d.label, foodId: f.id, grams: d.ml, macros: macrosFor(f, d.ml) });
    setOther(false);
    toast(f ? tl('Segnato: {0} (è anche nel diario dei pasti)', d.label) : tl('Segnato: {0}', d.label));
  };
  return (
    <>
      {min !== null ? (
        <Card accent={FIT}>
          <Row gap={10}>
            <Icon name="drop" size={26} color={FIT} />
            <View style={{ flex: 1 }}>
              <Body bold>{tl('Non segni acqua da {0}', sinceText(min))}</Body>
              <Body small muted>Hai bevuto? Segnalo qui.</Body>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={tl('Non mostrare più il banner')} hitSlop={10} onPress={() => { fit.setWaterBanner({ on: false }); toast('Banner spento: lo riaccendi dallo storico dei pasti'); }}><Icon name="x" size={18} color={t.muted} /></Pressable>
          </Row>
          <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginTop: 10 }} gap={8}>
            <Btn small title="1 bicchiere" onPress={() => add(1)} />
            <Btn small ghost title="2" onPress={() => add(2)} />
            <Btn small ghost title="3" onPress={() => add(3)} />
            <Btn small ghost title="Altro" onPress={() => setOther(true)} />
            <Btn small ghost title="Più tardi" onPress={() => fit.setWaterBanner({ snoozeUntil: Date.now() + 30 * 60000 })} />
          </Row>
        </Card>
      ) : null}
      <Sheet visible={other} title="Cosa hai bevuto?" onClose={() => setOther(false)}>
        <Body small muted>Tocca la bevanda: segno una porzione tipica. Il conteggio dei liquidi è una stima. Se ha calorie la metto anche nel diario dei pasti.</Body>
        <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginTop: 10 }} gap={8}>
          {DRINKS.map((d) => <Pill key={d.id} label={`${tl(d.label)} · ${d.ml} ml`} off onPress={() => drink(d)} />)}
        </Row>
      </Sheet>
    </>
  );
}
