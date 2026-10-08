import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, View } from 'react-native';

import { Body, Input, Page, Pill, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { sendToAssistant } from '@/lib/assistant/run';
import { Icon } from '@/lib/icons';
import { GENERALE, foldersOf, migrateOldChat, searchLog, useAssistant, type AMsg } from '@/store/assistant';
import { useApp } from '@/store/app';
import { toast } from '@/store/toast';

const START_CHIPS = ['Aggiungi una riunione al piano', 'Aggiungi un task', 'Cosa ho in programma domani?', 'Analisi delle mie finanze', 'Rendi privato il mio profilo', 'Cambia la foto del profilo', 'Cosa sai fare?'];

export default function LifeChat() {
  const t = useTheme();
  const log = useAssistant((s) => s.log);
  const clearTopic = useAssistant((s) => s.clearTopic);
  const name = useApp((s) => s.assistantName);
  // si parte sempre da "Generale": un'unica grande chat con tutto quello che ci si è detti
  const [section, setSection] = useState(GENERALE);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [searching, setSearching] = useState(false);
  const [q, setQ] = useState('');
  const list = useRef<FlatList<AMsg>>(null);

  useEffect(() => { migrateOldChat(); }, []);
  // una scheda (es. suggerimento di Theia) può aprire la chat già con un comando da eseguire
  const { ask } = useLocalSearchParams<{ ask?: string }>();
  useEffect(() => {
    if (!ask) return;
    router.setParams({ ask: '' });
    void send(String(ask));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ask]);

  const folders = useMemo(() => foldersOf(log), [log]);
  const [showAll, setShowAll] = useState(false);
  // "Generale" riparte pulito se manca da un paio d'ore, ma l'assistente ricorda tutto: lo storico resta a un tocco e nella ricerca
  const sessionFrom = useMemo(() => {
    if (!log.length) return 0;
    if (Date.now() - log[log.length - 1].ts > 2 * 3600000) return log.length;
    let i = log.length - 1;
    while (i > 0 && log[i].ts - log[i - 1].ts < 2 * 3600000) i--;
    return i;
  }, [log]);
  const shown = useMemo(() => (section === GENERALE ? (showAll ? log : log.slice(sessionFrom)) : log.filter((m) => m.topic === section)), [log, section, showAll, sessionFrom]);
  const hidden = section === GENERALE && !showAll ? sessionFrom : 0;
  const results = useMemo(() => (searching && q.trim() ? searchLog(log, q) : []), [log, q, searching]);
  const lastAi = [...shown].reverse().find((m) => m.who === 'ai');

  async function send(v?: string) {
    const msg = (v ?? text).trim();
    if (!msg || busy) return;
    setText(''); setBusy(true);
    try { await sendToAssistant(msg, { topic: section !== GENERALE ? section : undefined }); } finally { setBusy(false); }
    // se la domanda cambia argomento resto in Generale, che mostra tutto
    setTimeout(() => list.current?.scrollToEnd({ animated: true }), 60);
  }

  return (
    <Page id="ai" title="LifeChat" scroll={false} right={<Pressable onPress={() => { setSearching((x) => !x); setQ(''); }} hitSlop={10} accessibilityLabel="Cerca nelle conversazioni"><Icon name="search" size={22} color={t.text} /></Pressable>}>
      {searching ? (
        <View style={{ flex: 1 }}>
          <Input placeholder="Cerca una domanda o una risposta…" value={q} onChangeText={setQ} autoFocus style={{ marginBottom: 8 }} />
          <FlatList
            data={results}
            keyExtractor={(m) => m.id}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Body muted small>{q.trim() ? 'Nessun risultato.' : 'Scrivi una parola: cerco in tutte le conversazioni, anche in quelle archiviate per argomento.'}</Body>}
            renderItem={({ item }) => (
              <Pressable onPress={() => { setSection(item.topic); setSearching(false); setQ(''); }} style={{ backgroundColor: t.item, borderRadius: 14, padding: 12, marginBottom: 8 }}>
                <Text style={{ color: t.muted, fontSize: 11, marginBottom: 3 }}>{item.topic} · {new Date(item.ts).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} · {item.who === 'me' ? 'Tu' : name}</Text>
                <Text style={{ color: t.text, fontSize: 14, lineHeight: 20 }} numberOfLines={4}>{item.text}</Text>
              </Pressable>
            )}
          />
        </View>
      ) : (
        <>
          <View style={{ height: 44, marginBottom: 6 }}>
            <ScrollView horizontal keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center', gap: 8 }}>
              <Pill label="Generale" on={section === GENERALE} onPress={() => setSection(GENERALE)} />
              {folders.map((f) => <Pill key={f.topic} label={`${f.topic} · ${f.count}`} on={section === f.topic} onPress={() => setSection(f.topic)} />)}
            </ScrollView>
          </View>
          {hidden > 0 && (
            <Row style={{ marginBottom: 6 }}>
              <Body muted small style={{ flex: 1 }}>Nuova conversazione. Ricordo tutto quello che ci siamo detti ({hidden} messaggi).</Body>
              <Pill label="Mostra storico" onPress={() => setShowAll(true)} />
            </Row>
          )}
          {section !== GENERALE && (
            <Row style={{ marginBottom: 6 }}>
              <Body muted small style={{ flex: 1 }}>Sei nella sezione «{section}»: quello che scrivi qui resta qui e compare anche in Generale.</Body>
              <Pill label="Svuota" onPress={() => { clearTopic(section); setSection(GENERALE); toast('Cartella svuotata'); }} />
            </Row>
          )}
          <FlatList
            ref={list}
            style={{ flex: 1 }}
            data={shown}
            keyExtractor={(m) => m.id}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <View style={{ paddingTop: 8 }}>
                <Body style={{ marginBottom: 8 }}>Sono {name}. Dimmi cosa fare e lo faccio io: piano, task, note, profilo, analisi di finanze, salute e umore. Funziono con regole sul tuo telefono, senza consumare AI.</Body>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{START_CHIPS.map((c) => <Pill key={c} label={c} onPress={() => send(c)} />)}</View>
              </View>
            }
            renderItem={({ item }) => {
              const me = item.who === 'me';
              return (
                <View style={{ marginVertical: 4 }}>
                  <View style={{ alignSelf: me ? 'flex-end' : 'flex-start', maxWidth: '88%', backgroundColor: me ? '#e6ebf3' : t.aiMsg, borderColor: t.aiMsgBorder, borderWidth: me ? 0 : 1, borderRadius: 18, padding: 12 }}>
                    {item.image ? <Image source={{ uri: item.image }} style={{ width: 160, height: 100, borderRadius: 10, marginBottom: 6 }} contentFit="cover" /> : null}
                    <Text selectable style={{ color: me ? '#111' : t.text, fontSize: 15, lineHeight: 21 }}>{item.text}</Text>
                    {item.source === 'theia' && <Text style={{ color: me ? '#556' : t.muted, fontSize: 10, marginTop: 4 }}>da {name} sulla schermata</Text>}
                  </View>
                  {item.id === lastAi?.id && item.chips?.length ? (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 }}>{item.chips.map((c) => <Pill key={c} label={c} onPress={() => send(c)} />)}</View>
                  ) : null}
                </View>
              );
            }}
          />
          <Row style={{ paddingTop: 10, paddingBottom: 6, alignItems: 'flex-start' }}>
            <Input flex={1} placeholder={section === GENERALE ? 'Scrivi un comando o una domanda…' : `Scrivi in ${section}…`} value={text} onChangeText={setText} onSubmitEditing={() => send()} returnKeyType="send" style={{ marginBottom: 0 }} />
            <Pressable onPress={() => send()} disabled={busy || !text.trim()} style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center', opacity: busy || !text.trim() ? 0.4 : 1, marginLeft: 8 }} accessibilityLabel="Invia">
              <Icon name="arrow-up" size={20} color={t.onText} stroke={2.4} />
            </Pressable>
          </Row>
        </>
      )}
    </Page>
  );
}
