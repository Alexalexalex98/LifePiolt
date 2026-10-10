import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text, TextInput } from '@/components/T';

import { Press, hit } from '@/components/ui';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { Icon } from '@/lib/icons';
import {
  OVERLAY_TTL_MS, REACTIONS, clockLabel, commentOpacity, overlayComments,
  type LiveComment, type LiveReaction, type ReactionKind,
} from '@/lib/liveRoom';

const NATIVE = Platform.OS !== 'web';
const SOFT = 'rgba(0,0,0,0.45)';

/** Pulsante tondo sul video; `slash` barra l'icona (microfono spento, camera spenta). */
export function RoundBtn({ icon, label, onPress, on, slash, color, size = 46, danger }: { icon: string; label: string; onPress: () => void; on?: boolean; slash?: boolean; color?: string; size?: number; danger?: boolean }) {
  return (
    <Press onPress={onPress} accessibilityLabel={label} selected={on} hitSlop={hit(size)} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: danger ? '#e5484d' : on ? '#fff' : SOFT, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size={Math.round(size * 0.46)} color={danger ? '#fff' : on ? '#111' : color ?? '#fff'} stroke={2} />
      {slash ? <View style={{ position: 'absolute', width: size * 0.62, height: 2.5, borderRadius: 2, backgroundColor: danger ? '#fff' : '#ff6b6b', transform: [{ rotate: '-45deg' }] }} /> : null}
    </Press>
  );
}

function Chip({ children, bg = SOFT, style }: { children: React.ReactNode; bg?: string; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: bg, borderRadius: 999, paddingVertical: 5, paddingHorizontal: 10 }, style]}>{children}</View>;
}

/** In alto, su sfumatura: LIVE, durata, spettatori, titolo e relatore, chiudi. */
export function TopBar({ title, host, live, elapsedMs, viewers, onClose, closeLabel, topInset, sideInset, extra }: {
  title: string; host: string; live: boolean; elapsedMs: number; viewers: number | null; onClose: () => void; closeLabel: string; topInset: number; sideInset: number; extra?: React.ReactNode;
}) {
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', top: 0, start: 0, end: 0 }}>
      <LinearGradient pointerEvents="none" colors={['rgba(0,0,0,0.7)', 'rgba(0,0,0,0)']} style={{ position: 'absolute', top: 0, start: 0, end: 0, height: topInset + 110 }} />
      <View pointerEvents="box-none" style={{ paddingTop: topInset + 8, paddingStart: sideInset + 12, paddingEnd: sideInset + 12, gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Chip bg={live ? '#e5484d' : SOFT}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#fff', opacity: live ? 1 : 0.5 }} />
            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.6 }}>{live ? 'LIVE' : 'IN ATTESA'}</Text>
          </Chip>
          {live ? <Chip><Icon name="clock" size={12} color="#fff" /><Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>{clockLabel(elapsedMs)}</Text></Chip> : null}
          {viewers !== null ? <Chip><Icon name="eye" size={12} color="#fff" /><Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }} accessibilityLabel={`${viewers} spettatori`}>{String(viewers)}</Text></Chip> : null}
          <View style={{ flex: 1 }} />
          {extra}
          <RoundBtn icon="x" label={closeLabel} onPress={onClose} size={40} />
        </View>
        <View>
          <Text numberOfLines={1} style={{ color: '#fff', fontSize: 16, fontWeight: '800', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 4 }}>{title}</Text>
          <Text numberOfLines={1} style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12.5, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 4 }}>{host}</Text>
        </View>
      </View>
    </View>
  );
}

