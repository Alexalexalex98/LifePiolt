import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { FIT } from '@/components/fitness/kit';
import { Body, Btn, Card, H, Item, Page, Pill, Row, Switch } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { DaySummary } from '@/components/fitness/DaySummary';
import { withMicro } from '@/lib/fitness/mealMicro';
import { NUTRITION_LEGAL } from '@/lib/fitness/micro';
import { dayOf, groupByDay, periodStats, quality, slotOf, waterGoal } from '@/lib/fitness/mealInsights';
import { dailyTarget, dailyTargets } from '@/lib/fitness/nutrition';
import { refreshFoodReminders } from '@/lib/foodNotify';
import { Icon } from '@/lib/icons';
import { go } from '@/lib/nav';
import { requestPermission } from '@/lib/notify';
import { useFitness } from '@/store/fitness';
import { toast } from '@/store/toast';

const dayLabel = (ts: number) => {
  const k = dayOf(ts), now = Date.now();
  if (k === dayOf(now)) return tl('Oggi');
  if (k === dayOf(now - 86400000)) return tl('Ieri');
  return new Date(ts).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
};
const hhmm = (ts: number) => new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
const Bar = ({ value, max, color }: { value: number; max: number; color: string }) => {
  const t = useTheme();
  return <View style={{ height: 8, borderRadius: 4, backgroundColor: t.chip, overflow: 'hidden', marginVertical: 6 }}><View style={{ width: `${Math.min(100, Math.round((value / Math.max(1, max)) * 100))}%`, height: 8, backgroundColor: color }} /></View>;
};
const SLOT: Record<string, string> = { colazione: 'Colazione', pranzo: 'Pranzo', merenda: 'Merenda', cena: 'Cena', notte: 'Dopo cena' };

