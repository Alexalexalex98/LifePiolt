import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Spark } from '@/components/charts';
import { FinTabs } from '@/components/FinTabs';
import { StockFlow, type Flow } from '@/components/stocks';
import { Body, Btn, Card, Empty, H, Input, Item, Link, Metric, Page, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { formatCHF } from '@/lib/format';
import { go } from '@/lib/nav';
import { holdings, useFin } from '@/store/finance';
import { toast } from '@/store/toast';

export default function Stocks() {
  const t = useTheme();
  const f = useFin();
  const [q, setQ] = useState('');
  const [flow, setFlow] = useState<Flow>(null);
  const [add, setAdd] = useState(false);
  const [sym, setSym] = useState('');
  const [name, setName] = useState('');

  const hold = holdings(f.stocks);
  const invested = hold.reduce((s, x) => s + x.shares * x.avgCost, 0);
  const value = hold.reduce((s, x) => s + x.shares * x.price, 0);
  const gain = invested ? ((value - invested) / invested) * 100 : 0;
  const list = f.stocks.filter((s) => s.symbol.toLowerCase().includes(q.toLowerCase()) || s.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <Page id="stocks" title="Stock" back>
      <FinTabs current="stocks" />
      <Card onPress={() => go('portfolio')}>
        <H>Portafoglio</H>
        <Metric big>{formatCHF(value)} CHF</Metric>
        <Body small color={gain >= 0 ? t.positive : t.danger}>{gain >= 0 ? '+' : ''}{gain.toFixed(2)}%</Body>
        <Body small muted style={{ marginTop: 6 }}>Capitale investito: {formatCHF(invested)} CHF · simulazione: nessun investimento reale · tocca per entrare</Body>
      </Card>
      <Input placeholder="Cerca un titolo azionario" value={q} onChangeText={setQ} />
      <Card>
        <Row><H>Watchlist</H><Btn small ghost title="+ Aggiungi titolo" onPress={() => setAdd(true)} /></Row>
        {list.length === 0 ? <Empty text="Nessun titolo trovato." /> : list.map((s, i) => {
          const up = s.changePct >= 0, color = up ? t.positive : t.danger;
          return (
            <Item key={s.symbol} last={i === list.length - 1}>
              <Pressable onPress={() => setFlow({ view: 'detail', symbol: s.symbol })}>
                <Row>
                  <View style={{ flex: 1 }}><Body bold>{s.symbol}</Body><Body small muted numberOfLines={1}>{s.name}</Body></View>
                  <Spark data={s.history.slice(-12)} w={54} h={28} pad={3} color={color} stroke={2} />
                  <View style={{ alignItems: 'flex-end', minWidth: 76 }}><Body>{s.price.toFixed(2)}</Body><Body small color={color}>{up ? '+' : ''}{s.changePct.toFixed(2)}%</Body></View>
                  <Link danger onPress={() => f.delStock(s.symbol)}>×</Link>
                </Row>
              </Pressable>
            </Item>
          );
        })}
      </Card>
      <StockFlow flow={flow} setFlow={setFlow} />
      <Sheet visible={add} title="Aggiungi titolo alla watchlist" onClose={() => setAdd(false)}>
        <Input autoCapitalize="characters" placeholder="Simbolo (es. GOOGL)" value={sym} onChangeText={setSym} />
        <Input placeholder="Nome azienda (facoltativo)" value={name} onChangeText={setName} />
        <Btn title="Aggiungi" onPress={() => {
          const s = sym.toUpperCase().trim(); if (!s) return;
          if (f.stocks.some((x) => x.symbol === s)) { toast('Titolo già in watchlist'); return; }
          f.addStock(s, name.trim() || s); setSym(''); setName(''); setAdd(false); toast('Titolo aggiunto alla watchlist');
        }} />
      </Sheet>
    </Page>
  );
}
