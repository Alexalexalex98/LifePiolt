import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Body, Btn, Card, Empty, Page, Press, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { confirmDelete } from '@/lib/confirm';
import { dayKey } from '@/lib/format';
import { Icon } from '@/lib/icons';
import { go } from '@/lib/nav';
import { groupNotifs, kindOf, KIND_ORDER, KINDS, unreadByKind, type KindId, type NotifGroup } from '@/lib/notifyKinds';
import { useApp } from '@/store/app';
import { useLife } from '@/store/life';
import { useNet, type Notif } from '@/store/network';
import { toast } from '@/store/toast';

type Filter = 'all' | KindId;

/** Apre la schermata collegata alla notifica (richiesta di servizio, seminario, ...). */
function openTarget(n: Notif, me: string, hasMyService: boolean) {
  const [what, id] = (n.ref ?? '').split(':');
  if (what === 'service' && id) return go('servicePage', { name: id });
  if (what === 'seminar' && id) return go('seminarPage', { id });
  if (kindOf(n) === 'servizio') return hasMyService ? go('servicePage', { name: me }) : go('lifenetwork');
  if (kindOf(n) === 'seminario') return go('lifenetwork');
  if (kindOf(n) === 'messaggio') return go('messagesPage');
  if (kindOf(n) === 'lifepoints') return go('lifepointsPage');
  if (kindOf(n) === 'promemoria') return go('plan');
  return go('lifenetwork');
}

