import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { UserAvatar } from '@/components/network';
import { Body, Btn, Card, Page, Row } from '@/components/ui';
import { t as tl } from '@/i18n/core';
import { dayKey } from '@/lib/format';
import { go, goBack } from '@/lib/nav';
import { useApp } from '@/store/app';
import { useChat } from '@/store/chat';
import { useLife } from '@/store/life';
import { useNet } from '@/store/network';
import { toast } from '@/store/toast';

/** Una richiesta o prenotazione ricevuta: la notifica apre se stessa, con chi, cosa e quando, e le azioni per rispondere. */
export default function RequestDetail() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const me = useApp((s) => s.account.name);
  const net = useNet();
  const addEvents = useLife((s) => s.addEvents);
  const n = net.notifications.find((x) => String(x.id) === id);
  if (!n) return <Page id="requestDetail" back title="Richiesta"><Card><Body muted>{tl('Questa richiesta non c’è più.')}</Body></Card></Page>;
  const who = n.text.split(' ha ')[0];
  const patch = (p: Partial<typeof n>) => net.patch({ notifications: net.notifications.map((x) => (x.id === n.id ? { ...x, ...p } : x)) });
  if (!n.read) patch({ read: true });
  return (
    <Page id="requestDetail" back title="Richiesta">
      <Card>
        <Row gap={12}>
          <UserAvatar name={who} size={48} />
          <View style={{ flex: 1 }}>
            <Body bold>{who}</Body>
            <Body small muted>{n.date}</Body>
          </View>
        </Row>
        <Body style={{ marginTop: 12 }}>{n.text}</Body>
        {n.service ? <Body small muted style={{ marginTop: 8 }}>{tl('Servizio')}: {n.service}</Body> : null}
        {n.slot ? <Body small muted>{tl('Orario')}: {n.slot}</Body> : null}
      </Card>
      <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginTop: 12 }} gap={8}>
        {n.slot && !n.addedToCalendar ? <Btn icon="plan" title="Aggiungi al calendario" onPress={() => { addEvents(dayKey(), [{ time: n.slot ?? '--:--', title: `${n.service ?? 'Sessione'} con ${who}` }]); patch({ addedToCalendar: true }); toast('Aggiunta al calendario in Plan'); }} /> : null}
        {n.addedToCalendar ? <Body small color="#4fb58a">{tl('Aggiunta al calendario')}</Body> : null}
        <Btn ghost icon="comment" title={tl('Scrivi a {0}', who.split(' ')[0])} onPress={() => go('conversationPage', { id: useChat.getState().ensureDm(who, me) })} />
      </Row>
      <Btn ghost small style={{ marginTop: 16 }} title="Indietro alle notifiche" onPress={goBack} />
    </Page>
  );
}
