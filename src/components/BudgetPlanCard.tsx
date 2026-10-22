import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Text } from '@/components/T';
import { Body, Btn, Card, H, Row, Sheet, Toggle } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { translateText } from '@/i18n/core';
import { formatMoney } from '@/i18n/format';
import { RENT_RULE, suggestPlan } from '@/lib/budgetPlan';
import { toast } from '@/store/toast';
import { categoryOf, useFin, type StatementInfo } from '@/store/finance';
import { ExplainSheet } from '@/components/ExplainSheet';
import { FixedEditSheet } from '@/components/FixedEditSheet';
import { StatementChecksCard } from '@/components/StatementChecksCard';
import { FormHead, Preview, Segments, Stepper } from '@/components/formKit';
import { Icon } from '@/lib/icons';
import { analyzeSalary, DEFAULT_AVG, type AvgRule } from '@/lib/statementAnalysis';
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
const avgName = (m: 'median' | 'mean') => (m === 'mean' ? 'la media aritmetica' : 'la mediana (il valore centrale, non si fa tirare da un mese strano)');
const dmy = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;

/** Budget costruito SOLO dall'estratto conto: ogni numero si puo' toccare per vedere i movimenti da cui arriva. */
function StatementBudget({ info }: { info: StatementInfo }) {
  const th = useTheme();
  const f = useFin();
  const [ex, setEx] = useState<Ex>(null);
  const [ruleOpen, setRuleOpen] = useState(false);
  const [from, setFrom] = useState(f.salaryRule.from);
  const [to, setTo] = useState(f.salaryRule.to);
  const [excl, setExcl] = useState<string[]>(f.salaryExcluded);
  const [avg, setAvg] = useState<AvgRule>(f.avgRule);
  const [fx, setFx] = useState<StatementInfo['fixed'][number] | null>(null);
  const months = f.months;
  const salary = info.salary.monthly;
  const fixedTotal = info.fixed.reduce((s, b) => s + b.monthly, 0);
  const free = salary - fixedTotal;
  const pct = (n: number) => (salary ? Math.round((n / salary) * 100) : 0);
  const rule = f.salaryRule;

  const openSalary = () => {
    const rows: ExplainRow[] = info.salary.months.flatMap((m) => m.parts.map((p) => ({ date: m.label, label: p.name, amount: p.amount, sort: m.ym })));
    setEx({ title: 'Entrate ricorrenti', formula: `Tutte le entrate contano, ma qui vedi quelle che tornano mese dopo mese (${info.salary.sources.map((s) => s.name).join(', ') || 'nessuna'}). Un mese va dal ${rule.from} al ${rule.to} del mese dopo (es. dal ${rule.from} settembre al ${rule.to} ottobre = settembre). Si sommano le entrate ricorrenti di ogni mese e si calcola ${avgName(info.salary.method)} sugli ultimi ${info.salary.used} mesi (${info.salary.months.filter((m) => m.used).map((m) => m.ym).reverse().join(', ')}) = ${formatMoney(salary)}. La regola si può cambiare con «Come si calcola». Servono almeno 3 mesi di storico per riconoscere una ricorrenza.`, rows, total: sumRows(rows) });
  };
  const recKeys = new Set(info.salary.sources.map((s) => s.key));
  const occRows = listMovements(months, (x) => x.amount > 0 && !recKeys.has(payeeKey(x.label)));
  const occMonthly = Math.round(sumRows(occRows) / Math.max(1, info.months));
  const openOcc = () => setEx({ title: 'Entrate occasionali', formula: `Tutte le entrate che non tornano mese dopo mese (depositi, bonifici da persone, rimborsi). Contano nei conti, ma non si possono dare per certe. Media = totale diviso ${info.months} mesi = ${formatMoney(occMonthly)}.`, rows: occRows, total: sumRows(occRows) });
  const openFixed = (b: StatementInfo['fixed'][number]) => {
    const rows = listMovements(months, (x) => x.amount < 0 && payeeKey(x.label) === b.key);
    setEx({ title: b.name, formula: b.overridden ? `Importo impostato da te: ${formatMoney(b.monthly)} al mese. Dall’estratto risultava ${formatMoney(b.overridden.calculated)} (${b.payments} pagamenti in ${b.months} mesi): qui sotto vedi i movimenti.` : `Spesa fissa: ${b.payments} pagamenti in ${b.months} mesi diversi, di circa ${formatMoney(b.monthly)} al mese (mediana dei mesi). Non contano acquisti singoli o piccoli importi.`, rows, total: sumRows(rows) });
  };
  const fixedKeys = new Set(info.fixed.map((b) => b.key));
  const openVar = (v: StatementInfo['variable'][number]) => {
    const rows = listMovements(months, (x) => x.amount < 0 && x.amount > -1000 && !fixedKeys.has(payeeKey(x.label)) && classify(x.label) === v.name);
    setEx({ title: v.name, formula: `Media mensile = totale ${formatMoney(v.total)} diviso ${info.months} mesi dell’estratto = ${formatMoney(v.monthly)}. Sono ${v.payments} pagamenti non ripetuti ogni mese.`, rows, total: sumRows(rows) });
  };
  const saveRule = () => {
    f.setSalaryRule({ from, to }, excl, avg); setRuleOpen(false);
  };
  return (
    <>
      <LinearGradient colors={['#12285c', '#1d3a80', '#14506e']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 24, padding: 18, marginBottom: 14 }}>
        <Text style={{ color: '#ffffffb8', fontSize: 13, fontWeight: '700', letterSpacing: 0.6 }}>{translateText('ENTRATE RICORRENTI · MEDIA AL MESE')}</Text>
        <Pressable onPress={openSalary} accessibilityRole="button" accessibilityLabel={translateText('Da dove arriva lo stipendio')}>
          <Text style={{ color: '#fff', fontSize: 36, fontWeight: '800', letterSpacing: -1, marginTop: 4 }}>{formatMoney(salary)}</Text>
          <Text style={{ color: '#ffffffc8', fontSize: 12.5 }}>{translateText(info.salary.method === 'mean' ? 'Media' : 'Mediana')} {translateText('degli ultimi')} {info.salary.used} {translateText(info.salary.used === 1 ? 'mese' : 'mesi')}{info.salary.used < info.salary.months.length ? ` ${translateText('su')} ${info.salary.months.length}` : ''} · {translateText('tocca per vedere i mesi')}</Text>
        </Pressable>
        <Pressable onPress={() => { setFrom(rule.from); setTo(rule.to); setExcl(f.salaryExcluded); setAvg(f.avgRule); setRuleOpen(true); }} accessibilityRole="button" style={{ marginTop: 10, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.16)' }}>
          <Icon name="settings" size={14} color="#fff" stroke={2} />
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12.5 }}>{translateText('Come si calcola')}</Text>
        </Pressable>
        <Pressable onPress={openOcc} accessibilityRole="button" style={{ marginTop: 10 }}>
          <Text style={{ color: '#ffffffd0', fontSize: 13 }}>{translateText('Più entrate occasionali (depositi, bonifici, una tantum): circa')} {formatMoney(occMonthly)} {translateText('al mese, in media su')} {info.months} {translateText('mesi')} · {translateText('tocca per vederle')}</Text>
        </Pressable>
        <Row style={{ marginTop: 14, alignItems: 'flex-end' }}>
          <View>
            <Text style={{ color: '#ffffffa8', fontSize: 12.5 }}>{translateText('Dopo le spese fisse ti restano')}</Text>
            <Text style={{ color: free >= 0 ? '#fff' : '#ff9a9a', fontSize: 24, fontWeight: '800' }}>{formatMoney(free)}</Text>
          </View>
          <Text style={{ color: '#ffffffc0', fontWeight: '700' }}>{salary ? 100 - pct(fixedTotal) : 0}%</Text>
        </Row>
      </LinearGradient>

      <StatementChecksCard />

      <Card>
        <H>Spese fisse (dall’estratto)</H>
        <Body small muted style={{ marginBottom: 4 }}>Quelle che tornano mese per mese: affitto, cassa malati e assicurazioni, mutuo, prestiti e leasing, telefono, energia, abbonamenti. Non i biglietti singoli.</Body>
        {info.fixed.length ? info.fixed.map((b, i) => (
          <Pressable key={b.key} onPress={() => openFixed(b)} onLongPress={() => setFx(b)} accessibilityRole="button" style={{ paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: th.item }}>
            <Row style={{ alignItems: 'flex-start' }}><Body bold style={{ flex: 1, flexShrink: 1 }}>{b.name}</Body><Body bold style={{ flexShrink: 0, marginStart: 8 }}>{formatMoney(b.monthly)}</Body></Row>
            <Body small muted>{pct(b.monthly)}% dello stipendio · {b.payments} pagamenti in {b.months} mesi · ultimo {dmy(b.lastDate)} · tocca per vederli</Body>
            {b.overridden ? <Body small color={th.warn}>{`Importo impostato da te (dall’estratto risultava ${formatMoney(b.overridden.calculated)}). Dì a Theia «ripristina ${b.name.split(':')[0].toLowerCase()}» per tornare al calcolo.`}</Body> : null}
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

      <FixedEditSheet item={fx} onClose={() => setFx(null)} />
      <ExplainSheet visible={!!ex} title={ex?.title ?? ''} formula={ex?.formula} rows={ex?.rows ?? []} total={ex?.total} onClose={() => setEx(null)} />
      <Sheet visible={ruleOpen} title="Come si calcola" onClose={() => setRuleOpen(false)}>
        {(() => {
          const prev = analyzeSalary(listMovements(months, () => true).map((r) => ({ date: r.sort, label: r.label, amount: r.amount })), { from, to }, excl, avg);
          const total = prev.months.length;
          const srcs = analyzeSalary(listMovements(months, () => true).map((r) => ({ date: r.sort, label: r.label, amount: r.amount })), { from, to }, [], avg).sources;
          return (
            <>
              <FormHead icon="calendar" title="Le entrate di ogni mese" text="Decidi quando comincia un mese di entrate e su quanti mesi fare la media." />
              <Body bold style={{ marginBottom: 6 }}>Quando va da… a…</Body>
              <Row gap={8}>
                <Stepper label="Dal giorno" value={from} onChange={setFrom} min={1} max={31} />
                <Stepper label="Al giorno del mese dopo" value={to} onChange={setTo} min={1} max={28} />
              </Row>
              <Body small muted style={{ marginTop: 6, marginBottom: 12 }}>Esempio: dal {from} al {to} → settembre va dal {from} settembre al {to} ottobre.</Body>
              <Segments label="Su quanti mesi" value={avg.window} onChange={(w) => setAvg({ ...avg, window: w })} options={[{ v: 0, label: 'Tutti' }, { v: 3, label: 'Ultimi 3' }, { v: 6, label: 'Ultimi 6' }, { v: 12, label: 'Ultimi 12' }]} />
              <Segments label="Che media" value={avg.method} onChange={(m) => setAvg({ ...avg, method: m })} options={[{ v: 'median', label: 'Mediana' }, { v: 'mean', label: 'Media aritmetica' }]} />
              <Body small muted style={{ marginBottom: 8 }}>{avg.method === 'median' ? 'La mediana è il valore centrale: un mese con un extra non la sposta.' : 'La media aritmetica somma tutti i mesi e divide: un mese con un extra la alza.'}</Body>
              {srcs.length ? <Body bold style={{ marginTop: 4 }}>Fonti che contano come ricorrenti</Body> : null}
              {srcs.map((s) => <Toggle key={s.key} label={`${s.name} · circa ${formatMoney(s.monthly)}`} value={!excl.includes(s.key)} onChange={(on) => setExcl(on ? excl.filter((k) => k !== s.key) : [...excl, s.key])} />)}
              <Preview label="Con questa regola" value={`${formatMoney(prev.monthly)} ${translateText('al mese')}`}>
                <Body small muted style={{ marginTop: 2 }}>{avg.method === 'mean' ? 'Media' : 'Mediana'} su {prev.used} {prev.used === 1 ? 'mese' : 'mesi'}{prev.used < total ? ` su ${total}` : ''}. Tutte le entrate contano comunque nei conti.</Body>
              </Preview>
              <Btn style={{ marginTop: 10 }} title="Salva e ricalcola" onPress={saveRule} />
              <Btn ghost style={{ marginTop: 6 }} title="Ripristina la regola standard" onPress={() => { setFrom(20); setTo(10); setAvg(DEFAULT_AVG); setExcl([]); }} />
            </>
          );
        })()}
      </Sheet>
    </>
  );
}

export function BudgetPlanCard() {
  const info = useFin((s) => s.statementInfo);
  return info ? <StatementBudget info={info} /> : <GenericBudgetPlan />;
}
