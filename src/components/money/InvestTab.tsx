import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { AreaChart } from '@/components/AreaChart';
import { Text } from '@/components/T';
import { Amount, Panel, SectionTitle } from '@/components/money/parts';
import { Body, Btn, Input, Pill, Press, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { Icon } from '@/lib/icons';
import { CATALOG, BY_SYM, KINDS, KIND_LABEL, type Instrument, type Kind } from '@/lib/markets/catalog';
import { portfolio, pnl } from '@/lib/markets/invest';
import { usdToLp } from '@/lib/markets/quotes';
import { dayChangePct, loadHistory, priceLp, priceUsd, useMarkets } from '@/store/markets';
import { useNet } from '@/store/network';
import { toast } from '@/store/toast';

const RANGES = [{ n: '1M', len: 22 }, { n: '3M', len: 65 }, { n: '1A', len: 260 }, { n: 'Max', len: 9999 }];
const PAGE = 30;
const fmt = (n: number, d = 2) => n.toLocaleString('de-CH', { minimumFractionDigits: d, maximumFractionDigits: d });
const parse = (v: string) => { const n = parseFloat(v.replace(',', '.')); return Number.isFinite(n) ? n : 0; };

function Chg({ pct }: { pct: number }) {
  const t = useTheme();
  const c = pct >= 0 ? t.positive : t.danger;
  return <View style={{ minWidth: 68, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 9, backgroundColor: c + '22', alignItems: 'center' }}><Text style={{ color: c, fontSize: 12.5, fontWeight: '800' }}>{pct >= 0 ? '+' : ''}{pct.toFixed(2)}%</Text></View>;
}
function Logo({ sym }: { sym: string }) {
  const t = useTheme();
  return <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: t.chip, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: t.text, fontWeight: '800', fontSize: 11.5 }}>{sym.slice(0, 4)}</Text></View>;
}

