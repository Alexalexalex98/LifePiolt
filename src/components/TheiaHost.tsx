import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { ActivityIndicator, Animated, Modal, PanResponder, Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { create } from 'zustand';
import { captureScreen } from 'react-native-view-shot';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Btn, Input, ModalToast, Pill, Row, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { sendToAssistant } from '@/lib/assistant/run';
import { go } from '@/lib/nav';
import { theiaOnline } from '@/lib/theia';
import { useAssistant } from '@/store/assistant';
import { useApp } from '@/store/app';
import { useChat } from '@/store/chat';
import { useLife } from '@/store/life';
import { useTheia, askTheiaAbout } from '@/store/theia';
import { toast } from '@/store/toast';
import { Icon } from '@/lib/icons';

const NONE: string[] = [];

export function TheiaHost() {
  const t = useTheme();
  const name = useApp((s) => s.assistantName);
  const open = useTheia((s) => s.open);
  const req = useTheia((s) => s.req);
  const close = useTheia((s) => s.close);
  const log = useAssistant((s) => s.log);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [since, setSince] = useState(0);
  const scroll = useRef<ScrollView>(null);

  useEffect(() => {
    if (!open) return;
    setQ(''); setSince(Date.now());
    if (req?.ask) { const a = req.ask; setTimeout(() => void ask(a), 50); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, req]);
  // la conversazione continua nella LifeChat, archiviata nella sezione giusta: qui si vede solo la parte di adesso
  const turns = open ? log.filter((m) => m.ts >= since) : [];

  async function ask(question: string) {
    const v = question.trim();
    if (!v || busy || !req) return;
    setQ(''); setBusy(true);
    try { await sendToAssistant(v, { source: 'theia', req }); }
    finally { setBusy(false); setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 80); }
  }

  const chips = req?.text ? ['Riassumi', 'Estrai i task', 'Quando?', 'Quanto?', 'Rispondi per me'] : req?.imageUri ? ['Cosa vedi?', 'Spiegami questa schermata'] : ['Cosa devo fare adesso?', 'Aggiungi un task', 'Che impegni ho oggi?'];
  void NONE;

  return (
    <Sheet visible={open} title={`Chiedi a ${name}`} onClose={close}>
      {!theiaOnline && <Body small muted style={{ marginBottom: 8 }}>Comandi e analisi funzionano sul telefono, senza AI. Per leggere le immagini e rispondere a domande aperte serve il server.</Body>}
      {req?.imageUri && <Image source={{ uri: req.imageUri }} style={{ width: '100%', height: 150, borderRadius: 12, marginBottom: 8, backgroundColor: t.item }} contentFit="contain" />}
      {req?.text ? (
        <View style={{ backgroundColor: t.item, borderLeftWidth: 3, borderLeftColor: t.accent, borderRadius: 10, padding: 10, marginBottom: 8 }}>
          <Body small muted>{req.label ?? 'Testo selezionato'}</Body>
          <Body small numberOfLines={6}>{req.text}</Body>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 }}>{chips.map((c) => <Pill key={c} label={c} onPress={() => ask(c)} />)}</View>

      <ScrollView ref={scroll} style={{ maxHeight: 280 }} keyboardShouldPersistTaps="handled">
        {turns.map((x) => (
          <View key={x.id} style={{ marginBottom: 8 }}>
            {x.who === 'me' ? (
              <View style={{ alignSelf: 'flex-end', backgroundColor: '#e6ebf3', borderRadius: 16, padding: 10, maxWidth: '86%' }}><Text style={{ color: '#111' }}>{x.text}</Text></View>
            ) : (
              <View style={{ alignSelf: 'flex-start', backgroundColor: t.aiMsg, borderColor: t.aiMsgBorder, borderWidth: 1, borderRadius: 16, padding: 12, maxWidth: '94%' }}>
                <Text style={{ color: t.text, fontSize: 15, lineHeight: 21 }} selectable>{x.text}</Text>
                <Row style={{ flexWrap: 'wrap', justifyContent: 'flex-start', marginTop: 8 }} gap={6}>
                  {x.chips?.map((c) => <Pill key={c} label={c} onPress={() => ask(c)} />)}
                  <Pill label="Copia" onPress={() => void Clipboard.setStringAsync(x.text).then(() => toast('Copiato'))} />
                  <Pill label="Salva in nota" onPress={() => { useLife.getState().saveNote(null, x.text); toast('Salvato nelle note'); }} />
                  {req?.replyToChat ? <Pill label="Usa come risposta" onPress={() => { useChat.getState().patchChat(req.replyToChat!, { draft: x.text }); close(); toast('Bozza pronta nella chat'); }} /> : null}
                </Row>
              </View>
            )}
          </View>
        ))}
        {busy && <ActivityIndicator style={{ alignSelf: 'flex-start', margin: 8 }} />}
      </ScrollView>
      <Row style={{ alignItems: 'flex-start', marginTop: 4 }}>
        <Input flex={1} placeholder="Scrivi una domanda o un comando…" value={q} onChangeText={setQ} onSubmitEditing={() => ask(q)} returnKeyType="send" style={{ marginBottom: 0 }} />
        <Btn title="" label="Invia" icon="arrow-up" onPress={() => ask(q)} disabled={!q.trim() || busy} />
      </Row>
      <Pressable onPress={() => { close(); go('ai'); }} style={{ paddingVertical: 10 }}><Body small muted>Questa conversazione viene archiviata in LifeChat, nella sezione giusta. Apri LifeChat</Body></Pressable>
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
  // il pulsante si può trascinare dove non copre il contenuto
  const pos = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) + Math.abs(g.dy) > 8,
    onPanResponderGrant: () => { pos.extractOffset(); },
    onPanResponderMove: Animated.event([null, { dx: pos.x, dy: pos.y }], { useNativeDriver: false }),
    onPanResponderRelease: () => { pos.flattenOffset(); },
  })).current;
  const selecting = useSelect((x) => !!x.uri);
  if (open || selecting) return null;

  async function shot() {
    // lo scatto è silenzioso: il pulsante sparisce per un attimo e l'utente vede subito la schermata "ferma", pronta per la selezione
    setHidden(true);
    await new Promise((r) => setTimeout(r, 120));
    try {
      if (Platform.OS === 'web') throw new Error('web');
      const uri = await captureScreen({ format: 'jpg', quality: 0.8, result: 'tmpfile' });
      useSelect.getState().begin(uri);
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
    <Animated.View {...pan.panHandlers} style={{ position: 'absolute', right: 12, bottom: insets.bottom + 150, transform: pos.getTranslateTransform() }}>
      <Pressable
        onPress={shot} onLongPress={clip} delayLongPress={350}
        accessibilityLabel={`Chiedi a ${name}: tocca, poi trascina sulla schermata per scegliere cosa chiedere. Tieni premuto per il testo copiato. Trascinalo per spostarlo`}
        style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center', opacity: 0.92, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 6, elevation: 6 }}>
        <Icon name="sparkle" size={22} color={t.onText} />
      </Pressable>
    </Animated.View>
  );
}

