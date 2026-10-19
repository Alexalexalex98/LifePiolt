import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { AiNote } from '@/components/AiNote';
import { ExplainSheet } from '@/components/ExplainSheet';
import { Body, Card, H, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { formatMoney } from '@/i18n/format';
import { listMovements, sumRows, type ExplainRow } from '@/lib/explain';
import { buildForecast, type MonthHist, type Projection } from '@/lib/statementForecast';
import { useFin } from '@/store/finance';

type Ex = { title: string; formula: string; rows: ExplainRow[]; total?: number } | null;

/** Previsioni dai dati dell'estratto: storico mese per mese, prossimi 3 mesi con intervallo, avvisi e scenari. Ogni numero si tocca per vedere da dove arriva. */
export function StatementForecastCard() {
  const th = useTheme();
  const months = useFin((s) => s.months);
  const info = useFin((s) => s.statementInfo);
  const rule = useFin((s) => s.salaryRule);
  const excluded = useFin((s) => s.salaryExcluded);
  const [ex, setEx] = useState<Ex>(null);
  const fc = useMemo(() => {
    if (!info) return null;
    const rows = listMovements(months, () => true).map((r) => ({ date: r.sort, label: r.label, amount: r.amount }));
    return buildForecast(rows, rule, excluded);
  }, [months, info, rule, excluded]);
  if (!fc) return null;
  const money = (n: number) => formatMoney(Math.round(n));
  const openMonth = (m: MonthHist) => {
    const rows = listMovements(months, (_x, mo) => { const [nm, y] = mo.label.split(' '); const idx = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'].indexOf(nm.toLowerCase()) + 1; return `${y}-${String(idx).padStart(2, '0')}` === m.ym; });
    setEx({ title: m.label, formula: `Entrate ${money(m.income)} (ricorrenti ${money(m.recurringIncome)}, occasionali ${money(m.occasionalIncome)}) meno spese fisse ${money(m.fixed)}, variabili ${money(m.variable)} e straordinarie ${money(m.extraordinary)} = ${money(m.net)}.${m.complete ? '' : ' Mese non ancora finito.'}`, rows, total: sumRows(rows) });
  };
  const openNext = (p: Projection) => setEx({ title: `Previsione di ${p.label}`, formula: `Entrate ${money(p.income)} = ricorrenti ${money(fc.recurringMonthly)} (le fonti che tornano mese dopo mese) + occasionali ${money(fc.occasionalMonthly)} (mediana degli ultimi 6 mesi). Spese fisse ${money(p.fixed)} (la somma di quelle riconosciute). Spese variabili ${money(p.variable)} (mediana degli ultimi mesi). Saldo del mese = ${money(p.net)}. L’intervallo ${money(p.low)} / ${money(p.high)} viene da quanto è variato davvero il saldo nei mesi dello storico. I pagamenti straordinari non sono previsti.`, rows: [] });
  return (
    <>
      <Card>
        <Row><H>Prossimi mesi dai tuoi dati</H><Body small muted>Affidabilità {fc.reliability}</Body></Row>
        <Body small muted style={{ marginBottom: 6 }}>Calcolati solo sul tuo estratto: ciò che torna ogni mese più la media recente del resto. Tocca un mese per vedere come si arriva al numero.</Body>
        {fc.next.map((p, i) => (
          <Pressable key={p.ym} onPress={() => openNext(p)} accessibilityRole="button" style={{ paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: th.item }}>
            <Row><Body bold style={{ flex: 1 }}>{p.label}</Body><Body bold color={p.net >= 0 ? th.positive : th.danger}>{p.net >= 0 ? '+' : ''}{money(p.net)}</Body></Row>
            <Body small muted>Entrate {money(p.income)} · spese fisse {money(p.fixed)} · variabili {money(p.variable)} · intervallo {money(p.low)} / {money(p.high)}</Body>
          </Pressable>
        ))}
        <AiNote />
      </Card>

      {fc.alerts.length ? (
        <Card>
          <H>Cosa emerge dallo storico</H>
          {fc.alerts.map((a, i) => <Body key={i} small style={{ marginTop: i ? 6 : 4 }}>• {a}</Body>)}
        </Card>
      ) : null}

      {fc.scenarios.length ? (
        <Card>
          <H>Cosa potrebbe succedere</H>
          {fc.scenarios.map((s, i) => (
            <View key={i} style={{ paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: th.item }}>
              <Row><Body style={{ flex: 1 }}>{s.title}</Body><Body bold color={s.net >= 0 ? th.positive : th.danger}>{s.net >= 0 ? '+' : ''}{money(s.net)}</Body></Row>
              <Body small muted>{s.why} Saldo del mese in questo caso.</Body>
            </View>
          ))}
        </Card>
      ) : null}

      <Card>
        <H>Storico mese per mese</H>
        {fc.history.slice().reverse().map((m, i) => (
          <Pressable key={m.ym} onPress={() => openMonth(m)} accessibilityRole="button" style={{ paddingVertical: 9, borderTopWidth: i ? 1 : 0, borderTopColor: th.item }}>
            <Row><Body style={{ flex: 1 }}>{m.label}{m.complete ? '' : ' (in corso)'}</Body><Body bold color={m.net >= 0 ? th.positive : th.danger}>{m.net >= 0 ? '+' : ''}{money(m.net)}</Body></Row>
            <Body small muted>Entrate {money(m.income)} · fisse {money(m.fixed)} · variabili {money(m.variable)}{m.extraordinary ? ` · straordinarie ${money(m.extraordinary)}` : ''}</Body>
          </Pressable>
        ))}
      </Card>
      <ExplainSheet visible={!!ex} title={ex?.title ?? ''} formula={ex?.formula} rows={ex?.rows ?? []} total={ex?.total} onClose={() => setEx(null)} />
    </>
  );
}
