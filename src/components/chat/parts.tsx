import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useState } from 'react';
import { FlatList, Linking, Modal, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/use-theme';
import { fmtDur, urlRe, type ChatMessage, type MsgStatus } from '@/store/chat';
import { fmtSize } from '@/lib/chatMedia';

export function useChatColors() {
  const t = useTheme();
  const light = t.bg === '#eef1f6' || t.text === '#10151d';
  return {
    mine: light ? '#d9fdd3' : '#005c4b',
    theirs: light ? '#ffffff' : '#202c33',
    mineText: light ? '#111b21' : '#e9edef',
    theirsText: light ? '#111b21' : '#e9edef',
    meta: light ? '#667781' : '#9aa6ad',
    read: '#34b7f1',
    wall: light ? '#efeae2' : '#0b141a',
    quoteBg: light ? '#00000012' : '#00000040',
    light,
  };
}

export const fontPx = (s: 'S' | 'M' | 'L') => (s === 'S' ? 14 : s === 'L' ? 18 : 16);

export function Ticks({ status, size = 13 }: { status: MsgStatus; size?: number }) {
  const c = useChatColors();
  if (status === 'sending') return <Text style={{ color: c.meta, fontSize: size }}>🕓</Text>;
  const double = status === 'delivered' || status === 'read';
  return <Text style={{ color: status === 'read' ? c.read : c.meta, fontSize: size, fontWeight: '700', letterSpacing: -2 }}>{double ? '✓✓' : '✓'}</Text>;
}

export const senderColor = (name: string) => `hsl(${Math.abs([...name].reduce((h, ch) => ((h << 5) - h + ch.charCodeAt(0)) | 0, 0)) % 360},60%,62%)`;

/** Testo con link cliccabili. */
export function LinkText({ text, color, size }: { text: string; color: string; size: number }) {
  const parts = text.split(urlRe);
  return (
    <Text style={{ color, fontSize: size, lineHeight: size * 1.35 }}>
      {parts.map((p, i) => (/^(https?:\/\/|www\.)/i.test(p)
        ? <Text key={i} style={{ color: '#34a0f1', textDecorationLine: 'underline' }} onPress={() => void Linking.openURL(/^https?:/i.test(p) ? p : `https://${p}`)}>{p}</Text>
        : <Text key={i}>{p}</Text>))}
    </Text>
  );
}

/* ---------- vocale ---------- */
export function VoiceBubble({ m, mine }: { m: ChatMessage; mine: boolean }) {
  const c = useChatColors();
  const player = useAudioPlayer(m.media?.uri ?? null);
  const st = useAudioPlayerStatus(player);
  const [rate, setRate] = useState(1);
  const wave = m.media?.waveform ?? Array.from({ length: 32 }, (_, i) => 0.25 + ((i * 7) % 5) / 10);
  const total = (m.media?.durationMs ?? st.duration * 1000) || 1;
  const pos = st.currentTime * 1000;
  const progress = Math.min(1, pos / total);
  function toggle() {
    if (st.playing) player.pause();
    else { if (st.didJustFinish || pos >= total - 100) void player.seekTo(0); player.play(); }
  }
  function speed() {
    const next = rate === 1 ? 1.5 : rate === 1.5 ? 2 : 1;
    setRate(next); player.setPlaybackRate(next);
  }
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 210 }}>
      <Pressable onPress={toggle} hitSlop={8} accessibilityLabel={st.playing ? 'Pausa' : 'Riproduci'}>
        <Text style={{ fontSize: 24, color: c.meta }}>{st.playing ? '❚❚' : '▶'}</Text>
      </Pressable>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', height: 28, gap: 2 }}>
          {wave.map((h, i) => (
            <View key={i} style={{ flex: 1, height: Math.max(3, h * 26), borderRadius: 2, backgroundColor: i / wave.length <= progress ? c.read : c.meta, opacity: i / wave.length <= progress ? 1 : 0.55 }} />
          ))}
        </View>
        <Text style={{ color: c.meta, fontSize: 11 }}>{fmtDur(st.playing || pos > 0 ? pos : total)}</Text>
      </View>
      <Pressable onPress={speed} hitSlop={8} style={{ backgroundColor: c.quoteBg, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 }}>
        <Text style={{ color: mine ? c.mineText : c.theirsText, fontSize: 11, fontWeight: '700' }}>{rate}x</Text>
      </Pressable>
    </View>
  );
}

