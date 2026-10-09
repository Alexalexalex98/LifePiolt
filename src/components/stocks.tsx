import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/T';

import { LineChart } from '@/components/charts';
import { Body, Btn, Card, Input, Item, Metric, Pill, Row, Select, Sheet, Tag, Toggle } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { formatCHF } from '@/lib/format';
import { useFin, type Stock } from '@/store/finance';
import { toast } from '@/store/toast';

export type Flow = { view: 'detail' | 'trade' | 'plan' | 'neworder'; symbol?: string; side?: 'buy' | 'sell' } | null;

const ranges = [{ n: '1G', len: 3 }, { n: '1S', len: 6 }, { n: '1M', len: 12 }, { n: '3M', len: 24 }, { n: '6M', len: 40 }, { n: '1A', len: 60 }];

/** Una sola sheet che cambia vista (dettaglio → ordine → piano): evita modali annidate. */
export function StockFlow({ flow, setFlow }: { flow: Flow; setFlow: (f: Flow) => void }) {
  const t = useTheme();
  const f = useFin();
  const [rangeIdx, setRangeIdx] = useState(4);
  const stock = f.stocks.find((x) => x.symbol === flow?.symbol);
  const close = () => setFlow(null);

  // bozza ordine
  const [qty, setQty] = useState(1);
  const [limitOn, setLimitOn] = useState(false), [limitPrice, setLimitPrice] = useState('');
  const [slOn, setSlOn] = useState(false), [slPrice, setSlPrice] = useState('');
  const [tpOn, setTpOn] = useState(false), [tpPrice, setTpPrice] = useState('');
  // piano di risparmio
  const [spAmount, setSpAmount] = useState('');
  const [spFreq, setSpFreq] = useState<'Mensile' | 'Settimanale'>('Mensile');
  const [pickSym, setPickSym] = useState('');

  function startTrade(s: Stock, side: 'buy' | 'sell') {
    setQty(s.price > 0 ? +(100 / s.price).toFixed(4) : 1);
    setLimitOn(false); setSlOn(false); setTpOn(false);
    setLimitPrice(s.price.toFixed(2)); setSlPrice((s.price * 0.9).toFixed(2)); setTpPrice((s.price * 1.1).toFixed(2));
    setFlow({ view: 'trade', symbol: s.symbol, side });
  }

  let title = '', body: React.ReactNode = null;

  if (flow?.view === 'neworder') {
    title = 'Nuovo ordine';
    const sym = pickSym || f.stocks[0]?.symbol;
    body = (
      <>
        <Select title="Titolo" value={sym ? `${sym} · ${f.stocks.find((x) => x.symbol === sym)?.name}` : ''} options={f.stocks.map((s) => `${s.symbol} · ${s.name}`)} onChange={(v) => setPickSym(v.split(' · ')[0])} />
        <Row>
          <Btn style={{ flex: 1 }} tone="sell" title="Vendi" onPress={() => { const s = f.stocks.find((x) => x.symbol === sym); if (s) startTrade(s, 'sell'); }} />
          <Btn style={{ flex: 1 }} tone="buy" title="Acquista" onPress={() => { const s = f.stocks.find((x) => x.symbol === sym); if (s) startTrade(s, 'buy'); }} />
        </Row>
      </>
    );
  } else if (stock && flow?.view === 'detail') {
    const range = ranges[rangeIdx];
    const slice = stock.history.slice(-range.len);
    const rangeUp = slice[slice.length - 1] >= slice[0];
    const up = stock.changePct >= 0, color = up ? t.positive : t.danger;
    const plan = f.plans[stock.symbol];
    title = stock.symbol;
    const Cell = ({ l, v }: { l: string; v: string }) => <View style={{ width: '48.5%', backgroundColor: t.card, borderWidth: 1, borderColor: t.border, borderRadius: 22, padding: 14, marginBottom: 10 }}><Tag>{l}</Tag><Body bold>{v}</Body></View>;
    body = (
      <>
        <Body small muted>{stock.name}</Body>
        <Metric big>{stock.price.toFixed(2)} USD</Metric>
        <Body small color={color} style={{ marginBottom: 8 }}>{up ? '+' : '-'}{Math.abs(stock.changeAbs).toFixed(2)} ({up ? '+' : ''}{stock.changePct.toFixed(2)}%) oggi</Body>
        <LineChart data={slice} padL={10} color={rangeUp ? t.positive : t.danger} fmt={(n) => n.toFixed(0)} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 }}>{ranges.map((r, i) => <Pill key={r.n} label={r.n} on={i === rangeIdx} onPress={() => setRangeIdx(i)} />)}</View>
        <Row style={{ marginTop: 16 }}>
          <Btn small style={{ flex: 1 }} tone="sell" title="Vendi" onPress={() => startTrade(stock, 'sell')} />
          <Btn small style={{ flex: 1 }} tone="buy" title="Acquista" onPress={() => startTrade(stock, 'buy')} />
        </Row>
        <Btn small ghost style={{ marginTop: 8 }} icon="repeat" title={`Imposta piano di risparmio${plan ? ` · attivo ${formatCHF(plan.amount)} CHF/${plan.freq === 'mensile' ? 'mese' : 'sett.'}` : ''}`}
          onPress={() => { setSpAmount(plan ? String(plan.amount) : ''); setSpFreq(plan?.freq === 'settimanale' ? 'Settimanale' : 'Mensile'); setFlow({ view: 'plan', symbol: stock.symbol }); }} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 16 }}>
          <Cell l="APERTURA" v={stock.open.toFixed(2)} /><Cell l="MAX 52 SETT." v={stock.high52.toFixed(2)} />
          <Cell l="MIN 52 SETT." v={stock.low52.toFixed(2)} /><Cell l="VOLUME" v={stock.vol} />
          <Cell l="CAP. DI MERCATO" v={stock.mcap} /><Cell l="P/E" v={stock.pe} />
        </View>
        <Body small muted>Dati simulati, non collegati a un mercato reale.</Body>
      </>
    );
  } else if (stock && flow?.view === 'trade') {
    const side = flow.side ?? 'buy';
    const value = qty * stock.price, margin = value * 0.2;
    title = (side === 'buy' ? 'Acquista ' : 'Vendi ') + stock.symbol;
    const num = (v: string) => parseFloat(v.replace(',', '.')) || 0;
    const place = () => {
      if (side === 'buy' && value > f.cash) { toast('Fondi disponibili insufficienti'); return; }
      if (side === 'sell' && qty > stock.shares) { toast('Non possiedi abbastanza quote da vendere'); return; }
      if (limitOn) {
        f.placeLimit({ symbol: stock.symbol, type: side, limitPrice: num(limitPrice), amount: value, sl: slOn ? num(slPrice) : null, tp: tpOn ? num(tpPrice) : null });
        close(); toast('Ordine condizionato creato, in attesa di esecuzione'); return;
      }
      const msg = side === 'buy' ? f.buy(stock.symbol, value) : f.sell(stock.symbol, value);
      close(); toast(msg);
    };
    body = (
      <>
        <Row><View><Body bold>{stock.symbol}</Body><Body small muted>{stock.name}</Body></View><View style={{ alignItems: 'flex-end' }}><Body>{stock.price.toFixed(2)} USD</Body><Body small color={stock.changePct >= 0 ? t.positive : t.danger}>{stock.changePct >= 0 ? '+' : ''}{stock.changePct.toFixed(2)}%</Body></View></Row>
        <Body small muted style={{ textAlign: 'center', marginTop: 16, marginBottom: 6 }}>{side === 'buy' ? 'Acquista' : 'Vendi'}</Body>
        <Row style={{ justifyContent: 'center' }} gap={16}>
          <Pressable onPress={() => setQty(Math.max(0.0001, +(qty - 0.5).toFixed(4)))} style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: t.border, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: t.text, fontSize: 22 }}>−</Text></Pressable>
          <View style={{ alignItems: 'center', minWidth: 110 }}><Text style={{ color: t.text, fontSize: 26, fontWeight: '800' }}>{qty.toFixed(4)}</Text><Body small muted>Valore: {formatCHF(value)} CHF</Body></View>
          <Pressable onPress={() => setQty(+(qty + 0.5).toFixed(4))} style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: t.border, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: t.text, fontSize: 22 }}>+</Text></Pressable>
        </Row>
        <View style={{ marginTop: 16 }}>
          <Toggle label="Esegui solo a un certo prezzo" value={limitOn} onChange={setLimitOn} />
          {limitOn && <Input keyboardType="decimal-pad" value={limitPrice} onChangeText={setLimitPrice} placeholder="Prezzo target" />}
          <Toggle label="Stop Loss" value={slOn} onChange={setSlOn} />
          {slOn && <Input keyboardType="decimal-pad" value={slPrice} onChangeText={setSlPrice} placeholder="Prezzo stop loss" />}
          <Toggle label="Take Profit" value={tpOn} onChange={setTpOn} />
          {tpOn && <Input keyboardType="decimal-pad" value={tpPrice} onChangeText={setTpPrice} placeholder="Prezzo take profit" />}
        </View>
        <Item style={{ marginTop: 8 }}><Row><Body muted>Margine richiesto</Body><Body bold>{formatCHF(margin)} CHF</Body></Row></Item>
        <Item last><Row><Body muted>Valore</Body><Body bold>{formatCHF(value)} CHF</Body></Row></Item>
        <Btn style={{ marginTop: 14 }} title="Conferma ordine" onPress={place} />
        <Body small muted style={{ marginTop: 10 }}>Operazione simulata: nessun investimento reale viene eseguito. Stop Loss e Take Profit restano registrati sull'ordine, non vengono eseguiti automaticamente.</Body>
      </>
    );
  } else if (stock && flow?.view === 'plan') {
    const plan = f.plans[stock.symbol];
    title = 'Piano di risparmio · ' + stock.symbol;
    body = (
      <>
        <Body small muted>Versamento periodico automatico in {stock.symbol} (simulato).</Body>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginVertical: 10 }}>{[50, 100, 250, 500].map((v) => <Pill key={v} label={`${v} CHF`} onPress={() => setSpAmount(String(v))} />)}</View>
        <Input keyboardType="decimal-pad" placeholder="Importo personalizzato (CHF)" value={spAmount} onChangeText={setSpAmount} />
        <Select value={spFreq} options={['Mensile', 'Settimanale']} onChange={(v) => setSpFreq(v as typeof spFreq)} />
        <Btn title="Continua" onPress={() => {
          const a = parseFloat(spAmount.replace(',', '.'));
          if (!Number.isFinite(a) || a <= 0) { toast('Inserisci un importo valido'); return; }
          f.setPlan(stock.symbol, { amount: a, freq: spFreq === 'Mensile' ? 'mensile' : 'settimanale' });
          close(); toast(`Piano impostato: ${formatCHF(a)} CHF al ${spFreq === 'Mensile' ? 'mese' : 'settimana'} su ${stock.symbol}`);
        }} />
        {plan && <Btn small ghost style={{ marginTop: 8 }} title="Disattiva piano" onPress={() => { f.setPlan(stock.symbol, null); close(); toast('Piano disattivato'); }} />}
      </>
    );
  }

  return <Sheet visible={!!flow && !!body} title={title} onClose={close}>{body}</Sheet>;
}

export const _c = Card;
