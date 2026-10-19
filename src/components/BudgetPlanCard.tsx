import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Text } from '@/components/T';
import { Body, Btn, Card, H, Input, Row, Sheet, Toggle } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { translateText } from '@/i18n/core';
import { formatMoney } from '@/i18n/format';
import { RENT_RULE, suggestPlan } from '@/lib/budgetPlan';
import { toast } from '@/store/toast';
import { categoryOf, useFin, type StatementInfo } from '@/store/finance';
import { ExplainSheet } from '@/components/ExplainSheet';
import { listMovements, sumRows, type ExplainRow } from '@/lib/explain';
import { classify, payeeKey } from '@/lib/statementAnalysis';

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
const dmy = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;

/** Budget costruito SOLO dall'estratto conto: ogni numero si puo' toccare per vedere i movimenti da cui arriva. */
function StatementBudget({ info }: { info: StatementInfo }) {
  const th = useTheme();
  const f = useFin();
  const [ex, setEx] = useState<Ex>(null);
  const [ruleOpen, setRuleOpen] = useState(false);
  const [from, setFrom] = useState(String(f.salaryRule.from));
  const [to, setTo] = useState(String(f.salaryRule.to));
  const [excl, setExcl] = useState<string[]>(f.salaryExcluded);
  const months = f.months;
  const salary = info.salary.monthly;
  const fixedTotal = info.fixed.reduce((s, b) => s + b.monthly, 0);
  const free = salary - fixedTotal;
  const pct = (n: number) => (salary ? Math.round((n / salary) * 100) : 0);
  const rule = f.salaryRule;

  const openSalary = () => {
    const rows: ExplainRow[] = info.salary.months.flatMap((m) => m.parts.map((p) => ({ date: m.label, label: p.name, amount: p.amount, sort: m.ym })));
    setEx({ title: 'Da dove arriva lo stipendio', formula: `Regola: lo stipendio di un mese è quello che entra dal ${rule.from} del mese al ${rule.to} del mese dopo (es. dal ${rule.from} settembre al ${rule.to} ottobre = settembre). Per ogni mese si sommano le entrate che tornano (${info.salary.sources.map((s) => s.name).join(', ') || 'nessuna'}); lo stipendio è la mediana dei mesi = ${formatMoney(salary)}. Depositi, rimborsi e entrate una tantum non contano.`, rows, total: sumRows(rows) });
  };
  const openFixed = (b: StatementInfo['fixed'][number]) => {
    const rows = listMovements(months, (x) => x.amount < 0 && payeeKey(x.label) === b.key);
    setEx({ title: b.name, formula: `Spesa fissa: ${b.payments} pagamenti in ${b.months} mesi diversi, di circa ${formatMoney(b.monthly)} al mese (mediana dei mesi). Non contano acquisti singoli o piccoli importi.`, rows, total: sumRows(rows) });
  };
  const fixedKeys = new Set(info.fixed.map((b) => b.key));
  const openVar = (v: StatementInfo['variable'][number]) => {
    const rows = listMovements(months, (x) => x.amount < 0 && x.amount > -1000 && !fixedKeys.has(payeeKey(x.label)) && classify(x.label) === v.name);
    setEx({ title: v.name, formula: `Media mensile = totale ${formatMoney(v.total)} diviso ${info.months} mesi dell’estratto = ${formatMoney(v.monthly)}. Sono ${v.payments} pagamenti non ripetuti ogni mese.`, rows, total: sumRows(rows) });
  };
  const saveRule = () => {
    const a = Math.min(31, Math.max(1, Math.round(Number(from)) || 20)), b = Math.min(28, Math.max(1, Math.round(Number(to)) || 10));
    f.setSalaryRule({ from: a, to: b }, excl); setRuleOpen(false);
  };
  return (
    <>
      <LinearGradient colors={['#12285c', '#1d3a80', '#14506e']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 24, padding: 18, marginBottom: 14 }}>
        <Text style={{ color: '#ffffffb8', fontSize: 13, fontWeight: '700', letterSpacing: 0.6 }}>{translateText('STIPENDIO MENSILE')}</Text>
        <Pressable onPress={openSalary} accessibilityRole="button" accessibilityLabel={translateText('Da dove arriva lo stipendio')}>
          <Text style={{ color: '#fff', fontSize: 36, fontWeight: '800', letterSpacing: -1, marginTop: 4 }}>{formatMoney(salary)}</Text>
          <Text style={{ color: '#ffffffa8', fontSize: 12.5 }}>{translateText('Entrate dal {0} al {1} del mese dopo: tocca per vedere i mesi').replace('{0}', String(rule.from)).replace('{1}', String(rule.to))}</Text>
        </Pressable>
        <Pressable onPress={() => { setFrom(String(rule.from)); setTo(String(rule.to)); setExcl(f.salaryExcluded); setRuleOpen(true); }} accessibilityRole="button" style={{ marginTop: 8, alignSelf: 'flex-start', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.16)' }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12.5 }}>{translateText('Cambia la regola dello stipendio')}</Text>
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
        <Body small muted style={{ marginBottom: 4 }}>Quelle che tornano mese per mese: affitto, cassa malati e assicurazioni, mutuo, prestiti e leasing, telefono, energia, abbonamenti. Non i biglietti singoli.</Body>
        {info.fixed.length ? info.fixed.map((b, i) => (
          <Pressable key={b.key} onPress={() => openFixed(b)} accessibilityRole="button" style={{ paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: th.item }}>
            <Row><Body bold style={{ flex: 1 }}>{b.name}</Body><Body bold>{formatMoney(b.monthly)}</Body></Row>
            <Body small muted>{pct(b.monthly)}% dello stipendio · {b.payments} pagamenti in {b.months} mesi · ultimo {dmy(b.lastDate)} · tocca per vederli</Body>
          </Pressable>
        )) : <Body small muted>Nell’estratto non ci sono spese che tornano ogni mese.</Body>}
        {info.fixed.length ? <Row style={{ marginTop: 8, borderTopWidth: 1, borderTopColor: th.item, paddingTop: 8 }}><Body bold style={{ flex: 1 }}>Totale spese fisse</Body><Body bold>{formatMoney(fixedTotal)}</Body></Row> : null}
        {free < 0 ? <Body small color={th.danger} style={{ marginTop: 6 }}>Le spese fisse superano lo stipendio riconosciuto: controlla toccando le voci o cambia la regola dello stipendio.</Body> : null}
      </Card>

      <Card>
        <Row><H>Il resto: cibo e spese variabili</H><Btn small title="Usa come budget" onPress={() => { const alloc: Record<string, number> = { ...f.budget.alloc }; info.variable.forEach((c) => { alloc[c.name] = Math.round(c.monthly); }); f.setBudget({ alloc }); toast('Medie dell’estratto impostate come budget'); }} /></Row>
        <Body small muted style={{ marginBottom: 6 }}>Media mensile sui {info.months} mesi dell’estratto, senza le spese fisse e senza i grandi pagamenti straordinari. Tocca una voce per vedere i movimenti.</Body>
        {info.variable.map((v, i) => (
          <Pressable key={v.name} onPress={() => openVar(v)} accessibilityRole="button" style={{ paddingVertical: 9, borderTopWidth: i ? 1 : 0, borderTopColor: th.item }}>
            <Row><Body style={{ flex: 1 }}>{v.name}</Body><Body muted small style={{ marginRight: 10 }}>{pct(v.monthly)}%</Body><Body bold>{formatMoney(v.monthly)}</Body></Row>
          </Pressable>
        ))}
        <Body small muted style={{ marginTop: 8 }}>Dati calcolati dal tuo estratto conto, non una consulenza finanziaria.</Body>
      </Card>

      {info.extraordinary.length ? (
        <Card>
          <H>Pagamenti straordinari (non fanno media)</H>
          <Body small muted style={{ marginBottom: 4 }}>Grandi pagamenti che non tornano ogni mese, come uffici di esecuzione o bonifici esteri: li tengo a parte perché falserebbero le medie.</Body>
          {info.extraordinary.map((e, i) => <Row key={i} style={{ paddingVertical: 7, borderTopWidth: i ? 1 : 0, borderTopColor: th.item }}><View style={{ flex: 1 }}><Body small muted>{dmy(e.date)}</Body><Body numberOfLines={2}>{e.label}</Body></View><Body bold>{formatMoney(e.amount)}</Body></Row>)}
        </Card>
      ) : null}

      <ExplainSheet visible={!!ex} title={ex?.title ?? ''} formula={ex?.formula} rows={ex?.rows ?? []} total={ex?.total} onClose={() => setEx(null)} />
      <Sheet visible={ruleOpen} title="Regola dello stipendio" onClose={() => setRuleOpen(false)}>
        <Body small muted>Lo stipendio di un mese è quello che entra dal giorno «dal» di quel mese al giorno «al» del mese dopo. Esempio: dal 20 al 10 → lo stipendio di settembre entra dal 20 settembre al 10 ottobre.</Body>
        <Row gap={8} style={{ marginTop: 8 }}>
          <View style={{ flex: 1 }}><Body bold>Dal giorno</Body><Input keyboardType="numeric" value={from} onChangeText={setFrom} accessibilityLabel="Dal giorno" /></View>
          <View style={{ flex: 1 }}><Body bold>Al giorno (mese dopo)</Body><Input keyboardType="numeric" value={to} onChangeText={setTo} accessibilityLabel="Al giorno" /></View>
        </Row>
        {info.salary.sources.length ? <Body bold style={{ marginTop: 8 }}>Entrate che contano come stipendio</Body> : null}
        {info.salary.sources.map((s) => <Toggle key={s.key} label={`${s.name} · circa ${formatMoney(s.monthly)}`} value={!excl.includes(s.key)} onChange={(on) => setExcl(on ? excl.filter((k) => k !== s.key) : [...excl, s.key])} />)}
        <Btn style={{ marginTop: 10 }} title="Salva e ricalcola" onPress={saveRule} />
      </Sheet>
    </>
  );
}

export function BudgetPlanCard() {
  const info = useFin((s) => s.statementInfo);
  return info ? <StatementBudget info={info} /> : <GenericBudgetPlan />;
}