function CommentRow({ c, now, onPress }: { c: LiveComment; now: number; onPress?: () => void }) {
  const reduce = useReduceMotion();
  const enter = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  useEffect(() => {
    if (reduce) return;
    Animated.timing(enter, { toValue: 1, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE }).start();
  }, [enter, reduce]);
  const ttl = c.kind === 'system' ? OVERLAY_TTL_MS / 2 : c.kind === 'question' ? OVERLAY_TTL_MS * 1.5 : OVERLAY_TTL_MS;
  const fade = commentOpacity(now - c.ts, ttl);
  const q = c.kind === 'question';
  const sys = c.kind === 'system';
  const body = (
    <View style={{ alignSelf: 'flex-start', maxWidth: '100%', backgroundColor: q ? 'rgba(143,164,255,0.38)' : 'rgba(0,0,0,0.38)', borderRadius: 14, paddingVertical: 5, paddingHorizontal: 10 }}>
      {sys ? (
        <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12.5, fontStyle: 'italic' }}>{`${c.author} ${c.text}`}</Text>
      ) : (
        <Text style={{ color: '#fff', fontSize: 13.5, lineHeight: 18 }}>
          <Text style={{ fontWeight: '800', color: c.mine ? '#ffd166' : 'rgba(255,255,255,0.78)' }}>{q ? `${c.author} · Domanda  ` : `${c.author}  `}</Text>
          <Text>{c.text}</Text>
        </Text>
      )}
    </View>
  );
  return (
    <Animated.View style={{ opacity: Animated.multiply(enter, fade), transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }], marginTop: 4 }}>
      {onPress ? <Press onPress={onPress} accessibilityLabel={`${c.author}: ${c.text}`} feedback={0.8}>{body}</Press> : body}
    </Animated.View>
  );
}

/** Ultimi commenti sul lato sinistro, in basso, che svaniscono col tempo (come nelle live). */
export function CommentsOverlay({ comments, now, onPickComment, style }: { comments: LiveComment[]; now: number; onPickComment?: (c: LiveComment) => void; style?: StyleProp<ViewStyle> }) {
  const shown = overlayComments(comments, now);
  return (
    <View pointerEvents="box-none" style={[{ justifyContent: 'flex-end' }, style]} accessibilityLiveRegion="polite">
      {shown.map((c) => <CommentRow key={c.id} c={c} now={now} onPress={onPickComment ? () => onPickComment(c) : undefined} />)}
    </View>
  );
}

/** Commento fissato dal relatore. */
export function PinnedBanner({ c, onUnpin }: { c: LiveComment; onUnpin?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,209,102,0.92)', borderRadius: 14, paddingVertical: 7, paddingHorizontal: 10 }}>
      <Icon name="pin" size={14} color="#222" />
      <Text numberOfLines={2} style={{ color: '#222', fontSize: 12.5, flex: 1 }}><Text style={{ fontWeight: '800' }}>{`${c.author}  `}</Text>{c.text}</Text>
      {onUnpin ? <Press onPress={onUnpin} accessibilityLabel="Togli il commento fissato" hitSlop={hit(24)}><Icon name="x" size={15} color="#222" stroke={2.4} /></Press> : null}
    </View>
  );
}

function Floating({ r, lane, reduce, onDone }: { r: LiveReaction; lane: number; reduce: boolean; onDone: () => void }) {
  const p = useRef(new Animated.Value(0)).current;
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    Animated.timing(p, { toValue: 1, duration: reduce ? 700 : 2600, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE }).start(({ finished }) => { if (finished) done.current(); });
  }, [p, reduce]);
  const def = REACTIONS.find((x) => x.kind === r.kind) ?? REACTIONS[0];
  const rise = 240 + (lane % 3) * 30;
  return (
    <Animated.View pointerEvents="none" style={{
      position: 'absolute', bottom: 0, end: 4 + (lane % 5) * 9,
      opacity: p.interpolate({ inputRange: [0, 0.1, 0.75, 1], outputRange: [0, 1, 0.9, 0] }),
      transform: [
        { translateY: reduce ? 0 : p.interpolate({ inputRange: [0, 1], outputRange: [0, -rise] }) },
        { translateX: reduce ? 0 : p.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, lane % 2 ? 14 : -14, lane % 2 ? -6 : 6] }) },
        { scale: p.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0.5, 1.15, 1] }) },
      ],
    }}>
      <Icon name={def.icon} size={28} color={def.color} fill={def.kind === 'heart' ? def.color : 'none'} stroke={2} />
    </Animated.View>
  );
}

