import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/T';

import { AreaChart } from '@/components/AreaChart';
import { FinTabs } from '@/components/FinTabs';
import { StockFlow, type Flow } from '@/components/stocks';
import { Body, Btn, Card, Empty, Input, Page, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { confirmDelete } from '@/lib/confirm';
import { Icon } from '@/lib/icons';
import { go } from '@/lib/nav';
import { holdings, useFin, type Stock } from '@/store/finance';
import { toast } from '@/store/toast';
import { formatMoney } from '@/i18n/format';
import { t as tl } from '@/i18n/core';

const RANGES = [{ n: '1G', len: 3 }, { n: '1S', len: 6 }, { n: '1M', len: 12 }, { n: '3M', len: 24 }, { n: '6M', len: 40 }, { n: '1A', len: 60 }, { n: 'Max', len: 9999 }];
const TABS = ['Watchlist', 'Posizioni', 'Piani', 'Ordini'] as const;
type Tab = (typeof TABS)[number];

/** Pillola con la variazione percentuale (verde/rossa), come nelle app di investimento. */
function ChangePill({ pct }: { pct: number }) {
  const t = useTheme();
  const up = pct >= 0;
  const c = up ? t.positive : t.danger;
  return (
    <View style={{ minWidth: 70, paddingVertical: 5, paddingHorizontal: 9, borderRadius: 9, backgroundColor: c + '22', alignItems: 'center' }}>
      <Text style={{ color: c, fontSize: 13, fontWeight: '700' }}>{up ? '+' : ''}{pct.toFixed(2)}%</Text>
    </View>
  );
}

function Logo({ s }: { s: Stock }) {
  const t = useTheme();
  return (
    <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: t.chip, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: t.text, fontWeight: '800', fontSize: 12 }}>{s.symbol.slice(0, 4)}</Text>
    </View>
  );
}

