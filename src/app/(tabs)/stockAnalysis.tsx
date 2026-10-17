import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { AnalysisChart } from '@/components/money/AnalysisChart';
import { InstrumentSheet } from '@/components/money/InvestTab';
import { Amount, Bar, Panel, SectionTitle } from '@/components/money/parts';
import { Text } from '@/components/T';
import { Body, Btn, Input, Page, Pill, Press, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { routeWithRuntime } from '@/lib/aiRouter/runtime';
import { Icon } from '@/lib/icons';
import { BY_SYM } from '@/lib/markets/catalog';
import { HORIZONS, annualVol, beta, bollinger, correlation, currentDrawdown, levels, macd, maxDrawdown, periodReturn, positionSize, projectRange, range52, rebase, riskLevel, rsi, signals, smaSeries, trend, valueAtRisk, type Signal } from '@/lib/markets/analysis';
import { usdToLp } from '@/lib/markets/quotes';
import { dayChangePct, loadHistory, priceLp, priceUsd, useMarkets } from '@/store/markets';
import { useNet } from '@/store/network';

const RANGES = [{ n: '3M', len: 63 }, { n: '6M', len: 126 }, { n: '1A', len: 252 }, { n: 'Max', len: 99999 }];
const fmt = (n: number, d = 2) => n.toLocaleString('de-CH', { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (n: number | null, d = 1) => (n === null ? '–' : `${n >= 0 ? '+' : ''}${(n * 100).toFixed(d)}%`);
const num = (v: string) => { const n = parseFloat(v.replace(',', '.')); return Number.isFinite(n) ? n : 0; };

export default function StockAnalysis() {
  const t = useTheme();
  const { sym: raw } = useLocalSearchParams<{ sym?: string }>();
  const sym = (raw ?? 'AAPL').toUpperCase();
  const mk = useMarkets();
  const net = useNet();
  const inst = BY_SYM[sym];
  const [hist, setHist] = useState<number[]>([]);
  const [bench, setBench] = useState<number[]>([]);
  const [live, setLive] = useState(true);
  const [failed, setFailed] = useState(false);
  const [rangeIdx, setRangeIdx] = useState(1);
  const [ov, setOv] = useState({ s20: false, s50: true, s200: false, boll: false });
  const [cmp, setCmp] = useState('SPY');
  const [cmpHist, setCmpHist] = useState<number[]>([]);
  const [whatPct, setWhatPct] = useState('-10');
  const [whatLp, setWhatLp] = useState('500');
  const [sz, setSz] = useState({ capital: String(Math.round(net.lifePoints)), risk: '2', stopPct: '8' });
  const [trade, setTrade] = useState(false);
  const [theia, setTheia] = useState<{ busy: boolean; text?: string }>({ busy: false });

  const usd = priceUsd(mk, sym);
  const fx = mk.usdChf;
  useEffect(() => {
    let alive = true;
    setFailed(false);
    void Promise.all([loadHistory(sym, usd), loadHistory('SPY', priceUsd(mk, 'SPY'))]).then(([a, b]) => { if (!alive) return; setHist(a.closes); setBench(b.closes); setLive(a.live); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sym]);
  useEffect(() => {
    let alive = true;
    void loadHistory(cmp, priceUsd(mk, cmp)).then((r) => { if (alive) setCmpHist(r.closes); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cmp]);
  useEffect(() => { if (!inst && hist.length === 0) { const id = setTimeout(() => setFailed(true), 6000); return () => clearTimeout(id); } }, [inst, hist.length]);

  const lp = useMemo(() => hist.map((x) => usdToLp(x, fx)), [hist, fx]);
  const price = lp.length ? lp[lp.length - 1] : priceLp(mk, sym);
  const sg: Signal[] = useMemo(() => signals(lp, bench), [lp, bench]);
  const tr = lp.length > 30 ? trend(lp) : null;
  const r14 = lp.length > 15 ? rsi(lp) : null;
  const mc = lp.length > 40 ? macd(lp) : null;
  const bb = lp.length > 20 ? bollinger(lp) : null;
  const vol = lp.length > 30 ? annualVol(lp) : 0;
  const dd = maxDrawdown(lp.slice(-253)), cdd = currentDrawdown(lp.slice(-253));
  const var95 = valueAtRisk(lp);
  const be = beta(lp, bench), co = correlation(lp, bench);
  const rg = lp.length > 2 ? range52(lp) : null;
  const lv = useMemo(() => (lp.length > 40 ? levels(lp) : { supports: [], resistances: [] }), [lp]);
  const pos = mk.positions[sym];
  const pfCorr = useMemo(() => {
    const syms = Object.keys(mk.positions).filter((s) => s !== sym);
    if (!syms.length || !lp.length) return null;
    return syms.length;
  }, [mk.positions, sym, lp.length]);

  const range = RANGES[rangeIdx];
  const nShow = Math.min(range.len, lp.length);
  const slice = (xs: (number | null)[]) => xs.slice(-nShow);
  const s20 = smaSeries(lp, 20), s50 = smaSeries(lp, 50), s200 = smaSeries(lp, 200);
  const up = nShow < 2 || lp[lp.length - 1] >= lp[lp.length - nShow];
  const lineCol = up ? t.positive : t.danger;
  const bbSeries = useMemo(() => { const up2: (number | null)[] = [], lo: (number | null)[] = []; for (let i = 0; i < lp.length; i++) { const b = i >= 19 ? bollinger(lp.slice(0, i + 1)) : null; up2.push(b ? b.upper : null); lo.push(b ? b.lower : null); } return { up: up2, lo }; }, [lp]);
  const rsiSeries = useMemo(() => lp.map((_, i) => (i > 14 ? rsi(lp.slice(0, i + 1)) : null)).slice(-nShow), [lp, nShow]);
  const macdFull = lp.length > 40 ? macd(lp) : null;

  const verdict = (label: string, value: string, tone: 'pos' | 'neg' | 'neu') => (
    <View style={{ flex: 1, backgroundColor: t.chip, borderRadius: 16, padding: 12 }}>
      <Text style={{ color: t.muted, fontSize: 11.5, fontWeight: '700' }}>{label}</Text>
      <Text style={{ color: tone === 'pos' ? t.positive : tone === 'neg' ? t.danger : t.text, fontWeight: '900', fontSize: 15, marginTop: 3 }}>{value}</Text>
    </View>
  );

  const what = num(whatPct), whatAmt = num(whatLp);
  const stopPrice = price * (1 - num(sz.stopPct) / 100);
  const size = positionSize({ capital: num(sz.capital), riskPct: num(sz.risk), entry: price, stop: stopPrice });
  const cmpLp = cmpHist.map((x) => usdToLp(x, fx));
  const nC = Math.min(nShow, lp.length, cmpLp.length);
  const corrCmp = correlation(lp, cmpLp);
  const fact = mk.facts[sym] ?? {};

  const askTheia = async () => {
    setTheia({ busy: true });
    const nums = `Titolo ${inst?.name ?? sym} (${sym}), prezzo ${fmt(price)} LP. Rendimenti: ${HORIZONS.map((h) => `${h.id} ${pct(periodReturn(lp, h.n))}`).join(', ')}. Andamento ${tr?.trend ?? 'n/d'}, RSI ${r14 ?? 'n/d'}, volatilità annua ${(vol * 100).toFixed(0)}%, calo massimo ${(dd * 100).toFixed(0)}%, beta ${be?.toFixed(2) ?? 'n/d'}.`;
    const r = await routeWithRuntime({ text: `${nums}\nSpiegami in modo semplice i punti di forza e di debolezza di questo titolo dai soli dati sopra, senza consigli di acquisto.`, lang: 'it', source: 'typed' });
    setTheia({ busy: false, text: r.status === 'answered' && r.text ? r.text : r.message });
  };

  return (
    <Page id="stockAnalysis" title="Analisi" back>
      {/* testata */}
      <Row>
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.muted, fontSize: 13 }}>{sym}{inst ? ` · ${tl(inst.sector)}` : ''}</Text>
          <Text style={{ color: t.text, fontSize: 24, fontWeight: '900', letterSpacing: -0.5 }}>{inst?.name ?? sym}</Text>
        </View>
        <Press onPress={() => mk.toggleWatch(sym)} accessibilityLabel={mk.watch.includes(sym) ? tl('Non seguire più') : tl('Segui')}><Icon name="star" size={24} color={mk.watch.includes(sym) ? t.accent : t.muted} fill={mk.watch.includes(sym) ? t.accent : 'none'} /></Press>
      </Row>
      <View style={{ marginVertical: 6 }}><Amount n={price} size={38} /></View>
      <Text style={{ color: dayChangePct(mk, sym) >= 0 ? t.positive : t.danger, fontWeight: '800' }}>{dayChangePct(mk, sym) >= 0 ? '+' : ''}{dayChangePct(mk, sym).toFixed(2)}% {tl('oggi')}</Text>
      {!live ? <Text style={{ color: t.warn, fontSize: 12.5, marginTop: 6 }}>{tl('Storico dimostrativo: non è disponibile la fonte dei prezzi, i numeri servono per provare gli strumenti.')}</Text> : null}
      {failed ? <Panel><Body small muted>Non trovo i prezzi di «{sym}». Controlla il simbolo o riprova con connessione attiva.</Body></Panel> : null}

      {lp.length > 30 ? (
        <>
          {/* grafico */}
          <View style={{ marginTop: 14 }}>
            <AnalysisChart height={200} grid={t.border} lines={[
              { data: slice(lp), color: lineCol, width: 2.2 },
              ...(ov.s20 ? [{ data: slice(s20), color: '#f0c040', width: 1.4 }] : []),
              ...(ov.s50 ? [{ data: slice(s50), color: t.accent, width: 1.4 }] : []),
              ...(ov.s200 ? [{ data: slice(s200), color: '#ff6fa5', width: 1.4 }] : []),
              ...(ov.boll ? [{ data: slice(bbSeries.up), color: t.muted, width: 1, dash: true }, { data: slice(bbSeries.lo), color: t.muted, width: 1, dash: true }] : []),
            ]} />
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>{RANGES.map((r, k) => <Pill key={r.n} label={r.n} on={rangeIdx === k} onPress={() => setRangeIdx(k)} />)}</View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginTop: 8 }} style={{ flexGrow: 0 }}>
            <Pill label="Media 20" on={ov.s20} onPress={() => setOv({ ...ov, s20: !ov.s20 })} />
            <Pill label="Media 50" on={ov.s50} onPress={() => setOv({ ...ov, s50: !ov.s50 })} />
            <Pill label="Media 200" on={ov.s200} onPress={() => setOv({ ...ov, s200: !ov.s200 })} />
            <Pill label="Bande di Bollinger" on={ov.boll} onPress={() => setOv({ ...ov, boll: !ov.boll })} />
          </ScrollView>

          {/* in breve */}
          <SectionTitle>{tl('Theia in breve')}</SectionTitle>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {verdict(tl('Andamento'), tr ? tl(tr.trend) : '–', tr?.trend === 'rialzista' ? 'pos' : tr?.trend === 'ribassista' ? 'neg' : 'neu')}
            {verdict(tl('Slancio'), mc ? (mc.hist > 0 ? tl('in aumento') : tl('in calo')) : '–', mc ? (mc.hist > 0 ? 'pos' : 'neg') : 'neu')}
            {verdict(tl('Rischio'), tl(riskLevel(vol)), riskLevel(vol) === 'basso' ? 'pos' : riskLevel(vol) === 'medio' ? 'neu' : 'neg')}
          </View>
          <View style={{ marginTop: 10 }}>
            <Panel pad={6}>
              {sg.map((s, i) => (
                <View key={s.id} style={{ flexDirection: 'row', gap: 12, padding: 12, borderTopWidth: i ? 1 : 0, borderTopColor: t.border }}>
                  <View style={{ width: 9, height: 9, borderRadius: 5, marginTop: 6, backgroundColor: s.tone === 'pos' ? t.positive : s.tone === 'neg' ? t.danger : t.muted }} />
                  <View style={{ flex: 1 }}><Text style={{ color: t.text, fontWeight: '800', fontSize: 14.5 }}>{s.title}</Text><Text style={{ color: t.muted, fontSize: 13, lineHeight: 19, marginTop: 2 }}>{s.text}</Text></View>
                </View>
              ))}
            </Panel>
          </View>
          <Text style={{ color: t.muted, fontSize: 11.5, marginTop: 8, lineHeight: 16 }}>{tl('Sono osservazioni calcolate dai prezzi passati: non sono previsioni né consigli di investimento.')}</Text>

          {/* rendimenti */}
          <SectionTitle>{tl('Rendimenti')}</SectionTitle>
          <Row style={{ gap: 8 }}>
            {HORIZONS.map((h) => { const r = periodReturn(lp, h.n); return (
              <View key={h.id} style={{ flex: 1, backgroundColor: t.card, borderRadius: 16, borderWidth: 1, borderColor: t.border, paddingVertical: 12, alignItems: 'center' }}>
                <Text style={{ color: t.muted, fontSize: 11.5, fontWeight: '700' }}>{h.id}</Text>
                <Text style={{ color: r === null ? t.muted : r >= 0 ? t.positive : t.danger, fontWeight: '900', fontSize: 13.5, marginTop: 3 }}>{pct(r, 1)}</Text>
              </View>
            ); })}
          </Row>

          {/* indicatori */}
          <SectionTitle>{tl('Indicatori')}</SectionTitle>
          <Panel>
            <Row><Text style={{ color: t.text, fontWeight: '800' }}>RSI (14)</Text><Text style={{ color: t.text, fontWeight: '900' }}>{r14 ?? '–'}</Text></Row>
            <Text style={{ color: t.muted, fontSize: 12.5, marginBottom: 6 }}>{tl('Sopra 70 il titolo è «caro» a breve, sotto 30 «a buon mercato» a breve.')}</Text>
            <AnalysisChart height={90} lines={[{ data: rsiSeries, color: t.accent, width: 1.8 }]} bands={[{ from: 70, to: 100, color: t.danger + '1f' }, { from: 0, to: 30, color: t.positive + '1f' }]} hlines={[{ y: 70, color: t.muted }, { y: 30, color: t.muted }]} />
            {macdFull ? (
              <View style={{ marginTop: 18 }}>
                <Row><Text style={{ color: t.text, fontWeight: '800' }}>MACD</Text><Text style={{ color: macdFull.hist >= 0 ? t.positive : t.danger, fontWeight: '900' }}>{macdFull.hist >= 0 ? tl('positivo') : tl('negativo')}</Text></Row>
                <Text style={{ color: t.muted, fontSize: 12.5, marginBottom: 6 }}>{tl('Le barre sono la differenza tra due medie veloci: verdi se la spinta cresce, rosse se cala.')}</Text>
                <AnalysisChart height={90} lines={[]} bars={{ data: macdFull.histSeries.slice(-Math.min(nShow, 120)), pos: t.positive, neg: t.danger }} hlines={[{ y: 0, color: t.muted }]} />
              </View>
            ) : null}
            {bb ? <View style={{ marginTop: 18 }}><Row><Text style={{ color: t.text, fontWeight: '800' }}>{tl('Bande di Bollinger')}</Text><Text style={{ color: t.text, fontWeight: '900' }}>{Math.round(bb.pctB * 100)}%</Text></Row><View style={{ marginVertical: 6 }}><Bar pct={bb.pctB * 100} color={bb.pctB > 1 || bb.pctB < 0 ? t.danger : t.accent} /></View><Text style={{ color: t.muted, fontSize: 12.5 }}>{tl('0% = banda bassa, 100% = banda alta. Fuori dalla fascia il movimento è insolito.')}</Text></View> : null}
          </Panel>

          {/* rischio */}
          <SectionTitle>{tl('Rischio')}</SectionTitle>
          <Panel>
            {[
              [tl('Variabilità annua'), `±${(vol * 100).toFixed(0)}%`, tl(riskLevel(vol))],
              [tl('Calo massimo (1 anno)'), `${(dd * 100).toFixed(0)}%`, `${tl('oggi')} ${(cdd * 100).toFixed(0)}% ${tl('dal massimo')}`],
              [tl('Perdita giornaliera tipica nei giorni peggiori'), `${(var95 * 100).toFixed(1)}%`, tl('nel 95% dei giorni è stata minore')],
              ['Beta vs. mercato (SPY)', be === null ? '–' : be.toFixed(2), co === null ? '' : `${tl('correlazione')} ${co.toFixed(2)}`],
            ].map(([a, b, c], i) => (
              <View key={a} style={{ paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: t.border }}>
                <Row><Text style={{ color: t.text, fontWeight: '700', flex: 1, paddingEnd: 8 }}>{a}</Text><Text style={{ color: t.text, fontWeight: '900' }}>{b}</Text></Row>
                {c ? <Text style={{ color: t.muted, fontSize: 12.5, marginTop: 2 }}>{c}</Text> : null}
              </View>
            ))}
          </Panel>

          {/* livelli */}
          {rg ? (
            <>
              <SectionTitle>{tl('Livelli')}</SectionTitle>
              <Panel>
                <Row><Text style={{ color: t.muted, fontSize: 12.5 }}>{tl('Minimo 1 anno')} {fmt(rg.low)}</Text><Text style={{ color: t.muted, fontSize: 12.5 }}>{tl('Massimo')} {fmt(rg.high)}</Text></Row>
                <View style={{ marginVertical: 8 }}><Bar pct={rg.pos * 100} /></View>
                {lv.resistances.length ? <Text style={{ color: t.text, marginTop: 6 }}><Text style={{ fontWeight: '800' }}>{tl('Resistenze')}: </Text>{lv.resistances.map((x) => fmt(x)).join(' · ')} LP</Text> : null}
                {lv.supports.length ? <Text style={{ color: t.text, marginTop: 6 }}><Text style={{ fontWeight: '800' }}>{tl('Supporti')}: </Text>{lv.supports.map((x) => fmt(x)).join(' · ')} LP</Text> : null}
                <Text style={{ color: t.muted, fontSize: 12.5, marginTop: 8 }}>{tl('Sono prezzi dove in passato il titolo ha rallentato o è tornato indietro.')}</Text>
              </Panel>
            </>
          ) : null}

          {/* scenari */}
          <SectionTitle>{tl('Scenari')}</SectionTitle>
          <Panel>
            <Text style={{ color: t.text, fontWeight: '800', marginBottom: 8 }}>{tl('E se il prezzo cambiasse?')}</Text>
            <Row style={{ gap: 10 }}>
              <View style={{ flex: 1, minWidth: 0 }}><Input style={{ marginBottom: 0 }} keyboardType="numbers-and-punctuation" value={whatPct} onChangeText={setWhatPct} placeholder="% (es. -10)" /></View>
              <View style={{ flex: 1, minWidth: 0 }}><Input style={{ marginBottom: 0 }} keyboardType="decimal-pad" value={whatLp} onChangeText={setWhatLp} placeholder="LP investiti" /></View>
            </Row>
            <Text style={{ color: t.text, marginTop: 10 }}>{tl('Il prezzo andrebbe a')} <Text style={{ fontWeight: '900' }}>{fmt(price * (1 + what / 100))} LP</Text>; {tl('i tuoi')} {fmt(whatAmt)} LP {tl('diventerebbero')} <Text style={{ fontWeight: '900', color: what >= 0 ? t.positive : t.danger }}>{fmt(whatAmt * (1 + what / 100))} LP</Text> ({what >= 0 ? '+' : ''}{fmt(whatAmt * what / 100)}).</Text>
            <Text style={{ color: t.text, fontWeight: '800', marginTop: 16, marginBottom: 6 }}>{tl('Fascia statistica dei prezzi')}</Text>
            {[[1, '1 mese', 21], [3, '3 mesi', 63], [12, '12 mesi', 252]].map(([, label, d]) => { const p = projectRange(price, vol, d as number); return (
              <Row key={label as string} style={{ paddingVertical: 5 }}><Text style={{ color: t.muted }}>{label as string}</Text><Text style={{ color: t.text, fontWeight: '800' }}>{fmt(p.low)} – {fmt(p.high)} LP</Text></Row>
            ); })}
            <Text style={{ color: t.muted, fontSize: 12, marginTop: 6, lineHeight: 17 }}>{tl('Nell’80% dei casi, secondo la variabilità passata, il prezzo starebbe dentro questa fascia. Non è una previsione: nessuno sa dove andrà il prezzo.')}</Text>
          </Panel>

          {/* dimensionamento */}
          <SectionTitle>{tl('Quanto comprare')}</SectionTitle>
          <Panel>
            <Text style={{ color: t.muted, fontSize: 12.5, marginBottom: 8 }}>{tl('Scegli quanto sei disposto a perdere al massimo se il prezzo scende fino allo stop.')}</Text>
            <Row style={{ gap: 8 }}>
              <View style={{ flex: 1, minWidth: 0 }}><Input style={{ marginBottom: 0 }} keyboardType="decimal-pad" value={sz.capital} onChangeText={(v) => setSz({ ...sz, capital: v })} placeholder="Capitale LP" /></View>
              <View style={{ flex: 1, minWidth: 0 }}><Input style={{ marginBottom: 0 }} keyboardType="decimal-pad" value={sz.risk} onChangeText={(v) => setSz({ ...sz, risk: v })} placeholder="Rischio %" /></View>
              <View style={{ flex: 1, minWidth: 0 }}><Input style={{ marginBottom: 0 }} keyboardType="decimal-pad" value={sz.stopPct} onChangeText={(v) => setSz({ ...sz, stopPct: v })} placeholder="Stop −%" /></View>
            </Row>
            {size.error ? <Text style={{ color: t.warn, marginTop: 10 }}>{size.error}</Text> : (
              <Text style={{ color: t.text, marginTop: 10, lineHeight: 21 }}>{tl('Stop a')} <Text style={{ fontWeight: '900' }}>{fmt(stopPrice)} LP</Text>. {tl('Compra circa')} <Text style={{ fontWeight: '900' }}>{fmt(size.units, 4)}</Text> {tl('quote')} = <Text style={{ fontWeight: '900' }}>{fmt(size.cost)} LP</Text>; {tl('perdita massima allo stop')}: <Text style={{ fontWeight: '900', color: t.danger }}>{fmt(size.maxLoss)} LP</Text>.{size.capped ? ` ${tl('(limitato al tuo capitale)')}` : ''}</Text>
            )}
            <Text style={{ color: t.muted, fontSize: 12, marginTop: 6 }}>{tl('Lo stop è un livello che scegli tu: il titolo non viene venduto da solo.')}</Text>
          </Panel>

          {/* confronto */}
          <SectionTitle>{tl('Confronto')}</SectionTitle>
          <Panel>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ flexGrow: 0, marginBottom: 10 }}>
              {['SPY', 'QQQ', 'VT', 'GLD', 'AGG', ...Object.keys(mk.positions), ...mk.watch].filter((s, i, a) => s !== sym && a.indexOf(s) === i && BY_SYM[s]).slice(0, 14).map((s) => <Pill key={s} label={s} on={cmp === s} onPress={() => setCmp(s)} />)}
            </ScrollView>
            {nC > 5 ? <AnalysisChart height={150} grid={t.border} lines={[{ data: rebase(lp, nC), color: t.accent, width: 2.2 }, { data: rebase(cmpLp, nC), color: '#f0c040', width: 2 }]} /> : <View style={{ height: 150 }} />}
            <Row style={{ marginTop: 8 }}><Text style={{ color: t.accent, fontWeight: '800' }}>● {sym}</Text><Text style={{ color: '#f0c040', fontWeight: '800' }}>● {cmp}</Text></Row>
            <Text style={{ color: t.muted, fontSize: 12.5, marginTop: 6 }}>{tl('Entrambi partono da 100.')}{corrCmp !== null ? ` ${tl('Correlazione')}: ${corrCmp.toFixed(2)} (${corrCmp > 0.7 ? tl('si muovono insieme') : corrCmp < 0.3 ? tl('si muovono in modo diverso') : tl('si muovono in parte insieme')}).` : ''}</Text>
            {pfCorr ? <Text style={{ color: t.muted, fontSize: 12.5, marginTop: 4 }}>{tl('Hai già {0} altre posizioni: scegli una per vedere quanto questo titolo le somiglia.', pfCorr)}</Text> : null}
          </Panel>
        </>
      ) : null}

      {/* dati societari a mano */}
      <SectionTitle>{tl('Dati della società')}</SectionTitle>
      <Panel>
        <Text style={{ color: t.muted, fontSize: 12.5, marginBottom: 8, lineHeight: 18 }}>{tl('Utili, rapporto prezzo/utili e dividendo non arrivano dalla fonte dei prezzi. Scrivili tu (da un sito o da uno screenshot) e ti dico cosa significano.')}</Text>
        <Row style={{ gap: 8 }}>
          <View style={{ flex: 1, minWidth: 0 }}><Input style={{ marginBottom: 0 }} keyboardType="decimal-pad" defaultValue={fact.pe ? String(fact.pe) : ''} onChangeText={(v) => mk.setFact(sym, { pe: num(v) || undefined })} placeholder="P/E" /></View>
          <View style={{ flex: 1, minWidth: 0 }}><Input style={{ marginBottom: 0 }} keyboardType="decimal-pad" defaultValue={fact.epsGrowth ? String(fact.epsGrowth) : ''} onChangeText={(v) => mk.setFact(sym, { epsGrowth: num(v) || undefined })} placeholder="Utili %/anno" /></View>
        </Row>
        <Row style={{ gap: 8, marginTop: 8 }}>
          <View style={{ flex: 1, minWidth: 0 }}><Input style={{ marginBottom: 0 }} keyboardType="decimal-pad" defaultValue={fact.div ? String(fact.div) : ''} onChangeText={(v) => mk.setFact(sym, { div: num(v) || undefined })} placeholder="Dividendo %" /></View>
          <View style={{ flex: 1, minWidth: 0 }}><Input style={{ marginBottom: 0 }} keyboardType="decimal-pad" defaultValue={fact.debt ? String(fact.debt) : ''} onChangeText={(v) => mk.setFact(sym, { debt: num(v) || undefined })} placeholder="Debito/capitale" /></View>
        </Row>
        {[
          fact.pe ? (fact.pe < 12 ? 'P/E basso: il mercato paga poco gli utili (può essere una occasione o un segnale di problemi).' : fact.pe > 30 ? 'P/E alto: il prezzo sconta molta crescita futura; se la crescita delude, il calo può essere forte.' : 'P/E nella norma per un titolo quotato.') : null,
          fact.pe && fact.epsGrowth ? `PEG ≈ ${(fact.pe / fact.epsGrowth).toFixed(1)}: ${fact.pe / fact.epsGrowth < 1 ? 'sotto 1, prezzo basso rispetto alla crescita' : fact.pe / fact.epsGrowth > 2 ? 'sopra 2, prezzo alto rispetto alla crescita' : 'tra 1 e 2, abbastanza equilibrato'}.` : null,
          fact.div ? (fact.div > 5 ? 'Dividendo molto alto: verifica che sia sostenibile.' : fact.div > 0 ? `Il dividendo rende circa ${fact.div}% l'anno.` : null) : null,
          fact.debt ? (fact.debt > 2 ? 'Debito alto rispetto al capitale: più rischio se i tassi salgono o gli utili calano.' : 'Debito contenuto rispetto al capitale.') : null,
        ].filter(Boolean).map((x, i) => <Text key={i} style={{ color: t.text, marginTop: 8, lineHeight: 19 }}>• {x}</Text>)}
      </Panel>

      {/* azioni */}
      <SectionTitle>{tl('Cosa vuoi fare?')}</SectionTitle>
      <Row style={{ gap: 10 }}>
        <Btn style={{ flex: 1 }} title={tl('Compra')} tone="buy" onPress={() => setTrade(true)} />
        {pos ? <Btn style={{ flex: 1 }} title={tl('Vendi')} tone="sell" onPress={() => setTrade(true)} /> : null}
      </Row>
      <Btn ghost style={{ marginTop: 10 }} title={theia.busy ? tl('Theia sta leggendo i dati…') : tl('Chiedi a Theia di spiegarlo')} onPress={() => void askTheia()} disabled={theia.busy || lp.length < 30} />
      {theia.text ? <Panel><Text style={{ color: t.text, lineHeight: 21 }}>{theia.text}</Text></Panel> : null}
      <Text style={{ color: t.muted, fontSize: 11.5, marginTop: 14, lineHeight: 16 }}>{tl('Informazioni a scopo educativo, non consulenza finanziaria. I risultati passati non garantiscono quelli futuri. Puoi perdere parte di quanto investi.')}</Text>
      {trade ? <InstrumentSheet sym={sym} onClose={() => setTrade(false)} /> : null}
    </Page>
  );
}