/* ---------- selezione dell'area: la schermata resta "ferma", si trascina il dito su ciò che interessa ---------- */
type SelState = { uri: string | null; begin: (u: string) => void; end: () => void };
const useSelect = create<SelState>((set) => ({ uri: null, begin: (uri) => set({ uri }), end: () => set({ uri: null }) }));

type Rect = { x: number; y: number; w: number; h: number };

export function TheiaSelect() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const uri = useSelect((s) => s.uri);
  const end = useSelect((s) => s.end);
  const { width, height } = useWindowDimensions();
  const [rect, setRect] = useState<Rect | null>(null);
  const start = useRef({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => { start.current = { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY }; setRect({ x: e.nativeEvent.locationX, y: e.nativeEvent.locationY, w: 0, h: 0 }); },
    onPanResponderMove: (_, g) => {
      const x0 = start.current.x, y0 = start.current.y, x1 = x0 + g.dx, y1 = y0 + g.dy;
      setRect({ x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(g.dx), h: Math.abs(g.dy) });
    },
  })).current;

  useEffect(() => { setRect(null); setBusy(false); }, [uri]);
  if (!uri) return null;

  async function confirm(whole: boolean) {
    if (!uri) return;
    setBusy(true);
    let out = uri;
    try {
      if (!whole && rect && rect.w > 24 && rect.h > 24) {
        const info = await manipulateAsync(uri, [], {});
        const sx = info.width / width, sy = info.height / height;
        const crop = { originX: Math.max(0, rect.x * sx), originY: Math.max(0, rect.y * sy), width: Math.min(info.width - rect.x * sx, rect.w * sx), height: Math.min(info.height - rect.y * sy, rect.h * sy) };
        out = (await manipulateAsync(uri, [{ crop }], { compress: 0.85, format: SaveFormat.JPEG })).uri;
      }
    } catch { out = uri; }
    end();
    askTheiaAbout({ imageUri: out, source: 'screen', label: whole ? 'Schermata intera' : 'Area selezionata' });
  }

  return (
    <Modal visible transparent animationType="none" onRequestClose={end} statusBarTranslucent>
      <ModalToast />
      <View style={{ flex: 1, backgroundColor: '#000' }} {...pan.panHandlers}>
        <Image source={{ uri }} style={{ width, height }} contentFit="fill" pointerEvents="none" />
        <View pointerEvents="none" style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)' }} />
        {rect && rect.w > 2 && rect.h > 2 && (
          <View pointerEvents="none" style={{ position: 'absolute', left: rect.x, top: rect.y, width: rect.w, height: rect.h, borderColor: t.accent, borderWidth: 2, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.12)' }} />
        )}
        <View style={{ position: 'absolute', top: insets.top + 10, left: 16, right: 16, alignItems: 'center' }} pointerEvents="none">
          <View style={{ backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 8 }}>
            <Text style={{ color: '#fff', fontSize: 14 }}>Tieni premuto e trascina su ciò che vuoi chiedere</Text>
          </View>
        </View>
        <View style={{ position: 'absolute', bottom: insets.bottom + 20, left: 16, right: 16, flexDirection: 'row', justifyContent: 'center', gap: 10 }}>
          <Pressable onPress={end} style={{ backgroundColor: 'rgba(0,0,0,0.75)', borderRadius: 22, paddingHorizontal: 18, paddingVertical: 12 }} accessibilityLabel="Annulla"><Text style={{ color: '#fff', fontWeight: '700' }}>Annulla</Text></Pressable>
          <Pressable onPress={() => confirm(true)} style={{ backgroundColor: 'rgba(0,0,0,0.75)', borderRadius: 22, paddingHorizontal: 18, paddingVertical: 12 }} accessibilityLabel="Tutta la schermata"><Text style={{ color: '#fff', fontWeight: '700' }}>Tutta la schermata</Text></Pressable>
          <Pressable onPress={() => confirm(false)} disabled={!rect || rect.w < 24 || busy} style={{ backgroundColor: t.accent, borderRadius: 22, paddingHorizontal: 18, paddingVertical: 12, opacity: !rect || rect.w < 24 ? 0.4 : 1 }} accessibilityLabel="Chiedi su quest'area"><Text style={{ color: t.onText, fontWeight: '800' }}>Chiedi</Text></Pressable>
        </View>
      </View>
    </Modal>
  );
}
