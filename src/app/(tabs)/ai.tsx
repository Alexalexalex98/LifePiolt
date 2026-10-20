import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Platform, Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/components/T';

import { Body, Input, Page, Pill, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { runAction, sendTheia } from '@/lib/assistant/theiaFlow';
import { LogoLoader } from '@/components/LogoLoader';
import { AiNote } from '@/components/AiNote';
import { Composer, type ComposerSend } from '@/components/theia/Composer';
import { MessageAttachments } from '@/components/theia/AttachChips';
import { MessageFooter, MessageImages } from '@/components/theia/MessageExtras';
import { useKeyboardInset } from '@/hooks/use-keyboard-inset';
import { shouldScrollToEnd } from '@/lib/keyboardInset';
import { Icon } from '@/lib/icons';
import { GENERALE, foldersOf, migrateOldChat, searchLog, useAssistant, type AMsg } from '@/store/assistant';
import { useApp } from '@/store/app';
import { toast } from '@/store/toast';
import { translateText } from '@/i18n/core';
import { fmtDate } from '@/i18n/format';

const HERO_CARDS: [string, string, string][] = [['calendar', 'Pianifica la mia giornata', 'Riepilogo della giornata'], ['tasks', 'Aggiungi un task', 'Aggiungi un task'], ['lifefinance', 'Analizza le mie finanze', 'Analisi delle mie finanze'], ['sparkle', 'Cosa devo fare adesso?', 'Cosa devo fare adesso?']];

export default function LifeChat() {
  const t = useTheme();
  const log = useAssistant((s) => s.log);
  const clearTopic = useAssistant((s) => s.clearTopic);
  const name = useApp((s) => s.assistantName);
  // si parte sempre da "Generale": un'unica grande chat con tutto quello che ci si è detti
  const [section, setSection] = useState(GENERALE);
  const [busy, setBusy] = useState(false);
  const [searching, setSearching] = useState(false);
  const [q, setQ] = useState('');
  const list = useRef<FlatList<AMsg>>(null);

  useEffect(() => { migrateOldChat(); }, []);
  // quando la tastiera si apre (o cambia altezza) l'ultimo messaggio resta in vista, sopra la barra di scrittura
  const kb = useKeyboardInset();
  const prevKb = useRef({ visible: false, height: 0 });
  useEffect(() => {
    const doScroll = shouldScrollToEnd(prevKb.current, kb);
    prevKb.current = { visible: kb.visible, height: kb.height };
    if (!doScroll) return;
    const tm = setTimeout(() => list.current?.scrollToEnd({ animated: true }), 120);
    return () => clearTimeout(tm);
  }, [kb.visible, kb.height]); // eslint-disable-line react-hooks/exhaustive-deps
  // una scheda (es. suggerimento di Theia) può aprire la chat già con un comando da eseguire
  const { ask, attach } = useLocalSearchParams<{ ask?: string; attach?: string }>();
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

  const appLang = useApp((s) => s.language);
  const userName = useApp((s) => s.account.name);
  const hr = new Date().getHours();
  const greetWord = hr < 12 ? 'Buongiorno' : hr < 18 ? 'Buon pomeriggio' : 'Buonasera';

  async function deliver(m: ComposerSend) {
    if (busy) return;
    setBusy(true);
    try {
      await sendTheia({ text: m.text, lang: m.lang, appLang, forced: m.forced, source: m.source, images: m.images, attachments: m.attachments, voiceNote: m.voiceNote, topic: section !== GENERALE ? section : undefined });
    } finally { setBusy(false); }
    // se la domanda cambia argomento resto in Generale, che mostra tutto
    setTimeout(() => list.current?.scrollToEnd({ animated: true }), 60);
  }
  const send = (v: string) => deliver({ text: v, images: [], source: 'typed', lang: appLang, forced: false });
  async function act(id: string, a: Parameters<typeof runAction>[1]) {
    if (busy) return;
    setBusy(true);
    try { await runAction(id, a); } finally { setBusy(false); }
    setTimeout(() => list.current?.scrollToEnd({ animated: true }), 60);
  }

  return (
    <Page id="ai" title="LifeChat" scroll={false}>
      {searching ? (
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Input flex={1} placeholder="Cerca una domanda o una risposta…" value={q} onChangeText={setQ} autoFocus style={{ marginBottom: 0 }} />
            <Pressable onPress={() => { setSearching(false); setQ(''); }} hitSlop={8} accessibilityRole="button" accessibilityLabel={translateText('Chiudi la ricerca')} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Icon name="x" size={22} color={t.text} stroke={2.1} /></Pressable>
          </View>
          <FlatList
            data={results}
            keyExtractor={(m) => m.id}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Body muted small>{q.trim() ? 'Nessun risultato.' : 'Scrivi una parola: cerco in tutte le conversazioni, anche in quelle archiviate per argomento.'}</Body>}
            renderItem={({ item }) => (
              <Pressable onPress={() => { setSection(item.topic); setSearching(false); setQ(''); }} style={{ backgroundColor: t.item, borderRadius: 14, padding: 12, marginBottom: 8 }}>
                <Text style={{ color: t.muted, fontSize: 11, marginBottom: 3 }}>{item.topic} · {fmtDate(item.ts, { day: 'numeric', month: 'short' })} · {item.who === 'me' ? 'Tu' : name}</Text>
                <Text style={{ color: t.text, fontSize: 14, lineHeight: 20 }} numberOfLines={4}>{item.text}</Text>
              </Pressable>
            )}
          />
        </View>
      ) : (
        <>
          <View style={{ height: 44, marginBottom: 6, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <ScrollView horizontal style={{ flex: 1 }} keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center', gap: 8 }}>
              <Pill label="Generale" on={section === GENERALE} onPress={() => setSection(GENERALE)} />
              {folders.map((f) => <Pill key={f.topic} label={`${f.topic} · ${f.count}`} on={section === f.topic} onPress={() => setSection(f.topic)} />)}
            </ScrollView>
            <Pressable onPress={() => { setSearching(true); setQ(''); }} accessibilityRole="button" accessibilityLabel={translateText('Cerca nelle conversazioni')} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Icon name="search" size={22} color={t.text} /></Pressable>
          </View>
          {hidden > 0 && !kb.visible && (
            <Row style={{ marginBottom: 4 }}>
              <Body muted small style={{ flex: 1 }} numberOfLines={1}>Nuova conversazione · {hidden} messaggi in memoria</Body>
              <Pill label="Storico" onPress={() => setShowAll(true)} />
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
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            removeClippedSubviews={false}
            onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
            onLayout={() => list.current?.scrollToEnd({ animated: false })}
            contentContainerStyle={shown.length === 0 ? { flexGrow: 1, justifyContent: 'center' } : undefined}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', paddingHorizontal: 4, paddingBottom: 8 }}>
                <LinearGradient colors={[t.accent, t.accent + '66']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                  <Icon name="sparkle" size={30} color={t.onText} stroke={2} />
                </LinearGradient>
                <Text style={{ color: t.text, fontSize: 24, fontWeight: '800', letterSpacing: -0.4, textAlign: 'center' }}>{greetWord}, {userName}</Text>
                <Text style={{ color: t.muted, fontSize: 15, marginTop: 4, textAlign: 'center' }}>Sono {name}. Cosa facciamo oggi?</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16, alignSelf: 'stretch' }}>
                  {HERO_CARDS.map(([ic, label, cmd]) => (
                    <Pressable key={label} onPress={() => send(cmd)} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => ({ width: '48%', flexGrow: 1, backgroundColor: t.card, borderColor: t.border, borderWidth: 1, borderRadius: 16, padding: 12, minHeight: 74, justifyContent: 'space-between', opacity: pressed ? 0.7 : 1 })}>
                      <Icon name={ic} size={22} color={t.accent} stroke={1.9} />
                      <Text style={{ color: t.text, fontSize: 14, fontWeight: '700', marginTop: 8 }}>{label}</Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={{ color: t.muted, fontSize: 12.5, marginTop: 12, textAlign: 'center' }}>Scrivi un comando o una domanda: ti suggerisco io cosa so fare.</Text>
              </View>
            }
            ListFooterComponent={busy ? <View style={{ alignSelf: 'flex-start', marginVertical: 6, marginLeft: 4 }}><LogoLoader size={54} /></View> : null}
            renderItem={({ item }) => {
              const me = item.who === 'me';
              return (
                <View style={{ marginVertical: 4 }}>
                  <View style={{ alignSelf: me ? 'flex-end' : 'flex-start', maxWidth: '88%', backgroundColor: me ? '#e6ebf3' : t.aiMsg, borderColor: t.aiMsgBorder, borderWidth: me ? 0 : 1, borderRadius: 18, padding: 12 }}>
                    {item.image ? <Image source={{ uri: item.image }} style={{ width: 160, height: 100, borderRadius: 10, marginBottom: 6 }} contentFit="cover" /> : null}
                    {item.ext?.images?.length ? <MessageImages uris={item.ext.images} me={me} /> : null}
                    {item.ext?.attachments?.length ? <MessageAttachments items={item.ext.attachments} me={me} /> : null}
                    {item.text ? <Text selectable style={{ color: me ? '#111' : t.text, fontSize: 15, lineHeight: 21 }}>{item.text}</Text> : null}
                    <MessageFooter ext={item.id === lastAi?.id ? item.ext : item.ext} me={me} onAction={(a) => void act(item.id, a)} />
                    {item.source === 'theia' && <Text style={{ color: me ? '#556' : t.muted, fontSize: 10, marginTop: 4 }}>da {name} sulla schermata</Text>}
                  </View>
                  {item.id === lastAi?.id && item.chips?.length ? (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 }}>{item.chips.map((c) => <Pill key={c} label={c} onPress={() => send(c)} />)}</View>
                  ) : null}
                </View>
              );
            }}
          />
          <AiNote compact style={{ paddingHorizontal: 4 }} />
          <Composer openAttach={attach} appLang={appLang} busy={busy} placeholder={section === GENERALE ? 'Scrivi a Theia…' : `Scrivi in ${section}…`} onSend={(m) => void deliver(m)} />
        </>
      )}
    </Page>
  );
}