/** Investire con i LifePoints: l'utente vede tutto in LP, l'app converte e compra in valuta reale. */
export function InvestTab() {
  const t = useTheme();
  const mk = useMarkets();
  const [inner, setInner] = useState<'Mercato' | 'Posizioni' | 'Ordini'>('Mercato');
  const [kind, setKind] = useState<Kind | 'tutti'>('tutti');
  const [q, setQ] = useState('');
  const [shown, setShown] = useState(PAGE);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    void mk.refresh();
    const id = setInterval(() => void useMarkets.getState().refresh(), 60_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return CATALOG.filter((i) => (kind === 'tutti' || i.kind === kind) && (!s || i.sym.toLowerCase().includes(s) || i.name.toLowerCase().includes(s) || i.sector.toLowerCase().includes(s)));
  }, [q, kind]);
  const pf = portfolio(Object.values(mk.positions), (s) => priceLp(mk, s));
  const upd = mk.updatedAt ? new Date(mk.updatedAt).toLocaleTimeString('it-CH', { hour: '2-digit', minute: '2-digit' }) : '';
  const row = (i: Instrument) => {
    const p = priceLp(mk, i.sym), c = dayChangePct(mk, i.sym);
    return (
      <Press key={i.sym} onPress={() => setOpen(i.sym)} accessibilityLabel={`${i.name}, ${fmt(p)} LP`} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 }}>
        <Logo sym={i.sym} />
        <View style={{ flex: 1 }}><Text numberOfLines={1} style={{ color: t.text, fontWeight: '800', fontSize: 15 }}>{i.name}</Text><Text style={{ color: t.muted, fontSize: 12.5 }}>{i.sym} · {tl(i.sector)}</Text></View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}><Amount n={p} size={15} /><Chg pct={c} /></View>
      </Press>
    );
  };

  return (
    <View>
      <View style={{ paddingTop: 6 }}>
        <Text style={{ color: t.muted, fontSize: 14, fontWeight: '600' }}>{tl('I tuoi investimenti')}</Text>
        <Amount n={pf.value} size={42} />
        {pf.cost > 0 ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}><Chg pct={pf.pct} /><Text style={{ color: pf.gain >= 0 ? t.positive : t.danger, fontWeight: '800', fontSize: 14 }}>{pf.gain >= 0 ? '+' : ''}{fmt(pf.gain)} LP</Text></View> : <Text style={{ color: t.muted, marginTop: 4 }}>{tl('Scegli un titolo e investi da 1 LP.')}</Text>}
      </View>
      <View style={{ marginTop: 14 }}>
        <Panel pad={14}>
          <Text style={{ color: t.muted, fontSize: 12.5, lineHeight: 18 }}>{tl('Sono investimenti reali: il valore sale e scende e puoi perdere parte di quanto investi. Il valore in LP è quello che riceveresti vendendo adesso.')}</Text>
          <Text style={{ color: t.muted, fontSize: 12, marginTop: 8 }}>{mk.live ? `${tl('Prezzi aggiornati alle')} ${upd} · ${tl('ritardo di circa 15 minuti')}` : tl('Prezzi dimostrativi: servono per provare l’app, non sono quotazioni reali.')}</Text>
        </Panel>
      </View>

      <View style={{ flexDirection: 'row', backgroundColor: t.input, borderRadius: 16, padding: 4, gap: 4, marginTop: 18 }}>
        {(['Mercato', 'Posizioni', 'Ordini'] as const).map((o) => (
          <Press key={o} onPress={() => setInner(o)} accessibilityLabel={tl(o)} selected={inner === o} role="tab" style={{ flex: 1, minHeight: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: inner === o ? t.text : 'transparent' }}>
            <Text style={{ color: inner === o ? t.bg : t.muted, fontWeight: '700', fontSize: 13.5 }}>{tl(o)}</Text>
          </Press>
        ))}
      </View>

      {inner === 'Mercato' ? (
        <>
          <Input placeholder="Cerca un titolo, un ETF, un settore" value={q} onChangeText={(v) => { setQ(v); setShown(PAGE); }} style={{ marginTop: 14 }} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
            <Pill label={tl('Tutti')} on={kind === 'tutti'} onPress={() => { setKind('tutti'); setShown(PAGE); }} />
            {KINDS.map((k) => <Pill key={k} label={tl(KIND_LABEL[k])} on={kind === k} onPress={() => { setKind(k); setShown(PAGE); }} />)}
          </View>
          {!q && kind === 'tutti' && mk.watch.length ? (
            <>
              <SectionTitle>{tl('Seguiti')}</SectionTitle>
              {mk.watch.filter((s) => BY_SYM[s]).map((s) => row(BY_SYM[s]))}
              <SectionTitle>{tl('Tutti i titoli')}</SectionTitle>
            </>
          ) : null}
          {list.slice(0, shown).map(row)}
          {list.length === 0 ? <Body small muted style={{ marginVertical: 20 }}>Nessun titolo trovato.</Body> : null}
          {shown < list.length ? <Btn ghost title={tl('Mostra altri ({0})', list.length - shown)} onPress={() => setShown((n) => n + PAGE)} /> : null}
          <Text style={{ color: t.muted, fontSize: 12, textAlign: 'center', marginTop: 10 }}>{CATALOG.length} {tl('titoli disponibili')}</Text>
        </>
      ) : null}

      {inner === 'Posizioni' ? (
        pf.rows.length === 0 ? <Panel><Body small muted>Non hai ancora investimenti. Apri «Mercato», scegli un titolo e compra con i tuoi LP.</Body></Panel> : (
          <View style={{ marginTop: 8 }}>
            {pf.rows.map((r) => {
              const i = BY_SYM[r.sym];
              return (
                <Press key={r.sym} onPress={() => setOpen(r.sym)} accessibilityLabel={i?.name ?? r.sym} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 }}>
                  <Logo sym={r.sym} />
                  <View style={{ flex: 1 }}><Text numberOfLines={1} style={{ color: t.text, fontWeight: '800', fontSize: 15 }}>{i?.name ?? r.sym}</Text><Text style={{ color: t.muted, fontSize: 12.5 }}>{fmt(r.units, 4)} {tl('quote')}</Text></View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}><Amount n={r.value} size={15} /><Text style={{ color: r.gain >= 0 ? t.positive : t.danger, fontWeight: '800', fontSize: 12.5 }}>{r.gain >= 0 ? '+' : ''}{fmt(r.gain)} LP</Text></View>
                </Press>
              );
            })}
          </View>
        )
      ) : null}

      {inner === 'Ordini' ? (
        mk.orders.length === 0 ? <Panel><Body small muted style={{ marginTop: 0 }}>Gli acquisti e le vendite compariranno qui.</Body></Panel> : (
          <View style={{ marginTop: 8 }}>
            {mk.orders.slice(0, 60).map((o) => (
              <View key={o.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 }}>
                <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: t.chip, alignItems: 'center', justifyContent: 'center' }}><Icon name={o.side === 'buy' ? 'arrow-down' : 'arrow-up'} size={17} color={t.text} /></View>
                <View style={{ flex: 1 }}><Text style={{ color: t.text, fontWeight: '800', fontSize: 14.5 }}>{o.side === 'buy' ? tl('Acquisto') : tl('Vendita')} {o.sym}</Text><Text style={{ color: t.muted, fontSize: 12 }}>{fmt(o.units, 4)} × {fmt(o.priceLp)} LP · {new Date(o.ts).toLocaleDateString('it-CH', { day: 'numeric', month: 'short' })}</Text></View>
                <Amount n={o.side === 'buy' ? -o.amountLp : o.amountLp} size={15} sign />
              </View>
            ))}
          </View>
        )
      ) : null}

      {open ? <InstrumentSheet sym={open} onClose={() => setOpen(null)} /> : null}
    </View>
  );
}

