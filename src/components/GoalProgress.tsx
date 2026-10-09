import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Body, Btn, Input, Link, Pill, Progress, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { goalInputsNow } from '@/lib/goalInputs';
import { goalMetricIds, goalMetrics, goalProgress, isGoalLink, linkTitle, periodLabel, type GoalLink, type GoalMetric, type GoalPeriod } from '@/lib/goalData';
import { useFin } from '@/store/finance';
import { useHealth } from '@/store/health';
import { useLife, type Goal } from '@/store/life';
import { toast } from '@/store/toast';
import { translateText } from '@/i18n/core';

/**
 * Avanzamento automatico di un obiettivo collegato ai dati + scelta del collegamento.
 * Da inserire nella card obiettivi del Plan, sotto il titolo/la barra: <GoalProgress goal={g} />.
 */
export function GoalProgress({ goal }: { goal: Goal }) {
  const t = useTheme();
  const setLink = useLife((s) => s.setGoalLink);
  const patchGoal = useLife((s) => s.patchGoal);
  // si riconteggia quando cambiano i dati
  const hs = useHealth((s) => s.series), wk = useHealth((s) => s.workouts), months = useFin((s) => s.months);
  const [open, setOpen] = useState(false);
  const [metric, setMetric] = useState<GoalMetric>(goal.metric ?? 'workouts');
  const [period, setPeriod] = useState<GoalPeriod>(goal.period ?? 'week');
  const [target, setTarget] = useState(String(goal.target ?? goalMetrics[goal.metric ?? 'workouts'].defTarget));

  const link: GoalLink | null = isGoalLink(goal) ? { metric: goal.metric!, target: goal.target!, period: goal.period! } : null;
  const info = link ? goalProgress(link, goalInputsNow()) : null;
  void hs; void wk; void months;

  // tiene allineata la percentuale salvata (usata dall'analisi e dallo storico)
  useEffect(() => {
    if (info?.hasData && info.pct !== goal.p) patchGoal(goal.id, { p: info.pct });
  }, [info?.pct, info?.hasData, goal.p, goal.id, patchGoal]);

  function save() {
    const n = parseFloat(target.replace(',', '.'));
    if (!Number.isFinite(n) || n <= 0) { toast('Inserisci un valore maggiore di zero'); return; }
    const p = goalMetrics[metric].periods.includes(period) ? period : goalMetrics[metric].periods[0];
    setLink(goal.id, { metric, target: n, period: p });
    setOpen(false); toast('Obiettivo collegato ai dati');
  }

  return (
    <View style={{ marginTop: 6 }}>
      {link && info ? (
        <>
          <Body small muted>{linkTitle(link)} · calcolato dai tuoi dati</Body>
          <View style={{ marginTop: 4 }}><Progress value={info.pct} color={info.done ? t.positive : undefined} /></View>
          <Body small color={info.done ? t.positive : undefined} muted={!info.done} style={{ marginTop: 4 }}>{info.done ? 'Obiettivo raggiunto. ' : ''}{info.text}</Body>
        </>
      ) : null}
      <Row style={{ marginTop: 4, justifyContent: 'flex-start' }} gap={14}>
        <Link onPress={() => { setMetric(goal.metric ?? 'workouts'); setPeriod(goal.period ?? 'week'); setTarget(String(goal.target ?? goalMetrics[goal.metric ?? 'workouts'].defTarget)); setOpen(true); }}>{link ? 'cambia collegamento' : 'collega ai dati'}</Link>
        {link ? <Link danger onPress={() => { setLink(goal.id, null); toast('Collegamento rimosso'); }}>scollega</Link> : null}
      </Row>
      <Sheet visible={open} title="Collega ai tuoi dati" onClose={() => setOpen(false)}>
        <Body small muted style={{ marginBottom: 8 }}>L’avanzamento di “{goal.t}” si aggiorna da solo da Apple Health, dai dati registrati e dalle finanze.</Body>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {goalMetricIds.map((m) => <Pill key={m} label={goalMetrics[m].label} on={metric === m} onPress={() => { setMetric(m); setTarget(String(goalMetrics[m].defTarget)); if (!goalMetrics[m].periods.includes(period)) setPeriod(goalMetrics[m].periods[0]); }} />)}
        </View>
        <Body small muted style={{ marginVertical: 6 }}>{goalMetrics[metric].hint}</Body>
        {goalMetrics[metric].periods.length > 1 && (
          <View style={{ flexDirection: 'row', marginBottom: 6 }}>
            {goalMetrics[metric].periods.map((p) => <Pill key={p} label={p === 'week' ? 'Settimana' : 'Mese'} on={period === p} onPress={() => setPeriod(p)} />)}
          </View>
        )}
        <Input keyboardType="decimal-pad" value={target} onChangeText={setTarget} placeholder={`Obiettivo (${goalMetrics[metric].unit})`} accessibilityLabel={translateText("Valore obiettivo")} />
        <Body small muted style={{ marginBottom: 10 }}>Obiettivo: {target || '—'} {goalMetrics[metric].unit}{metric === 'workouts' || metric === 'mindful' ? ' ' + periodLabel[period] : ''}</Body>
        <Btn title="Salva collegamento" onPress={save} />
      </Sheet>
    </View>
  );
}
