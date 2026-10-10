import { View } from 'react-native';

import { Body, Btn, Card, H, Pill, Progress, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { costTotals, PLANS, planById, usageBars, type PlanId } from '@/lib/aiRouter/quota';
import { PRICING_VERIFICATION } from '@/lib/aiRouter/registry';
import { useAiRouter } from '@/store/aiRouter';
import { toast } from '@/store/toast';

const fmt = (n: number) => (Math.round(n * 100) / 100).toLocaleString('it-IT');

export function UsageSection() {
  const t = useTheme();
  const planId = useAiRouter((s) => s.planId);
  const usage = useAiRouter((s) => s.usage);
  const setPlan = useAiRouter((s) => s.setPlan);
  const now = Date.now();
  const plan = planById(planId);
  const bars = usageBars(usage, plan, now);
  const cost = costTotals(usage, now);
  return (
    <>
      <Card>
        <H>Il tuo piano</H>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {PLANS.map((p) => <Pill key={p.id} label={p.label} on={p.id === planId} onPress={() => setPlan(p.id as PlanId)} />)}
        </View>
        <Body small muted style={{ marginTop: 8 }}>Piani e limiti sono un ESEMPIO ancora da decidere. Quando ci sarà il server verranno dal tuo abbonamento.</Body>
      </Card>
      <Card>
        <H>Quanto hai usato</H>
        {bars.map((b) => (
          <View key={b.id} style={{ marginBottom: 14 }} testID={'bar-' + b.id}>
            <Row><Body bold>{b.label}</Body><Body small muted>{`${Math.round(b.used).toLocaleString('it-IT')} di ${b.max.toLocaleString('it-IT')} ${b.windowLabel}`}</Body></Row>
            <View style={{ marginVertical: 6 }}><Progress value={b.max ? (b.used / b.max) * 100 : 0} color={b.used >= b.max ? t.danger : t.accent} /></View>
            <Body small muted>{b.resetText}</Body>
          </View>
        ))}
        <Body small muted>I token sono una stima dalla lunghezza del testo, non un conteggio esatto.</Body>
      </Card>
      <Card>
        <H>Costo stimato</H>
        <Row><Body muted>Oggi</Body><Body bold>{`${fmt(cost.day)} di ${fmt(plan.budget.day)}`}</Body></Row>
        <Row style={{ marginTop: 6 }}><Body muted>Questo mese</Body><Body bold>{`${fmt(cost.month)} di ${fmt(plan.budget.month)}`}</Body></Row>
        <Body small muted style={{ marginTop: 8 }}>{`Unità di costo neutre. I prezzi dei fornitori sono ${PRICING_VERIFICATION.status}: vanno controllati sui listini ufficiali prima dell'uso.`}</Body>
        {typeof __DEV__ !== 'undefined' && __DEV__ ? <Btn small ghost style={{ marginTop: 10 }} title="Azzera i contatori (solo sviluppo)" onPress={() => { useAiRouter.getState().resetUsageDev(); toast('Contatori azzerati'); }} /> : null}
      </Card>
    </>
  );
}
