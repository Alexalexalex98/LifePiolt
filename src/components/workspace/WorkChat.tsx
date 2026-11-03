import { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Mascot } from '@/components/mascot/Mascot';
import { RichText } from '@/components/RichText';
import { Text } from '@/components/T';
import { Composer, type ComposerSend } from '@/components/theia/Composer';
import { MessageAttachments } from '@/components/theia/AttachChips';
import { Body, Btn, Item, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { Icon } from '@/lib/icons';
import { clearFocus, focusFile, sendWork, workAction, workspaceFiles } from '@/lib/workspaceAi';
import { useLife } from '@/store/life';
import { useWorkspaceChat, type WsMsg } from '@/store/workspaceChat';

/** La chat di Theia Lavoro: stessa grafica e stesso compositore della chat con Theia (allegati, foto, file, voce), ma lavora solo sul workspace. */
export function WorkChat({ onClose }: { onClose: () => void }) {
  const th = useTheme();
  const insets = useSafeAreaInsets();
  const log = useWorkspaceChat((s) => s.log);
  const focus = useWorkspaceChat((s) => s.focus);
  const mode = useWorkspaceChat((s) => s.mode);
  useLife((s) => s.drive);
  const [busy, setBusy] = useState(false);
  const [pick, setPick] = useState(false);
  const list = useRef<FlatList<WsMsg>>(null);
  const last = log[log.length - 1];
  useEffect(() => { const h = setTimeout(() => list.current?.scrollToEnd({ animated: true }), 80); return () => clearTimeout(h); }, [log.length, busy]);
  const files = workspaceFiles();
  const focusNames = focus.map((id) => useLife.getState().drive.find((f) => f.id === id)?.n).filter(Boolean) as string[];

  const send = async (m: ComposerSend) => { setBusy(true); try { await sendWork(m.text, m.attachments ?? []); } finally { setBusy(false); } };
  const act = async (op: 'pick' | 'all' | 'dismiss', msgId: string) => {
    useWorkspaceChat.getState().patch(msgId, { actions: undefined });
    if (op === 'pick') { setPick(true); return; }
    setBusy(true); try { await workAction(op); } finally { setBusy(false); }
  };
  const choose = async (id: string) => { setPick(false); setBusy(true); try { await focusFile(id); } finally { setBusy(false); } };

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose} statusBarTranslucent>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: th.bg, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: th.border }}>
        <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel={tl('Chiudi')} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: th.card, borderWidth: 1, borderColor: th.border, alignItems: 'center', justifyContent: 'center' }}><Icon name="x" size={18} color={th.text} stroke={2.4} /></Pressable>
        <Mascot size={40} color={th.accent} expression="happy" />
        <View style={{ flex: 1 }}>
          <Text style={{ color: th.text, fontSize: 17, fontWeight: '800' }}>Theia Lavoro</Text>
          <Text style={{ color: th.muted, fontSize: 12 }} numberOfLines={1}>{files.length ? tl('{0} file nel workspace', files.length) : tl('Pagine, database e file')}</Text>
        </View>
        {log.length ? <Pressable onPress={() => useWorkspaceChat.getState().clear()} hitSlop={8} accessibilityRole="button" accessibilityLabel={tl('Svuota la chat')}><Icon name="trash" size={19} color={th.muted} /></Pressable> : null}
      </View>

      <FlatList ref={list} style={{ flex: 1 }} contentContainerStyle={{ padding: 16, flexGrow: 1 }} data={log} keyExtractor={(m) => m.id} keyboardShouldPersistTaps="handled"
        ListEmptyComponent={(
          <View style={{ alignItems: 'center', paddingVertical: 24, gap: 8 }}>
            <Text style={{ color: th.text, fontSize: 20, fontWeight: '800', textAlign: 'center' }}>{tl('Cosa facciamo oggi?')}</Text>
            <Text style={{ color: th.muted, fontSize: 14, textAlign: 'center' }}>{tl('Carica un file con la graffetta o scegline uno: poi chiedimi quello che vuoi.')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 10 }}>
              {[tl('Riassumi il file'), tl('Quali sono le scadenze?'), tl('Trova i numeri importanti')].map((x) => (
                <Pressable key={x} onPress={() => void send({ text: x, images: [], source: 'typed', lang: 'it', forced: false })} style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, backgroundColor: th.card, borderWidth: 1, borderColor: th.border }}><Text style={{ color: th.text, fontSize: 13, fontWeight: '600' }}>{x}</Text></Pressable>
              ))}
            </View>
          </View>
        )}
        renderItem={({ item }) => {
          const me = item.who === 'me';
          return (
            <View style={{ marginVertical: 5, flexDirection: 'row', alignItems: 'flex-end', gap: 6, justifyContent: me ? 'flex-end' : 'flex-start' }}>
              {!me ? <Mascot size={34} color={th.accent} expression="happy" animated={item.id === last?.id} /> : null}
              <View style={{ flexShrink: 1, maxWidth: '88%' }}>
                <View style={{ alignSelf: me ? 'flex-end' : 'flex-start', backgroundColor: me ? '#e6ebf3' : th.aiMsg, borderColor: th.aiMsgBorder, borderWidth: me ? 0 : 1, borderRadius: 18, padding: 12 }}>
                  {item.files?.length ? <View style={{ gap: 6, marginBottom: item.text ? 8 : 0 }}>{item.files.map((n) => <View key={n} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: me ? '#d3dae6' : th.tile, borderRadius: 10, padding: 8 }}><Icon name="file" size={16} color={me ? '#334' : th.muted} /><Text numberOfLines={1} style={{ color: me ? '#111' : th.text, fontSize: 13, flexShrink: 1 }}>{n}</Text></View>)}</View> : null}
                  {item.text ? (me ? <Text selectable style={{ color: '#111', fontSize: 15, lineHeight: 21 }}>{item.text}</Text> : <RichText text={item.text} color={th.text} accent={th.text} />) : null}
                  {item.sources?.length ? <View style={{ marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{item.sources.map((s) => <View key={s} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: th.tile, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}><Icon name="file" size={11} color={th.muted} /><Text numberOfLines={1} style={{ color: th.muted, fontSize: 11, maxWidth: 160 }}>{s}</Text></View>)}</View> : null}
                  {item.actions?.length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>{item.actions.map((a) => <Btn key={a.op} small ghost={a.op !== 'pick'} title={a.label} onPress={() => void act(a.op, item.id)} />)}</View> : null}
                </View>
              </View>
            </View>
          );
        }}
        ListFooterComponent={busy ? (<View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginVertical: 6 }}><Mascot size={34} color={th.accent} expression="doubtful" ritual={false} /><View style={{ backgroundColor: th.aiMsg, borderRadius: 18, borderWidth: 1, borderColor: th.aiMsgBorder, paddingHorizontal: 14, paddingVertical: 10 }}><Text style={{ color: th.muted }}>{tl('Leggo i file…')}</Text></View></View>) : undefined}
      />

      <View style={{ paddingHorizontal: 16, paddingBottom: Math.max(insets.bottom, 10), borderTopWidth: 1, borderTopColor: th.border }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, flexWrap: 'wrap' }}>
        {focusNames.length ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: th.accent + '22', borderWidth: 1, borderColor: th.accent + '66', borderRadius: 999, paddingStart: 10, paddingEnd: 6, paddingVertical: 5, maxWidth: '78%' }}>
            <Icon name="file" size={14} color={th.accent} />
            <Text numberOfLines={1} style={{ color: th.text, fontSize: 12.5, fontWeight: '700', flexShrink: 1 }}>{tl('Parliamo di: {0}', focusNames.join(', '))}</Text>
            <Pressable onPress={() => clearFocus()} hitSlop={8} accessibilityRole="button" accessibilityLabel={tl('Togli il file')}><Icon name="x" size={14} color={th.muted} stroke={2.4} /></Pressable>
          </View>
        ) : <Text style={{ color: th.muted, fontSize: 12 }}>{mode === 'all' ? tl('Cerco in tutti i file') : tl('Nessun file scelto')}</Text>}
        <Pressable onPress={() => setPick(true)} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: th.card, borderWidth: 1, borderColor: th.border }}><Icon name="plus" size={13} color={th.text} stroke={2.4} /><Text style={{ color: th.text, fontSize: 12.5, fontWeight: '700' }}>{tl('Scegli un file')}</Text></Pressable>
      </View>
      <Composer appLang="it" busy={busy} placeholder={tl('Chiedi a Theia Lavoro…')} onSend={(m) => void send(m)} />
      </View>

      <Sheet visible={pick} title={tl('Scegli il file')} onClose={() => setPick(false)}>
        <Body small muted style={{ marginBottom: 8 }}>{tl('Qui ci sono i file del workspace. Per caricarne uno nuovo usa la graffetta nella chat.')}</Body>
        {files.length ? files.map((f, i) => (
          <Item key={f.id} last={i === files.length - 1} onPress={() => void choose(f.id)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Icon name="file" size={20} color={th.accent} /><View style={{ flex: 1 }}><Body bold numberOfLines={1}>{f.n}</Body><Body small muted>{`${f.s} · ${f.date}`}</Body></View></View>
          </Item>
        )) : <Body small muted>{tl('Nessun file nel workspace: caricane uno con la graffetta.')}</Body>}
      </Sheet>
    </KeyboardAvoidingView>
    </Modal>
  );
}
