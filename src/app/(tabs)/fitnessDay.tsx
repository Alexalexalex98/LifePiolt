import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { Pressable, View } from 'react-native';

import { DaySummary } from '@/components/fitness/DaySummary';
import { FIT } from '@/components/fitness/kit';
import { Body, Btn, Card, H, Item, Page, Pill, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { withMicro } from '@/lib/fitness/mealMicro';
import { NUTRITION_LEGAL } from '@/lib/fitness/micro';
import { dayOf, dayStats, groupByDay, quality, slotOf, waterGoal } from '@/lib/fitness/mealInsights';
import { dailyTargets } from '@/lib/fitness/nutrition';
import { Icon } from '@/lib/icons';
import { go } from '@/lib/nav';
import { useFitness } from '@/store/fitness';

const SLOT: Record<string, string> = { colazione: 'Colazione', pranzo: 'Pranzo', merenda: 'Merenda', cena: 'Cena', notte: 'Dopo cena' };
const hhmm = (ts: number) => new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

/** Resoconto di un giorno: quanto dovresti mangiare e quanto hai mangiato (colori), acqua, qualità del giorno e i pasti. */
export default function FitnessDay() {
  const t = useTheme();
  const fit = useFitness();
  const { day } = useLocalSearchParams<{ day?: string }>();
  const key = day && /^\d{4}-\d{2}-\d{2}$/.test(String(day)) ? String(day) : dayOf(Date.now());
  const g = groupByDay(withMicro(fit.meals)).find((x) => x.key === key);
  const water = (fit.water ?? {})[key] ?? 0;
  const tg = fit.body ? dailyTargets(fit.body) : null;
  const q = tg ? quality(dayStats(g, water), tg) : null;
  const [y, m, d] = key.split('-').map(Number);
  const title = new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  const goal = waterGoal(fit.body?.weightKg);
  const qCol = q ? (q.level === 'ok' ? '#5fd39a' : q.level === 'attenzione' ? '#ffb020' : t.danger) : FIT;
  return (
    <Page id="fitnessDay" back title="Resoconto del giorno">
      <Card accent={FIT}>
        <H style={{ textTransform: 'capitalize' }}>{title}</H>
        <DaySummary meals={g?.meals ?? []} micro={g?.micro} waterMl={water} body={fit.body} />
        <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginTop: 10 }} gap={8}>
          {[200, 500, 1000].map((ml) => <Pill key={ml} label={ml === 1000 ? '+ 1 L acqua' : `+ ${ml} ml acqua`} off onPress={() => { fit.addWater(ml, key); }} />)}
          {water > 0 ? <Pill label="Annulla ultimo" off onPress={() => { fit.addWater(-200, key); }} /> : null}
        </Row>
        {water < goal * 0.5 && key === dayOf(Date.now()) && new Date().getHours() >= 15 ? <Body small style={{ marginTop: 6, color: '#ffb020' }}>Oggi hai bevuto poco: ti conviene bere qualcosa nelle prossime ore.</Body> : null}
      </Card>

      {q ? (
        <Card>
          <Row><H style={{ flex: 1 }}>Qualità della giornata</H><Body bold style={{ color: qCol, fontSize: 22 }}>{`${q.score}/100`}</Body></Row>
          <Body bold style={{ color: qCol }}>{tl(q.label)}</Body>
          {q.parts.map((p) => <Row key={p.id} style={{ marginTop: 4 }}><Body small muted>{tl(p.label)}</Body><Body small>{`${Math.round(p.score)}/${p.max} · ${p.note}`}</Body></Row>)}
          <Body small muted style={{ marginTop: 8 }}>Si basa su calorie, macronutrienti, zuccheri, grassi saturi, fibre, sale, acqua e su una stima di vitamine e minerali. Non è un dato medico.</Body>
        </Card>
      ) : !fit.body ? <Card><Body muted>Per vedere cosa dovresti mangiare e la qualità del giorno imposta i tuoi dati (sesso, età, peso, altezza).</Body><Btn style={{ marginTop: 8 }} title="Imposta l'obiettivo" onPress={() => go('fitnessMeal')} /></Card> : null}

      <Body small muted>{NUTRITION_LEGAL}</Body>
      <Card>
        <H>I pasti del giorno</H>
        {!g ? <Body muted>Nessun pasto registrato.</Body> : g.meals.map((x, i) => (
          <Item key={x.id} last={i === g.meals.length - 1}>
            <Pressable accessibilityRole="button" accessibilityLabel={x.name} onPress={() => go('fitnessMealCard', { id: x.id })}>
              <Row gap={10}>
                {x.photo ? <Image source={{ uri: x.photo }} style={{ width: 52, height: 52, borderRadius: 12 }} contentFit="cover" /> : <View style={{ width: 52, height: 52, borderRadius: 12, backgroundColor: t.chip, alignItems: 'center', justifyContent: 'center' }}><Icon name="lifefitness" size={22} color={t.muted} /></View>}
                <View style={{ flex: 1 }}><Body bold numberOfLines={1}>{x.name}</Body><Body small muted>{`${tl(SLOT[slotOf(x.ts)])} · ${hhmm(x.ts)} · ${x.macros.kcal} kcal`}</Body></View>
                <Icon name="chevron" size={18} color={t.muted} />
              </Row>
            </Pressable>
          </Item>
        ))}
        <Btn style={{ marginTop: 10 }} ghost icon="camera" title="Aggiungi un pasto" onPress={() => go('fitnessMeal')} />
      </Card>
    </Page>
  );
}
