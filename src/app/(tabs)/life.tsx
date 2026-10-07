import { useState } from 'react';
import { View } from 'react-native';

import { LifeScoreSheet } from '@/components/scoreSheet';
import { Body, Card, H, Metric, Page, Row, Tag } from '@/components/ui';
import { go, goBack } from '@/lib/nav';
import { computeScores } from '@/lib/scores';
import { useFin } from '@/store/finance';
import { useHealth } from '@/store/health';
import { useLife } from '@/store/life';
import { LpTag } from '@/components/network';
import { formatCHF } from '@/lib/format';
import { useNet } from '@/store/network';

export default function Life() {
  const life = useLife();
  useHealth((s) => s.series); useFin((s) => s.months);
  const [sheet, setSheet] = useState(false);
  const lp = useNet((n) => n.lifePoints);
  const sc = computeScores();
  void goBack;
  return (
    <Page id="life" title="La tua vita" back>
      <Card onPress={() => setSheet(true)} style={{ alignItems: 'center' }}>
        <Body small muted>Life Score</Body>
        <Metric big>{sc.total ?? '—'}</Metric>
        <Body small muted style={{ marginTop: 6 }}>tocca per il dettaglio</Body>
      </Card>
      <Row style={{ alignItems: 'stretch' }} gap={10}>
        <Card style={{ flex: 1 }} onPress={() => go('lifehealth')}><H>Health</H><Metric>{sc.health ?? '—'}</Metric><Body small muted>Sonno · HRV · attività · stress</Body></Card>
        <Card style={{ flex: 1 }} onPress={() => go('lifehealth')}><H>Mind</H><Metric>{sc.mind ?? '—'}</Metric><Body small muted>Umore · journal · mindfulness</Body></Card>
      </Row>
      <Row style={{ alignItems: 'stretch' }} gap={10}>
        <Card style={{ flex: 1 }} onPress={() => go('lifefinance')}><H>Finance</H><Metric>{sc.finance ?? '—'}</Metric><Body small muted>Budget · cash flow · obiettivi</Body></Card>
        <Card style={{ flex: 1 }} onPress={() => go('plan')}><H>Growth</H><Metric>{sc.growth ?? '—'}</Metric><Body small muted>Avanzamento sui tuoi obiettivi</Body></Card>
      </Row>
      <Card onPress={() => go('lifenotes')}><H>LifeNotes</H><Metric>{life.notes.length}</Metric><Body small muted>note salvate · tocca per aprire</Body></Card>
      <Card onPress={() => go('lifedrive')}><H>LifeDrive</H><Metric>{life.drive.length}</Metric><Body small muted>file organizzati dall'AI · tocca per aprire</Body></Card>
      <Card onPress={() => go('lifepointsPage')}><H>LifePoints</H><Row style={{ justifyContent: 'flex-start' }} gap={4}><Metric>{formatCHF(lp)}</Metric><LpTag size={15} /></Row><Body small muted>tocca per il resoconto</Body></Card>
      <LifeScoreSheet visible={sheet} onClose={() => setSheet(false)} />
    </Page>
  );
}
void Tag;
