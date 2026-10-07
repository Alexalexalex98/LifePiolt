import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { Body, Btn, Input, Sheet } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { currentLocation, persistFile, pickContact, pickDocument, pickFromGallery, takePhoto, toWaveform, type Picked } from '@/lib/chatMedia';
import { uid } from '@/lib/format';
import { fmtDur, previewOf, type ChatMessage, type Poll } from '@/store/chat';
import { toast } from '@/store/toast';
import { senderColor, useChatColors } from './parts';

const EMOJI = '😀 😃 😄 😁 😆 😅 😂 🤣 🙂 😉 😊 😍 🥰 😘 😎 🤔 😐 😴 😢 😭 😡 🤯 😱 🤗 🙏 👍 👎 👏 🙌 💪 🤝 👀 🔥 ❤️ 💔 💯 ✨ 🎉 🎂 ☕ 🍕 🍺 ⚽ 🏃 🚗 ✈️ 🏠 💼 📅 ✅ ❌ ⭐ 🌞 🌙 ☔'.split(' ');

type Props = {
  me: string;
  draft: string;
  enterSends: boolean;
  fontSize: number;
  replyTo?: ChatMessage;
  editing?: ChatMessage;
  disabledReason?: string;
  onDraft: (v: string) => void;
  onSendText: (text: string) => void;
  onSendPicked: (p: Picked, caption?: string) => void;
  onSendVoice: (uri: string, durationMs: number, waveform: number[]) => void;
  onSendPoll: (p: Poll) => void;
  onCancelContext: () => void;
};