/** Storico dei pasti giorno per giorno, acqua, promemoria e analisi di Theia su come si mangia. */
export default function FitnessDiary() {
  const t = useTheme();
  const fit = useFitness();
  const [shown, setShown] = useState(10);
  const [period, setPeriod] = useState<7 | 30>(7);
  const groups = groupByDay(withMicro(fit.meals));
  const target = fit.body ? dailyTarget(fit.body) : null;
  const st = periodStats(withMicro(fit.meals), fit.water ?? {}, Date.now(), period);
  const tg = fit.body ? dailyTargets(fit.body) : null;
  const q = tg ? quality(st, tg) : null;
  const qCol = q ? (q.level === 'ok' ? '#5fd39a' : q.level === 'attenzione' ? '#ffb020' : t.danger) : FIT;
  const today = dayOf(Date.now());
  const waterToday = (fit.water ?? {})[today] ?? 0;
  const goal = waterGoal(fit.body?.weightKg);
  const w = fit.waterRemind ?? { on: false, everyMin: 120, from: '09:00', to: '21:00' };
  const ev = fit.eveningCheck ?? { on: true, at: '20:45' };

  const setRemind = async (p: Partial<typeof w>) => {
    if ((p.on ?? w.on) || p.everyMin) { const r = await requestPermission(); if (!r.ok) { toast(r.message || 'Per gli avvisi servono le notifiche: attivale in Impostazioni'); return; } }
    fit.setWaterRemind(p);
    await refreshFoodReminders();
  };

  return (
    <Page id="fitnessDiary" back title="Storico dei pasti">
      <Card accent={FIT}>
        <H>Come mangi</H>
        <Body small muted style={{ marginTop: 2 }}>Theia guarda gli ultimi 7 giorni e ti dice in chat dove sei carente e cosa migliorare. L'analisi si fa sul telefono, senza AI esterna.</Body>
        <Btn style={{ marginTop: 10 }} icon="sparkle" title="Fai analizzare a Theia" onPress={() => go('ai', { ask: 'Analizza come mangio' })} />
      </Card>

      <Card>
        <Row><H style={{ flex: 1 }}>Qualità della tua alimentazione</H>
          <Row gap={6}>{([7, 30] as const).map((d) => <Pill key={d} label={`${d} ${tl('giorni')}`} on={period === d} onPress={() => setPeriod(d)} />)}</Row>
        </Row>
        {q ? (
          <View>
            <Row style={{ marginTop: 6 }}><Body bold style={{ color: qCol, fontSize: 30 }}>{`${q.score}/100`}</Body><Body bold style={{ color: qCol }}>{tl(q.label)}</Body></Row>
            {q.parts.map((p) => <Row key={p.id} style={{ marginTop: 3 }}><Body small muted>{tl(p.label)}</Body><Body small>{`${Math.round(p.score)}/${p.max} · ${p.note}`}</Body></Row>)}
            <Body small muted style={{ marginTop: 8 }}>{tl('Calcolata su {0} giorni con pasti registrati. Sono stime, non un dato medico: vitamine e minerali sono calcolati per categoria di alimento.', st.days)}</Body>
          </View>
        ) : <Body small muted style={{ marginTop: 6 }}>{fit.body ? 'Registra qualche pasto per vedere la qualità della tua alimentazione.' : 'Imposta i tuoi dati in «Pasti e calorie» (sesso, età, peso, altezza) per vedere qualità e valori consigliati.'}</Body>}
      </Card>

      {st.days ? (
        <Card>
          <H>Valori medi al giorno</H>
          <Body small muted>{tl('Media degli ultimi {0} giorni (quelli con pasti registrati) rispetto a quanto dovresti mangiare.', period)}</Body>
          <DaySummary meals={[]} avg={st.avg} micro={st.micro} waterMl={st.waterMl} body={fit.body} />
        </Card>
      ) : null}

      <Card>
        <Row><H style={{ flex: 1 }}>Acqua di oggi</H><Body bold>{`${(waterToday / 1000).toFixed(1).replace('.', ',')} / ${(goal / 1000).toFixed(1).replace('.', ',')} L`}</Body></Row>
        <Bar value={waterToday} max={goal} color={FIT} />
        <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginTop: 8 }} gap={8}>
          {[200, 500, 1000].map((ml) => <Pill key={ml} label={ml === 1000 ? '+ 1 L' : `+ ${ml} ml`} off onPress={() => { fit.addWater(ml); }} />)}
          {waterToday > 0 ? <Pill label="Annulla ultimo" off onPress={() => { fit.addWater(-200); }} /> : null}
        </Row>
        <Row style={{ marginTop: 12 }}><View style={{ flex: 1 }}><Body>Avvisami per bere</Body><Body small muted>{`${tl('Ogni')} ${Math.round(w.everyMin / 60)} ${tl('ore')}, ${w.from}-${w.to}`}</Body></View><Switch value={w.on} onValueChange={(v) => void setRemind({ on: v })} accessibilityLabel="Avvisami per bere" /></Row>
        {w.on ? (
          <Row style={{ justifyContent: 'flex-start', marginTop: 6 }} gap={8}>
            {[1, 2, 3, 4].map((h) => <Pill key={h} label={`${h} h`} on={Math.round(w.everyMin / 60) === h} onPress={() => void setRemind({ everyMin: h * 60 })} />)}
          </Row>
        ) : null}
        <Row style={{ marginTop: 12 }}><View style={{ flex: 1 }}><Body>Domanda serale su cibo e acqua</Body><Body small muted>{`${tl('Una notifica verso le')} ${ev.at}`}</Body></View><Switch value={ev.on} onValueChange={async (v) => { if (v) { const r = await requestPermission(); if (!r.ok) { toast(r.message || 'Per la notifica serve il permesso alle notifiche'); return; } } fit.setEveningCheck({ on: v }); await refreshFoodReminders(); }} accessibilityLabel="Domanda serale" /></Row>
      </Card>

      {!groups.length ? <Card><Body muted>Non hai ancora pasti nel diario. Aggiungine uno da «Pasti e calorie»: con una foto lo salvo con tutto.</Body><Btn style={{ marginTop: 10 }} title="Aggiungi un pasto" onPress={() => go('fitnessMeal')} /></Card> : null}

      {groups.slice(0, shown).map((g) => (
        <Card key={g.key}>
          <Pressable accessibilityRole="button" accessibilityLabel={tl('Apri il resoconto del giorno')} onPress={() => go('fitnessDay', { day: g.key })}><Row><H style={{ flex: 1, textTransform: 'capitalize' }}>{dayLabel(g.ts)}</H><Body bold>{g.total.kcal} kcal</Body><Icon name="chevron" size={18} color={t.muted} /></Row></Pressable>
          {target ? <Bar value={g.total.kcal} max={target} color={FIT} /> : null}
          <Body small muted style={{ marginBottom: 4 }}>{tl('proteine {0} g · carboidrati {1} g · grassi {2} g', g.total.p, g.total.c, g.total.f)}{(fit.water ?? {})[g.key] ? ` · ${tl('acqua')} ${(((fit.water ?? {})[g.key]) / 1000).toFixed(1).replace('.', ',')} L` : ''}</Body>
          {g.meals.map((m, i) => (
            <Item key={m.id} last={i === g.meals.length - 1}>
              <Pressable accessibilityRole="button" accessibilityLabel={m.name} onPress={() => go('fitnessMealCard', { id: m.id })}>
                <Row gap={10}>
                  {m.photo ? <Image source={{ uri: m.photo }} style={{ width: 52, height: 52, borderRadius: 12 }} contentFit="cover" /> : <View style={{ width: 52, height: 52, borderRadius: 12, backgroundColor: t.chip, alignItems: 'center', justifyContent: 'center' }}><Icon name="lifefitness" size={22} color={t.muted} /></View>}
                  <View style={{ flex: 1 }}><Body bold numberOfLines={1}>{m.name}</Body><Body small muted>{`${tl(SLOT[slotOf(m.ts)])} · ${hhmm(m.ts)} · ${m.macros.kcal} kcal`}</Body></View>
                  <Icon name="chevron" size={18} color={t.muted} />
                </Row>
              </Pressable>
            </Item>
          ))}
        </Card>
      ))}
      {groups.length > shown ? <Btn ghost title={tl('Mostra altri giorni ({0})', groups.length - shown)} onPress={() => setShown(shown + 10)} /> : null}
      <Body small muted style={{ marginTop: 8 }}>{NUTRITION_LEGAL}</Body>
    </Page>
  );
}
