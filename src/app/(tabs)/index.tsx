import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { Body, Card, H, Label, Metric, Progress, Row, Screen } from '@/components/ui';
import { todayKey } from '@/lib/id';
import { financeScore, growthScore, healthScore, lifeScore, mindScore } from '@/lib/score';
import { useTheme } from '@/hooks/use-theme';
import { useStore } from '@/store';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Buongiorno' : h < 18 ? 'Buon pomeriggio' : 'Buonasera';
}

export default function Home() {
  const t = useTheme();
  const { name, tasks, goals, health, salary, txs, notes } = useStore();
  const score = lifeScore([
    healthScore(health[todayKey()]),
    mindScore(health),
    financeScore(salary, txs),
    growthScore(goals, tasks),
  ]);
  const open = tasks.filter((x) => !x.done);
  const today = health[todayKey()];

  return (
    <Screen>
      <Label>{new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}</Label>
      <Text style={{ color: t.text, fontSize: 30, fontWeight: '800', marginBottom: 16 }}>
        {greeting()}, {name}
      </Text>

      <Card onPress={() => router.push('/life')}>
        <Row>
          <View>
            <Metric big>{score ?? '—'}</Metric>
            <Body muted small>Life Score · tocca per il dettaglio</Body>
          </View>
        </Row>
        {score == null && <Body muted small style={{ marginTop: 8 }}>Registra sonno, umore, budget o obiettivi per calcolarlo.</Body>}
      </Card>

      <Card onPress={() => router.push('/plan')}>
        <H>Oggi</H>
        {open.length === 0 ? (
          <Body muted>Nessuna attività aperta. Aggiungine una dal Plan.</Body>
        ) : (
          open.slice(0, 4).map((x) => <Body key={x.id} style={{ paddingVertical: 4 }}>• {x.title}</Body>)
        )}
      </Card>

      {goals[0] && (
        <Card onPress={() => router.push('/plan')}>
          <Label>Obiettivo principale</Label>
          <Row><H>{goals[0].title}</H><Body muted>{goals[0].progress}%</Body></Row>
          <Progress value={goals[0].progress} />
        </Card>
      )}

      <Row style={{ alignItems: 'stretch' }}>
        <Card style={{ flex: 1 }} onPress={() => router.push('/health')}>
          <Label>Salute</Label>
          <Metric>{healthScore(today) ?? '—'}</Metric>
          <Body muted small>{today?.sleepHours != null ? `Sonno ${today.sleepHours}h` : 'Registra oggi'}</Body>
        </Card>
        <Card style={{ flex: 1 }} onPress={() => router.push('/finance')}>
          <Label>Finanze</Label>
          <Metric>{financeScore(salary, txs) ?? '—'}</Metric>
          <Body muted small>{salary ? 'Budget del mese' : 'Imposta lo stipendio'}</Body>
        </Card>
      </Row>

      <Card onPress={() => router.push('/notes')}>
        <Label>Note</Label>
        <Metric>{notes.length}</Metric>
        <Body muted small>note salvate</Body>
      </Card>
    </Screen>
  );
}
