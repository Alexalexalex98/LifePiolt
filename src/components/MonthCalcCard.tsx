import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/T';

import { Body, Btn, Card, H, Pill, Progress, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { formatMoney } from '@/i18n/format';
import { monthCalc, oneOffTransfers, transferSource, type IncomeKind, type IncomeLine } from '@/lib/financeCalc';
import { payeeKey } from '@/lib/statementAnalysis';
import { toast } from '@/store/toast';
import { t as tl } from '@/i18n/core';
import { categoryOf, useFin } from '@/store/finance';

/** Il calcolo del mese per intero: saldo sul conto, entrate, spese fisse e variabili, fondo emergenza, quanto resta e categorie contro budget. */
export function MonthCalcCard() {
  const t = useTheme();
  const f = useFin();
  const [open, setOpen] = useState(true);
  const [ask, setAsk] = useState<IncomeLine | null>(null);
  const m = f.months[0];
  if (!m) return null;
  const info = f.statementInfo;
  const salaryKeys = new Set((info?.salary.sources ?? []).map((x) => x.key));
  const fixedKeys = info ? new Set(info.fixed.map((x) => x.key)) : null;
  const kinds = f.moveKind ?? {};
  const oneOff = oneOffTransfers(f.months, kinds, (l) => transferSource(l, payeeKey));
  const c = monthCalc(m, (l) => categoryOf(l, f.categories), f.budget.alloc, {
    isFixed: fixedKeys ? (l) => fixedKeys.has(payeeKey(l)) : undefined,
    incomeKind: (x, key) => (kinds[key] === 'transfer' ? 'other' : kinds[key]) ?? (salaryKeys.has(payeeKey(x.label)) ? 'salary' : undefined),
    skip: (key) => oneOff.has(key),
  });
  const KIND: Record<IncomeKind, string> = { salary: 'Stipendio', other: 'Altra entrata', refund: 'Rimborso', transfer: 'Giroconto tra i miei conti' };
  const line = (label: string, amount: number, o: { bold?: boolean; color?: string; sign?: string } = {}) => (
    <Row key={label} style={{ paddingVertical: 4 }}>
      <Body small bold={o.bold} style={{ flex: 1, flexShrink: 1 }} numberOfLines={2}>{label}</Body>
      <Body small bold={o.bold} color={o.color} style={{ flexShrink: 0, marginStart: 8 }}>{o.sign ?? ''}{formatMoney(amount, { decimals: amount % 1 ? 2 : 0 })}</Body>
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
        {c.transferIn > 0 || c.transferOut > 0 ? <Body small color={t.warn} style={{ marginTop: 4 }}>{`${tl('Include giroconti tra i tuoi conti')}: ${c.transferIn > 0 ? `+${formatMoney(c.transferIn)}` : ''}${c.transferIn > 0 && c.transferOut > 0 ? ' / ' : ''}${c.transferOut > 0 ? `−${formatMoney(c.transferOut)}` : ''}. ${tl('Non sono guadagno, ma ti hanno aiutato: senza di loro saresti a {0}.', formatMoney(c.endWithoutTransfers))}`}</Body> : null}
      </View>
      {open && (
        <>
          {head('Entrate')}
          {c.incomeLines.length === 0 ? <Body small muted>Nessuna entrata registrata questo mese.</Body> : c.incomeLines.map((x) => (
            <Pressable key={x.key} onPress={() => setAsk(x)} accessibilityRole="button" style={{ paddingVertical: 4 }}>
              <Row>
                <View style={{ flex: 1, flexShrink: 1 }}>
                  <Body small numberOfLines={2}>{x.label}</Body>
                  <Body small color={x.kind ? t.muted : t.warn}>{`${x.date ? `${x.date} · ` : ''}${kinds[x.key] === 'transfer' ? tl('Giroconto ricorrente: conta come entrata ogni mese') : x.kind ? tl(KIND[x.kind]) : tl('Da confermare: che cos\'è? Tocca per dirmelo')}`}</Body>
                </View>
                <Body small bold color={t.positive} style={{ flexShrink: 0, marginStart: 8 }}>{`+${formatMoney(x.amount, { decimals: x.amount % 1 ? 2 : 0 })}`}</Body>
              </Row>
            </Pressable>
          ))}
          {c.incomeLines.length > 1 ? line('Totale entrate', c.income, { bold: true, color: t.positive, sign: '+' }) : null}
          {c.incomeUnsure > 0 ? <Body small color={t.warn} style={{ marginTop: 2 }}>{`${formatMoney(c.incomeUnsure)} di entrate non sono ancora confermate: finché non mi dici cosa sono, il calcolo non è sicuro.`}</Body> : null}
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
      <Sheet visible={!!ask} title="Che cos'è questa entrata?" onClose={() => setAsk(null)}>
        {ask ? (
          <View style={{ gap: 8 }}>
            <Body bold numberOfLines={3}>{ask.label}</Body>
            <Body small muted>{`${ask.date} · +${formatMoney(ask.amount, { decimals: 2 })}`}</Body>
            <Body small muted>Dimmelo tu: non lo indovino. Da questa scelta dipendono entrate, quanto ti resta e le medie. Un giroconto una tantum resta separato e fuori dalle medie; se torna ogni mese dallo stesso conto (o in contanti) conta come entrata.</Body>
            <Row gap={8} style={{ flexWrap: 'wrap', justifyContent: 'flex-start' }}>
              {(Object.keys(KIND) as IncomeKind[]).map((k) => <Pill key={k} label={KIND[k]} on={kinds[ask.key] === k || (!kinds[ask.key] && ask.kind === k)} onPress={() => { f.setMoveKind(ask.key, k); f.recomputeStatement(); toast('Fatto, ricalcolo'); setAsk(null); }} />)}
            </Row>
            {kinds[ask.key] ? <Btn small ghost title="Torna alla scelta automatica" onPress={() => { f.setMoveKind(ask.key, null); f.recomputeStatement(); setAsk(null); }} /> : null}
          </View>
        ) : null}
      </Sheet>
    </Card>
  );
}
