import { useRef, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';

import { Body, Btn, Input, Item, Page, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { askAssistant, captureTask, catReplies, categories, detectTopic } from '@/lib/ai';
import { Icon } from '@/lib/icons';
import { useLife, type ChatMsg } from '@/store/life';
import { toast } from '@/store/toast';

export default function LifeChat() {
  const t = useTheme();
  const { chat, activeCat, pushChat, setCat, addTask } = useLife();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [picker, setPicker] = useState(false);
  const list = useRef<FlatList<ChatMsg>>(null);

  const msgs: ChatMsg[] = chat[activeCat]?.length ? chat[activeCat] : [{ who: 'ai', text: catReplies[activeCat] ?? catReplies.General }];

  async function send() {
    const msg = text.trim();
    if (!msg || busy) return;
    setText('');
    let cat = activeCat;
    const detected = detectTopic(msg);
    if (detected && detected !== activeCat) { cat = detected; setCat(detected); toast('Argomento rilevato: ' + detected); }
    if (!useLife.getState().chat[cat]?.length) pushChat(cat, { who: 'ai', text: catReplies[cat] ?? catReplies.General });
    pushChat(cat, { who: 'me', text: msg });
    const task = captureTask(msg);
    if (task) { addTask({ t: task.charAt(0).toUpperCase() + task.slice(1), done: false }); toast('Aggiunto ai task: "' + task + '"'); }
    setBusy(true);
    try {
      pushChat(cat, { who: 'ai', text: await askAssistant(cat, useLife.getState().chat[cat] ?? []) });
    } catch {
      pushChat(cat, { who: 'ai', text: 'Non riesco a raggiungere il server. Riprova tra poco.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page id="ai" title="LifeChat" scroll={false}>
      <Body muted small style={{ marginBottom: 10 }}>LifePilot riconosce da solo l'argomento di cui parli. Puoi comunque cambiarlo tu.</Body>
      <Pressable onPress={() => setPicker(true)} style={{ backgroundColor: t.input, borderColor: t.inputBorder, borderWidth: 1, borderRadius: 14, padding: 13, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: t.text, fontSize: 16 }}>{activeCat}</Text>
        <Icon name="chevron" size={16} color={t.muted} stroke={2} />
      </Pressable>
      <FlatList
        ref={list}
        style={{ flex: 1 }}
        data={msgs}
        keyExtractor={(_, i) => String(i)}
        onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => (
          <View style={{ alignSelf: item.who === 'me' ? 'flex-end' : 'flex-start', maxWidth: '86%', backgroundColor: item.who === 'me' ? '#e6ebf3' : t.aiMsg, borderColor: t.aiMsgBorder, borderWidth: item.who === 'me' ? 0 : 1, borderRadius: 18, padding: 12, marginVertical: 5 }}>
            <Text style={{ color: item.who === 'me' ? '#111' : t.text, fontSize: 15, lineHeight: 21 }}>{item.text}</Text>
          </View>
        )}
      />
      <Row style={{ paddingTop: 10, paddingBottom: 6, alignItems: 'flex-start' }}>
        <Input flex={1} placeholder="Chiedi qualsiasi cosa…" value={text} onChangeText={setText} onSubmitEditing={send} returnKeyType="send" style={{ marginBottom: 0 }} />
        <Btn title="↑" onPress={send} disabled={busy || !text.trim()} />
      </Row>
      <Sheet visible={picker} title="Argomento" onClose={() => setPicker(false)}>
        {categories.map((c, i) => (
          <Item key={c} last={i === categories.length - 1} onPress={() => { setCat(c); setPicker(false); }}>
            <Row><Body>{c}</Body>{c === activeCat ? <Text style={{ color: t.positive }}>✓</Text> : null}</Row>
          </Item>
        ))}
      </Sheet>
    </Page>
  );
}
