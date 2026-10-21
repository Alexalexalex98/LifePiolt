import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { FIT } from '@/components/fitness/kit';
import { Body, Btn, Card, H, Item, Page, Pill, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { mealOpinion, slotOf } from '@/lib/fitness/mealInsights';
import { FOOD, dailyTarget, macrosFor } from '@/lib/fitness/nutrition';
import { router } from 'expo-router';
import { go } from '@/lib/nav';
import { useFitness } from '@/store/fitness';

const SLOT: Record<string, string> = { colazione: 'Colazione', pranzo: 'Pranzo', merenda: 'Merenda', cena: 'Cena', notte: 'Dopo cena' };

/** La scheda di un pasto: foto, ingredienti, valori e il parere di Theia. */
export default function FitnessMealCard() {
  const t = useTheme();
  const fit = useFitness();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const m = fit.meals.find((x) => x.id === String(id));
  if (!m) return <Page id="fitnessMealCard" back title="Pasto"><Card><Body muted>Questo pasto non c'è più.</Body></Card></Page>;
  const x = m.macros;
  const op = mealOpinion(m, { targetKcal: fit.body ? dailyTarget(fit.body) : undefined, weightKg: fit.body?.weightKg, goal: fit.body?.goal });
  const when = new Date(m.ts).toLocaleString(undefined, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  const items = m.items?.length ? m.items : [{ foodId: m.foodId ?? '', name: m.name, grams: m.grams }];
  return (
    <Page id="fitnessMealCard" back title={m.name}>
      {m.photo ? <Image source={{ uri: m.photo }} style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: 18 }} contentFit="cover" cachePolicy="disk" /> : null}
      <Card>
        <H>{m.name}</H>
        <Body small muted style={{ textTransform: 'capitalize' }}>{`${tl(SLOT[slotOf(m.ts)])} · ${when}`}</Body>
        <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginTop: 10 }} gap={8}>
          <Pill label={`${x.kcal} kcal`} off /><Pill label={`P ${x.p} g`} off /><Pill label={`C ${x.c} g`} off /><Pill label={`G ${x.f} g`} off />
        </Row>
        <Body small muted style={{ marginTop: 10 }}>{tl('zuccheri {0} g · grassi saturi {1} g · fibre {2} g · sale {3} g', x.sug ?? 0, x.sat ?? 0, x.fib ?? 0, x.salt ?? 0)} · {tl('stima')}</Body>
      </Card>
      <Card accent={FIT}>
        <Row><H style={{ flex: 1 }}>Il parere di Theia</H><Pill label={op.verdict === 'ok' ? 'Va bene' : 'Da migliorare'} on={op.verdict === 'ok'} off={op.verdict !== 'ok'} /></Row>
        <Body style={{ marginTop: 6 }}>{op.text}</Body>
        <Body small muted style={{ marginTop: 8 }}>È calcolato sui valori di questo pasto, non su una visita: non è un consiglio medico né nutrizionale.</Body>
      </Card>
      <Card>
        <H>Cosa c'è dentro</H>
        {items.map((it, i) => { const f = FOOD(it.foodId); return <Item key={i} last={i === items.length - 1}><Row><Body style={{ flex: 1 }}>{it.name}</Body><Body small muted>{`${it.grams} g${f ? ` · ${macrosFor(f, it.grams).kcal} kcal` : ''}`}</Body></Row></Item>; })}
      </Card>
      <Btn title="Modifica il pasto" onPress={() => go('fitnessMeal', { edit: m.id })} />
      <Btn ghost style={{ marginTop: 8 }} title="Elimina il pasto" onPress={() => { fit.delMeal(m.id); router.back(); }} />
    </Page>
  );
}
