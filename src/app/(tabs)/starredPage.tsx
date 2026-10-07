import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';

import { Body, Card, Empty, Page, Row } from '@/components/ui';
import { go } from '@/lib/nav';
import { useApp } from '@/store/app';
import { dayLabel, fmtClock, previewOf, useChat } from '@/store/chat';

export default function Starred() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const me = useApp((s) => s.account.name);
  const chats = useChat((s) => s.chats);
  const messages = useChat((s) => s.messages);
  const rows = useMemo(() => Object.keys(messages)
    .filter((k) => !id || k === id)
    .flatMap((k) => (messages[k] ?? []).filter((m) => m.starredBy?.includes(me) && !m.deletedForAll && !m.hiddenFor?.includes(me)))
    .sort((a, b) => b.ts - a.ts), [messages, id, me]);
  return (
    <Page id="starredPage" back title="Messaggi preferiti">
      {rows.length === 0 ? <Empty text="Nessun messaggio preferito. Tieni premuto un messaggio e scegli ★." /> : rows.map((m) => (
        <Card key={m.id} onPress={() => go('conversationPage', { id: m.chatId, jump: m.id })}>
          <Row><Body small bold>{m.from === me ? 'Tu' : m.from} · {chats[m.chatId]?.name}</Body><Body small muted>{dayLabel(m.ts)} {fmtClock(m.ts)}</Body></Row>
          <Body style={{ marginTop: 4 }}>{previewOf(m)}</Body>
        </Card>
      ))}
    </Page>
  );
}
