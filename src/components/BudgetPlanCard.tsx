import { useMemo } from 'react';
import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Text } from '@/components/T';
import { Body, Btn, Card, H, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { translateText } from '@/i18n/core';
import { formatMoney } from '@/i18n/format';
import { RENT_RULE, suggestPlan } from '@/lib/budgetPlan';
import { toast } from '@/store/toast';
import { useFin } from '@/store/finance';

const COLORS: Record<string, string> = { Affitto: '#5b8def', 'Cassa malati': '#ff6f91', 'Alimentari/Casa': '#4fd18b', Abbonamenti: '#c9d15c', Abbigliamento: '#b96bff', 'Viaggio estero': '#4fc7e0', 'Fondo emergenza': '#7c5cff', Altro: '#ffb84f' };

/** Il tuo mese in un colpo d'occhio: stipendio diviso tra costi fissi, spese e risparmio, con un piano consigliato applicabile con un tocco. */
export function BudgetPlanCard() {
  const th = useTheme();
  const f = useFin();
  const salary = f.budget.salary || 3500;
  const bill = (n: string) => f.bills.find((b) => b.name.toLowerCase() === n.toLowerCase());
  const rent = bill('Affitto')?.amount ?? 1450;
  const health = bill('Cassa malati')?.amount ?? 480;
  const plan = useMemo(() => suggestPlan(salary, rent, health), [salary, rent, health]);
  const apply = () => {
    const alloc: Record<string, number> = { ...f.budget.alloc };
    plan.lines.forEach((l) => { alloc[l.n] = l.amt; });
    f.setBudget({ salary, alloc });
    toast('Piano consigliato applicato al prossimo mese');
  };
  const pct = (n: number) => (plan.salary ? Math.round((n / plan.salary) * 100) : 0);
  return (
    <>
      <LinearGradient colors={['#12285c', '#1d3a80', '#14506e']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 24, padding: 18, marginBottom: 14 }}>
        <Text style={{ color: '#ffffffb8', fontSize: 13, fontWeight: '700', letterSpacing: 0.6 }}>{translateText('STIPENDIO MENSILE')}</Text>
        <Text style={{ color: '#fff', fontSize: 36, fontWeight: '800', letterSpacing: -1, marginTop: 4 }}>{formatMoney(plan.salary)}</Text>
        <View style={{ flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden', marginTop: 14, backgroundColor: 'rgba(255,255,255,0.15)' }}>
          {plan.lines.filter((l) => l.amt > 0).map((l) => <View key={l.n} style={{ flex: l.amt, backgroundColor: COLORS[l.n] ?? '#999' }} />)}
        </View>
        <Row style={{ marginTop: 14, alignItems: 'flex-end' }}>
          <View>
            <Text style={{ color: '#ffffffa8', fontSize: 12.5 }}>{translateText('Dopo affitto e cassa malati ti restano')}</Text>
            <Text style={{ color: '#fff', fontSize: 24, fontWeight: '800' }}>{formatMoney(plan.free)}</Text>
          </View>
          <Text style={{ color: '#ffffffc0', fontWeight: '700' }}>{100 - pct(plan.fixed)}%</Text>
        </Row>
      </LinearGradient>

      <Card>
        <H>Costi fissi</H>
        {plan.lines.filter((l) => l.kind === 'fisso').map((l, i) => (
          <View key={l.n} style={{ paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: th.item }}>
            <Row>
              <Row gap={8} style={{ justifyContent: 'flex-start', flex: 1 }}><View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS[l.n] }} /><Body bold>{l.n}</Body></Row>
              <Body bold>{formatMoney(l.amt)}</Body>
            </Row>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: th.item, marginTop: 8 }}><View style={{ width: `${Math.min(100, pct(l.amt))}%`, height: 6, borderRadius: 3, backgroundColor: COLORS[l.n] }} /></View>
            <Body small muted style={{ marginTop: 4 }}>{pct(l.amt)}% dello stipendio{l.n === 'Affitto' ? ` · regola pratica: fino a circa ${Math.round(RENT_RULE * 100)}%` : ''}</Body>
          </View>
        ))}
        {plan.rentHigh ? <Body small color={th.warn} style={{ marginTop: 6 }}>L'affitto pesa più della regola del terzo: non è un errore, ma lascia meno margine per risparmiare. Il piano qui sotto ne tiene conto.</Body> : null}
        {plan.deficit ? <Body small color={th.danger} style={{ marginTop: 6 }}>I costi fissi superano lo stipendio: controlla gli importi.</Body> : null}
      </Card>

      <Card>
        <Row><H>Piano consigliato</H><Btn small title="Applica" onPress={apply} /></Row>
        <Body small muted style={{ marginBottom: 6 }}>Ripartizione indicativa dei {formatMoney(plan.free)} che restano. Puoi cambiare ogni importo più sotto.</Body>
        {plan.lines.filter((l) => l.kind !== 'fisso').map((l, i) => (
          <Row key={l.n} style={{ paddingVertical: 9, borderTopWidth: i ? 1 : 0, borderTopColor: th.item }}>
            <Row gap={8} style={{ justifyContent: 'flex-start', flex: 1 }}><View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS[l.n] ?? '#999' }} /><Body>{l.n}</Body></Row>
            <Body muted small style={{ marginRight: 10 }}>{pct(l.amt)}%</Body>
            <Body bold>{formatMoney(l.amt)}</Body>
          </Row>
        ))}
        <Body small muted style={{ marginTop: 8 }}>Indicazione generale su uno stipendio netto, non consulenza finanziaria.</Body>
      </Card>
    </>
  );
}
