import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { captureScreen } from 'react-native-view-shot';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Btn, Input, Pill, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { askTheia, theiaOnline, type TheiaAnswer } from '@/lib/theia';
import { useApp } from '@/store/app';
import { useChat } from '@/store/chat';
import { useLife } from '@/store/life';
import { useTheia, askTheiaAbout } from '@/store/theia';
import { toast } from '@/store/toast';
import { Icon } from '@/lib/icons';

type Turn = { q: string; a?: TheiaAnswer; err?: boolean };

export function TheiaHost() {
  const t = useTheme();
  const name = useApp((s) => s.assistantName);
  const open = useTheia((s) => s.open);
  const req = useTheia((s) => s.req);
  const close = useTheia((s) => s.close);
  const [q, setQ] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const scroll = useRef<ScrollView>(null);

  useEffect(() => { if (open) { setTurns([]); setQ(''); } }, [open, req]);

  async function ask(question: string) {
    const v = question.trim();
    if (!v || busy || !req) return;
    setQ(''); setBusy(true);
    setTurns((x) => [...x, { q: v }]);
    try {
      const a = await askTheia(v, req);
      setTurns((x) => x.map((y, i) => (i === x.length - 1 ? { ...y, a } : y)));
    } catch {
      setTurns((x) => x.map((y, i) => (i === x.length - 1 ? { ...y, err: true } : y)));
    } finally {
      setBusy(false);
      setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 80);
    }
  }

  const chips = req?.text ? ['Riassumi', 'Estrai i task', 'Quando?', 'Quanto?', 'Rispondi per me'] : req?.imageUri ? ['Cosa vedi?', 'Spiegami questa schermata'] : ['Cosa devo fare adesso?', 'Come sto?', 'Che impegni ho oggi?'];

  return (
    <Sheet visible={open} title={`Chiedi a ${name}`} onClose={close}>
      {!theiaOnline && <Body small muted style={{ marginBottom: 8 }}>Modalità locale: lavoro sui dati del telefono con regole semplici. Per risposte da un vero modello AI e per leggere le immagini serve il server.</Body>}
      {req?.imageUri && <Image source={{ uri: req.imageUri }} style={{ width: '100%', height: 150, borderRadius: 12, marginBottom: 8, backgroundColor: t.item }} contentFit="contain" />}
      {req?.text ? (
        <View style={{ backgroundColor: t.item, borderLeftWidth: 3, borderLeftColor: t.accent, borderRadius: 10, padding: 10, marginBottom: 8 }}>
          <Body small muted>{req.label ?? 'Testo selezionato'}</Body>
          <Body small numberOfLines={6}>{req.text}</Body>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 }}>{chips.map((c) => <Pill key={c} label={c} onPress={() => ask(c)} />)}</View>

      <ScrollView ref={scroll} style={{ maxHeight: 280 }} keyboardShouldPersistTaps="handled">
        {turns.map((x, i) => (
          <View key={i} style={{ marginBottom: 10 }}>
            <View style={{ alignSelf: 'flex-end', backgroundColor: '#e6ebf3', borderRadius: 16, padding: 10, maxWidth: '86%' }}><Text style={{ color: '#111' }}>{x.q}</Text></View>
            <View style={{ alignSelf: 'flex-start', backgroundColor: t.aiMsg, borderColor: t.aiMsgBorder, borderWidth: 1, borderRadius: 16, padding: 12, marginTop: 6, maxWidth: '94%' }}>
              {x.a ? (
                <>
                  <Text style={{ color: t.text, fontSize: 15, lineHeight: 21 }} selectable>{x.a.text}</Text>
                  <Row style={{ flexWrap: 'wrap', justifyContent: 'flex-start', marginTop: 8 }} gap={6}>
                    <Pill label="Copia" onPress={() => void Clipboard.setStringAsync(x.a!.text).then(() => toast('Copiato'))} />
                    {x.a.tasks?.length ? <Pill label={`Crea ${x.a.tasks.length} task`} onPress={() => { x.a!.tasks!.forEach((tt) => useLife.getState().addTask({ t: tt, done: false })); toast('Task aggiunti'); }} /> : null}
                    <Pill label="Salva in nota" onPress={() => { useLife.getState().saveNote(null, `${x.q}\n\n${x.a!.text}`); toast('Salvato nelle note'); }} />
                    {x.a.reply && req?.replyToChat ? <Pill label="Usa come risposta" onPress={() => { useChat.getState().patchChat(req.replyToChat!, { draft: x.a!.reply }); close(); toast('Bozza pronta nella chat'); }} /> : null}
                  </Row>
                </>
              ) : x.err ? <Text style={{ color: t.danger }}>Non riesco a raggiungere il server. Riprova tra poco.</Text> : <ActivityIndicator />}
            </View>
          </View>
        ))}
      </ScrollView>
      <Row style={{ alignItems: 'flex-start', marginTop: 4 }}>
        <Input flex={1} placeholder="Scrivi una domanda…" value={q} onChangeText={setQ} onSubmitEditing={() => ask(q)} returnKeyType="send" style={{ marginBottom: 0 }} />
        <Btn title="" icon="arrow-up" onPress={() => ask(q)} disabled={!q.trim() || busy} />
      </Row>
    </Sheet>
  );
}

/** Pulsante flottante: tocca = screenshot della schermata; tieni premuto = usa il testo copiato. */
export function TheiaFab() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const open = useTheia((s) => s.open);
  const name = useApp((s) => s.assistantName);
  const [hidden, setHidden] = useState(false);
  if (open) return null;

  async function shot() {
    setHidden(true);
    await new Promise((r) => setTimeout(r, 120));
    try {
      if (Platform.OS === 'web') throw new Error('web');
      const uri = await captureScreen({ format: 'jpg', quality: 0.7, result: 'tmpfile' });
      askTheiaAbout({ imageUri: uri, source: 'screen' });
    } catch {
      askTheiaAbout({ source: 'free' });
      toast('Screenshot non disponibile qui: puoi comunque scrivermi o incollare un testo');
    } finally { setHidden(false); }
  }
  async function clip() {
    const txt = (await Clipboard.getStringAsync()).trim();
    if (!txt) { toast('Prima copia un testo, poi tieni premuto'); return; }
    askTheiaAbout({ text: txt, source: 'clipboard', label: 'Testo copiato' });
  }

  if (hidden) return null;
  return (
    <Pressable
      onPress={shot} onLongPress={clip} delayLongPress={350}
      accessibilityLabel={`Chiedi a ${name}: tocca per analizzare la schermata, tieni premuto per il testo copiato`}
      style={{ position: 'absolute', right: 12, bottom: insets.bottom + 150, width: 44, height: 44, borderRadius: 22, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center', opacity: 0.92, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 6, elevation: 6 }}>
      <Icon name="sparkle" size={22} color={t.onText} />
    </Pressable>
  );
}