export function Composer(p: Props) {
  const t = useTheme();
  const c = useChatColors();
  const [attach, setAttach] = useState(false);
  const [emoji, setEmoji] = useState(false);
  const [poll, setPoll] = useState(false);
  const [preview, setPreview] = useState<Picked[] | null>(null);
  const [caption, setCaption] = useState('');
  const inputRef = useRef<TextInput>(null);

  /* ---- vocale ---- */
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const [rec, setRec] = useState<'off' | 'on' | 'paused'>('off');
  const [ms, setMs] = useState(0);
  const levels = useRef<number[]>([]);
  const [live, setLive] = useState<number[]>([]);
  const mode = useRef<'none' | 'hold' | 'lock'>('none');
  const startP = useRef<Promise<boolean> | null>(null);
  const touchX = useRef(0);
  const slideCancel = useRef(false);
  const [willCancel, setWillCancel] = useState(false);

  useEffect(() => {
    if (rec !== 'on') return;
    const id = setInterval(() => {
      const s = recorder.getStatus();
      setMs(s.durationMillis);
      if (s.metering != null) { levels.current.push(s.metering); setLive(levels.current.slice(-24)); }
    }, 120);
    return () => clearInterval(id);
  }, [rec, recorder]);

  async function startRec(): Promise<boolean> {
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) { toast('Permesso microfono negato: abilitalo da Impostazioni'); return false; }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      levels.current = []; setLive([]); setMs(0);
      recorder.record();
      setRec('on');
      return true;
    } catch {
      toast(Platform.OS === 'web' ? 'La registrazione vocale richiede l’app sul telefono' : 'Impossibile avviare la registrazione');
      return false;
    }
  }
  async function cancelRec() {
    try { await recorder.stop(); } catch { /* già fermo */ }
    await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
    setRec('off'); setMs(0); mode.current = 'none'; setWillCancel(false);
  }
  async function sendRec() {
    const dur = recorder.getStatus().durationMillis || ms;
    try { await recorder.stop(); } catch { /* ignore */ }
    await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
    setRec('off'); mode.current = 'none'; setWillCancel(false);
    const uri = recorder.uri;
    if (!uri || dur < 600) { toast('Registrazione troppo breve'); return; }
    p.onSendVoice(persistFile(uri, 'voce.m4a'), dur, toWaveform(levels.current));
  }
  function pauseRec() {
    if (rec === 'on') { recorder.pause(); setRec('paused'); } else { recorder.record(); setRec('on'); }
  }

  /* ---- allegati ---- */
  async function run(fn: () => Promise<Picked[] | Picked | null>) {
    setAttach(false);
    try {
      const r = await fn();
      const list = r ? (Array.isArray(r) ? r : [r]) : [];
      if (!list.length) return;
      if (list.every((x) => x.kind === 'image' || x.kind === 'video')) { setCaption(''); setPreview(list); }
      else list.forEach((x) => p.onSendPicked(x));
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Operazione non riuscita');
    }
  }

  const sendText = () => { const v = p.draft.trim(); if (v) p.onSendText(v); };
  const has = p.draft.trim().length > 0;

  if (p.disabledReason) {
    return <View style={{ padding: 14, alignItems: 'center', backgroundColor: t.card }}><Body small muted>{p.disabledReason}</Body></View>;
  }

  const ctx = p.editing ?? p.replyTo;
  return (
    <View style={{ backgroundColor: t.card }}>
      {ctx && (
        <View style={{ flexDirection: 'row', alignItems: 'center', margin: 8, marginBottom: 0, padding: 8, borderRadius: 10, backgroundColor: c.quoteBg, borderLeftWidth: 4, borderLeftColor: senderColor(ctx.from) }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: senderColor(ctx.from), fontWeight: '700', fontSize: 12 }}>{p.editing ? 'Modifica messaggio' : ctx.from === p.me ? 'Tu' : ctx.from}</Text>
            <Text numberOfLines={1} style={{ color: t.muted, fontSize: 13 }}>{previewOf(ctx)}</Text>
          </View>
          <Pressable onPress={p.onCancelContext} hitSlop={10}><Text style={{ color: t.muted, fontSize: 18 }}>✕</Text></Pressable>
        </View>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', padding: 8, gap: 6 }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', backgroundColor: t.input, borderRadius: 22, borderWidth: 1, borderColor: t.inputBorder, paddingHorizontal: 10 }}>
          <Pressable onPress={() => setEmoji(true)} hitSlop={6} style={{ paddingVertical: 9 }} accessibilityLabel="Emoji"><Text style={{ fontSize: 22 }}>🙂</Text></Pressable>
          <TextInput
            ref={inputRef}
            value={p.draft}
            onChangeText={p.onDraft}
            placeholder="Messaggio"
            placeholderTextColor={t.muted}
            multiline
            blurOnSubmit={p.enterSends}
            onSubmitEditing={p.enterSends ? sendText : undefined}
            returnKeyType={p.enterSends ? 'send' : 'default'}
            style={{ flex: 1, color: t.text, fontSize: p.fontSize, maxHeight: 120, paddingHorizontal: 8, paddingTop: 9, paddingBottom: 9 }}
          />
          {!p.editing && <Pressable onPress={() => setAttach(true)} hitSlop={6} style={{ paddingVertical: 9 }} accessibilityLabel="Allega"><Text style={{ fontSize: 22 }}>📎</Text></Pressable>}
          {!p.editing && !has && <Pressable onPress={() => run(takePhoto)} hitSlop={6} style={{ paddingVertical: 9, paddingLeft: 8 }} accessibilityLabel="Fotocamera"><Text style={{ fontSize: 22 }}>📷</Text></Pressable>}
        </View>
        {has && rec === 'off' ? (
          <Pressable onPress={sendText} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#00a884', alignItems: 'center', justifyContent: 'center' }} accessibilityLabel={p.editing ? 'Salva modifica' : 'Invia'}><Text style={{ color: '#fff', fontSize: 18 }}>{p.editing ? '✓' : '➤'}</Text></Pressable>
        ) : (
          <Pressable
            onPress={() => { if (mode.current === 'lock') void sendRec(); else if (rec === 'off') { mode.current = 'lock'; void startRec().then((ok) => { if (!ok) mode.current = 'none'; }); } }}
            onLongPress={() => { if (rec !== 'off') return; mode.current = 'hold'; slideCancel.current = false; startP.current = startRec(); void startP.current.then((ok) => { if (!ok) mode.current = 'none'; }); }}
            delayLongPress={250}
            onTouchStart={(e) => { touchX.current = e.nativeEvent.pageX; }}
            onTouchMove={(e) => { if (mode.current === 'hold') { const c = touchX.current - e.nativeEvent.pageX > 90; slideCancel.current = c; setWillCancel(c); } }}
            onPressOut={() => { if (mode.current !== 'hold') return; void (startP.current ?? Promise.resolve(false)).then((ok) => { if (!ok) return; if (slideCancel.current) void cancelRec(); else void sendRec(); }); }}
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: rec === 'off' ? '#00a884' : willCancel ? '#e5484d' : '#00a884', alignItems: 'center', justifyContent: 'center', transform: [{ scale: rec !== 'off' && mode.current === 'hold' ? 1.35 : 1 }] }}
            accessibilityLabel={rec === 'off' ? 'Messaggio vocale: tocca o tieni premuto' : 'Invia vocale'}>
            <Text style={{ fontSize: 20, color: '#fff' }}>{rec === 'off' ? '🎤' : '➤'}</Text>
          </Pressable>
        )}
        {rec !== 'off' && (
          <View style={{ position: 'absolute', left: 8, right: 58, top: 8, bottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, backgroundColor: t.input, borderRadius: 22, borderWidth: 1, borderColor: t.inputBorder }}>
            <Text style={{ color: rec === 'on' ? '#e5484d' : t.muted, fontSize: 15, fontWeight: '700', width: 52 }}>● {fmtDur(ms)}</Text>
            {mode.current === 'hold'
              ? <Text style={{ flex: 1, color: willCancel ? '#e5484d' : t.muted, fontSize: 13 }}>{willCancel ? 'Rilascia per annullare' : '‹ Scorri per annullare'}</Text>
              : <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 2, height: 28 }}>{live.map((l, i) => <View key={i} style={{ flex: 1, height: Math.max(3, ((l + 60) / 60) * 26), borderRadius: 2, backgroundColor: t.muted }} />)}</View>}
            {mode.current === 'lock' && <Pressable onPress={pauseRec} hitSlop={10} accessibilityLabel={rec === 'on' ? 'Pausa' : 'Riprendi'}><Text style={{ fontSize: 20, color: t.text }}>{rec === 'on' ? '⏸' : '⏺'}</Text></Pressable>}
            {mode.current === 'lock' && <Pressable onPress={cancelRec} hitSlop={10} accessibilityLabel="Annulla registrazione"><Text style={{ fontSize: 20 }}>🗑️</Text></Pressable>}
          </View>
        )}
      </View>

      <Sheet visible={emoji} title="Emoji" onClose={() => setEmoji(false)}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {EMOJI.map((e) => <Pressable key={e} onPress={() => p.onDraft(p.draft + e)} style={{ width: '12.5%', alignItems: 'center', paddingVertical: 8 }}><Text style={{ fontSize: 26 }}>{e}</Text></Pressable>)}
        </View>
      </Sheet>

      <Sheet visible={attach} title="Allega" onClose={() => setAttach(false)}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {([
            ['📄', 'Documento', () => run(pickDocument), '#7f66ff'],
            ['📷', 'Fotocamera', () => run(takePhoto), '#e5484d'],
            ['🖼️', 'Galleria', () => run(pickFromGallery), '#bf59cf'],
            ['📍', 'Posizione', () => run(currentLocation), '#1fa855'],
            ['👤', 'Contatto', () => run(pickContact), '#009de2'],
            ['📊', 'Sondaggio', () => { setAttach(false); setPoll(true); }, '#e8a317'],
          ] as [string, string, () => void, string][]).map(([ic, label, fn, col]) => (
            <Pressable key={label} onPress={fn} style={{ width: '33.3%', alignItems: 'center', paddingVertical: 14 }} accessibilityLabel={label}>
              <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: col, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 24 }}>{ic}</Text></View>
              <Text style={{ color: t.text, fontSize: 13, marginTop: 6 }}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </Sheet>

      <Sheet visible={!!preview} title={preview ? `Invia ${preview.length} ${preview.length === 1 ? 'elemento' : 'elementi'}` : ''} onClose={() => setPreview(null)}>
        <ScrollView horizontal style={{ marginBottom: 10 }}>
          {preview?.map((x, i) => <View key={i} style={{ marginRight: 8, width: 110, height: 110, borderRadius: 10, backgroundColor: t.item, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: t.muted, fontSize: 12 }}>{x.kind === 'video' ? '🎥 Video' : '📷 Foto'} {i + 1}</Text></View>)}
        </ScrollView>
        <Input placeholder="Aggiungi una didascalia…" value={caption} onChangeText={setCaption} />
        <Btn title="Invia" onPress={() => { preview?.forEach((x, i) => p.onSendPicked(x, i === 0 ? caption.trim() || undefined : undefined)); setPreview(null); }} />
      </Sheet>

      <PollSheet visible={poll} onClose={() => setPoll(false)} onCreate={(pl) => { setPoll(false); p.onSendPoll(pl); }} />
    </View>
  );
}

