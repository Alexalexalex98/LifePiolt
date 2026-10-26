import { useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/T';

import { Bars } from '@/components/charts';
import { Ring } from '@/components/fitness/kit';
import { Body, Btn, Card, H, Page, Pill, Row, Switch } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { refreshFoodReminders } from '@/lib/foodNotify';
import { go } from '@/lib/nav';
import { waterGoal } from '@/lib/fitness/mealInsights';
import { WATER_NOTE, WHAT_IF_HIGH, WHAT_IF_HIGH_WARN, WHAT_IF_LOW, WHAT_IF_LOW_WARN, dayKey, waterPeriod, waterVerdict } from '@/lib/fitness/waterInsights';
import { requestPermission } from '@/lib/notify';
import { useFitness } from '@/store/fitness';
import { toast } from '@/store/toast';

const BLUE = '#6aa8ff';
const L = (ml: number) => `${(ml / 1000).toFixed(1).replace('.', ',')} L`;

/** Solo l'acqua: quanta ne hai bevuta oggi, come sono andati gli ultimi giorni, cosa significa e gli avvisi per bere. Niente cibo. */
export default function FitnessWater() {
  const t = useTheme();
  const fit = useFitness();
  const [period, setPeriod] = useState<7 | 30>(7);
  const [whatIf, setWhatIf] = useState<'low' | 'high' | null>(null);
  const now = Date.now();
  const today = dayKey(now);
  const ml = (fit.water ?? {})[today] ?? 0;
  const goal = waterGoal(fit.body?.weightKg);
  const wp = waterPeriod(fit.water ?? {}, now, period, goal);
  const wv = waterVerdict(wp);
  const col = !wv ? BLUE : wv.level === 'ok' ? '#5fd39a' : wv.level === 'attenzione' ? '#ffb020' : t.danger;
  const days = Array.from({ length: period }, (_, i) => dayKey(now - (period - 1 - i) * 86400000));
  const series = days.map((k) => (fit.water ?? {})[k] ?? 0);
  const w = fit.waterRemind ?? { on: false, everyMin: 120, from: '09:00', to: '21:00' };
  const setRemind = async (p: Partial<typeof w>) => {
    if ((p.on ?? w.on) || p.everyMin) { const r = await requestPermission(); if (!r.ok) { toast(r.message || 'Per gli avvisi servono le notifiche: attivale in Impostazioni'); return; } }
    fit.setWaterRemind(p);
    await refreshFoodReminders();
  };
  return (
    <Page id="fitnessWater" back title="Acqua">
      <Card accent={BLUE}>
        <Row gap={16}>
          <Ring value={ml / goal} size={120} stroke={12} color={BLUE} big={L(ml)} small={tl('su {0}', L(goal))} />
          <View style={{ flex: 1 }}>
            <H>Oggi</H>
            <Body small muted style={{ marginTop: 2 }}>{ml >= goal ? tl('Obiettivo di oggi raggiunto') : tl('Ti mancano ancora {0}', L(Math.max(0, goal - ml)))}</Body>
            <Row gap={6} style={{ marginTop: 10, justifyContent: 'flex-start', flexWrap: 'wrap' }}>
              {[200, 500, 1000].map((n) => <Pill key={n} label={n === 1000 ? '+ 1 L' : `+ ${n} ml`} onPress={() => { fit.addWater(n); }} />)}
            </Row>
          </View>
        </Row>
      </Card>

      <Card>
        <H>Come va</H>
        <Row style={{ justifyContent: 'flex-start', marginTop: 6 }} gap={8}>{([7, 30] as const).map((d) => <Pill key={d} label={`${d} ${tl('giorni')}`} on={period === d} onPress={() => setPeriod(d)} />)}</Row>
        <View style={{ marginTop: 12 }}><Bars data={series} color={BLUE + '77'} hi={BLUE} height={90} /></View>
        <Row style={{ marginTop: 4 }}><Text style={{ color: t.muted, fontSize: 11 }}>{new Date(now - (period - 1) * 86400000).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</Text><Text style={{ color: t.muted, fontSize: 11 }}>{tl('Oggi')}</Text></Row>
        {wv && wp.avgMl !== null ? (
          <View style={{ marginTop: 12 }}>
            <Row><Body bold style={{ color: col, fontSize: 18 }}>{tl(wv.title)}</Body><Body bold>{`${Math.round(wp.pct * 100)}%`}</Body></Row>
            <Body small muted style={{ marginTop: 4 }}>{tl('In media {0} al giorno su {1}: obiettivo raggiunto in {2} giorni su {3} con acqua segnata.', L(wp.avgMl), L(wp.goal), wp.daysAtGoal, wp.loggedDays)}</Body>
            {wp.unloggedDays > 0 ? <Body small muted style={{ marginTop: 2 }}>{tl('{0} giorni senza acqua segnata: non li conto nella media.', wp.unloggedDays)}</Body> : null}
            {wv.advice ? <Body small style={{ marginTop: 6 }}>{tl(wv.advice)}</Body> : null}
          </View>
        ) : <Body small muted style={{ marginTop: 10 }}>Segna l'acqua che bevi: dopo qualche giorno ti dico se ne bevi abbastanza.</Body>}
      </Card>

      <Card>
        <H>Cosa può succedere</H>
        <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginTop: 8 }} gap={8}>
          <Pill label="Se ne bevo poca" on={whatIf === 'low'} onPress={() => setWhatIf(whatIf === 'low' ? null : 'low')} />
          <Pill label="Se ne bevo troppa" on={whatIf === 'high'} onPress={() => setWhatIf(whatIf === 'high' ? null : 'high')} />
        </Row>
        {whatIf ? (
          <View style={{ marginTop: 10, gap: 4 }}>
            {(whatIf === 'low' ? WHAT_IF_LOW : WHAT_IF_HIGH).map((x) => <Body key={x} small muted>{`• ${tl(x)}`}</Body>)}
            <Body small style={{ marginTop: 4 }}>{tl(whatIf === 'low' ? WHAT_IF_LOW_WARN : WHAT_IF_HIGH_WARN)}</Body>
          </View>
        ) : null}
        <Body small muted style={{ marginTop: 10 }}>{WATER_NOTE}</Body>
      </Card>

      <Card>
        <Row><View style={{ flex: 1 }}><H>Avvisami per bere</H><Body small muted>{`${tl('Ogni')} ${Math.round(w.everyMin / 60)} ${tl('ore')}, ${w.from}-${w.to}`}</Body></View><Switch value={w.on} onValueChange={(v) => void setRemind({ on: v })} accessibilityLabel="Avvisami per bere" /></Row>
        {w.on ? <Row style={{ justifyContent: 'flex-start', marginTop: 8 }} gap={8}>{[1, 2, 3, 4].map((h) => <Pill key={h} label={`${h} h`} on={Math.round(w.everyMin / 60) === h} onPress={() => void setRemind({ everyMin: h * 60 })} />)}</Row> : null}
      </Card>
      <Btn ghost small title="Storico di pasti, acqua e analisi" onPress={() => go('fitnessDiary')} />
    </Page>
  );
}