/* ---------- foto/video ---------- */
export function MediaThumb({ m, onOpen }: { m: ChatMessage; onOpen: () => void }) {
  const { width } = useWindowDimensions();
  const w = Math.min(260, width * 0.62);
  const ratio = m.media?.w && m.media?.h ? Math.min(1.6, Math.max(0.6, m.media.h / m.media.w)) : 1;
  return (
    <Pressable onPress={onOpen} accessibilityLabel={m.kind === 'video' ? 'Apri video' : 'Apri foto'}>
      <View style={{ width: w, height: w * ratio, borderRadius: 10, overflow: 'hidden', backgroundColor: '#0006' }}>
        <Image source={{ uri: m.media?.uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
        {m.kind === 'video' && (
          <View style={{ ...absoluteFill, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: '#000a', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontSize: 20 }}>▶</Text></View>
            {m.media?.durationMs ? <Text style={{ position: 'absolute', left: 8, bottom: 6, color: '#fff', fontSize: 11 }}>{fmtDur(m.media.durationMs)}</Text> : null}
          </View>
        )}
      </View>
    </Pressable>
  );
}
const absoluteFill = { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 };

function VideoPage({ uri, active }: { uri: string; active: boolean }) {
  const p = useVideoPlayer(uri, (pl) => { pl.loop = false; });
  if (!active) p.pause();
  return <VideoView player={p} style={{ width: '100%', height: '100%' }} nativeControls contentFit="contain" />;
}

export function MediaViewer({ items, index, onClose }: { items: ChatMessage[]; index: number | null; onClose: () => void }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [cur, setCur] = useState(index ?? 0);
  if (index == null) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <FlatList
          data={items}
          horizontal pagingEnabled
          initialScrollIndex={index}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          keyExtractor={(m) => m.id}
          onMomentumScrollEnd={(e) => setCur(Math.round(e.nativeEvent.contentOffset.x / width))}
          renderItem={({ item, index: i }) => (
            <View style={{ width, justifyContent: 'center' }}>
              {item.kind === 'video' ? <VideoPage uri={item.media!.uri} active={i === cur} /> : <Image source={{ uri: item.media!.uri }} style={{ width: '100%', height: '100%' }} contentFit="contain" />}
              {item.text ? <Text style={{ position: 'absolute', bottom: insets.bottom + 16, left: 16, right: 16, color: '#fff', textAlign: 'center', fontSize: 15 }}>{item.text}</Text> : null}
            </View>
          )}
        />
        <Pressable onPress={onClose} hitSlop={14} style={{ position: 'absolute', top: insets.top + 10, left: 16 }} accessibilityLabel="Chiudi"><Text style={{ color: '#fff', fontSize: 28 }}>✕</Text></Pressable>
        <Text style={{ position: 'absolute', top: insets.top + 16, alignSelf: 'center', color: '#fff', fontSize: 13 }}>{cur + 1} / {items.length}</Text>
      </View>
    </Modal>
  );
}

export function FileCard({ m }: { m: ChatMessage }) {
  const c = useChatColors();
  const ext = (m.media?.name ?? '').split('.').pop()?.toUpperCase().slice(0, 4) ?? 'FILE';
  return (
    <Pressable onPress={() => m.media?.uri && void Linking.openURL(m.media.uri).catch(() => undefined)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.quoteBg, borderRadius: 10, padding: 10, minWidth: 200 }}>
      <View style={{ width: 38, height: 44, borderRadius: 6, backgroundColor: '#e5484d', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>{ext}</Text></View>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={2} style={{ color: c.theirsText, fontSize: 14 }}>{m.media?.name ?? 'Documento'}</Text>
        <Text style={{ color: c.meta, fontSize: 11 }}>{fmtSize(m.media?.size)} {ext}</Text>
      </View>
    </Pressable>
  );
}

export function LocationCard({ m }: { m: ChatMessage }) {
  const c = useChatColors();
  const l = m.location!;
  return (
    <Pressable onPress={() => void Linking.openURL(`https://maps.google.com/?q=${l.lat},${l.lng}`)} style={{ minWidth: 210 }}>
      <View style={{ height: 96, borderRadius: 10, backgroundColor: c.light ? '#cfe3d4' : '#1e3b34', alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 34 }}>📍</Text></View>
      <Text style={{ color: c.theirsText, fontSize: 14, marginTop: 6 }}>{l.label ?? 'Posizione condivisa'}</Text>
      <Text style={{ color: c.meta, fontSize: 11 }}>{l.lat.toFixed(5)}, {l.lng.toFixed(5)} · tocca per aprire la mappa</Text>
    </Pressable>
  );
}

export function ContactCard({ m }: { m: ChatMessage }) {
  const c = useChatColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 200 }}>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.quoteBg, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 20 }}>👤</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: c.theirsText, fontSize: 15, fontWeight: '600' }}>{m.contact?.name}</Text>
        {m.contact?.phone ? <Text style={{ color: c.meta, fontSize: 12 }}>{m.contact.phone}</Text> : null}
      </View>
    </View>
  );
}

