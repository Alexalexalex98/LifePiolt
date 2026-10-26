import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { DaySummary } from '@/components/fitness/DaySummary';
import { MealCalendar } from '@/components/fitness/MealCalendar';
import { RecapStats } from '@/components/fitness/RecapStats';
import { addDays } from '@/lib/fitness/dayPlan';
import { FIT } from '@/components/fitness/kit';
import { Body, Btn, Card, H, Item, Page, Pill, Row, TabRow } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { withMicro } from '@/lib/fitness/mealMicro';
import { NUTRITION_LEGAL } from '@/lib/fitness/micro';
import { dayOf, displayName, dayStats, groupByDay, periodStats, quality, slotOf, waterGoal } from '@/lib/fitness/mealInsights';
import { waterLevel } from '@/lib/fitness/waterInsights';
import { dailyTargets } from '@/lib/fitness/nutrition';
import { Icon } from '@/lib/icons';
import { go } from '@/lib/nav';
import { useFitness } from '@/store/fitness';

const Bar = ({ value, max, color }: { value: number; max: number; color: string }) => {
  const t = useTheme();
  return <View style={{ height: 8, borderRadius: 4, backgroundColor: t.chip, overflow: 'hidden', marginVertical: 6 }}><View style={{ width: `${Math.min(100, Math.round((value / Math.max(1, max)) * 100))}%`, height: 8, backgroundColor: color }} /></View>;
};
const SLOT: Record<string, string> = { colazione: 'Colazione', pranzo: 'Pranzo', merenda: 'Merenda', cena: 'Cena', notte: 'Dopo cena' };
const hhmm = (ts: number) => new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

