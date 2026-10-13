import { View } from 'react-native';
import { Text } from '@/components/T';

import { EnrollmentBox } from '@/components/market';
import { hasEnded } from '@/lib/enroll';
import { LpTag } from '@/components/network';
import { Body, Btn, Card, Empty, Item, Page, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { go } from '@/lib/nav';
import { useApp } from '@/store/app';
import { useNet } from '@/store/network';

const Section = ({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) => {
  const t = useTheme();
  return (
    <View style={{ marginTop: 16 }}>
      <Text style={{ color: t.text, fontSize: 17, fontWeight: '800' }}>{title}</Text>
      {hint ? <Body small muted style={{ marginBottom: 6 }}>{hint}</Body> : null}
      {children}
    </View>
  );
};

/** I tuoi servizi: tutto ciò che hai prenotato e pagato (psicologa, personal trainer, lezione di cucina, seminari...), con stato e fattura. */
export default function MyServices() {
  const t = useTheme();
  const me = useApp((s) => s.account.name);
  const enrollments = useNet((s) => s.enrollments);
  const seminars = useNet((s) => s.seminars);
  const providers = useNet((s) => s.providers);
  const participants = useNet((s) => s.participants);
  const now = Date.now();
  const mine = enrollments.filter((e) => e.host !== me);
  const upcoming = mine.filter((e) => e.status === 'enrolled' && !hasEnded(e, now)).sort((a, b) => a.startsAt - b.startsAt);
  const toConfirm = mine.filter((e) => e.status === 'enrolled' && hasEnded(e, now));
  const past = mine.filter((e) => e.status !== 'enrolled').sort((a, b) => b.startsAt - a.startsAt);
  const held = upcoming.reduce((a, e) => a + (e.held ? e.paid ?? e.price : 0), 0);
  const offered = seminars.filter((s) => s.host === me);
  const myService = providers.find((p) => p.name === me);
  return (
    <Page id="myServices" back title="I tuoi servizi">
      <Body muted>Tutto quello che hai prenotato e pagato: sedute, lezioni, seminari. Qui trovi date, fatture e puoi riprogrammare o disdire.</Body>
      <Card style={{ marginTop: 12 }}>
        <Row>
          <View style={{ flex: 1 }}><Body small muted>In programma</Body><Text style={{ color: t.text, fontSize: 22, fontWeight: '800' }}>{upcoming.length}</Text></View>
          <View style={{ flex: 1 }}><Body small muted>Da confermare</Body><Text style={{ color: toConfirm.length ? t.warn : t.text, fontSize: 22, fontWeight: '800' }}>{toConfirm.length}</Text></View>
          <View style={{ flex: 1 }}><Body small muted>LP bloccati</Body><Row gap={3} style={{ justifyContent: 'flex-start' }}><Text style={{ color: t.text, fontSize: 22, fontWeight: '800' }}>{held}</Text><LpTag size={16} /></Row></View>
        </Row>
      </Card>

      {mine.length === 0 ? (
        <Card style={{ marginTop: 12 }}><Empty text="Non hai ancora prenotato nulla. Trovi sedute, lezioni e seminari nel Marketplace." /><Btn style={{ marginTop: 10 }} title="Vai al Marketplace" onPress={() => go('lifenetwork')} /></Card>
      ) : null}
      {upcoming.length > 0 && <Section title="In programma" hint="I LifePoints restano bloccati fino alla fine di ogni sessione.">{upcoming.map((e) => <Card key={e.id}><EnrollmentBox e={e} /></Card>)}</Section>}
      {toConfirm.length > 0 && <Section title="Da confermare" hint="Conferma di aver partecipato: solo allora vengono accreditati a chi ti ha seguito.">{toConfirm.map((e) => <Card key={e.id}><EnrollmentBox e={e} /></Card>)}</Section>}
      {past.length > 0 && <Section title="Concluse">{past.map((e) => <Card key={e.id}><EnrollmentBox e={e} /></Card>)}</Section>}

      {(offered.length > 0 || myService) && (
        <Section title="Quello che offri tu" hint="Chi si è prenotato e quanto ha pagato lo vedi aprendo il servizio o il seminario.">
          <Card>
            {myService && <Item last={!offered.length} onPress={() => go('servicePage', { name: me })}><Row><View style={{ flex: 1 }}><Body bold>{myService.role}</Body><Body small muted>{(participants?.[`service:${me}`] ?? []).length} prenotati</Body></View></Row></Item>}
            {offered.map((s, i) => <Item key={s.id} last={i === offered.length - 1} onPress={() => go('seminarPage', { id: String(s.id) })}><Row><View style={{ flex: 1 }}><Body bold numberOfLines={1}>{s.title}</Body><Body small muted>{(participants?.[`seminar:${s.id}`] ?? []).length} iscritti</Body></View></Row></Item>)}
          </Card>
        </Section>
      )}
    </Page>
  );
}
