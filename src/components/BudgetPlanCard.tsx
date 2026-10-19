import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Text } from '@/components/T';
import { Body, Btn, Card, H, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { translateText } from '@/i18n/core';
import { formatMoney } from '@/i18n/format';
import { RENT_RULE, suggestPlan } from '@/lib/budgetPlan';
import { toast } from '@/store/toast';
import { categoryOf, useFin, type StatementInfo } from '@/store/finance';
import { ExplainSheet } from '@/components/ExplainSheet';
import { listMovements, sumRows, type ExplainRow } from '@/lib/explain';
import { normalizeLabel } from '@/lib/recurring';

const COLORS: Record<string, string> = { Affitto: '#5b8def', 'Cassa malati': '#ff6f91', 'Alimentari/Casa': '#4fd18b', Abbonamenti: '#c9d15c', Abbigliamento: '#b96bff', 'Viaggio estero': '#4fc7e0', 'Fondo emergenza': '#7c5cff', Altro: '#ffb84f' };

/** Il tuo mese in un colpo d'occhio: stipendio diviso tra costi fissi, spese e risparmio, con un piano consigliato applicabile con un tocco. */
function GenericBudgetPlan() {
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

type Ex = { title: string; formula: string; rows: ExplainRow[]; total?: number } | null;

/** Budget costruito SOLO dall'estratto conto: ogni numero si puo' toccare per vedere i movimenti da cui arriva. */
function StatementBudget({ info }: { info: StatementInfo }) {
  const th = useTheme();
  const f = useFin();
  const [ex, setEx] = useState<Ex>(null);
  const months = f.months;
  const salary = f.budget.salary || info.salary;
  const fixedTotal = info.fixed.reduce((s, b) => s + b.amount, 0);
  const free = salary - fixedTotal;
  const incomeKey = (label: string) => normalizeLabel(label.replace(/^(accredito|bonifico|gutschrift|zahlung)\s+/i, ''));
  const sourceKeys = info.sources.map((s) => normalizeLabel(s.name));
  const monthCount = Math.max(1, months.filter((m) => m.movements.length).length);
  const byCat = useMemo(() => {
    const acc: Record<string, number> = {};
    months.forEach((m) => m.movements.forEach((x) => { if (x.amount >= 0) return; const c = categoryOf(x.label, f.categories); if (c === 'Fondo emergenza') return; acc[c] = (acc[c] ?? 0) - x.amount; }));
    return Object.entries(acc).map(([name, total]) => ({ name, total, avg: total / monthCount })).sort((a, b) => b.total - a.total);
  }, [months, f.categories, monthCount]);
  const pct = (n: number) => (salary ? Math.round((n / salary) * 100) : 0);
  const day = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
  const openSalary = () => {
    const rows = listMovements(months, (x) => x.amount > 0 && sourceKeys.some((k) => k && incomeKey(x.label).includes(k)));
    setEx({ title: 'Da dove arriva lo stipendio', formula: `Somma, mese per mese, delle entrate che tornano ogni mese nell’estratto (dal ${day(info.from)} al ${day(info.to)}): ${info.sources.map((s) => `${s.name} circa ${formatMoney(s.monthly)} (${s.months} mesi)`).join(' + ')} = ${formatMoney(info.salary)}. Depositi e entrate una tantum non contano.`, rows, total: sumRows(rows) });
  };
  const openFixed = (b: StatementInfo['fixed'][number]) => {
    const rows = listMovements(months, (x) => x.amount < 0 && normalizeLabel(x.label) === b.key);
    setEx({ title: b.name, formula: `Spesa fissa riconosciuta: ${b.count} pagamenti simili, ogni mese, di circa ${formatMoney(b.amount)} (importo mediano).`, rows, total: sumRows(rows) });
  };
  const openCat = (c: { name: string; total: number; avg: number }) => {
    const rows = listMovements(months, (x) => x.amount < 0 && categoryOf(x.label, f.categories) === c.name);
    setEx({ title: c.name, formula: `Media mensile = totale ${formatMoney(c.total)} diviso ${monthCount} mesi dell’estratto = ${formatMoney(c.avg)}.`, rows, total: sumRows(rows) });
  };
  return (
    <>
      <LinearGradient colors={['#12285c', '#1d3a80', '#14506e']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 24, padding: 18, marginBottom: 14 }}>
        <Text style={{ color: '#ffffffb8', fontSize: 13, fontWeight: '700', letterSpacing: 0.6 }}>{translateText('STIPENDIO MENSILE')}</Text>
        <Pressable onPress={openSalary} accessibilityRole="button" accessibilityLabel={translateText('Da dove arriva lo stipendio')}>
          <Text style={{ color: '#fff', fontSize: 36, fontWeight: '800', letterSpacing: -1, marginTop: 4 }}>{formatMoney(salary)}</Text>
          <Text style={{ color: '#ffffffa8', fontSize: 12.5 }}>{translateText('Riconosciuto dall’estratto: tocca per vedere le entrate')}</Text>
        </Pressable>
        <Row style={{ marginTop: 14, alignItems: 'flex-end' }}>
          <View>
            <Text style={{ color: '#ffffffa8', fontSize: 12.5 }}>{translateText('Dopo le spese fisse ti restano')}</Text>
            <Text style={{ color: free >= 0 ? '#fff' : '#ff9a9a', fontSize: 24, fontWeight: '800' }}>{formatMoney(free)}</Text>
          </View>
          <Text style={{ color: '#ffffffc0', fontWeight: '700' }}>{salary ? 100 - pct(fixedTotal) : 0}%</Text>
        </Row>
      </LinearGradient>

      <Card>
        <H>Spese fisse (dall’estratto)</H>
        {info.fixed.length ? info.fixed.map((b, i) => (
          <Pressable key={b.key} onPress={() => openFixed(b)} accessibilityRole="button" style={{ paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: th.item }}>
            <Row><Body bold style={{ flex: 1 }}>{b.name}</Body><Body bold>{formatMoney(b.amount)}</Body></Row>
            <Body small muted>{pct(b.amount)}% dello stipendio · {b.count} pagamenti · ultimo {day(b.lastDate)} · tocca per vederli</Body>
          </Pressable>
        )) : <Body small muted>Nell’estratto non ci sono spese che tornano ogni mese con lo stesso importo.</Body>}
        {free < 0 ? <Body small color={th.danger} style={{ marginTop: 6 }}>Le spese fisse superano lo stipendio riconosciuto: controlla i movimenti toccando le voci.</Body> : null}
      </Card>

      <Card>
        <Row><H>Come spendi davvero</H><Btn small title="Usa come budget" onPress={() => { const alloc: Record<string, number> = { ...f.budget.alloc }; byCat.forEach((c) => { alloc[c.name] = Math.round(c.avg); }); f.setBudget({ alloc }); toast('Medie dell’estratto impostate come budget'); }} /></Row>
        <Body small muted style={{ marginBottom: 6 }}>Media mensile per categoria, calcolata sui {monthCount} mesi dell’estratto. Tocca una voce per vedere i movimenti.</Body>
        {byCat.map((c, i) => (
          <Pressable key={c.name} onPress={() => openCat(c)} accessibilityRole="button" style={{ paddingVertical: 9, borderTopWidth: i ? 1 : 0, borderTopColor: th.item }}>
            <Row><Body style={{ flex: 1 }}>{c.name}</Body><Body muted small style={{ marginRight: 10 }}>{pct(c.avg)}%</Body><Body bold>{formatMoney(c.avg)}</Body></Row>
          </Pressable>
        ))}
        <Body small muted style={{ marginTop: 8 }}>Dati calcolati dal tuo estratto conto, non una consulenza finanziaria.</Body>
      </Card>
      <ExplainSheet visible={!!ex} title={ex?.title ?? ''} formula={ex?.formula} rows={ex?.rows ?? []} total={ex?.total} onClose={() => setEx(null)} />
    </>
  );
}

export function BudgetPlanCard() {
  const info = useFin((s) => s.statementInfo);
  return info ? <StatementBudget info={info} /> : <GenericBudgetPlan />;
}