/** Resoconto di un giorno: quanto dovresti mangiare e quanto hai mangiato (colori), acqua, qualità del giorno e i pasti. */
export default function FitnessDay() {
  const t = useTheme();
  const fit = useFitness();
  const { day, focus } = useLocalSearchParams<{ day?: string; focus?: string }>();
  const [per, setPer] = useState('Giorno');
  const [sel, setSel] = useState<string | null>(null);
  const [cal, setCal] = useState(false);
  const key = sel ?? (day && /^\d{4}-\d{2}-\d{2}$/.test(String(day)) ? String(day) : dayOf(Date.now()));
  const g = groupByDay(withMicro(fit.meals)).find((x) => x.key === key);
  const water = (fit.water ?? {})[key] ?? 0;
  const tg = fit.body ? dailyTargets(fit.body) : null;
  const q = tg ? quality(dayStats(g, water), tg) : null;
  const [y, m, d] = key.split('-').map(Number);
  const title = new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  const goal = waterGoal(fit.body?.weightKg);
  const isToday = key === dayOf(Date.now());
  const wl = waterLevel(water, goal);
  const qCol = q ? (q.level === 'ok' ? '#5fd39a' : q.level === 'attenzione' ? '#ffb020' : t.danger) : FIT;

  /* settimana, mese, anno, da sempre: media al giorno sui giorni con pasti registrati */
  if (per !== 'Giorno') {
    const meals = withMicro(fit.meals);
    const end = new Date(); end.setHours(23, 59, 59, 0);
    const first = meals.length ? Math.min(...meals.map((x) => x.ts)) : end.getTime();
    const days = per === 'Settimana' ? 7 : per === 'Mese' ? 30 : per === 'Anno' ? 365 : Math.max(1, Math.ceil((end.getTime() - first) / 86400000));
    const st = periodStats(meals, fit.water ?? {}, end.getTime(), days);
    const since = dayOf(end.getTime() - days * 86400000);
    const inRange = meals.filter((x) => dayOf(x.ts) >= since);
    const totalKcal = inRange.reduce((a, x) => a + x.macros.kcal, 0);
    return (
      <Page id="fitnessDay" back title="Pasti e calorie">
        <TabRow options={['Giorno', 'Settimana', 'Mese', 'Anno', 'Sempre']} value={per} onChange={setPer} />
        <Card accent={FIT}>
          <H>{per === 'Sempre' ? tl('Da sempre') : per === 'Settimana' ? tl('Ultima settimana') : per === 'Mese' ? tl('Ultimo mese') : tl('Ultimo anno')}</H>
          {st.days ? (
            <>
              <Body small muted>{tl('Media al giorno sui {0} giorni con pasti registrati ({1} pasti, {2} kcal in tutto).', st.days, inRange.length, totalKcal)}</Body>
              <DaySummary meals={[]} avg={st.avg} micro={st.micro} waterMl={st.waterMl} body={fit.body} />
            </>
          ) : <Body muted>Nessun pasto registrato in questo periodo.</Body>}
        </Card>
        <RecapStats meals={meals} days={days} targetKcal={tg?.kcal} sugarMax={tg?.sugarMax} now={end.getTime()} />
        <Btn ghost title="Giorno per giorno, con foto e analisi di Theia" onPress={() => go('fitnessDiary')} />
        <Body small muted>{NUTRITION_LEGAL}</Body>
      </Page>
    );
  }
  const waterCard = (
      <Card accent={focus === 'water' ? FIT : undefined}>
        <Row><H style={{ flex: 1 }}>Acqua</H><Body bold>{`${(water / 1000).toFixed(1).replace('.', ',')} / ${(goal / 1000).toFixed(1).replace('.', ',')} L`}</Body></Row>
        <Bar value={water} max={goal} color={FIT} />
        <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginTop: 8 }} gap={8}>
          {[200, 500, 1000].map((ml) => <Pill key={ml} label={ml === 1000 ? '+ 1 L acqua' : `+ ${ml} ml acqua`} onPress={() => { fit.addWater(ml, key); }} />)}
          {water > 0 ? <Pill label="Annulla ultimo" onPress={() => { fit.addWater(-200, key); }} /> : null}
        </Row>
        {isToday && water < goal ? <Body small muted style={{ marginTop: 6 }}>{tl('Ti mancano ancora {0} per arrivare all\'obiettivo.', `${(Math.max(0, goal - water) / 1000).toFixed(1).replace('.', ',')} L`)}</Body> : null}
        {water >= goal ? <Body small style={{ marginTop: 6, color: '#5fd39a' }}>Obiettivo raggiunto per questo giorno.</Body> : null}
        {water > 0 && wl === 'troppa' ? <Body small style={{ marginTop: 6, color: '#ffb020' }}>Hai bevuto molta più acqua del necessario: ti conviene distribuirla nella giornata. Trovi cosa può succedere nello storico.</Body> : null}
        {water > 0 && !isToday && wl === 'poca' ? <Body small style={{ marginTop: 6, color: '#ffb020' }}>Quel giorno hai bevuto poco. Se succede spesso, nello storico trovi cosa può causare.</Body> : null}
        <Btn small ghost style={{ marginTop: 8, alignSelf: 'flex-start' }} title="Come va l'acqua negli ultimi giorni" onPress={() => go('fitnessWater')} />
      </Card>
  );
  return (
    <Page id="fitnessDay" back title="Pasti e calorie">
      <TabRow options={['Giorno', 'Settimana', 'Mese', 'Anno', 'Sempre']} value={per} onChange={setPer} />
      <Row gap={8}>
        <Btn small ghost icon="arrow-left" title="Giorno prima" onPress={() => setSel(addDays(key, -1))} />
        {!isToday ? <Btn small ghost title="Oggi" onPress={() => setSel(dayOf(Date.now()))} /> : null}
        <View style={{ flex: 1 }} />
        <Btn small ghost icon="calendar" title="Calendario" onPress={() => setCal(!cal)} />
        <Btn small ghost disabled={isToday} title="Giorno dopo" onPress={() => setSel(addDays(key, 1))} />
      </Row>
      {cal ? <MealCalendar meals={fit.meals} target={tg?.kcal} selected={key} onPick={(d) => { setSel(d); setCal(false); }} /> : null}
      {focus === 'water' ? waterCard : null}
      <Card accent={FIT}>
        <H style={{ textTransform: 'capitalize' }}>{title}</H>
        <DaySummary meals={g?.meals ?? []} micro={g?.micro} waterMl={water} body={fit.body} />
      </Card>

      {focus === 'water' ? null : waterCard}

      <RecapStats meals={withMicro(fit.meals)} days={1} now={new Date(y, m - 1, d, 12).getTime()} targetKcal={tg?.kcal} sugarMax={tg?.sugarMax} />

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
                <View style={{ flex: 1 }}><Body bold numberOfLines={1}>{displayName(x)}</Body><Body small muted>{`${tl(SLOT[slotOf(x.ts)])} · ${hhmm(x.ts)} · ${x.macros.kcal} kcal`}</Body></View>
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
