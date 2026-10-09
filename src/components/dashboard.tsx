import { Pressable, View } from 'react-native';
import { Text } from '@/components/T';

import { TrendChart } from '@/components/charts';
import { Body, Card, Item, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import type { Palette } from '@/constants/theme';
import { metricInfo } from '@/data/metricInfo';
import { fmtVal, type Analysis, type Insight, type Status } from '@/lib/analytics';
import { Icon } from '@/lib/icons';

export const statusColor = (t: Palette, s: Status | Insight['severity']) =>
  s === 'good' ? t.positive : s === 'warn' ? t.warn : s === 'bad' ? t.danger : t.muted;

export const scoreStatus = (v: number | null): Status => (v == null ? 'neutral' : v >= 80 ? 'good' : v >= 60 ? 'warn' : 'bad');

/** Il cambiamento è "buono" o "cattivo" a seconda di cosa significa per quella metrica. */
export function deltaStatus(a: Analysis): Status {
  if (a.deltaPct == null || Math.abs(a.deltaPct) < 2) return 'neutral';
  const up = a.deltaPct > 0;
  if (a.def.better === 'up') return up ? 'good' : 'warn';
  if (a.def.better === 'down') return up ? 'warn' : 'good';
  return 'neutral';
}

const conf = { alta: 'affidabilità alta', media: 'affidabilità media', bassa: 'affidabilità bassa' } as const;
const srcLabel: Record<string, string> = { apple: 'Apple Health', manuale: 'Inserito a mano', demo: 'Dati demo', stimato: 'Stimato da HRV e battito' };

export function DeltaChip({ a }: { a: Analysis }) {
  const t = useTheme();
  if (a.deltaPct == null) return null;
  const st = deltaStatus(a);
  const c = statusColor(t, st);
  const arrow = Math.abs(a.deltaPct) < 2 ? 'minus' : a.deltaPct > 0 ? 'trend-up' : 'trend-down';
  return (
    <View style={{ backgroundColor: c + '22', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
      <Icon name={arrow} size={12} color={c} stroke={2.4} />
      <Text style={{ color: c, fontSize: 11, fontWeight: '700' }}>{a.deltaPct > 0 ? '+' : ''}{Math.round(a.deltaPct)}%</Text>
    </View>
  );
}

/** Valore principale: media degli ultimi 7 giorni (metriche giornaliere) o ultimo mese. */
export const mainValue = (a: Analysis) => (a.def.period === 'day' ? a.avg7 : a.latest.v);

export function KpiCard({ a, onPress }: { a: Analysis; onPress: () => void }) {
  const t = useTheme();
  const c = statusColor(t, a.status);
  const d = a.def;
  const fc = a.forecast;
  const caption = d.period === 'day' ? 'media 7 giorni' : 'ultimo mese';
  return (
    <Card onPress={onPress} style={{ width: '48.6%', padding: 14, marginVertical: 0, marginBottom: 10 }} accent={undefined}>
      <Row>
        <Text style={{ color: t.muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', flex: 1 }} numberOfLines={1}>{d.label}</Text>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c }} />
      </Row>
      <Text style={{ color: t.text, fontSize: 24, fontWeight: '800', marginTop: 4 }} numberOfLines={1}>{fmtVal(mainValue(a), d)}</Text>
      <Row style={{ marginBottom: 6 }}>
        <Text style={{ color: t.muted, fontSize: 10 }}>{caption}</Text>
        <DeltaChip a={a} />
      </Row>
      <TrendChart pts={a.pts.slice(-21)} forecast={fc} color={d.color} h={46} target={d.target} range={d.range} />
      {metricInfo[d.id] && <Text style={{ color: c, fontSize: 11, marginTop: 4, fontWeight: '600' }} numberOfLines={2}>Ottimale: {metricInfo[d.id].optimal}</Text>}
      <Text style={{ color: t.muted, fontSize: 11, marginTop: 4 }} numberOfLines={2}>
        {fc ? `Prev. ${d.period === 'day' ? '7 gg' : '3 mesi'}: ${fmtVal(fc.end, d)}` : `${a.n} ${d.period === 'day' ? 'giorni' : 'mesi'} di dati`}
        {a.significant ? (a.trend === 'up' ? '  in crescita' : '  in calo') : ''}
      </Text>
    </Card>
  );
}

export function InsightCard({ i, onPress }: { i: Insight; onPress?: () => void }) {
  const t = useTheme();
  const c = statusColor(t, i.severity);
  const glyph = i.severity === 'good' ? 'check' : i.severity === 'info' ? 'info' : 'alert';
  return (
    <Card onPress={onPress} style={{ borderLeftWidth: 3, borderLeftColor: c }}>
      <Row style={{ alignItems: 'flex-start' }}>
        <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: c + '25', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={glyph} size={14} color={c} stroke={2.4} />
        </View>
        <View style={{ flex: 1 }}>
          <Body bold>{i.title}</Body>
          <Body small muted style={{ marginTop: 3 }}>{i.detail}</Body>
          {i.action ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 }}><Icon name="arrow-right" size={13} color={c} /><Body small color={c} style={{ flex: 1 }}>{i.action}</Body></View> : null}
        </View>
      </Row>
    </Card>
  );
}

const Stat = ({ l, v }: { l: string; v: string }) => {
  const t = useTheme();
  return (
    <View style={{ width: '33.33%', paddingVertical: 8 }}>
      <Text style={{ color: t.muted, fontSize: 11 }}>{l}</Text>
      <Text style={{ color: t.text, fontSize: 15, fontWeight: '700' }}>{v}</Text>
    </View>
  );
};

export function MetricSheet({ a, onClose }: { a: Analysis | null; onClose: () => void }) {
  const t = useTheme();
  if (!a) return <Sheet visible={false} title="" onClose={onClose}><View /></Sheet>;
  const d = a.def;
  const fc = a.forecast;
  const f = (v: number) => fmtVal(v, d);
  const per = d.period === 'day' ? 'sett.' : 'mese';
  return (
    <Sheet visible title={d.label} onClose={onClose}>
      <Row style={{ alignItems: 'flex-end' }}>
        <View>
          <Text style={{ color: t.text, fontSize: 34, fontWeight: '800' }}>{f(mainValue(a))}</Text>
          <Body small muted>{d.period === 'day' ? 'media ultimi 7 giorni' : 'ultimo mese'} · ultimo dato {a.ageDays === 0 ? 'oggi' : `${a.ageDays} giorni fa`}: {f(a.value)}</Body>
        </View>
        <DeltaChip a={a} />
      </Row>
      <View style={{ marginVertical: 12 }}><TrendChart pts={a.pts.slice(-30)} forecast={fc} color={d.color} h={120} target={d.target} range={d.range} showLabels /></View>
      <Body small muted>Linea piena = storico · tratteggio = previsione · fascia = intervallo probabile all'80%{d.target != null ? ' · linea punteggiata = obiettivo' : ''}</Body>

      <Explain a={a} part="top" />

      {fc && (
        <Card style={{ marginTop: 12 }}>
          <Body bold>Previsione {d.period === 'day' ? 'a 7 giorni' : 'a 3 mesi'}: {f(fc.end)}</Body>
          <Body small muted style={{ marginTop: 2 }}>Probabile tra {f(fc.endLo)} e {f(fc.endHi)} · {conf[fc.confidence]}</Body>
          <Body small muted style={{ marginTop: 6 }}>Stima statistica semplice (tendenza recente con smorzamento): non tiene conto di eventi futuri.</Body>
        </Card>
      )}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
        <Stat l="Media" v={f(a.mean)} /><Stat l="Mediana" v={f(a.median)} /><Stat l="Variabilità" v={`${Math.round(a.cv * 100)}%`} />
        <Stat l="Minimo" v={f(a.min)} /><Stat l="Massimo" v={f(a.max)} /><Stat l="Dev. standard" v={f(a.std)} />
        <Stat l={`Trend / ${per}`} v={a.significant ? `${a.slopePctWeek > 0 ? '+' : ''}${a.slopePctWeek.toFixed(1)}%` : 'stabile'} />
        <Stat l="Dati" v={`${a.n} ${d.period === 'day' ? 'gg' : 'mesi'}`} />
        <Stat l={d.period === 'day' ? 'Copertura 14 gg' : 'Periodo'} v={d.period === 'day' ? `${Math.round(a.coverage * 100)}%` : 'mensile'} />
        {a.goalRate7 != null && <Stat l="Obiettivo 7 gg" v={`${Math.round(a.goalRate7 * 7)}/7`} />}
        {a.streak > 0 && <Stat l="Serie attuale" v={`${a.streak} gg`} />}
        {d.target != null && <Stat l="Obiettivo" v={f(d.target)} />}
        {d.range && <Stat l="Intervallo sano" v={`${d.range[0]}–${d.range[1]}`} />}
      </View>

      {a.anomalies.length > 0 && (
        <>
          <Body bold style={{ marginTop: 12, marginBottom: 4 }}>Valori fuori dal tuo solito</Body>
          {a.anomalies.slice(-5).map((p, i, arr) => (
            <Item key={p.d} last={i === arr.length - 1}><Row><Body small>{p.d.slice(8)}/{p.d.slice(5, 7)}</Body><Body small bold>{f(p.v)}</Body></Row></Item>
          ))}
        </>
      )}
      <Explain a={a} part="rest" />
      <Body small muted style={{ marginTop: 12 }}>Fonte: {srcLabel[a.source] ?? a.source}.</Body>
    </Sheet>
  );
}

/** Da che parte è fuori range il dato: sotto o sopra l'ottimale. */
function side(a: Analysis): 'low' | 'high' | null {
  const d = a.def, v = mainValue(a);
  if (d.better === 'range' && d.range) return v < d.range[0] ? 'low' : v > d.range[1] ? 'high' : null;
  if (d.better === 'up') return d.target != null ? (v < d.target ? 'low' : null) : a.status === 'bad' || a.status === 'warn' ? 'low' : null;
  if (d.better === 'down') return d.target != null ? (v > d.target ? 'high' : null) : a.status === 'bad' || a.status === 'warn' ? 'high' : null;
  return a.deltaPct != null && Math.abs(a.deltaPct) >= 5 ? (a.deltaPct > 0 ? 'high' : 'low') : null;
}

const Sect = ({ title, children, color }: { title: string; children: React.ReactNode; color?: string }) => {
  const t = useTheme();
  return (<View style={{ marginTop: 14 }}><Text style={{ color: color ?? t.text, fontWeight: '800', fontSize: 14, marginBottom: 4 }}>{title}</Text>{children}</View>);
};

/** Cos'è il dato, qual è l'ottimale, cosa comporta e come migliorarlo. */
function Explain({ a, part }: { a: Analysis; part: 'top' | 'rest' }) {
  const t = useTheme();
  const info = metricInfo[a.def.id];
  if (!info) return null;
  const f = (v: number) => fmtVal(v, a.def);
  const sd = side(a);
  const good = a.status === 'good' || (!sd && a.status !== 'bad' && a.status !== 'warn');
  const c = statusColor(t, good ? 'good' : a.status === 'bad' ? 'bad' : 'warn');
  const consequence = sd === 'low' ? info.low : sd === 'high' ? info.high : undefined;
  if (part === 'top') return (
    <View>
      <Sect title="Dove sei rispetto all’ottimale">
        <View style={{ backgroundColor: c + '18', borderRadius: 12, padding: 12, borderLeftWidth: 3, borderLeftColor: c }}>
          <Body bold>Il tuo valore: {f(mainValue(a))}</Body>
          <Body small style={{ marginTop: 2 }}>Ottimale: {info.optimal}</Body>
          <Body small muted style={{ marginTop: 2 }}>{info.basis}</Body>
          <Body small color={c} style={{ marginTop: 6 }}>
            {good ? 'Sei nella zona ottimale.' : sd === 'low' ? 'Sei sotto l’ottimale.' : sd === 'high' ? 'Sei sopra l’ottimale.' : 'Sei fuori dalla zona ottimale.'}
          </Body>
        </View>
      </Sect>
    </View>
  );
  return (
    <View>
      <Sect title="Cos’è"><Body small>{info.what}</Body></Sect>
      <Sect title="Perché conta"><Body small>{info.why}</Body></Sect>
      {!good && consequence && <Sect title="Cosa comporta così com’è" color={c}><Body small>{consequence}</Body></Sect>}
      {good ? (
        <Sect title="Come mantenerlo" color={t.positive}><Body small>{info.keep}</Body></Sect>
      ) : (
        <Sect title="Come migliorarlo" color={c}>
          {info.improve.map((x, i) => <Body key={i} small style={{ marginBottom: 3 }}>{i + 1}. {x}</Body>)}
        </Sect>
      )}
      {info.caution && <View style={{ flexDirection: 'row', gap: 6, marginTop: 10 }}><Icon name="alert" size={14} color={t.muted} /><Body small muted style={{ flex: 1 }}>{info.caution}</Body></View>}
    </View>
  );
}

export function Pressy({ onPress, children }: { onPress: () => void; children: React.ReactNode }) {
  return <Pressable onPress={onPress}>{children}</Pressable>;
}
