import { useMemo, useState, type ReactNode } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Path, Polygon, Polyline, Rect, Text as SvgText } from 'react-native-svg';

import { Text } from '@/components/T';
import { Donut } from '@/components/charts';
import { Body, Btn, Card, Empty, H, Item, Press, Row, Sheet } from '@/components/ui';
import { useInk, useTheme } from '@/hooks/use-theme';
import { currentCurrency, fmtDate, formatMoney } from '@/i18n/format';
import { t, translateText } from '@/i18n/core';
import { Icon } from '@/lib/icons';
import { alertsFor } from '@/lib/budgetState';
import { analyze, buildRecap, parseMonthLabel, rateZone, type Analysis, type MonthStat, type RecapAction } from '@/lib/financeRecap';
import { categoryOf, emergencyByMonth, useFin } from '@/store/finance';

export type OverviewHandlers = {
  onAlerts: () => void; onBills: () => void; onEmergency: () => void; onImport: () => void; onMovements: (monthIdx: number) => void;
};

const money = (n: number) => formatMoney(Math.round(n));
const compact = (n: number) => (Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(Math.abs(n) >= 10000 ? 0 : 1)}k` : String(Math.round(n)));
const monthShortOf = (label: string) => { const p = parseMonthLabel(label); return p ? fmtDate(new Date(p.y, p.m, 1), { month: 'short' }).replace('.', '') : label.slice(0, 3); };
const monthLongOf = (label: string) => { const p = parseMonthLabel(label); return p ? fmtDate(new Date(p.y, p.m, 1), { month: 'long', year: 'numeric' }) : label; };

/** Larghezza disponibile misurata (le card hanno padding): evita grafici troncati a 320pt. */
function useBox(initial = 260) {
  const [w, setW] = useState(initial);
  return [w, (e: LayoutChangeEvent) => { const x = Math.floor(e.nativeEvent.layout.width); if (x > 40 && x !== w) setW(x); }] as const;
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <Card>
      <H style={{ marginBottom: hint ? 2 : 8 }}>{title}</H>
      {hint ? <Body small muted style={{ marginBottom: 12 }}>{hint}</Body> : null}
      {children}
    </Card>
  );
}

function Legend({ items }: { items: { c: string; label: string; dot?: boolean }[] }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 6, marginTop: 10 }}>
      {items.map((i) => (
        <View key={i.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: i.dot ? 10 : 12, height: i.dot ? 10 : 12, borderRadius: i.dot ? 5 : 3, backgroundColor: i.c }} />
          <Body small muted>{i.label}</Body>
        </View>
      ))}
    </View>
  );
}

/* ---------------- (a) Entrate vs uscite + risparmio ---------------- */
function IncomeExpenseChart({ series, onPick }: { series: MonthStat[]; onPick: (i: number) => void }) {
  const th = useTheme();
  const [W, onLayout] = useBox();
  const H = 176, padT = 16, padB = 24, padX = 6;
  const hi = Math.max(1, ...series.flatMap((s) => [s.income, s.expense]));
  const lo = Math.min(0, ...series.map((s) => s.saved));
  const span = hi - lo || 1;
  const y = (v: number) => padT + (1 - (v - lo) / span) * (H - padT - padB);
  const gw = (W - 2 * padX) / series.length, bw = Math.max(8, Math.min(22, gw * 0.3));
  const cx = (i: number) => padX + gw * i + gw / 2;
  const line = series.map((s, i) => `${cx(i).toFixed(1)},${y(s.saved).toFixed(1)}`).join(' ');
  const label = series.map((s) => t('{0}: entrate {1}, uscite {2}, risparmio {3}', monthLongOf(s.label), money(s.income), money(s.expense), money(s.saved))).join('. ');
  return (
    <View onLayout={onLayout} style={{ direction: 'ltr' }}>
      <View style={{ width: W, height: H }}>
        <Svg width={W} height={H} accessibilityLabel={label} accessibilityRole="image">
          <Line x1={padX} x2={W - padX} y1={y(0)} y2={y(0)} stroke={th.border} strokeWidth={1} />
          <SvgText x={padX} y={padT - 5} fontSize={10} fill={th.muted}>{compact(hi)} {currentCurrency()}</SvgText>
          {series.map((s, i) => (
            <Rect key={'i' + s.label} x={cx(i) - bw - 1} y={y(s.income)} width={bw} height={Math.max(1, y(0) - y(s.income))} rx={3} fill={th.accent} />
          ))}
          {series.map((s, i) => (
            <Rect key={'e' + s.label} x={cx(i) + 1} y={y(s.expense)} width={bw} height={Math.max(1, y(0) - y(s.expense))} rx={3} fill={th.warn} />
          ))}
          <Polyline points={line} fill="none" stroke={th.text} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
          {series.map((s, i) => <Circle key={'c' + s.label} cx={cx(i)} cy={y(s.saved)} r={3.6} fill={s.saved >= 0 ? th.positive : th.danger} stroke={th.card} strokeWidth={1.5} />)}
          {series.map((s, i) => <SvgText key={'t' + s.label} x={cx(i)} y={H - 7} fontSize={11} fill={th.muted} textAnchor="middle">{monthShortOf(s.label)}</SvgText>)}
        </Svg>
        {series.map((s, i) => (
          <Press key={'z' + s.label} onPress={() => onPick(i)} accessibilityLabel={t('{0}: entrate {1}, uscite {2}, risparmio {3}', monthLongOf(s.label), money(s.income), money(s.expense), money(s.saved))} style={{ position: 'absolute', left: padX + gw * i, top: 0, width: gw, height: H }}><View style={{ flex: 1 }} /></Press>
        ))}
      </View>
      <Legend items={[{ c: th.accent, label: translateText('Entrate') }, { c: th.warn, label: translateText('Uscite') }, { c: th.text, label: translateText('Risparmio'), dot: true }]} />
    </View>
  );
}

/* ---------------- (c) gauge del tasso di risparmio ---------------- */
const G_LO = -10, G_HI = 40;
function SavingsGauge({ rate, onPress }: { rate: number; onPress: () => void }) {
  const th = useTheme();
  const [W, onLayout] = useBox();
  const w = Math.min(W, 300), r = w / 2 - 18, cx = w / 2, cy = r + 14, h = cy + 22, sw = 16;
  const ang = (v: number) => Math.PI * (1 - (Math.min(G_HI, Math.max(G_LO, v)) - G_LO) / (G_HI - G_LO));
  const pt = (v: number, rad = r) => [cx + rad * Math.cos(ang(v)), cy - rad * Math.sin(ang(v))];
  const arc = (a: number, b: number) => { const [x0, y0] = pt(a), [x1, y1] = pt(b); return `M${x0.toFixed(1)},${y0.toFixed(1)} A${r},${r} 0 0 1 ${x1.toFixed(1)},${y1.toFixed(1)}`; };
  const zones: { a: number; b: number; c: string }[] = [{ a: G_LO, b: 0, c: th.danger }, { a: 0, b: 10, c: th.warn }, { a: 10, b: 20, c: th.accent }, { a: 20, b: G_HI, c: th.positive }];
  const [mx, my] = pt(rate);
  const z = rateZone(rate);
  const word = z === 'neg' ? t('negativo') : z === 'low' ? t('basso') : z === 'ok' ? t('nella media') : t('alto');
  return (
    <View onLayout={onLayout} style={{ alignItems: 'center', direction: 'ltr' }}>
      <Press onPress={onPress} accessibilityLabel={t('Tasso di risparmio {0}%, livello {1}. Tocca per i riferimenti.', Math.round(rate), word)} style={{ width: w, height: h }}>
        <Svg width={w} height={h}>
          {zones.map((zn, i) => <Path key={i} d={arc(zn.a, zn.b)} stroke={zn.c} strokeWidth={sw} fill="none" opacity={0.9} />)}
          <Circle cx={mx} cy={my} r={sw / 2 + 3} fill={th.card} stroke={th.text} strokeWidth={3} />
          <SvgText x={cx} y={cy - 2} fontSize={30} fontWeight="800" fill={th.text} textAnchor="middle">{Math.round(rate)}%</SvgText>
          <SvgText x={cx} y={cy + 17} fontSize={12} fill={th.muted} textAnchor="middle">{word}</SvgText>
        </Svg>
      </Press>
      <Legend items={[{ c: th.danger, label: translateText('sotto 0%') }, { c: th.warn, label: '0-10%' }, { c: th.accent, label: '10-20%' }, { c: th.positive, label: translateText('oltre 20%') }]} />
    </View>
  );
}

/* ---------------- (d) saldo + proiezione tratteggiata ---------------- */
function BalanceChart({ a, onPick }: { a: Analysis; onPick: (i: number) => void }) {
  const th = useTheme();
  const [W, onLayout] = useBox();
  const H = 170, padT = 22, padB = 24, padX = 14;
  const hist = a.balance, fc = a.forecast;
  const all = [...hist, ...fc];
  const max = Math.max(...all), min = Math.min(...all), span = max - min || 1;
  const n = all.length, step = (W - 2 * padX) / Math.max(1, n - 1);
  const x = (i: number) => padX + step * i;
  const y = (v: number) => padT + (1 - (v - min) / span) * (H - padT - padB);
  const hl = hist.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const last = hist.length - 1;
  const fl = [`${x(last).toFixed(1)},${y(hist[last]).toFixed(1)}`, ...fc.map((v, i) => `${x(last + 1 + i).toFixed(1)},${y(v).toFixed(1)}`)].join(' ');
  const area = `${x(0)},${H - padB} ${hl} ${x(last)},${H - padB}`;
  const lastLabel = parseMonthLabel(a.series[a.series.length - 1].label);
  const names = [...a.series.map((s) => monthShortOf(s.label)), ...fc.map((_, k) => lastLabel ? fmtDate(new Date(lastLabel.y, lastLabel.m + 1 + k, 1), { month: 'short' }).replace('.', '') : '+' + (k + 1))];
  const skip = n > 7 ? 2 : 1;
  const a11y = t('Saldo a fine mese: {0}. Proiezione a 3 mesi, stima basata sulla media recente: {1}.', a.series.map((s, i) => `${monthLongOf(s.label)} ${money(hist[i])}`).join(', '), fc.map((v) => money(v)).join(', '));
  const anchor = (i: number) => (i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle');
  return (
    <View onLayout={onLayout} style={{ direction: 'ltr' }}>
      <View style={{ width: W, height: H }}>
        <Svg width={W} height={H} accessibilityLabel={a11y} accessibilityRole="image">
          <Line x1={padX} x2={W - padX} y1={H - padB} y2={H - padB} stroke={th.border} strokeWidth={1} />
          <Polygon points={area} fill={th.accent} opacity={0.14} />
          <Polyline points={hl} fill="none" stroke={th.accent} strokeWidth={2.6} strokeLinejoin="round" strokeLinecap="round" />
          <Polyline points={fl} fill="none" stroke={th.accent} strokeWidth={2.4} strokeDasharray="6 5" strokeLinecap="round" />
          {hist.map((v, i) => <Circle key={'h' + i} cx={x(i)} cy={y(v)} r={3.4} fill={th.accent} stroke={th.card} strokeWidth={1.5} />)}
          {fc.map((v, i) => <Circle key={'f' + i} cx={x(last + 1 + i)} cy={y(v)} r={3.6} fill={th.card} stroke={th.accent} strokeWidth={2} />)}
          <SvgText x={x(last)} y={y(hist[last]) - 9} fontSize={10.5} fontWeight="700" fill={th.text} textAnchor={anchor(last)}>{compact(hist[last])}</SvgText>
          <SvgText x={x(n - 1)} y={y(fc[fc.length - 1]) - 9} fontSize={10.5} fontWeight="700" fill={th.muted} textAnchor="end">{compact(fc[fc.length - 1])}</SvgText>
          {names.map((nm, i) => (i % skip === 0 || i === n - 1) ? <SvgText key={'t' + i} x={x(i)} y={H - 7} fontSize={11} fill={i > last ? th.muted : th.text} opacity={i > last ? 0.85 : 1} textAnchor={anchor(i)}>{nm}</SvgText> : null)}
        </Svg>
        {all.map((v, i) => (
          <Press key={'z' + i} onPress={() => onPick(i)} accessibilityLabel={`${i <= last ? monthLongOf(a.series[i].label) : t('Stima {0}', names[i])}: ${money(v)}`} style={{ position: 'absolute', left: Math.max(0, x(i) - step / 2), top: 0, width: Math.max(28, step), height: H }}><View style={{ flex: 1 }} /></Press>
        ))}
      </View>
      <Legend items={[{ c: th.accent, label: translateText('Saldo a fine mese'), dot: true }, { c: th.muted, label: translateText('Stima (tratteggio)'), dot: true }]} />
    </View>
  );
}

/* ---------------- (e) chi pesa di più ---------------- */
function TopSpenders({ a, onPick, ink }: { a: Analysis; onPick: (n: string) => void; ink: (c: string) => string }) {
  const th = useTheme();
  const [W, onLayout] = useBox();
  const max = Math.max(1, ...a.top.map((x) => Math.max(x.v, x.prev)));
  const hasPrev = a.top.some((x) => x.prev > 0);
  return (
    <View onLayout={onLayout}>
      {a.top.map((it, i) => {
        const col = it.trend === 'up' ? th.danger : it.trend === 'down' ? th.positive : th.muted;
        const w = Math.max(4, (it.v / max) * W), pw = (it.prev / max) * W;
        const txt = it.prev > 0 ? (it.trend === 'flat' ? t('in linea col mese prima') : t('{0} rispetto al mese prima', `${it.delta > 0 ? '+' : '-'}${money(Math.abs(it.delta))}`)) : t('nessuna spesa nel mese prima');
        return (
          <Press key={it.n} onPress={() => onPick(it.n)} accessibilityLabel={`${i + 1}. ${translateText(it.n)}: ${money(it.v)}, ${it.pctOfTotal}% delle uscite, ${txt}`} style={{ paddingVertical: 9 }}>
            <View>
              <Row gap={8} style={{ alignItems: 'flex-start' }}>
                <Body style={{ flex: 1 }}>{i + 1}. {it.n}</Body>
                <Body bold>{money(it.v)}</Body>
              </Row>
              <View style={{ direction: 'ltr', marginVertical: 5 }}>
                <Svg width={W} height={12}>
                  <Rect x={0} y={1} width={W} height={10} rx={5} fill={th.item} />
                  <Rect x={0} y={1} width={w} height={10} rx={5} fill={ink(it.c)} />
                  {it.prev > 0 ? <Line x1={Math.min(W - 1, pw)} x2={Math.min(W - 1, pw)} y1={0} y2={12} stroke={th.text} strokeWidth={2} strokeDasharray="2 2" /> : null}
                </Svg>
              </View>
              <Row gap={6} style={{ justifyContent: 'flex-start' }}>
                {it.trend !== 'flat' && it.prev > 0 ? <Icon name={it.trend === 'up' ? 'arrow-up' : 'arrow-down'} size={14} color={col} stroke={2.4} /> : <Icon name="minus" size={14} color={th.muted} stroke={2.4} />}
                <Body small color={col === th.muted ? undefined : col} muted={col === th.muted} style={{ flex: 1 }}>{txt} · {it.pctOfTotal}%</Body>
              </Row>
            </View>
          </Press>
        );
      })}
      {hasPrev ? <Body small muted style={{ marginTop: 6 }}>{a.basisIsCurrent && a.partial ? 'Il trattino indica il mese scorso intero; il mese in corso non è finito.' : 'Il trattino indica il mese precedente.'}</Body> : null}
    </View>
  );
}

/* ---------------- pannello principale ---------------- */
export function FinanceOverview({ h }: { h: OverviewHandlers }) {
  const th = useTheme();
  const ink = useInk();
  const f = useFin();
  const [sheet, setSheet] = useState<null | { kind: 'month'; i: number } | { kind: 'cat'; n: string } | { kind: 'gauge' } | { kind: 'point'; i: number }>(null);

  const { a, recap } = useMemo(() => {
    const now = new Date();
    const colors: Record<string, string> = {};
    f.categories.forEach((c) => { colors[c.n] = c.c; });
    const alerts = alertsFor(f).map((x) => ({ category: x.category, level: x.level, pct: x.pct }));
    const inp = {
      months: f.months, catOf: (l: string) => categoryOf(l, f.categories), catColors: colors,
      billsMonthly: f.bills.reduce((s, b) => s + (b.freq === 'monthly' ? b.amount : b.amount / 12), 0),
      efTotal: f.months.reduce((s, m) => s + emergencyByMonth(m), 0), alerts,
      day: now.getDate(), daysInMonth: new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(),
    };
    const an = analyze(inp);
    return { a: an, recap: buildRecap(an, inp) };
  }, [f.months, f.categories, f.bills, f.budget, f.guidelines]);

  const monthIdx = (i: number) => a.series.length - 1 - i;

  function run(act: RecapAction) {
    if (act.kind === 'alerts') h.onAlerts();
    else if (act.kind === 'bills') h.onBills();
    else if (act.kind === 'ef') h.onEmergency();
    else if (act.kind === 'import') h.onImport();
    else if (act.kind === 'category' && act.category) setSheet({ kind: 'cat', n: act.category });
    else h.onMovements(0);
  }

  const cur = a.cur;
  const enough = a.series.length >= 2;
  const basisLabel = a.basis ? monthLongOf(a.basis.label) : '';
  const catMovs = (n: string) => {
    if (!a.basis) return [];
    const idx = f.months.findIndex((m) => m.label === a.basis!.label);
    return (f.months[idx]?.movements ?? []).filter((x) => x.amount < 0 && categoryOf(x.label, f.categories) === n);
  };

  return (
    <>
      {/* Recap a parole */}
      <Card accent={th.accent} style={{ padding: 18 }}>
        <Row style={{ justifyContent: 'flex-start' }} gap={8}><Icon name="note" size={18} color={th.accent} /><H style={{ marginBottom: 0 }}>Il tuo mese in parole</H></Row>
        <Body small muted style={{ marginTop: 2, marginBottom: 10 }}>{cur ? monthLongOf(cur.label) : ''} · riepilogo automatico dei tuoi movimenti, non è consulenza finanziaria</Body>
        {recap.sentences.map((s, i) => <Text key={i} style={{ color: th.text, fontSize: 15, lineHeight: 22, marginBottom: 8 }}>{s}</Text>)}
        {recap.actions.length > 0 && (
          <View style={{ marginTop: 6 }}>
            <Body small bold muted style={{ marginBottom: 6 }}>Cosa potresti guardare</Body>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {recap.actions.map((x) => <Btn key={x.id} small ghost title={x.label} icon={x.kind === 'alerts' ? 'alert' : 'chevron-right'} onPress={() => run(x)} />)}
            </View>
          </View>
        )}
      </Card>

      {/* Saldo + numeri chiave */}
      {cur && (
        <Card>
          <Row gap={8} style={{ alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Body small muted>Saldo attuale</Body>
              <Text style={{ color: th.text, fontSize: 32, fontWeight: '800' }} numberOfLines={1} adjustsFontSizeToFit>{money(cur.end)}</Text>
            </View>
            <Btn small ghost title="Movimenti" icon="chevron-right" onPress={() => h.onMovements(0)} />
          </Row>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            {[{ l: 'Entrate', v: cur.income, c: th.accent }, { l: 'Uscite', v: cur.expense, c: th.warn }, { l: 'Risparmio', v: cur.saved, c: cur.saved >= 0 ? th.positive : th.danger }].map((k) => (
              <View key={k.l} style={{ flex: 1, backgroundColor: th.tile, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 10, borderTopWidth: 3, borderTopColor: k.c }}>
                <Body small muted>{k.l}</Body>
                <Text style={{ color: th.text, fontSize: 15, fontWeight: '700', marginTop: 2 }} numberOfLines={1} adjustsFontSizeToFit>{k.l === 'Risparmio' && k.v > 0 ? '+' : ''}{money(k.v)}</Text>
              </View>
            ))}
          </View>
        </Card>
      )}

      {/* (a) barre */}
      <Section title="Entrate e uscite" hint="Ultimi mesi, con il risparmio (entrate meno uscite) sulla linea. Tocca un mese per il dettaglio.">
        {enough ? <IncomeExpenseChart series={a.series} onPick={(i) => setSheet({ kind: 'month', i })} /> : <Empty text="Servono almeno 2 mesi di movimenti per il confronto." />}
      </Section>

      {/* (c) gauge */}
      <Section title="Tasso di risparmio" hint="Quanta parte delle entrate di questo mese resta dopo le uscite.">
        {a.rate != null ? <SavingsGauge rate={a.rate} onPress={() => setSheet({ kind: 'gauge' })} /> : <Empty text="Servono delle entrate nel mese per calcolare il tasso di risparmio." />}
      </Section>

      {/* (b) donut */}
      <Section title="Dove vanno le spese" hint={a.basis ? (a.basisIsCurrent ? `Uscite di ${basisLabel}${a.partial ? ' finora' : ''} per categoria (le voci sotto il 4% sono in Altro).` : `Uscite dell'ultimo mese chiuso, ${basisLabel} (le voci sotto il 4% sono in Altro).`) : undefined}>
        {a.donut.length ? (
          <View>
            <View style={{ alignItems: 'center', marginBottom: 10 }} accessibilityLabel={t('Spese per categoria: {0}', a.donut.map((d) => `${translateText(d.n)} ${d.p}%`).join(', '))} accessibilityRole="image">
              <View style={{ width: 150, height: 150, alignItems: 'center', justifyContent: 'center' }}>
                <Donut size={150} hole={30} holeColor={th.card} parts={a.donut.map((d) => ({ p: d.p, c: ink(d.c) }))} />
                <View style={{ position: 'absolute', alignItems: 'center', width: 84 }}>
                  <Body small muted>Uscite</Body>
                  <Text style={{ color: th.text, fontWeight: '800', fontSize: 14 }} numberOfLines={1} adjustsFontSizeToFit>{money(a.basis!.expense)}</Text>
                </View>
              </View>
            </View>
            {a.donut.map((d, i) => (
              <Press key={d.n} onPress={() => setSheet({ kind: 'cat', n: d.n })} accessibilityLabel={`${translateText(d.n)}: ${money(d.v)}, ${d.p}%`} style={{ paddingVertical: 9, borderTopWidth: i ? 1 : 0, borderTopColor: th.item }}>
                <Row gap={10}>
                  <View style={{ width: 12, height: 12, borderRadius: 4, backgroundColor: ink(d.c) }} />
                  <Body style={{ flex: 1 }}>{d.n}</Body>
                  <Body muted small>{money(d.v)}</Body>
                  <Body bold style={{ minWidth: 48, textAlign: 'right' }}>{d.p}%</Body>
                </Row>
              </Press>
            ))}
          </View>
        ) : <Empty text="Nessuna spesa registrata in questo periodo: appena ci sono movimenti vedrai la ripartizione." />}
      </Section>

      {/* (d) andamento */}
      <Section title="Andamento del saldo" hint="Saldo a fine mese e stima dei prossimi 3 mesi, ipotizzando che il risparmio medio recente resti simile.">
        {a.hasEnough.trend && a.forecast.length ? (
          <>
            <BalanceChart a={a} onPick={(i) => setSheet({ kind: 'point', i })} />
            <Body small muted style={{ marginTop: 8 }}>
              {a.forecastStep >= 0 ? t('Variazione media recente: +{0} al mese. È una stima, la situazione reale può cambiare.', money(a.forecastStep)) : t('Variazione media recente: -{0} al mese. È una stima, la situazione reale può cambiare.', money(-a.forecastStep))}
            </Body>
          </>
        ) : <Empty text="Servono almeno 2 mesi di movimenti per vedere l'andamento e la stima." />}
      </Section>

      {/* (e) chi pesa di più */}
      <Section title="Chi pesa di più" hint={a.basis ? `Le 5 voci di spesa più grandi di ${basisLabel}${a.basisIsCurrent && a.partial ? ' (finora)' : ''}, con il confronto sul mese prima.` : undefined}>
        {a.top.length ? <TopSpenders a={a} onPick={(n) => setSheet({ kind: 'cat', n })} ink={ink} /> : <Empty text="Nessuna spesa da classificare per ora." />}
      </Section>

      {/* ---- fogli di dettaglio ---- */}
      <Sheet visible={sheet?.kind === 'month'} title={sheet?.kind === 'month' ? monthLongOf(a.series[sheet.i]?.label ?? '') : ''} onClose={() => setSheet(null)}>
        {sheet?.kind === 'month' && a.series[sheet.i] && (() => {
          const s = a.series[sheet.i];
          return (<>
            <Item><Row><Body muted>Entrate</Body><Body bold color={th.positive}>+{money(s.income)}</Body></Row></Item>
            <Item><Row><Body muted>Uscite (senza fondo emergenza)</Body><Body bold>{money(s.expense)}</Body></Row></Item>
            <Item><Row><Body muted>Accantonato nel fondo emergenza</Body><Body bold>{money(s.ef)}</Body></Row></Item>
            <Item><Row><Body muted>Risparmio (entrate meno uscite)</Body><Body bold color={s.saved >= 0 ? th.positive : th.danger}>{money(s.saved)}</Body></Row></Item>
            <Item last><Row><Body muted>Saldo a fine mese</Body><Body bold>{money(s.end)}</Body></Row></Item>
            <Btn style={{ marginTop: 14 }} title="Apri i movimenti del mese" onPress={() => { const i = monthIdx(sheet.i); setSheet(null); h.onMovements(i); }} />
          </>);
        })()}
      </Sheet>

      <Sheet visible={sheet?.kind === 'cat'} title={sheet?.kind === 'cat' ? translateText(sheet.n) : ''} onClose={() => setSheet(null)}>
        {sheet?.kind === 'cat' && (() => {
          const list = catMovs(sheet.n);
          const tot = list.reduce((s, x) => s - x.amount, 0);
          const prevTot = a.basis ? (a.basisIsCurrent ? a.prev : a.series.length > 2 ? a.series[a.series.length - 3] : null)?.byCat[sheet.n] ?? 0 : 0;
          return (<>
            <Body small muted style={{ marginBottom: 8 }}>{basisLabel}</Body>
            <Text style={{ color: th.text, fontSize: 30, fontWeight: '800' }}>{money(tot)}</Text>
            <Body small muted style={{ marginBottom: 10 }}>{prevTot > 0 ? t('Il mese prima: {0}', money(prevTot)) : 'Nel mese prima non risultano spese in questa categoria.'}</Body>
            {list.length === 0 ? <Empty text="Nessun movimento in questa categoria nel periodo." /> : list.map((x, i) => (
              <Item key={i} last={i === list.length - 1}><Row><Body style={{ flex: 1 }}>{x.label.replace(/^[^·]*· /, '')}</Body><Body bold>{money(-x.amount)}</Body></Row></Item>
            ))}
          </>);
        })()}
      </Sheet>

      <Sheet visible={sheet?.kind === 'gauge'} title="Tasso di risparmio" onClose={() => setSheet(null)}>
        <Body>{a.rate != null ? t('Questo mese risparmi circa il {0}% delle entrate.', Math.round(a.rate)) : ''}</Body>
        <Body small muted style={{ marginTop: 8 }}>Riferimenti generali, solo indicativi e non una regola: sotto lo 0% si spende più di quanto entra; 0-10% è un margine ridotto; 10-20% è nella media; oltre il 20% è un margine ampio. Dipende da affitto, famiglia e obiettivi: non è consulenza finanziaria.</Body>
        <Body small muted style={{ marginTop: 8 }}>Il risparmio qui è entrate meno uscite; gli importi accantonati nel fondo di emergenza contano come risparmio.</Body>
      </Sheet>

      <Sheet visible={sheet?.kind === 'point'} title="Saldo" onClose={() => setSheet(null)}>
        {sheet?.kind === 'point' && (() => {
          const all = [...a.balance, ...a.forecast];
          const isFc = sheet.i >= a.balance.length;
          const prevV = sheet.i > 0 ? all[sheet.i - 1] : null;
          const nm = isFc ? t('Stima tra {0} mesi', sheet.i - a.balance.length + 1) : monthLongOf(a.series[sheet.i].label);
          return (<>
            <Body small muted>{nm}</Body>
            <Text style={{ color: th.text, fontSize: 30, fontWeight: '800', marginBottom: 6 }}>{money(all[sheet.i])}</Text>
            {prevV != null ? <Body small muted>{t('Rispetto al punto precedente: {0}', `${all[sheet.i] - prevV >= 0 ? '+' : '-'}${money(Math.abs(all[sheet.i] - prevV))}`)}</Body> : null}
            {isFc ? <Body small muted style={{ marginTop: 8 }}>Stima basata sulla variazione media dei mesi recenti. Non tiene conto di spese straordinarie o cambi di entrate: usala solo come ordine di grandezza.</Body> : null}
          </>);
        })()}
      </Sheet>
    </>
  );
}
