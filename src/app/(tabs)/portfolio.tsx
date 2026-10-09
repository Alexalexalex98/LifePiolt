import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Spark } from '@/components/charts';
import { StockFlow, type Flow } from '@/components/stocks';
import { Body, Btn, Card, Empty, Input, Item, Link, Page, Pill, Row, Sheet, Tag } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { holdings, useFin } from '@/store/finance';
import { toast } from '@/store/toast';
import { formatMoney } from '@/i18n/format';

const tabs = ['Posizioni', 'Ordini', 'Storico', 'Conto'];

export default function Portfolio() {
  const t = useTheme();
  const f = useFin();
  const [tab, setTab] = useState('Posizioni');
  const [flow, setFlow] = useState<Flow>(null);
  const [tr, setTr] = useState(false);
  const [amount, setAmount] = useState('');

  const hold = holdings(f.stocks);
  const invested = hold.reduce((s, x) => s + x.shares * x.avgCost, 0);
  const value = hold.reduce((s, x) => s + x.shares * x.price, 0);
  const pnl = value - invested, pnlPct = invested ? (pnl / invested) * 100 : 0, up = pnl >= 0;
  const Stat = ({ l, v }: { l: string; v: string }) => <View style={{ width: '50%', paddingVertical: 6 }}><Body small muted>{l}</Body><Body bold>{v}</Body></View>;

  const posRow = (s: (typeof hold)[number]) => {
    const val = s.shares * s.price, cost = s.shares * s.avgCost, gain = val - cost, gp = cost ? (gain / cost) * 100 : 0;
    const col = gain >= 0 ? t.positive : t.danger;
    return (
      <Item key={s.symbol}>
        <Pressable onPress={() => setFlow({ view: 'detail', symbol: s.symbol })}>
          <Row>
            <View style={{ flex: 1 }}><Body bold>{s.symbol}</Body><Body small muted>{s.shares.toFixed(2)} azioni @ {s.avgCost.toFixed(2)}</Body></View>
            <Spark data={s.history.slice(-12)} w={46} h={26} pad={3} color={col} stroke={2} />
            <View style={{ alignItems: 'flex-end', minWidth: 90 }}><Body>{formatMoney(val)}</Body><Body small color={col}>{gain >= 0 ? '+' : ''}{formatMoney(gain)} ({gp.toFixed(1)}%)</Body></View>
          </Row>
        </Pressable>
      </Item>
    );
  };

  return (
    <Page id="portfolio" title="Portafoglio" back>
      <Card>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          <Stat l="Investito" v={`${formatMoney(value)}`} />
          <Stat l="Capitale" v={`${formatMoney(value + f.cash)}`} />
          <Stat l="Liquidità" v={`${formatMoney(f.cash)}`} />
          <Stat l="Margine" v={`${formatMoney(invested)}`} />
        </View>
        <Row style={{ marginTop: 10 }}>
          <Body small color={up ? t.positive : t.danger} style={{ flex: 1 }}>{up ? '+' : ''}{formatMoney(pnl)} ({up ? '+' : ''}{pnlPct.toFixed(2)}%) non realizzato</Body>
          <Btn small ghost title="Trasferisci" onPress={() => setTr(true)} />
        </Row>
      </Card>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginVertical: 6 }}>{tabs.map((x) => <Pill key={x} label={x} on={tab === x} onPress={() => setTab(x)} />)}</View>

      {tab === 'Posizioni' && (() => {
        const w = hold.filter((s) => s.price >= s.avgCost), l = hold.filter((s) => s.price < s.avgCost);
        if (!hold.length) return <Card><Empty text={'Nessuna posizione aperta. Tocca "+ Nuovo ordine" o "Acquista" su un titolo.'} /></Card>;
        return (<>
          {w.length > 0 && <><Body small muted style={{ margin: 8 }}>In profitto</Body><Card>{w.map(posRow)}</Card></>}
          {l.length > 0 && <><Body small muted style={{ margin: 8 }}>In perdita</Body><Card>{l.map(posRow)}</Card></>}
        </>);
      })()}
      {tab === 'Ordini' && (
        <Card>
          {f.orders.length === 0 ? <Empty text="Nessun ordine pendente." /> : f.orders.map((o) => (
            <Item key={o.id}>
              <Row>
                <View style={{ flex: 1 }}><Body bold>{o.symbol}</Body><Body small muted>{o.type === 'buy' ? 'Acquisto' : 'Vendita'} condizionato @ {o.limitPrice.toFixed(2)}{o.sl ? ` · SL ${o.sl}` : ''}{o.tp ? ` · TP ${o.tp}` : ''} · {formatMoney(o.amount)}</Body></View>
                <Btn small ghost title="Esegui" onPress={() => { const m = f.executeOrder(o.id); if (m) toast(m); }} />
                <Link danger onPress={() => { f.cancelOrder(o.id); toast('Ordine annullato'); }}>annulla</Link>
              </Row>
            </Item>
          ))}
        </Card>
      )}
      {tab === 'Storico' && (
        <Card>
          {f.trades.length === 0 ? <Empty text="Nessuna operazione eseguita finora." /> : f.trades.slice().reverse().map((x) => (
            <Item key={x.id}><Row><View style={{ flex: 1 }}><Body bold>{x.symbol}</Body><Body small muted>{x.type === 'buy' ? 'Acquisto' : 'Vendita'} · {x.shares.toFixed(3)} azioni @ {x.price.toFixed(2)}</Body></View><View style={{ alignItems: 'flex-end' }}><Body>{formatMoney(x.amount)}</Body><Body small muted>{x.date}</Body></View></Row></Item>
          ))}
        </Card>
      )}
      {tab === 'Conto' && (
        <>
          <Card>
            <Item><Row><Body muted>Liquidità disponibile</Body><Body bold>{formatMoney(f.cash)}</Body></Row></Item>
            <Item><Row><Body muted>Capitale investito</Body><Body bold>{formatMoney(invested)}</Body></Row></Item>
            <Item><Row><Body muted>Valore posizioni</Body><Body bold>{formatMoney(value)}</Body></Row></Item>
            <Item><Row><Body muted>Patrimonio totale</Body><Body bold>{formatMoney(value + f.cash)}</Body></Row></Item>
            <Item last><Row><Body muted>P&L non realizzato</Body><Body bold color={up ? t.positive : t.danger}>{up ? '+' : ''}{formatMoney(pnl)} ({up ? '+' : ''}{pnlPct.toFixed(2)}%)</Body></Row></Item>
          </Card>
          <Body small muted>Nessuna leva finanziaria reale: "margine" corrisponde a capitale investito e liquidità disponibile.</Body>
        </>
      )}

      <Btn small ghost style={{ marginVertical: 12 }} title="+ Nuovo ordine" onPress={() => setFlow({ view: 'neworder' })} />
      <Body small muted style={{ marginBottom: 20 }}>Simulazione a scopo dimostrativo: nessun investimento reale. Un servizio di investimento vero sarebbe fornito da un broker esterno autorizzato; LifePilot sarebbe solo l'interfaccia.</Body>
      <Tag>{''}</Tag>

      <StockFlow flow={flow} setFlow={setFlow} />
      <Sheet visible={tr} title="Trasferisci liquidità" onClose={() => setTr(false)}>
        <Input keyboardType="decimal-pad" placeholder="Importo da trasferire" value={amount} onChangeText={setAmount} />
        <Btn title="Trasferisci" onPress={() => { const v = parseFloat(amount.replace(',', '.')); if (!Number.isFinite(v) || v <= 0) return; f.addCash(v); setAmount(''); setTr(false); toast('Trasferimento simulato completato'); }} />
      </Sheet>
    </Page>
  );
}
