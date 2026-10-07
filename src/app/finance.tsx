import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Body, Button, Card, Empty, H, Input, Label, Metric, Pill, Row, Screen } from '@/components/ui';
import { todayKey } from '@/lib/id';
import { financeScore } from '@/lib/score';
import { useTheme } from '@/hooks/use-theme';
import { useStore } from '@/store';

const categories = ['Casa', 'Cibo', 'Trasporti', 'Svago', 'Salute', 'Altro'];
const fmt = (n: number) => n.toLocaleString('it-CH', { maximumFractionDigits: 2 });

export default function Finance() {
  const t = useTheme();
  const { salary, setSalary, txs, addTx, removeTx } = useStore();
  const [sal, setSal] = useState(salary ? String(salary) : '');
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [cat, setCat] = useState(categories[1]);
  const [income, setIncome] = useState(false);

  const month = todayKey().slice(0, 7);
  const monthTx = txs.filter((x) => x.date.startsWith(month));
  const spent = monthTx.filter((x) => x.amount < 0).reduce((a, x) => a - x.amount, 0);
  const earned = monthTx.filter((x) => x.amount > 0).reduce((a, x) => a + x.amount, 0);
  const byCat = categories
    .map((c) => ({ c, v: monthTx.filter((x) => x.amount < 0 && x.category === c).reduce((a, x) => a - x.amount, 0) }))
    .filter((x) => x.v > 0);

  function add() {
    const n = parseFloat(amount.replace(',', '.'));
    if (!Number.isFinite(n) || n <= 0 || !label.trim()) return;
    addTx({ label: label.trim(), amount: income ? n : -n, category: income ? 'Entrata' : cat });
    setLabel('');
    setAmount('');
  }

  return (
    <Screen title="LifeFinance" back>
      <Card>
        <Label>Questo mese</Label>
        <Row>
          <View><Metric>{fmt(earned - spent)}</Metric><Body muted small>entrate − spese (CHF)</Body></View>
          <View style={{ alignItems: 'flex-end' }}><Metric>{financeScore(salary, txs) ?? '—'}</Metric><Body muted small>punteggio budget</Body></View>
        </Row>
      </Card>

      <Card>
        <H>Stipendio mensile (CHF)</H>
        <Input keyboardType="decimal-pad" placeholder="0" value={sal} onChangeText={setSal} />
        <Button small title="Salva stipendio" onPress={() => setSalary(Math.max(0, parseFloat(sal.replace(',', '.')) || 0))} />
      </Card>

      <Card>
        <H>Nuovo movimento</H>
        <View style={{ flexDirection: 'row', marginBottom: 6 }}>
          <Pill label="Spesa" on={!income} onPress={() => setIncome(false)} />
          <Pill label="Entrata" on={income} onPress={() => setIncome(true)} />
        </View>
        <Input placeholder="Descrizione" value={label} onChangeText={setLabel} />
        <Input keyboardType="decimal-pad" placeholder="Importo" value={amount} onChangeText={setAmount} />
        {!income && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {categories.map((c) => <Pill key={c} label={c} on={cat === c} onPress={() => setCat(c)} />)}
          </View>
        )}
        <Button title="Aggiungi" onPress={add} />
      </Card>

      {byCat.length > 0 && (
        <Card>
          <H>Spese per categoria</H>
          {byCat.map((x) => (
            <Row key={x.c} style={{ paddingVertical: 4 }}><Body>{x.c}</Body><Body muted>{fmt(x.v)} CHF</Body></Row>
          ))}
        </Card>
      )}

      <Card>
        <H>Movimenti</H>
        {txs.length === 0 && <Empty text="Nessun movimento registrato." />}
        {txs.slice(0, 30).map((x) => (
          <Row key={x.id} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: t.border }}>
            <View style={{ flex: 1 }}>
              <Body>{x.label}</Body>
              <Body muted small>{x.category} · {x.date}</Body>
            </View>
            <Text style={{ color: x.amount > 0 ? t.positive : t.text, fontWeight: '700' }}>{x.amount > 0 ? '+' : ''}{fmt(x.amount)}</Text>
            <Pressable onPress={() => removeTx(x.id)} hitSlop={10} accessibilityLabel="Elimina movimento"><Text style={{ color: t.muted }}>✕</Text></Pressable>
          </Row>
        ))}
        <Body muted small style={{ marginTop: 10 }}>Strumento di tracciamento personale, non è consulenza finanziaria.</Body>
      </Card>
    </Screen>
  );
}