export function PollCard({ m, me, onVote }: { m: ChatMessage; me: string; onVote: (optId: string) => void }) {
  const c = useChatColors();
  const p = m.poll!;
  const total = p.options.reduce((s, o) => s + o.votes.length, 0);
  return (
    <View style={{ minWidth: 230 }}>
      <Text style={{ color: c.theirsText, fontSize: 15, fontWeight: '700' }}>📊 {p.q}</Text>
      <Text style={{ color: c.meta, fontSize: 11, marginBottom: 6 }}>{p.multi ? 'Seleziona una o più opzioni' : 'Seleziona un’opzione'}</Text>
      {p.options.map((o) => {
        const mineVote = o.votes.includes(me);
        const pct = total ? o.votes.length / total : 0;
        return (
          <Pressable key={o.id} onPress={() => onVote(o.id)} style={{ marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: c.theirsText, fontSize: 14 }}>{mineVote ? '☑ ' : '☐ '}{o.t}</Text>
              <Text style={{ color: c.meta, fontSize: 13 }}>{o.votes.length}</Text>
            </View>
            <View style={{ height: 4, borderRadius: 2, backgroundColor: c.quoteBg, marginTop: 3 }}><View style={{ height: 4, borderRadius: 2, width: `${pct * 100}%`, backgroundColor: c.read }} /></View>
          </Pressable>
        );
      })}
      <Text style={{ color: c.meta, fontSize: 11 }}>{total} {total === 1 ? 'voto' : 'voti'}</Text>
    </View>
  );
}


export const wallpapers: Record<string, { label: string; dark: string; light: string }> = {
  default: { label: 'Predefinito', dark: '#0b141a', light: '#efeae2' },
  verde: { label: 'Verde', dark: '#0e2a22', light: '#d6ecdf' },
  blu: { label: 'Blu', dark: '#0f1f33', light: '#d8e6f7' },
  viola: { label: 'Viola', dark: '#241a38', light: '#e6dcf5' },
  nero: { label: 'Nero', dark: '#000000', light: '#ffffff' },
};
export const wallColor = (key: string | undefined, c: { light: boolean }) => { const w = wallpapers[key ?? 'default'] ?? wallpapers.default; return c.light ? w.light : w.dark; };
