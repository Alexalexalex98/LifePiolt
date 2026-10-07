import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';

import { UserAvatar, openSheet } from '@/components/network';
import { Body, Btn, Input, Page, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { weekdayShortDate } from '@/lib/format';
import { useApp } from '@/store/app';
import { useNet, type Msg } from '@/store/network';

export default function Conversation() {
  const t = useTheme();
  const { type, key } = useLocalSearchParams<{ type?: string; key?: string }>();
  const me = useApp((s) => s.account.name);
  const net = useNet();
  const [text, setText] = useState('');
  const list = useRef<FlatList<Msg>>(null);
  const isGroup = type === 'group';
  const group = isGroup ? net.groups.find((g) => String(g.id) === key) : undefined;
  const name = key ?? '';
  const msgs: Msg[] = isGroup ? group?.msgs ?? [] : net.conversations[name] ?? [];

  // segna come letta
  useEffect(() => {
    if (isGroup && group) useNet.setState((s) => ({ groupSeen: { ...s.groupSeen, [group.id]: group.msgs.length } }));
    if (!isGroup && name) useNet.setState((s) => ({ convSeen: { ...s.convSeen, [name]: (s.conversations[name] ?? []).length } }));
  }, [isGroup, group?.id, group?.msgs.length, name, net.conversations[name]?.length]);

  function send() {
    const v = text.trim(); if (!v) return;
    setText('');
    const m: Msg = { from: me, text: v, date: weekdayShortDate() };
    if (isGroup && group) net.patch({ groups: net.groups.map((g) => (g.id === group.id ? { ...g, msgs: [...g.msgs, m] } : g)) });
    else net.patch({ conversations: { ...net.conversations, [name]: [...(net.conversations[name] ?? []), m] } });
  }

  return (
    <Page id="conversationPage" back scroll={false}>
      <Row style={{ marginVertical: 10 }}>
        <Row style={{ justifyContent: 'flex-start', flex: 1 }} gap={10}>
          {isGroup ? <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#5b8def33', alignItems: 'center', justifyContent: 'center' }}><Text>👥</Text></View> : <UserAvatar name={name} size={36} />}
          <View style={{ flex: 1 }}><Body bold style={{ fontSize: 16 }}>{isGroup ? group?.name : name}</Body>{isGroup && <Body small muted numberOfLines={1}>{group?.members.join(', ')}</Body>}</View>
        </Row>
        <Pressable onPress={() => (isGroup && group ? openSheet('groupSettings', { id: group.id }) : openSheet('convSettings', { name }))} hitSlop={10}><Text style={{ color: t.text, fontSize: 18 }}>⋯</Text></Pressable>
      </Row>
      <FlatList
        ref={list}
        style={{ flex: 1 }}
        data={msgs}
        keyExtractor={(_, i) => String(i)}
        onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={<Body muted small style={{ textAlign: 'center', marginTop: 40 }}>Nessun messaggio ancora: scrivi per primo.</Body>}
        renderItem={({ item }) => (
          <View style={{ alignSelf: item.from === me ? 'flex-end' : 'flex-start', maxWidth: '86%', backgroundColor: item.from === me ? '#e6ebf3' : t.aiMsg, borderColor: t.aiMsgBorder, borderWidth: item.from === me ? 0 : 1, borderRadius: 18, padding: 12, marginVertical: 5 }}>
            {isGroup && item.from !== me && <Text style={{ color: t.text, fontWeight: '700', fontSize: 12, marginBottom: 2 }}>{item.from}</Text>}
            <Text style={{ color: item.from === me ? '#111' : t.text, fontSize: 15, lineHeight: 21 }}>{item.text}</Text>
          </View>
        )}
      />
      <Row style={{ paddingTop: 10, alignItems: 'flex-start' }}>
        <Input flex={1} placeholder="Scrivi un messaggio…" value={text} onChangeText={setText} onSubmitEditing={send} returnKeyType="send" style={{ marginBottom: 0 }} />
        <Btn title="↑" onPress={send} disabled={!text.trim()} />
      </Row>
    </Page>
  );
}
