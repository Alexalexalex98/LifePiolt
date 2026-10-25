import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Spark } from '@/components/charts';
import { Ring } from '@/components/fitness/kit';
import { LpTag } from '@/components/network';
import { LifeScoreSheet } from '@/components/scoreSheet';
import { Text } from '@/components/T';
import { Body, Card, H, Page, Progress, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { type Analysis, type Domain } from '@/lib/analytics';
import { useDashboard } from '@/lib/analyticsData';
import { formatCHF } from '@/lib/format';
import { Icon } from '@/lib/icons';
import { go } from '@/lib/nav';
import { taskIsDone, useLife } from '@/store/life';
import { useNet } from '@/store/network';

const PILLARS: { id: Domain; key: 'salute' | 'mente' | 'finanza' | 'crescita'; title: string; icon: string; color: string; page: string; empty: string }[] = [
  { id: 'salute', key: 'salute', title: 'Salute', icon: 'lifehealth', color: '#5fd39a', page: 'lifehealth', empty: 'Collega Apple Salute o segna sonno e passi per vedere i dati.' },
  { id: 'mente', key: 'mente', title: 'Mente', icon: 'smile', color: '#c9b6ff', page: 'mood', empty: 'Segna il tuo umore per qualche giorno.' },
  { id: 'finanza', key: 'finanza', title: 'Finanze', icon: 'lifefinance', color: '#ffd479', page: 'lifefinance', empty: 'Importa un estratto conto per vedere entrate e spese.' },
  { id: 'crescita', key: 'crescita', title: 'Crescita', icon: 'lifetask', color: '#8fb3ff', page: 'lifetask', empty: 'Aggiungi obiettivi e task: qui vedi quanto avanzi.' },
];
const num = (n: number, dec: number) => (Math.round(n * 10 ** dec) / 10 ** dec).toFixed(dec).replace('.', ',');

/** La tua vita in una pagina: il Life Score con l'andamento, le quattro sezioni con i dati veri che lo compongono, e il tuo spazio (note, file, task, LifePoints). */
export default function Life() {
  const t = useTheme();
  const d = useDashboard();
  const life = useLife();
  const lp = useNet((n) => n.lifePoints);
  const [sheet, setSheet] = useState(false);
  const total = d.scores.total;
  const spark = d.lifeSeries.slice(-30).map((p) => p.v);
  const activeTasks = life.tasks.filter((x) => !taskIsDone(x)).length;
  const goalsDone = life.goals.filter((g) => g.p >= 100).length;
  const line = (a: Analysis) => {
    const good = a.trend === 'flat' ? null : (a.trend === 'up') === (a.def.better !== 'down');
    const col = good === null ? t.muted : good ? t.positive : t.warn;
    return (
      <Row key={a.def.id} style={{ marginTop: 6 }}>
        <Body small muted style={{ flex: 1 }}>{tl(a.def.label)}</Body>
        <Text style={{ color: t.text, fontWeight: '700', fontSize: 14 }}>{`${num(a.avg7, a.def.dec)}${a.def.unit && a.def.unit.length <= 4 ? ` ${a.def.unit}` : ''}`}</Text>
        <Icon name={a.trend === 'up' ? 'arrow-up' : a.trend === 'down' ? 'arrow-down' : 'minus'} size={13} color={col} />
      </Row>
    );
  };
  const last = <T,>(arr: T[]) => arr[arr.length - 1];
  const lastNote = last(life.notes)?.text?.split('\n')[0]?.slice(0, 60);
  const lastFile = last(life.drive)?.n;

  return (
    <Page id="life" title="La tua vita" back>
      <Card onPress={() => setSheet(true)} accent="#8fa4ff">
        <Row gap={16}>
          <Ring size={112} stroke={12} value={total != null ? total / 100 : 0} big={total != null ? String(total) : '—'} small="Life Score" color="#8fa4ff" />
          <View style={{ flex: 1 }}>
            <H style={{ marginBottom: 2 }}>{total == null ? 'Ancora pochi dati' : total >= 75 ? 'Stai andando bene' : total >= 50 ? 'Una buona base' : 'Si può crescere'}</H>
            {d.lifeDelta != null ? <Text style={{ color: d.lifeDelta >= 0 ? t.positive : t.warn, fontWeight: '700' }}>{`${d.lifeDelta >= 0 ? '+' : ''}${d.lifeDelta} sulla settimana scorsa`}</Text> : <Body small muted>Serve qualche giorno in più per confrontare le settimane.</Body>}
            <View style={{ marginTop: 6 }}><Spark data={spark} w={150} h={36} color="#8fa4ff" /></View>
            <Body small muted style={{ marginTop: 2 }}>{tl('Calcolato su {0} giorni di dati · tocca per il dettaglio', d.dataDays)}</Body>
          </View>
        </Row>
      </Card>

      <Row style={{ flexWrap: 'wrap', alignItems: 'stretch' }} gap={10}>
        {PILLARS.map((p) => {
          const score = d.scores[p.key];
          const list = d.list.filter((a) => a.def.domain === p.id).sort((a, b) => b.n - a.n).slice(0, 3);
          return (
            <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={`${tl(p.title)}: ${score ?? 'nessun dato'}`} onPress={() => go(p.page)} style={{ flexBasis: '47%', flexGrow: 1 }}>
              <View style={{ backgroundColor: t.card, borderRadius: 20, padding: 14, borderTopWidth: 3, borderTopColor: p.color, minHeight: 150 }}>
                <Row gap={8} style={{ justifyContent: 'flex-start' }}>
                  <Icon name={p.icon} size={16} color={p.color} stroke={2.2} />
                  <Text style={{ color: p.color, fontWeight: '800', fontSize: 14, flex: 1 }}>{tl(p.title)}</Text>
                  <Text style={{ color: t.text, fontWeight: '800', fontSize: 22 }}>{score ?? '—'}</Text>
                </Row>
                <View style={{ marginVertical: 8 }}><Progress value={score ?? 0} color={p.color} /></View>
                {list.length ? list.map(line) : <Body small muted>{tl(p.empty)}</Body>}
              </View>
            </Pressable>
          );
        })}
      </Row>

      <H style={{ marginTop: 6 }}>Il tuo spazio</H>
      <Row style={{ flexWrap: 'wrap', alignItems: 'stretch' }} gap={10}>
        {[
          { k: 'notes', title: 'LifeNotes', icon: 'note', color: '#e0c97b', big: String(life.notes.length), sub: lastNote ?? 'Nessuna nota ancora', page: 'lifenotes' },
          { k: 'drive', title: 'LifeDrive', icon: 'lifedrive', color: '#7bb8e0', big: String(life.drive.length), sub: lastFile ?? 'Nessun file ancora', page: 'lifedrive' },
          { k: 'task', title: 'LifeTask', icon: 'lifetask', color: '#8fb3ff', big: String(activeTasks), sub: goalsDone || life.goals.length ? tl('task attivi · {0} obiettivi su {1} raggiunti', goalsDone, life.goals.length) : 'task attivi', page: 'lifetask' },
          { k: 'lp', title: 'LifePoints', icon: 'coin', color: '#b79bff', big: formatCHF(lp), sub: 'il tuo saldo', page: 'lifepointsPage' },
        ].map((x) => (
          <Pressable key={x.k} accessibilityRole="button" accessibilityLabel={`${x.title}: ${x.big}`} onPress={() => go(x.page)} style={{ flexBasis: '47%', flexGrow: 1 }}>
            <View style={{ backgroundColor: t.card, borderRadius: 20, padding: 14, borderLeftWidth: 3, borderLeftColor: x.color, minHeight: 104 }}>
              <Row gap={8} style={{ justifyContent: 'flex-start' }}><Icon name={x.icon} size={15} color={x.color} stroke={2.2} /><Text style={{ color: x.color, fontWeight: '800', fontSize: 13 }}>{x.title}</Text></Row>
              <Row gap={4} style={{ justifyContent: 'flex-start', marginTop: 4 }}><Text style={{ color: t.text, fontWeight: '800', fontSize: 24 }}>{x.big}</Text>{x.k === 'lp' ? <LpTag size={15} /> : null}</Row>
              <Body small muted numberOfLines={2}>{tl(x.sub)}</Body>
            </View>
          </Pressable>
        ))}
      </Row>
      <LifeScoreSheet visible={sheet} onClose={() => setSheet(false)} />
    </Page>
  );
}
