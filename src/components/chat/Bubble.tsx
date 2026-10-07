import { memo, useRef } from 'react';
import { Animated, PanResponder, Pressable, Text, View } from 'react-native';

import { fmtClock, previewOf, type ChatMessage } from '@/store/chat';
import { ContactCard, FileCard, LinkText, LocationCard, MediaThumb, PollCard, Ticks, VoiceBubble, senderColor, useChatColors } from './parts';

type Props = {
  m: ChatMessage;
  me: string;
  quoted?: ChatMessage;
  isGroup: boolean;
  showSender: boolean;
  selected: boolean;
  highlight: boolean;
  fontSize: number;
  starred: boolean;
  onPress: () => void;
  onLongPress: () => void;
  onSwipeReply: () => void;
  onJump: (id: string) => void;
  onOpenMedia: () => void;
  onVote: (optId: string) => void;
  onReact: (m: ChatMessage) => void;
};

export const Bubble = memo(function Bubble(p: Props) {
  const c = useChatColors();
  const { m } = p;
  const mine = m.from === p.me;
  const x = useRef(new Animated.Value(0)).current;
  const cb = useRef(p.onSwipeReply); cb.current = p.onSwipeReply;
  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 2 && g.dx > 0,
    onPanResponderMove: (_, g) => x.setValue(Math.max(0, Math.min(70, g.dx))),
    onPanResponderRelease: (_, g) => { if (g.dx > 55) cb.current(); Animated.spring(x, { toValue: 0, useNativeDriver: true }).start(); },
    onPanResponderTerminate: () => Animated.spring(x, { toValue: 0, useNativeDriver: true }).start(),
  })).current;

  if (m.kind === 'system') {
    return <View style={{ alignSelf: 'center', backgroundColor: c.quoteBg, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, marginVertical: 6, maxWidth: '88%' }}><Text style={{ color: c.meta, fontSize: 12, textAlign: 'center' }}>{m.text}</Text></View>;
  }

  const bg = mine ? c.mine : c.theirs;
  const fg = mine ? c.mineText : c.theirsText;
  const reactions = Object.values(m.reactions ?? {});
  const reactionCounts = reactions.reduce<Record<string, number>>((a, e) => ({ ...a, [e]: (a[e] ?? 0) + 1 }), {});
  const mediaOnly = (m.kind === 'image' || m.kind === 'video') && !m.text;

  let body: React.ReactNode;
  if (m.deletedForAll) {
    body = <Text style={{ color: c.meta, fontSize: p.fontSize, fontStyle: 'italic' }}>🚫 {mine ? 'Hai eliminato questo messaggio' : 'Questo messaggio è stato eliminato'}</Text>;
  } else {
    body = (
      <>
        {m.forwarded && <Text style={{ color: c.meta, fontSize: 11, fontStyle: 'italic', marginBottom: 2 }}>↪ Inoltrato</Text>}
        {(m.kind === 'image' || m.kind === 'video') && <MediaThumb m={m} onOpen={p.onOpenMedia} onLongPress={p.onLongPress} />}
        {m.kind === 'audio' && <VoiceBubble m={m} mine={mine} />}
        {m.kind === 'file' && <FileCard m={m} onLongPress={p.onLongPress} />}
        {m.kind === 'location' && <LocationCard m={m} onLongPress={p.onLongPress} />}
        {m.kind === 'contact' && <ContactCard m={m} />}
        {m.kind === 'poll' && <PollCard m={m} me={p.me} onVote={p.onVote} />}
        {!!m.text && m.kind !== 'poll' && m.kind !== 'audio' ? <View style={{ marginTop: m.kind === 'text' ? 0 : 6 }}><LinkText text={m.text} color={fg} size={p.fontSize} /></View> : null}
      </>
    );
  }

  const meta = (
    <View style={{ flexDirection: 'row', alignSelf: 'flex-end', alignItems: 'center', gap: 3, marginTop: 2 }}>
      {p.starred && <Text style={{ fontSize: 10, color: c.meta }}>★</Text>}
      {m.expiresAt ? <Text style={{ fontSize: 10, color: c.meta }}>⏳</Text> : null}
      {m.edited && !m.deletedForAll ? <Text style={{ fontSize: 11, color: c.meta }}>modificato</Text> : null}
      <Text style={{ fontSize: 11, color: c.meta }}>{fmtClock(m.ts)}</Text>
      {mine && !m.deletedForAll && <Ticks status={m.status} />}
    </View>
  );

  return (
    <View style={{ backgroundColor: p.selected ? '#34b7f133' : p.highlight ? '#f5c54233' : 'transparent', paddingHorizontal: 10, paddingVertical: 1 }} {...pan.panHandlers}>
      <Animated.View style={{ transform: [{ translateX: x }], alignItems: mine ? 'flex-end' : 'flex-start' }}>
        <Pressable onPress={p.onPress} onLongPress={p.onLongPress} delayLongPress={280} style={{ maxWidth: '84%' }} accessibilityLabel={`${mine ? 'Tu' : m.from}: ${previewOf(m)}`}>
          <View style={{ backgroundColor: bg, borderRadius: 12, borderTopRightRadius: mine ? 3 : 12, borderTopLeftRadius: mine ? 12 : 3, padding: mediaOnly ? 3 : 8, paddingBottom: 5, marginBottom: reactions.length ? 10 : 0 }}>
            {p.isGroup && !mine && p.showSender && <Text style={{ color: senderColor(m.from), fontWeight: '700', fontSize: 13, marginBottom: 2 }}>{m.from}</Text>}
            {p.quoted && !m.deletedForAll && (
              <Pressable onPress={() => p.onJump(p.quoted!.id)} style={{ backgroundColor: c.quoteBg, borderLeftWidth: 4, borderLeftColor: senderColor(p.quoted.from), borderRadius: 6, padding: 6, marginBottom: 4 }}>
                <Text style={{ color: senderColor(p.quoted.from), fontSize: 12, fontWeight: '700' }}>{p.quoted.from === p.me ? 'Tu' : p.quoted.from}</Text>
                <Text numberOfLines={2} style={{ color: c.meta, fontSize: 13 }}>{previewOf(p.quoted)}</Text>
              </Pressable>
            )}
            {body}
            {mediaOnly ? <View style={{ position: 'absolute', right: 8, bottom: 6, backgroundColor: '#0007', borderRadius: 8, paddingHorizontal: 5, flexDirection: 'row', gap: 3 }}><Text style={{ color: '#fff', fontSize: 11 }}>{fmtClock(m.ts)}</Text>{mine && <Ticks status={m.status} />}</View> : meta}
            {reactions.length > 0 && (
              <Pressable onPress={() => p.onReact(m)} style={{ position: 'absolute', bottom: -12, [mine ? 'right' : 'left']: 8, flexDirection: 'row', backgroundColor: c.theirs, borderRadius: 12, paddingHorizontal: 6, paddingVertical: 1, borderWidth: 1, borderColor: c.quoteBg }}>
                {Object.entries(reactionCounts).map(([e, n]) => <Text key={e} style={{ fontSize: 13 }}>{e}{n > 1 ? n : ''}</Text>)}
              </Pressable>
            )}
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
});
