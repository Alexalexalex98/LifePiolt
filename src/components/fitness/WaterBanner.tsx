import { useEffect, useState } from 'react';
import { AppState, Pressable, View } from 'react-native';

import { FIT, Ring } from '@/components/fitness/kit';
import { Body, Btn, Card, Input, Pill, Row, Sheet } from '@/components/ui';
import { Text } from '@/components/T';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { dayOf, waterGoal } from '@/lib/fitness/mealInsights';
import { FOOD, macrosFor, searchFoods, type Food } from '@/lib/fitness/nutrition';
import { bannerMinutes, DRINKS, sinceText, type Drink } from '@/lib/fitness/waterBanner';
import { Icon } from '@/lib/icons';
import { useFitness } from '@/store/fitness';
import { toast } from '@/store/toast';

/** «Hai bevuto?»: compare quando apri l'app e non hai segnato acqua da un po'. Segni i bicchieri o un'altra bevanda; si spegne dal diario. */
export function WaterBanner() {
  const t = useTheme();
  const fit = useFitness();
  const [other, setOther] = useState(false);
  const [tick, setTick] = useState(0);
  const [q, setQ] = useState('');
  useEffect(() => { const s = AppState.addEventListener('change', (st) => { if (st === 'active') setTick((n) => n + 1); }); return () => s.remove(); }, []);
  const used = !!(fit.profile || fit.body || fit.meals.length || Object.keys(fit.water ?? {}).length);
  const wb = fit.waterBanner ?? { on: true, afterMin: 120, snoozeUntil: 0 };
  const wr = fit.waterRemind ?? { from: '09:00', to: '21:00' };
  const now = Date.now();
  const min = used ? bannerMinutes({ now, on: wb.on, afterMin: wb.afterMin, from: wr.from, to: wr.to, lastDrink: fit.lastDrink ?? 0, snoozeUntil: wb.snoozeUntil, todayMl: (fit.water ?? {})[dayOf(now)] ?? 0, goalMl: waterGoal(fit.body?.weightKg) }) : null;
  void tick;
  if (min === null && !other) return null;

  const drink = (d: Drink) => {
    if (d.hydrate > 0) fit.addWater(Math.round(d.ml * d.hydrate));
    else fit.set({ lastDrink: Date.now() });
    const f = d.food ? FOOD(d.food) : undefined;
    if (f) fit.addMeal({ ts: Date.now(), name: d.label, foodId: f.id, grams: d.ml, macros: macrosFor(f, d.ml) });
    setOther(false);
    toast(f ? tl('Segnato: {0} (è anche nel diario dei pasti)', d.label) : tl('Segnato: {0}', d.label));
  };
  const liquid = /succo|latte|bibita|t[eè]\b|caff|birra|vino|cola|acqua|spremuta|bevanda|frullato|tisana|aranciata|limonata|smoothie|energy|bevi/i;
  const food = (f: Food) => {
    const ml = f.portion || 200;
    if (liquid.test(f.name)) fit.addWater(Math.round(ml * 0.85)); else fit.set({ lastDrink: Date.now() });
    fit.addMeal({ ts: Date.now(), name: f.name, foodId: f.id, grams: ml, macros: macrosFor(f, ml) });
    setOther(false); setQ('');
    toast(tl('Segnato: {0} (è anche nel diario dei pasti)', f.name));
  };
  const ml = (fit.water ?? {})[dayOf(now)] ?? 0;
  const goal = waterGoal(fit.body?.weightKg);
  const L = (n: number) => `${(n / 1000).toFixed(1).replace('.', ',')} L`;
  const found = q.trim() ? searchFoods(q, 10) : [];
  return (
    <>
      {min !== null ? (
        <Card accent={FIT}>
          <Row gap={14}>
            <Ring value={ml / goal} size={92} stroke={9} color="#6aa8ff" big={L(ml)} small={tl('su {0}', L(goal))} />
            <View style={{ flex: 1 }}>
              <Body bold>{tl('Non segni acqua da {0}', sinceText(min))}</Body>
              <Body small muted>{tl('Ti mancano ancora {0}', L(Math.max(0, goal - ml)))}</Body>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={tl('Non mostrare più il banner')} hitSlop={10} onPress={() => { fit.setWaterBanner({ on: false }); toast('Banner spento: lo riaccendi dallo storico dei pasti'); }} style={{ alignSelf: 'flex-start' }}><Icon name="x" size={18} color={t.muted} /></Pressable>
          </Row>
          <Body small bold muted style={{ marginTop: 12, marginBottom: 8 }}>Quanta ne hai bevuta?</Body>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[200, 330, 500].map((n) => (
              <Pressable key={n} accessibilityRole="button" accessibilityLabel={tl('Aggiungi {0} ml', n)} onPress={() => { fit.addWater(n); toast(tl('Segnato: {0} ml', n)); }} style={{ flex: 1, height: 46, borderRadius: 16, backgroundColor: '#6aa8ff22', borderWidth: 1, borderColor: '#6aa8ff55', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: t.text, fontWeight: '800', fontSize: 15 }}>{n} ml</Text>
              </Pressable>
            ))}
          </View>
          <Row style={{ marginTop: 10 }} gap={8}>
            <Btn small ghost style={{ flex: 1 }} title="Altra bevanda" icon="search" onPress={() => setOther(true)} />
            <Btn small ghost style={{ flex: 1 }} title="Più tardi" onPress={() => fit.setWaterBanner({ snoozeUntil: Date.now() + 30 * 60000 })} />
          </Row>
        </Card>
      ) : null}
      <Sheet visible={other} icon="drop" title="Cosa hai bevuto?" onClose={() => { setOther(false); setQ(''); }}>
        <Input placeholder="Cerca tra gli alimenti e le bevande" value={q} onChangeText={setQ} />
        {found.length ? found.map((f) => (
          <Pressable key={f.id} accessibilityRole="button" onPress={() => food(f)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: t.sheetBorder }}>
            <Text style={{ color: t.text, flex: 1, fontWeight: '600' }}>{f.name}</Text>
            <Body small muted>{f.portion} g · {Math.round(f.kcal * f.portion / 100)} kcal</Body>
          </Pressable>
        )) : (
          <>
            <Body small muted>Tocca la bevanda: segno una porzione tipica. Il conteggio dei liquidi è una stima. Se ha calorie la metto anche nel diario dei pasti.</Body>
            <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginTop: 10 }} gap={8}>
              {DRINKS.map((d) => <Pill key={d.id} label={`${tl(d.label)} · ${d.ml} ml`} onPress={() => drink(d)} />)}
            </Row>
          </>
        )}
      </Sheet>
    </>
  );
}