/** Cuoricini e reazioni che salgono sul lato destro. */
export function ReactionsLayer({ reactions, onDone, style }: { reactions: LiveReaction[]; onDone: (id: string) => void; style?: StyleProp<ViewStyle> }) {
  const reduce = useReduceMotion();
  const recent = reactions.slice(-18);
  return (
    <View pointerEvents="none" style={style}>
      {recent.map((r, i) => <Floating key={r.id} r={r} lane={i} reduce={reduce} onDone={() => onDone(r.id)} />)}
    </View>
  );
}

/** Colonna di reazioni (per chi guarda). */
export function ReactionButtons({ onReact, disabled }: { onReact: (k: ReactionKind) => void; disabled?: boolean }) {
  return (
    <View style={{ gap: 8, alignItems: 'center', opacity: disabled ? 0.4 : 1 }}>
      {REACTIONS.map((r) => <RoundBtn key={r.kind} icon={r.icon} label={r.label} color={r.color} size={42} onPress={() => { if (!disabled) onReact(r.kind); }} />)}
    </View>
  );
}

/** Composer di commento in basso: testo, invio, interruttore "Domanda al relatore". */
export function Composer({ onSend, canWrite, blockedReason, allowQuestion, bottomInset, sideInset, right }: {
  onSend: (text: string, question: boolean) => void; canWrite: boolean; blockedReason?: string; allowQuestion: boolean; bottomInset: number; sideInset: number; right?: React.ReactNode;
}) {
  const [text, setText] = useState('');
  const [question, setQuestion] = useState(false);
  const send = () => {
    const v = text.trim();
    if (!v || !canWrite) return;
    onSend(v, question);
    setText('');
    setQuestion(false);
  };
  return (
    <View style={{ paddingBottom: bottomInset + 8, paddingStart: sideInset + 12, paddingEnd: sideInset + 12, paddingTop: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 999, borderWidth: 1, borderColor: question ? '#8fa4ff' : 'rgba(255,255,255,0.25)', paddingStart: 14, paddingEnd: 4, minHeight: 46 }}>
          <TextInput
            value={text}
            onChangeText={setText}
            editable={canWrite}
            placeholder={!canWrite ? blockedReason ?? 'Non puoi scrivere' : question ? 'Scrivi la tua domanda al relatore' : 'Scrivi un commento'}
            placeholderTextColor="rgba(255,255,255,0.6)"
            maxLength={200}
            returnKeyType="send"
            onSubmitEditing={send}
            blurOnSubmit={false}
            accessibilityLabel={question ? 'Domanda al relatore' : 'Commento'}
            style={{ flex: 1, color: '#fff', fontSize: 15, paddingVertical: 8 }}
          />
          {allowQuestion ? <RoundBtn icon="info" label={question ? 'Invia come commento' : 'Invia come domanda al relatore'} on={question} onPress={() => canWrite && setQuestion((q) => !q)} size={38} /> : null}
          <View style={{ width: 4 }} />
          <RoundBtn icon="send" label="Invia" onPress={send} size={38} on={!!text.trim() && canWrite} />
        </View>
        {right}
      </View>
    </View>
  );
}

/** Avviso sul video (offline, riconnessione, anteprima). */
export function NoticeChip({ icon, text, tone = 'info' }: { icon: string; text: string; tone?: 'info' | 'warn' | 'bad' }) {
  const bg = tone === 'bad' ? 'rgba(229,72,77,0.92)' : tone === 'warn' ? 'rgba(255,209,102,0.95)' : 'rgba(0,0,0,0.5)';
  const fg = tone === 'warn' ? '#222' : '#fff';
  return (
    <View accessibilityRole="alert" style={{ flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: bg, borderRadius: 12, paddingVertical: 6, paddingHorizontal: 10, alignSelf: 'flex-start', maxWidth: '100%' }}>
      <Icon name={icon} size={14} color={fg} stroke={2.1} />
      <Text style={{ color: fg, fontSize: 12, lineHeight: 16, flexShrink: 1 }}>{text}</Text>
    </View>
  );
}