export default function Stocks() {
  const t = useTheme();
  const f = useFin();
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<Tab>('Watchlist');
  const [rangeIdx, setRangeIdx] = useState(2);
  const [flow, setFlow] = useState<Flow>(null);
  const [add, setAdd] = useState(false);
  const [sym, setSym] = useState('');
  const [name, setName] = useState('');

  const hold = holdings(f.stocks);
  const invested = hold.reduce((s, x) => s + x.shares * x.avgCost, 0);
  const value = hold.reduce((s, x) => s + x.shares * x.price, 0);
  const total = value + f.cash;
  const pnl = value - invested;
  const pnlPct = invested ? (pnl / invested) * 100 : 0;
  const dayAbs = hold.reduce((s, x) => s + x.shares * x.changeAbs, 0);
  const dayPct = value - dayAbs > 0 ? (dayAbs / (value - dayAbs)) * 100 : 0;

  // serie del portafoglio: somma, per ogni giorno, delle posizioni (+ liquidità costante)
  const series = useMemo(() => {
    const src = hold.length ? hold : f.stocks.slice(0, 1);
    const n = Math.min(...src.map((x) => x.history.length));
    if (!Number.isFinite(n) || n < 2) return [] as number[];
    return Array.from({ length: n }, (_, i) => src.reduce((a, x) => a + (hold.length ? x.shares : 1) * x.history[x.history.length - n + i], 0));
  }, [hold, f.stocks]);
  const range = RANGES[rangeIdx];
  const slice = series.slice(-Math.min(range.len, series.length));
  const rangeUp = slice.length < 2 || slice[slice.length - 1] >= slice[0];
  const chartColor = rangeUp ? t.positive : t.danger;
  const rangeDelta = slice.length > 1 ? slice[slice.length - 1] - slice[0] : 0;
  const shown = hold.length ? value : slice.length ? slice[slice.length - 1] : 0;

  const list = f.stocks.filter((s) => s.symbol.toLowerCase().includes(q.toLowerCase()) || s.name.toLowerCase().includes(q.toLowerCase()));
  const movers = [...f.stocks].sort((a, b) => b.changePct - a.changePct);
  const best = movers[0], worst = movers[movers.length - 1];
  const plans = Object.entries(f.plans).filter(([, p]) => p);

  const action = (icon: string, label: string, onPress: () => void) => (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
      <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: t.chip, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={22} color={t.text} /></View>
      <Text style={{ color: t.text, fontSize: 12.5, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );

  const row = (s: Stock, last: boolean, sub?: string) => (
    <Pressable key={s.symbol} onPress={() => setFlow({ view: 'detail', symbol: s.symbol })} accessibilityRole="button" accessibilityLabel={`${s.name} ${s.price.toFixed(2)}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: last ? 0 : 1, borderBottomColor: t.border }}>
      <Logo s={s} />
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ color: t.text, fontSize: 15.5, fontWeight: '700' }}>{s.name}</Text>
        <Text numberOfLines={1} style={{ color: t.muted, fontSize: 12.5 }}>{sub ?? s.symbol}</Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <Text style={{ color: t.text, fontSize: 15, fontWeight: '700' }}>{s.price.toFixed(2)}</Text>
        <ChangePill pct={s.changePct} />
      </View>
    </Pressable>
  );

  return (
    <Page id="stocks" title="Stock" back>
      <FinTabs current="stocks" />

      {/* panoramica del portafoglio */}
      <View style={{ marginTop: 4 }}>
        <Text style={{ color: t.muted, fontSize: 13.5 }}>{tl('Portafoglio')}</Text>
        <Text style={{ color: t.text, fontSize: 38, fontWeight: '800', letterSpacing: -0.8 }}>{formatMoney(shown, { decimals: 2 })}</Text>
        <Row gap={8} style={{ justifyContent: 'flex-start' }}>
          <Icon name={rangeDelta >= 0 ? 'trend-up' : 'trend-down'} size={15} color={chartColor} />
          <Text style={{ color: chartColor, fontSize: 14, fontWeight: '700' }}>{rangeDelta >= 0 ? '+' : ''}{formatMoney(hold.length ? rangeDelta : 0, { decimals: 2 })} · {range.n}</Text>
        </Row>
      </View>
      <View style={{ marginTop: 10, marginHorizontal: -4 }}><AreaChart data={slice} color={chartColor} /></View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
        {RANGES.map((r, i) => (
          <Pressable key={r.n} onPress={() => setRangeIdx(i)} accessibilityRole="button" accessibilityState={{ selected: i === rangeIdx }} accessibilityLabel={r.n} style={{ minWidth: 40, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, backgroundColor: i === rangeIdx ? chartColor + '2a' : 'transparent' }}>
            <Text style={{ color: i === rangeIdx ? chartColor : t.muted, fontSize: 13, fontWeight: '700' }}>{r.n}</Text>
          </Pressable>
        ))}
      </View>

      {/* cifre principali */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 16, gap: 10 }}>
        {[
          ['Oggi', `${dayAbs >= 0 ? '+' : ''}${formatMoney(dayAbs, { decimals: 2 })} (${dayPct >= 0 ? '+' : ''}${dayPct.toFixed(2)}%)`, dayAbs >= 0 ? t.positive : t.danger],
          ['Non realizzato', `${pnl >= 0 ? '+' : ''}${formatMoney(pnl, { decimals: 2 })} (${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%)`, pnl >= 0 ? t.positive : t.danger],
          ['Liquidità', formatMoney(f.cash, { decimals: 2 }), t.text],
          ['Patrimonio', formatMoney(total, { decimals: 2 }), t.text],
        ].map(([l, v, c]) => (
          <View key={l} style={{ width: '48%', backgroundColor: t.card, borderRadius: 16, padding: 12 }}>
            <Text style={{ color: t.muted, fontSize: 12 }}>{l}</Text>
            <Text style={{ color: c, fontSize: 14.5, fontWeight: '700', marginTop: 2 }}>{v}</Text>
          </View>
        ))}
      </View>

      {/* azioni rapide */}
      <View style={{ flexDirection: 'row', marginTop: 20 }}>
        {action('plus', 'Ordine', () => setFlow({ view: 'neworder' }))}
        {action('repeat', 'Piano', () => { const s = f.stocks[0]; if (s) setFlow({ view: 'plan', symbol: s.symbol }); })}
        {action('coin', 'Deposito', () => go('portfolio'))}
        {action('file', 'Portafoglio', () => go('portfolio'))}
      </View>

      {/* migliori e peggiori del giorno */}
      {best && worst && best.symbol !== worst.symbol && (
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
          {[['Migliore oggi', best], ['Peggiore oggi', worst]].map(([l, s]) => (
            <Pressable key={(s as Stock).symbol} onPress={() => setFlow({ view: 'detail', symbol: (s as Stock).symbol })} accessibilityRole="button" style={{ flex: 1, backgroundColor: t.card, borderRadius: 16, padding: 12, gap: 6 }}>
              <Text style={{ color: t.muted, fontSize: 12 }}>{l as string}</Text>
              <Text numberOfLines={1} style={{ color: t.text, fontWeight: '700' }}>{(s as Stock).name}</Text>
              <ChangePill pct={(s as Stock).changePct} />
            </Pressable>
          ))}
        </View>
      )}

      {/* schede */}
      <View accessibilityRole="tablist" style={{ flexDirection: 'row', marginTop: 22, borderBottomWidth: 1, borderBottomColor: t.border }}>
        {TABS.map((x) => (
          <Pressable key={x} onPress={() => setTab(x)} accessibilityRole="tab" accessibilityState={{ selected: tab === x }} style={{ flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: tab === x ? t.text : 'transparent', marginBottom: -1 }}>
            <Text style={{ color: tab === x ? t.text : t.muted, fontWeight: '700', fontSize: 14 }}>{x}</Text>
          </Pressable>
        ))}
      </View>

      {tab === 'Watchlist' && (
        <View style={{ marginTop: 10 }}>
          <Input placeholder="Cerca un titolo" value={q} onChangeText={setQ} />
          {list.length === 0 ? <Empty text="Nessun titolo trovato." /> : list.map((s, i) => row(s, i === list.length - 1))}
          <Btn small ghost icon="plus" style={{ marginTop: 10, alignSelf: 'flex-start' }} title="Aggiungi titolo" onPress={() => setAdd(true)} />
          <Body small muted style={{ marginTop: 6 }}>Per togliere un titolo, aprilo e usa «Togli dalla watchlist».</Body>
        </View>
      )}
      {tab === 'Posizioni' && (
        <View style={{ marginTop: 10 }}>
          {hold.length === 0 ? <Empty text={'Nessuna posizione aperta. Tocca "Ordine" per iniziare.'} /> : hold.map((s, i) => {
            const val = s.shares * s.price, gain = val - s.shares * s.avgCost;
            return row(s, i === hold.length - 1, `${s.shares.toFixed(2)} · ${formatMoney(val, { decimals: 2 })} · ${gain >= 0 ? '+' : ''}${formatMoney(gain, { decimals: 2 })}`);
          })}
        </View>
      )}
      {tab === 'Piani' && (
        <View style={{ marginTop: 10 }}>
          {plans.length === 0 ? <Empty text="Nessun piano di risparmio. Apri un titolo e imposta un versamento periodico." /> : plans.map(([symbol, p], i) => {
            const s = f.stocks.find((x) => x.symbol === symbol);
            if (!s || !p) return null;
            return (
              <Pressable key={symbol} onPress={() => setFlow({ view: 'plan', symbol })} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: i === plans.length - 1 ? 0 : 1, borderBottomColor: t.border }}>
                <Logo s={s} />
                <View style={{ flex: 1 }}><Text style={{ color: t.text, fontWeight: '700', fontSize: 15.5 }}>{s.name}</Text><Text style={{ color: t.muted, fontSize: 12.5 }}>{p.freq === 'mensile' ? tl('{0} al mese', formatMoney(p.amount)) : tl('{0} alla settimana', formatMoney(p.amount))}</Text></View>
                <Icon name="chevron-right" size={18} color={t.muted} />
              </Pressable>
            );
          })}
        </View>
      )}
      {tab === 'Ordini' && (
        <View style={{ marginTop: 10 }}>
          {f.orders.length === 0 ? <Empty text="Nessun ordine in attesa." /> : f.orders.map((o) => (
            <Card key={o.id}>
              <Row>
                <View style={{ flex: 1 }}><Body bold>{o.symbol}</Body><Body small muted>{o.type === 'buy' ? 'Acquisto' : 'Vendita'} a {o.limitPrice.toFixed(2)} · {formatMoney(o.amount)}</Body></View>
                <Btn small ghost title="Esegui" onPress={() => { const m = f.executeOrder(o.id); if (m) toast(m); }} />
                <Btn small ghost danger title="Annulla" onPress={() => confirmDelete(`l'ordine su ${o.symbol}`, () => f.cancelOrder(o.id), () => f.restoreOrder(o), { title: 'Annullare l\'ordine?', okLabel: 'Annulla ordine', undoMessage: 'Ordine annullato' })} />
              </Row>
            </Card>
          ))}
        </View>
      )}

      <Body small muted style={{ marginTop: 18 }}>Simulazione a scopo dimostrativo: nessun investimento reale e dati di mercato non reali.</Body>

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