function InstrumentSheet({ sym, onClose }: { sym: string; onClose: () => void }) {
  const t = useTheme();
  const net = useNet();
  const mk = useMarkets();
  const i = BY_SYM[sym];
  const [side, setSide] = useState<'buy' | 'sell' | null>(null);
  const [amt, setAmt] = useState('');
  const [rangeIdx, setRangeIdx] = useState(2);
  const [hist, setHist] = useState<number[]>([]);
  const price = priceLp(mk, sym), usd = priceUsd(mk, sym);
  useEffect(() => {
    let live = true;
    void loadHistory(sym, usd).then((r) => { if (live) setHist(r.closes); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sym]);
  if (!i) return null;
  const pos = mk.positions[sym];
  const p = pos ? pnl(pos, price) : null;
  const range = RANGES[rangeIdx];
  const series = hist.slice(-Math.min(range.len, hist.length)).map((x) => usdToLp(x, mk.usdChf));
  const up = series.length < 2 || series[series.length - 1] >= series[0];
  const a = parse(amt);
  const watched = mk.watch.includes(sym);
  const go = () => {
    const r = side === 'buy' ? mk.buy(sym, a) : mk.sell(sym, a);
    if (!r.ok) { toast(r.error ?? 'Non riuscito'); return; }
    toast(side === 'buy' ? `Hai comprato ${sym}` : `Hai venduto ${sym}`);
    setSide(null); setAmt('');
  };
  return (
    <Sheet visible title={i.name} onClose={onClose}>
      <Row><View><Text style={{ color: t.muted, fontSize: 13 }}>{i.sym} · {tl(i.sector)}</Text><Amount n={price} size={34} /></View><View style={{ alignItems: 'flex-end', gap: 6 }}><Chg pct={dayChangePct(mk, sym)} /><Press onPress={() => mk.toggleWatch(sym)} accessibilityLabel={watched ? tl('Non seguire più') : tl('Segui')}><Icon name="star" size={22} color={watched ? t.accent : t.muted} fill={watched ? t.accent : 'none'} /></Press></View></Row>
      <View style={{ marginTop: 12 }}>{series.length > 1 ? <AreaChart data={series} color={up ? t.positive : t.danger} height={150} /> : <View style={{ height: 150 }} />}</View>
      <View style={{ flexDirection: 'row', gap: 8, marginVertical: 10 }}>{RANGES.map((r, k) => <Pill key={r.n} label={r.n} on={rangeIdx === k} onPress={() => setRangeIdx(k)} />)}</View>
      {p && pos ? (
        <Panel pad={14}>
          <Row><Text style={{ color: t.muted }}>{tl('La tua posizione')}</Text><Amount n={p.value} size={16} /></Row>
          <Row style={{ marginTop: 6 }}><Text style={{ color: t.muted }}>{fmt(pos.units, 4)} {tl('quote')} · {tl('investiti')} {fmt(pos.costLp)} LP</Text><Text style={{ color: p.gain >= 0 ? t.positive : t.danger, fontWeight: '800' }}>{p.gain >= 0 ? '+' : ''}{fmt(p.gain)} LP ({p.pct.toFixed(1)}%)</Text></Row>
        </Panel>
      ) : null}
      {side ? (
        <View style={{ marginTop: 12 }}>
          <Text style={{ color: t.text, fontWeight: '800', fontSize: 16 }}>{side === 'buy' ? tl('Quanto vuoi investire?') : tl('Quanto vuoi vendere?')}</Text>
          <Input keyboardType="decimal-pad" placeholder="LP" value={amt} onChangeText={setAmt} style={{ marginTop: 8 }} />
          <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }} gap={8}>
            {(side === 'buy' ? [10, 50, 100, 500] : []).map((x) => <Pill key={x} label={`${x} LP`} onPress={() => setAmt(String(x))} />)}
            {side === 'sell' && p ? <Pill label={tl('Tutto ({0} LP)', fmt(p.value))} onPress={() => setAmt(String(p.value))} /> : null}
          </Row>
          <Text style={{ color: t.muted, fontSize: 12.5, marginVertical: 8 }}>{a > 0 ? `${side === 'buy' ? tl('Compri circa') : tl('Vendi circa')} ${fmt(a / price, 4)} ${tl('quote')} · ${tl('nessuna commissione')}` : ''}{side === 'buy' ? ` · ${tl('Saldo')}: ${fmt(net.lifePoints)} LP` : ''}</Text>
          <Text style={{ color: t.muted, fontSize: 12, marginBottom: 8 }}>{tl('Gli LP vengono cambiati in valuta reale al momento dell’ordine e il titolo è acquistato subito; vendendo, il percorso è inverso. Puoi perdere parte di quanto investi.')}</Text>
          <Btn title={side === 'buy' ? tl('Conferma acquisto') : tl('Conferma vendita')} tone={side} onPress={go} />
          <Btn ghost title={tl('Annulla')} onPress={() => { setSide(null); setAmt(''); }} />
        </View>
      ) : (
        <Row style={{ marginTop: 14 }} gap={10}>
          <Btn style={{ flex: 1 }} title={tl('Compra')} tone="buy" onPress={() => setSide('buy')} />
          {pos ? <Btn style={{ flex: 1 }} title={tl('Vendi')} tone="sell" onPress={() => setSide('sell')} /> : null}
        </Row>
      )}
    </Sheet>
  );
}
