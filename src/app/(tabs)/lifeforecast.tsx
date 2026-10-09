import { useState } from 'react';
import { View } from 'react-native';

import { LineChart } from '@/components/charts';
import { FinTabs } from '@/components/FinTabs';
import { Body, Card, H, Input, Item, Page, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { formatCHF } from '@/lib/format';
import { avgRecentNet, monthEnd, monthNet, useFin } from '@/store/finance';
import { formatMoney } from '@/i18n/format';

export function computeForecast(startCapital: number, monthly: number, annualReturnPct: number) {
  const r = annualReturnPct / 100;
  const cash = [startCapital], inv = [startCapital];
  let cb = startCapital, ib = startCapital;
  for (let y = 1; y <= 10; y++) {
    cb += monthly * 12;
    for (let m = 0; m < 12; m++) ib = ib * (1 + r / 12) + monthly;
    cash.push(cb); inv.push(ib);
  }
  return { cash, inv };
}

export default function LifeForecast() {
  const t = useTheme();
  const f = useFin();
  const base = avgRecentNet(f.months);
  const [monthly, setMonthly] = useState(String(Math.round(base)));
  const [ret, setRet] = useState('4');
  const m = parseFloat(monthly.replace(',', '.')) || 0, r = parseFloat(ret.replace(',', '.')) || 0;
  const { cash, inv } = computeForecast(monthEnd(f.months[0]), m, r);
  const diff = inv[10] - cash[10];

  const nonEss = f.categories.filter((c) => !['Affitto', 'Cassa malati', 'Alimentari/Casa'].includes(c.n)).sort((a, b) => b.p - a.p);
  const top = nonEss[0];
  const cur = f.months[0];
  const totalExp = -cur.movements.filter((x) => x.amount < 0).reduce((s, x) => s + x.amount, 0);
  const catAmount = Math.round((totalExp * (top?.p ?? 0)) / 100);
  const tips: string[] = [];
  if (top && catAmount > 0) tips.push(`Tagliando il 20% della categoria "${top.n}" (circa ${formatMoney(catAmount)}/mese) libereresti circa ${formatMoney(Math.round(catAmount * 0.2))} al mese in più da risparmiare o investire.`);
  if (!f.budget.saveToEmergency) tips.push('Il Fondo di emergenza è escluso dal piano del prossimo mese: riattivarlo aiuta a non dover intaccare gli investimenti nei momenti difficili.');
  const rem = f.budget.salary - Object.values(f.budget.alloc).reduce((s, v) => s + (v || 0), 0);
  if (f.budget.salary > 0 && rem > 50) tips.push(`Nel piano del prossimo mese hai ${formatMoney(rem)} non allocati: potresti destinarli al Portafoglio invece di lasciarli fermi.`);
  if (!tips.length) tips.push('Registra qualche mese di movimenti e il piano del mese prossimo: qui comparirà qualche accortezza su misura.');
  void monthNet;

  return (
    <Page id="lifeforecast" title="Previsioni future" back>
      <FinTabs current="lifeforecast" />
      <Card style={{ borderColor: '#3a2a1a' }}>
        <Body small><Body small bold>Non è una consulenza finanziaria.</Body> È un'ipotesi di come potrebbe evolvere la tua situazione nei prossimi 10 anni, calcolata sullo storico reale dei tuoi movimenti in LifeFinance, con assunzioni semplici (nessun imprevisto, stipendio costante, rendimento medio costante). La realtà sarà diversa: usala come spunto, non come piano.</Body>
      </Card>
      <Card>
        <Body small muted style={{ marginBottom: 4 }}>Ipotesi di partenza</Body>
        <Item><Row><Body muted style={{ flex: 1 }}>Risparmio medio mensile (ultimi 3 mesi)</Body><Body bold>{base >= 0 ? '+' : ''}{formatMoney(base)}</Body></Row></Item>
        <Row style={{ marginTop: 10 }}><Body small muted style={{ flex: 1 }}>Quanto vuoi accantonare al mese</Body><Input keyboardType="decimal-pad" value={monthly} onChangeText={setMonthly} style={{ width: 110, marginBottom: 0 }} /></Row>
        <Row style={{ marginTop: 8 }}><Body small muted style={{ flex: 1 }}>Rendimento medio annuo atteso se investi</Body><Input keyboardType="decimal-pad" value={ret} onChangeText={setRet} style={{ width: 70, marginBottom: 0 }} /></Row>
      </Card>
      <Card>
        <H>Andamento a 10 anni</H>
        <LineChart data={cash} />
        <View style={{ flexDirection: 'row', paddingLeft: 38 }}>{cash.map((_, i) => <Body key={i} small muted style={{ flex: 1, textAlign: 'center', fontSize: 9 }}>{i === 0 ? 'Ora' : `+${i}`}</Body>)}</View>
        <Body small muted style={{ marginTop: 10 }}>Linea: patrimonio se lasci tutto sul conto, senza investire.</Body>
      </Card>
      <Card>
        <H>Tra 10 anni</H>
        <Item><Row><Body muted>Solo risparmiando (conto)</Body><Body bold>{formatMoney(cash[10])}</Body></Row></Item>
        <Item><Row><Body muted>Investendo al rendimento indicato</Body><Body bold>{formatMoney(inv[10])}</Body></Row></Item>
        <Item last><Row><Body muted>Differenza stimata</Body><Body bold color={t.positive}>{diff >= 0 ? '+' : ''}{formatMoney(diff)}</Body></Row></Item>
      </Card>
      <Card>
        <H>Tappe intermedie</H>
        {[1, 5, 10].map((y, i) => <Item key={y} last={i === 2}><Row><Body muted>Tra {y} {y === 1 ? 'anno' : 'anni'}</Body><View style={{ alignItems: 'flex-end' }}><Body small muted>conto: {formatCHF(cash[y])}</Body><Body bold>investendo: {formatCHF(inv[y])}</Body></View></Row></Item>)}
      </Card>
      <Card>
        <H>Qualche accortezza per averne di più</H>
        {tips.map((x, i) => <Item key={i} last={i === tips.length - 1}><Body small>{x}</Body></Item>)}
      </Card>
    </Page>
  );
}
