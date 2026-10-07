import { View } from 'react-native';

import { Body, Btn, Card, Empty, Page, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { dayKey } from '@/lib/format';
import { Icon, iconMarkup } from '@/lib/icons';
import { useLife } from '@/store/life';
import { useNet } from '@/store/network';
import { toast } from '@/store/toast';

iconMarkup.booking = iconMarkup.plan;
iconMarkup.like = iconMarkup.heart;
iconMarkup.donation = iconMarkup.sparkle;
iconMarkup.contribution = iconMarkup.sparkle;
iconMarkup.vote = '<path d="M12 2l2.9 6.3 6.9.6-5.2 4.6 1.6 6.8L12 16.9l-6.2 3.4 1.6-6.8L2.2 8.9l6.9-.6z"/>';
iconMarkup.goal = '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>';
iconMarkup.follow = '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><path d="M18 8v6M15 11h6"/>';
iconMarkup.reminder = iconMarkup.bell;
iconMarkup.comment = iconMarkup.ai;

const colors: Record<string, string> = { booking: '#8fa4ff', like: '#ff5d7a', donation: '#e0c97b', goal: '#7be0b0', vote: '#e0c97b', contribution: '#e0c97b', follow: '#c9b6ff', reminder: '#ffb84f', comment: '#6ec9dd' };

export default function Notifications() {
  const t = useTheme();
  const net = useNet();
  const addEvents = useLife((s) => s.addEvents);
  const read = (id: number) => net.patch({ notifications: net.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) });
  return (
    <Page id="notificationsPage" title="Notifiche" back>
      <Body small muted style={{ marginBottom: 10 }}>Prenotazioni, mi piace, LifePoint donati, obiettivi raggiunti e altro.</Body>
      <Btn small ghost style={{ marginBottom: 14, alignSelf: 'flex-start' }} title="Segna tutte come lette" onPress={() => { net.patch({ notifications: net.notifications.map((n) => ({ ...n, read: true })) }); toast('Tutte le notifiche segnate come lette'); }} />
      {net.notifications.length === 0 ? <Card><Empty text="Nessuna notifica: qui vedrai prenotazioni, mi piace, LifePoint donati e altro." /></Card> : net.notifications.map((n) => {
        const c = colors[n.type] ?? '#8e98a8';
        return (
          <Card key={n.id} onPress={() => read(n.id)} style={n.urgent && !n.read ? { borderColor: '#5c2a2a' } : undefined}>
            <Row style={{ alignItems: 'flex-start' }}>
              <Row style={{ flex: 1, justifyContent: 'flex-start', alignItems: 'flex-start' }} gap={8}>
                {!n.read && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#5b8def', marginTop: 5 }} />}
                <View style={{ width: 26, height: 26, borderRadius: 9, backgroundColor: c + '22', alignItems: 'center', justifyContent: 'center' }}><Icon name={n.type} size={14} color={c} stroke={2} /></View>
                <Body small style={{ flex: 1 }}>{n.text}</Body>
              </Row>
              {n.urgent && <Body small color={t.danger}>Urgente</Body>}
            </Row>
            <Body small muted style={{ marginTop: 6 }}>{n.date}</Body>
            {n.type === 'booking' && !n.addedToCalendar && (
              <Btn small ghost style={{ marginTop: 8 }} title="Aggiungi al calendario" onPress={() => {
                addEvents(dayKey(), [{ time: n.slot ?? '--:--', title: `${n.service ?? 'Sessione'} con ${n.text.split(' ha')[0]}` }]);
                net.patch({ notifications: net.notifications.map((x) => (x.id === n.id ? { ...x, addedToCalendar: true, read: true } : x)) });
                toast('Aggiunta al calendario in Plan');
              }} />
            )}
            {n.type === 'booking' && n.addedToCalendar && <Body small color={t.positive} style={{ marginTop: 8 }}>✓ Aggiunta al calendario</Body>}
          </Card>
        );
      })}
    </Page>
  );
}
