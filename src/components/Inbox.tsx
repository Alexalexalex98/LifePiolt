import { Pressable, Text, View } from 'react-native';

import { UserAvatar } from '@/components/network';
import { Body, Card, Empty, Row } from '@/components/ui';
import { go } from '@/lib/nav';
import { useApp } from '@/store/app';
import { useNet } from '@/store/network';

export function Inbox() {
  const me = useApp((s) => s.account.name);
  const net = useNet();
  const items: { sort: string; node: React.ReactNode }[] = [];
  Object.keys(net.conversations).forEach((name) => {
    const msgs = net.conversations[name];
    const last = msgs[msgs.length - 1];
    const unread = !!last && last.from !== me && net.convSeen[name] !== msgs.length;
    items.push({ sort: last?.date ?? '', node: (
      <Card key={'d' + name} onPress={() => go('conversationPage', { type: 'dm', key: name })}>
        <Row>
          <Row style={{ justifyContent: 'flex-start', flex: 1 }} gap={10}><UserAvatar name={name} size={38} /><View style={{ flex: 1 }}><Body bold>{name}</Body><Body small muted numberOfLines={1}>{last?.text ?? ''}</Body></View></Row>
          {unread ? <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: '#5b8def' }} /> : null}
        </Row>
      </Card>
    ) });
  });
  net.groups.forEach((g) => {
    const last = g.msgs[g.msgs.length - 1];
    const unread = !!last && last.from !== me && net.groupSeen[g.id] !== g.msgs.length;
    items.push({ sort: last?.date ?? '', node: (
      <Card key={'g' + g.id} onPress={() => go('conversationPage', { type: 'group', key: String(g.id) })}>
        <Row>
          <Row style={{ justifyContent: 'flex-start', flex: 1 }} gap={10}>
            <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#5b8def33', alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 16 }}>👥</Text></View>
            <View style={{ flex: 1 }}><Body bold>{g.name}</Body><Body small muted numberOfLines={1}>{last ? `${last.from}: ${last.text}` : `${g.members.length} membri`}</Body></View>
          </Row>
          {unread ? <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: '#5b8def' }} /> : null}
        </Row>
      </Card>
    ) });
  });
  items.sort((a, b) => b.sort.localeCompare(a.sort));
  if (!items.length) return <Card><Empty text="Nessun messaggio ancora: scrivi a qualcuno dal suo profilo." /></Card>;
  return <>{items.map((x) => x.node)}</>;
}
void Pressable;
