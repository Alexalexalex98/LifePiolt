import { useRef, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Button, Input } from '@/components/ui';
import { askAssistant } from '@/lib/ai';
import { useTheme } from '@/hooks/use-theme';
import { useStore } from '@/store';

export default function Chat() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { chat, pushChat, clearChat } = useStore();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const list = useRef<FlatList>(null);

  async function send() {
    const msg = text.trim();
    if (!msg || busy) return;
    setText('');
    pushChat({ role: 'user', text: msg });
    setBusy(true);
    try {
      const history = [...useStore.getState().chat];
      pushChat({ role: 'assistant', text: await askAssistant(history) });
    } catch {
      pushChat({ role: 'assistant', text: 'Non riesco a raggiungere il server. Riprova tra poco.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top + 12 }}>
      <View style={{ paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: t.text, fontSize: 28, fontWeight: '800' }}>LifeChat</Text>
        {chat.length > 0 && (
          <Pressable onPress={clearChat} hitSlop={10}><Body muted small>Cancella</Body></Pressable>
        )}
      </View>
      <FlatList
        ref={list}
        data={chat}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 16, flexGrow: 1 }}
        onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={<Body muted style={{ textAlign: 'center', marginTop: 60 }}>Chiedimi qualsiasi cosa su giornata, salute, soldi e obiettivi.</Body>}
        renderItem={({ item }) => (
          <View
            style={{
              alignSelf: item.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '86%',
              backgroundColor: item.role === 'user' ? t.text : t.card,
              borderColor: t.border,
              borderWidth: item.role === 'user' ? 0 : 1,
              borderRadius: 18,
              padding: 12,
              marginVertical: 5,
            }}>
            <Text style={{ color: item.role === 'user' ? t.onText : t.text, fontSize: 15, lineHeight: 21 }}>{item.text}</Text>
          </View>
        )}
      />
      <View style={{ flexDirection: 'row', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: t.border, alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Input placeholder="Chiedi qualsiasi cosa…" value={text} onChangeText={setText} onSubmitEditing={send} returnKeyType="send" style={{ marginBottom: 0 }} />
        </View>
        <Button title="↑" onPress={send} disabled={busy || !text.trim()} />
      </View>
    </View>
  );
}