export default function Notifications() {
  const t = useTheme();
  const net = useNet();
  const me = useApp((s) => s.account.name);
  const addEvents = useLife((s) => s.addEvents);
  const [filter, setFilter] = useState<Filter>('all');

  const list = net.notifications;
  const counts = useMemo(() => {
    const total: Record<string, number> = {};
    for (const n of list) total[kindOf(n)] = (total[kindOf(n)] ?? 0) + 1;
    return total;
  }, [list]);
  const unread = useMemo(() => unreadByKind(list), [list]);
  const totalUnread = list.filter((n) => !n.read).length;
  const hasMyService = net.providers.some((p) => p.name === me);

  const markRead = (ids: number[]) => net.patch({ notifications: net.notifications.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n)) });
  const remove = (g: NotifGroup<Notif>) => {
    const removed = g.items;
    const order = net.notifications.map((n) => n.id);
    confirmDelete(g.items.length > 1 ? `queste ${g.items.length} notifiche` : 'questa notifica',
      () => useNet.getState().patch({ notifications: useNet.getState().notifications.filter((n) => !g.ids.includes(n.id)) }),
      () => useNet.getState().patch({ notifications: [...removed, ...useNet.getState().notifications].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id)) }),
      { title: 'Eliminare la notifica?', undoMessage: 'Notifica eliminata' });
  };

  const shown = filter === 'all' ? list : list.filter((n) => kindOf(n) === filter);
  const byKind = useMemo(() => {
    const m = new Map<KindId, Notif[]>();
    for (const n of shown) { const k = kindOf(n); m.set(k, [...(m.get(k) ?? []), n]); }
    return m;
  }, [shown]);
  const kinds = KIND_ORDER.filter((k) => byKind.has(k));

  const renderGroup = (g: NotifGroup<Notif>) => {
    const info = KINDS[g.kind];
    const n = g.first;
    const isService = g.kind === 'servizio';
    return (
      <Card key={g.key} onPress={() => markRead(g.ids)} accent={isService ? info.color : undefined} style={isService && !g.read ? { borderColor: info.color + '88' } : undefined}>
        <Row style={{ alignItems: 'flex-start' }}>
          <Row style={{ flex: 1, justifyContent: 'flex-start', alignItems: 'flex-start' }} gap={8}>
            {!g.read && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: info.color, marginTop: 7 }} />}
            <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: info.color + '26', alignItems: 'center', justifyContent: 'center' }}><Icon name={info.icon} size={16} color={info.color} stroke={2} /></View>
            <View style={{ flex: 1, gap: 4 }}>
              {isService && <View style={{ alignSelf: 'flex-start', backgroundColor: info.color, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}><Body small bold color="#fff">Servizio</Body></View>}
              <Body small bold={!g.read}>{g.text}</Body>
              {g.items.length > 1 && g.actors.length > 1 && <Body small muted>{g.items.length} notifiche raggruppate</Body>}
            </View>
          </Row>
          <View style={{ alignItems: 'flex-end', gap: 6 }}>
            {n.urgent && !g.read && <Body small color={t.danger}>Urgente</Body>}
            <Press onPress={() => remove(g)} accessibilityLabel="Elimina notifica" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><Icon name="trash" size={16} color={t.muted} stroke={2} /></Press>
          </View>
        </Row>
        <Body small muted style={{ marginTop: 6 }}>{n.date}{isService && n.service ? ` · ${n.service}` : ''}{isService && n.slot ? ` · ${n.slot}` : ''}</Body>
        {isService && (
          <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', marginTop: 8 }} gap={8}>
            <Btn small icon="arrow-right" title="Apri richiesta" onPress={() => { markRead(g.ids); openTarget(n, me, hasMyService); }} />
            {n.type === 'booking' && !n.addedToCalendar && n.slot && (
              <Btn small ghost icon="plan" title="Aggiungi al calendario" onPress={() => {
                addEvents(dayKey(), [{ time: n.slot ?? '--:--', title: `${n.service ?? 'Sessione'} con ${n.text.split(' ha')[0]}` }]);
                net.patch({ notifications: net.notifications.map((x) => (x.id === n.id ? { ...x, addedToCalendar: true, read: true } : x)) });
                toast('Aggiunta al calendario in Plan');
              }} />
            )}
          </Row>
        )}
        {isService && n.addedToCalendar && <Body small color={t.positive} style={{ marginTop: 8 }}>Aggiunta al calendario</Body>}
      </Card>
    );
  };

  const chip = (id: Filter, label: string, icon: string, color: string, n: number) => {
    const on = filter === id;
    return (
      <Press key={id} onPress={() => setFilter(id)} selected={on} accessibilityLabel={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: on ? t.text : t.chip }}>
        <Icon name={icon} size={14} color={on ? t.onText : color} stroke={2.1} />
        <Body small bold color={on ? t.onText : t.text}>{label}</Body>
        {n > 0 && <View style={{ minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, backgroundColor: on ? t.onText : color, alignItems: 'center', justifyContent: 'center' }}><Body small bold color={on ? t.text : '#fff'} style={{ fontSize: 11, lineHeight: 14 }}>{n}</Body></View>}
      </Press>
    );
  };

  return (
    <Page id="notificationsPage" title="Notifiche" back>
      <Body small muted style={{ marginBottom: 10 }}>Servizi, promemoria, seminari, messaggi, mi piace, LifePoints e altro, ognuno con il suo stile.</Body>
      <Row style={{ justifyContent: 'flex-start', marginBottom: 12 }} gap={8}>
        <Btn small ghost icon="check" title="Segna tutte come lette" disabled={totalUnread === 0} onPress={() => { net.patch({ notifications: net.notifications.map((n) => ({ ...n, read: true })) }); toast('Tutte le notifiche segnate come lette'); }} />
      </Row>
      {list.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14, flexGrow: 0 }} contentContainerStyle={{ gap: 8, paddingEnd: 8 }}>
          {chip('all', 'Tutte', 'bell', t.muted, totalUnread)}
          {KIND_ORDER.filter((k) => counts[k]).map((k) => chip(k, KINDS[k].label, KINDS[k].icon, KINDS[k].color, unread[k]))}
        </ScrollView>
      )}
      {list.length === 0 ? <Card><Empty text="Nessuna notifica: qui vedrai richieste dei tuoi servizi, promemoria, mi piace, LifePoint donati e altro." /></Card> : shown.length === 0 ? <Card><Empty text="Nessuna notifica in questa categoria." /></Card> : kinds.map((k) => {
        const info = KINDS[k];
        const groups = groupNotifs(byKind.get(k) ?? []);
        return (
          <View key={k} style={{ marginBottom: 6 }}>
            <Row style={{ justifyContent: 'flex-start', marginBottom: 8, marginTop: 4 }} gap={8}>
              <Icon name={info.icon} size={16} color={info.color} stroke={2.1} />
              <Body bold color={info.color}>{k === 'servizio' ? 'In evidenza · Servizi' : info.label}</Body>
              {unread[k] > 0 && <View style={{ minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, backgroundColor: info.color, alignItems: 'center', justifyContent: 'center' }}><Body small bold color="#fff" style={{ fontSize: 11, lineHeight: 14 }}>{unread[k]}</Body></View>}
            </Row>
            {groups.map(renderGroup)}
          </View>
        );
      })}
    </Page>
  );
}