function PollSheet({ visible, onClose, onCreate }: { visible: boolean; onClose: () => void; onCreate: (p: Poll) => void }) {
  const [q, setQ] = useState('');
  const [opts, setOpts] = useState(['', '']);
  const [multi, setMulti] = useState(false);
  const t = useTheme();
  return (
    <Sheet visible={visible} title="Nuovo sondaggio" onClose={onClose}>
      <Input placeholder="Domanda" value={q} onChangeText={setQ} />
      {opts.map((o, i) => <Input key={i} placeholder={`Opzione ${i + 1}`} value={o} onChangeText={(v) => setOpts(opts.map((x, j) => (j === i ? v : x)))} />)}
      {opts.length < 8 && <Btn small ghost title="+ Aggiungi opzione" onPress={() => setOpts([...opts, ''])} />}
      <Pressable onPress={() => setMulti(!multi)} style={{ paddingVertical: 12 }}><Text style={{ color: t.text }}>{multi ? '☑' : '☐'} Consenti più risposte</Text></Pressable>
      <Btn title="Invia sondaggio" onPress={() => {
        const options = opts.map((x) => x.trim()).filter(Boolean);
        if (!q.trim() || options.length < 2) { toast('Scrivi la domanda e almeno 2 opzioni'); return; }
        onCreate({ q: q.trim(), multi, options: options.map((x) => ({ id: uid(), t: x, votes: [] })) });
        setQ(''); setOpts(['', '']); setMulti(false);
      }} />
    </Sheet>
  );
}
