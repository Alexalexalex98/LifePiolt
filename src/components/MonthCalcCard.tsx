import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/T';

import { Body, Card, H, Progress, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { formatMoney } from '@/i18n/format';
import { monthCalc } from '@/lib/financeCalc';
import { categoryOf, useFin } from '@/store/finance';

/** Il calcolo del mese per intero: saldo sul conto, entrate, spese fisse e variabili, fondo emergenza, quanto resta e categorie contro budget. */
export function MonthCalcCard() {
  const t = useTheme();
  const f = useFin();
  const [open, setOpen] = useState(true);
  const m = f.months[0];
  if (!m) return null;
  const c = monthCalc(m, (l) => categoryOf(l, f.categories), f.budget.alloc);
  const line = (label: string, amount: number, o: { bold?: boolean; color?: string; sign?: string } = {}) => (
    <Row key={label} style={{ paddingVertical: 4 }}>
      <Body small bold={o.bold} style={{ flex: 1 }} numberOfLines={1}>{label}</Body>
      <Body small bold={o.bold} color={o.color}>{o.sign ?? ''}{formatMoney(amount, { decimals: amount % 1 ? 2 : 0 })}</Body>
    </Row>
  );
  const head = (txt: string) => <Text style={{ color: t.muted, fontSize: 11, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase', marginTop: 12, marginBottom: 2 }}>{txt}</Text>;
  return (
    <Card>
      <Pressable onPress={() => setOpen(!open)} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <Row><H>Il calcolo del mese</H><Body small muted>{open ? 'Riduci' : 'Mostra'}</Body></Row>
        <Body small muted>{c.label}</Body>
      </Pressable>
      <View style={{ marginTop: 8 }}>
        <Body small muted>Sul conto adesso</Body>
        <Text style={{ color: t.text, fontSize: 30, fontWeight: '800' }}>{formatMoney(c.end)}</Text>
        <Body small muted>Inizio mese {formatMoney(c.start)}</Body>
      </View>
      {open && (
        <>
          {head('Entrate')}
          {line('Stipendio e altre entrate', c.income, { bold: true, color: t.positive, sign: '+' })}
          {head(`Spese fisse · ${formatMoney(c.fixedTotal)}`)}
          {c.fixed.map((x) => line(x.label, x.amount, { sign: '−' }))}
          {head(`Spese variabili · ${formatMoney(c.variableTotal)}`)}
          {c.variable.map((x) => line(x.label, x.amount, { sign: '−' }))}
          {head('Risparmio')}
          {line('Fondo emergenza messo da parte', c.emergency, { sign: '−' })}
          <View style={{ height: 1, backgroundColor: t.border, marginVertical: 8 }} />
          {line('Totale spese', c.expenses + c.emergency, { bold: true })}
          {line('Quello che resta del mese', c.left, { bold: true, color: c.left >= 0 ? t.positive : t.danger })}
          <Body small muted style={{ marginTop: 4 }}>Metti da parte il {c.savedPct.toFixed(1).replace('.', ',')}% delle entrate (fondo emergenza + quanto resta).</Body>
          {head('Categorie e budget')}
          {c.byCategory.filter((x) => x.spent > 0 || x.budget > 0).map((x) => (
            <View key={x.name} style={{ paddingVertical: 5 }}>
              <Row><Body small bold style={{ flex: 1 }}>{x.name}</Body><Body small color={x.left < 0 ? t.danger : t.muted}>{formatMoney(x.spent)} / {formatMoney(x.budget)}</Body></Row>
              <View style={{ marginTop: 4 }}><Progress value={x.budget > 0 ? Math.min(100, Math.round((x.spent / x.budget) * 100)) : 0} /></View>
            </View>
          ))}
        </>
      )}
    </Card>
  );
}
