import { router } from 'expo-router';
import { View } from 'react-native';

import { Body, Card, Label, Metric, Row, Screen } from '@/components/ui';
import { todayKey } from '@/lib/id';
import { financeScore, growthScore, healthScore, lifeScore, mindScore } from '@/lib/score';
import { useStore } from '@/store';

export default function Life() {
  const { tasks, goals, health, salary, txs, notes } = useStore();
  const h = healthScore(health[todayKey()]);
  const m = mindScore(health);
  const f = financeScore(salary, txs);
  const g = growthScore(goals, tasks);
  const score = lifeScore([h, m, f, g]);

  return (
    <Screen title="La tua vita">
      <Card style={{ alignItems: 'center' }}>
        <Body muted small>Life Score</Body>
        <Metric big>{score ?? '—'}</Metric>
        <Body muted small style={{ textAlign: 'center', marginTop: 6 }}>
          Media dei punteggi per cui hai inserito dei dati.
        </Body>
      </Card>

      <Row style={{ alignItems: 'stretch' }}>
        <Card style={{ flex: 1 }} onPress={() => router.push('/health')}>
          <Label>Health</Label><Metric>{h ?? '—'}</Metric><Body muted small>Sonno · passi</Body>
        </Card>
        <Card style={{ flex: 1 }} onPress={() => router.push('/health')}>
          <Label>Mind</Label><Metric>{m ?? '—'}</Metric><Body muted small>Umore 7 giorni</Body>
        </Card>
      </Row>
      <Row style={{ alignItems: 'stretch' }}>
        <Card style={{ flex: 1 }} onPress={() => router.push('/finance')}>
          <Label>Finance</Label><Metric>{f ?? '—'}</Metric><Body muted small>Budget del mese</Body>
        </Card>
        <Card style={{ flex: 1 }} onPress={() => router.push('/plan')}>
          <Label>Growth</Label><Metric>{g ?? '—'}</Metric><Body muted small>Obiettivi e task</Body>
        </Card>
      </Row>

      <Card onPress={() => router.push('/notes')}>
        <Label>LifeNotes</Label>
        <View><Metric>{notes.length}</Metric><Body muted small>note salvate · tocca per aprire</Body></View>
      </Card>
    </Screen>
  );
}
