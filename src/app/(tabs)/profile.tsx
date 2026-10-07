import { useState } from 'react';
import { View } from 'react-native';
import { UserAvatar } from '@/components/network';

import { Body, Btn, Card, H, Item, Metric, Page, Row, Sheet, Chev } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { go } from '@/lib/nav';
import { computeScores } from '@/lib/scores';
import { useApp } from '@/store/app';
import { useFin } from '@/store/finance';
import { useHealth } from '@/store/health';
import { useLife } from '@/store/life';
import { Pill } from '@/components/ui';

export default function Profile() {
  const t = useTheme();
  const { account, integrations, privacy, set } = useApp();
  const goals = useLife((s) => s.goals);
  const automations = useLife((s) => s.automations);
  useHealth((s) => s.series); useFin((s) => s.months);
  const [memory, setMemory] = useState(false);
  const sc = computeScores();
  const main = goals.slice().sort((a, b) => b.p - a.p)[0];
  void set;

  return (
    <Page id="profile" title="Profilo & Memory">
      <Card onPress={() => go('userProfile', { name: account.name })}>
        <Row style={{ justifyContent: 'flex-start' }}>
          <UserAvatar name={account.name} size={46} />
          <View style={{ flex: 1 }}>
            <H>{account.name}</H>
            <Body small muted>Il tuo profilo LifeNetwork · post, follower, voti, biglietto da visita</Body>
          </View>
          <Chev />
        </Row>
      </Card>
      <Card onPress={() => go('life')}>
        <Row>
          <View style={{ flex: 1 }}><H>La tua vita</H><Body small muted>Life Score, Health, Mind, Finance, Growth e altro</Body></View>
          <Metric>{sc.total ?? '—'}</Metric>
        </Row>
      </Card>
      <Card>
        <H>Cosa LifePilot sa di te</H>
        <Item><Body>Obiettivo principale · {main ? main.t : 'non ancora impostato'}</Body></Item>
        <Item><Body>Automazioni attive · {automations.filter((a) => a.on).length}</Body></Item>
        <Item last><Body>Preferenza · Risposte dirette e operative</Body></Item>
        <Btn small ghost style={{ marginTop: 10 }} title="Gestisci memoria" onPress={() => setMemory(true)} />
      </Card>
      <Card onPress={() => go('settings')}>
        <H>Settings</H>
        <Body small muted>Integrazioni, privacy, notifiche, aspetto · tocca per aprire</Body>
      </Card>
      <Card>
        <H>Moduli futuri</H>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{['Social', 'Community', 'Marketplace', 'Wallet', 'Investments', 'Travel', 'Translate', 'Voice Calls', 'Hardware'].map((x) => <Pill key={x} label={x} />)}</View>
        <Body small muted>Presenti nella mappa prodotto; richiedono backend, provider esterni e, per finanza/pagamenti, compliance dedicata.</Body>
      </Card>
      <Sheet visible={memory} title="Memory Control" onClose={() => setMemory(false)}>
        <Body>Qui puoi vedere, bloccare ed eliminare ogni informazione che LifePilot usa per personalizzare le risposte.</Body>
        <Item><Row><Body>Obiettivi personali</Body><Body bold>consentito</Body></Row></Item>
        <Item><Row><Body>Routine</Body><Body bold>consentito</Body></Row></Item>
        <Item><Row><Body>Salute</Body><Body bold>{integrations.Health ? 'collegato' : 'non collegato'}</Body></Row></Item>
        <Item last><Row><Body>Finanze</Body><Body bold>{privacy['Dati finanziari'] ? 'collegato' : 'non collegato'}</Body></Row></Item>
      </Sheet>
      <View style={{ height: 1, backgroundColor: t.bg }} />
    </Page>
  );
}
