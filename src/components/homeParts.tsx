import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { MetricSheet, statusColor, scoreStatus } from '@/components/dashboard';
import { Body, Btn, Card, Chev, Item, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { fmtVal, type Analysis, type Correlation, type Domain } from '@/lib/analytics';
import { domainLabel } from '@/lib/analyticsData';
import { Icon } from '@/lib/icons';
import { go } from '@/lib/nav';
import { useMoodData } from '@/lib/moodContext';
import { todayStr } from '@/lib/analytics';
import { moodOptions, useHealth } from '@/store/health';
import { toast } from '@/store/toast';
import { scoreInfo } from '@/data/metricInfo';

/** Check-in dell'umore: la prima cosa che si vede, finché non è stato fatto oggi. */
export function MoodCheckIn() {
  const t = useTheme();
  const moods = useHealth((s) => s.moods);
  const logMood = useHealth((s) => s.logMood);
  const { report } = useMoodData();
  const today = todayStr();
  const done = moods.find((m) => m.day === today);
  const top = report.factors.find((f) => f.sig);
  if (done) {
    return (
      <Card onPress={() => go('mood')} style={{ marginTop: 10 }}>
        <Row>
          <Row style={{ justifyContent: 'flex-start', flex: 1 }} gap={10}>
            <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: t.accent + '25', alignItems: 'center', justifyContent: 'center' }}><Icon name="smile" size={19} color={t.accent} /></View>
            <View style={{ flex: 1 }}>
              <Body bold>Oggi: {done.mood}</Body>
              <Body small muted numberOfLines={2}>{top ? top.sentence : 'Tocca per vedere come cambia il tuo umore e cosa lo influenza.'}</Body>
            </View>
          </Row>
          <Chev />
        </Row>
      </Card>
    );
  }
  return (
    <Card style={{ marginTop: 10, borderColor: t.accent, borderWidth: 1.5 }}>
      <Body bold style={{ fontSize: 17, marginBottom: 2 }}>Come ti senti oggi?</Body>
      <Body small muted style={{ marginBottom: 10 }}>Un tocco, 5 secondi: lo confronto con meteo, impegni, sonno e spese.</Body>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {moodOptions.map(([m, c]) => (
          <Pressable key={m} onPress={() => { logMood(m); toast('Umore registrato: ' + m); }} style={{ width: '31%', alignItems: 'center', paddingVertical: 12, borderRadius: 14, backgroundColor: t.tile, borderWidth: 1, borderColor: t.navBorder }} accessibilityRole="button" accessibilityLabel={`Mi sento ${m}`}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c, marginBottom: 6 }} /><Body small>{m}</Body>
          </Pressable>
        ))}
      </View>
    </Card>
  );
}

/** Dettaglio di un'area (Salute, Mente...): cos'è, come si legge, e i suoi indicatori toccabili. */
export function DomainSheet({ domain, list, onClose }: { domain: Exclude<Domain, 'contesto'> | null; list: Analysis[]; onClose: () => void }) {
  const t = useTheme();
  const [metric, setMetric] = useState<Analysis | null>(null);
  if (!domain) return <Sheet visible={false} title="" onClose={onClose}><View /></Sheet>;
  const items = list.filter((a) => a.def.domain === domain);
  const info = scoreInfo[domain];
  return (
    <>
      <Sheet visible={!metric} title={domainLabel[domain]} onClose={onClose}>
        <Body small>{info.what}</Body>
        <View style={{ backgroundColor: t.accent + '1f', borderRadius: 12, padding: 10, marginVertical: 10 }}><Body small>Riferimento: {info.optimal}</Body></View>
        {items.length === 0 ? <Body small muted>Nessun dato per quest’area. Aggiungine per vedere l’analisi.</Body> : items.map((a, i) => (
          <Item key={a.def.id} last={i === items.length - 1} onPress={() => setMetric(a)}>
            <Row><View style={{ flex: 1 }}><Body bold>{a.def.label}</Body><Body small muted>Ottimale: {a.def.target != null ? fmtVal(a.def.target, a.def) : a.def.range ? `${a.def.range[0]}–${a.def.range[1]}` : 'vedi dettagli'}</Body></View>
              <Text style={{ color: statusColor(t, a.status), fontWeight: '800' }}>{fmtVal(a.def.period === 'day' ? a.avg7 : a.latest.v, a.def)}</Text><Chev /></Row>
          </Item>
        ))}
        <Body bold style={{ marginTop: 12 }}>Come migliorarla</Body>
        {info.improve.map((x, i) => <Body key={i} small style={{ marginTop: 3 }}>{i + 1}. {x}</Body>)}
      </Sheet>
      <MetricSheet a={metric} onClose={() => setMetric(null)} />
    </>
  );
}

const rWord = (r: number) => { const a = Math.abs(r); return a >= 0.7 ? 'forte' : a >= 0.5 ? 'media' : 'moderata'; };

/** Spiegazione di un legame tra due dati. */
export function CorrelationSheet({ c, onClose, onOpen }: { c: Correlation | null; onClose: () => void; onOpen: (id: string) => void }) {
  if (!c) return <Sheet visible={false} title="" onClose={onClose}><View /></Sheet>;
  return (
    <Sheet visible title="Cosa influenza cosa" onClose={onClose}>
      <Body bold>{c.sentence}</Body>
      <Body small muted style={{ marginTop: 8 }}>Correlazione {rWord(c.r)} ({c.r > 0 ? 'vanno nella stessa direzione' : 'vanno in direzioni opposte'}), calcolata su {c.n} giorni{c.lag ? ' (con un giorno di scarto)' : ''}. È una associazione, non una prova che uno causi l’altro: possono muoversi insieme per un terzo motivo.</Body>
      <Body bold style={{ marginTop: 12, marginBottom: 6 }}>Guarda i due dati</Body>
      <Row gap={8}><Btn small ghost style={{ flex: 1 }} title={c.a.label} onPress={() => { onClose(); onOpen(c.a.id); }} /><Btn small ghost style={{ flex: 1 }} title={c.b.label} onPress={() => { onClose(); onOpen(c.b.id); }} /></Row>
    </Sheet>
  );
}

export { scoreStatus };
