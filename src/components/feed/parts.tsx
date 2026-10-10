import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, Platform, Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '@/components/T';

import { UserAvatar } from '@/components/network';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useTheme } from '@/hooks/use-theme';
import { Icon } from '@/lib/icons';
import { useApp } from '@/store/app';
import { translateText } from '@/i18n/core';
import { artShapes, heroPaletteFor, paletteFor, textCardFontSize, type FeedPalette } from './feedColors.ts';

export const NATIVE = Platform.OS !== 'web';
/** Raggio unico di tutte le carte del feed (carte speciali, pillole, badge): coerente con radius.lg del tema. */
export const FEED_RADIUS = 22;
/** Margine laterale delle carte inset (le foto dei post sono invece a tutta larghezza). */
export const FEED_GUTTER = 16;

/** Tono (scuro/chiaro) e alto contrasto correnti, per scegliere la palette delle carte. */
export function useFeedTone(): { tone: 'dark' | 'light'; hc: boolean } {
  const t = useTheme();
  const hc = useApp((s) => s.accessibility.highContrast);
  return { tone: t.mode === 'light' ? 'light' : 'dark', hc };
}

/** Pulsante con micro-animazione di pressione (scala 0.96): solo transform, nessun layout. Rispetta "Riduci animazioni". */
export function PressScale({ children, onPress, style, label, hitSlop, role = 'button', disabled, to = 0.96 }: {
  children: ReactNode; onPress?: () => void; style?: StyleProp<ViewStyle>; label?: string; hitSlop?: number; role?: 'button' | 'link' | 'imagebutton'; disabled?: boolean; to?: number;
}) {
  const reduce = useReduceMotion();
  const s = useRef(new Animated.Value(1)).current;
  const go = (v: number) => { if (!reduce) Animated.spring(s, { toValue: v, speed: 40, bounciness: 4, useNativeDriver: NATIVE }).start(); };
  return (
    <Pressable onPress={onPress} disabled={disabled} onPressIn={() => go(to)} onPressOut={() => go(1)} hitSlop={hitSlop} accessibilityRole={role} accessibilityLabel={label ? translateText(label) : undefined} accessibilityState={disabled ? { disabled: true } : undefined}>
      <Animated.View style={[style, { transform: [{ scale: s }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

/** Icona d'azione 44x44 (area di tocco minima), con "pop" quando `pop` cambia a true (es. mi piace). */
export function IconBtn({ icon, color, fill, size = 25, label, onPress, pop, selected }: {
  icon: string; color?: string; fill?: string; size?: number; label: string; onPress: () => void; pop?: boolean; selected?: boolean;
}) {
  const th = useTheme();
  const reduce = useReduceMotion();
  const sc = useRef(new Animated.Value(1)).current;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (pop && !reduce) Animated.sequence([Animated.timing(sc, { toValue: 1.28, duration: 110, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE }), Animated.spring(sc, { toValue: 1, friction: 4, tension: 160, useNativeDriver: NATIVE })]).start();
  }, [pop, reduce, sc]);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={translateText(label)} accessibilityState={selected != null ? { selected } : undefined} style={({ pressed }) => ({ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}>
      <Animated.View style={{ transform: [{ scale: sc }] }}><Icon name={icon} size={size} color={color ?? th.text} fill={fill ?? 'none'} stroke={1.9} /></Animated.View>
    </Pressable>
  );
}

/** Avatar con anello sottile e sobrio (NON un effetto "storia"): 1.5px tinta tenue dell'accento. */
export function RingAvatar({ name, size = 40 }: { name: string; size?: number }) {
  const t = useTheme();
  return (
    <View style={{ width: size + 8, height: size + 8, borderRadius: (size + 8) / 2, borderWidth: 1.5, borderColor: t.mode === 'light' ? t.border : t.accent + '66', alignItems: 'center', justifyContent: 'center' }}>
      <UserAvatar name={name} size={size} />
    </View>
  );
}

/** Aloni morbidi (cerchi concentrici molto traslucidi, deterministici) sopra un gradiente: danno profondità senza immagini. */
export function ArtShapes({ seed, size }: { seed: string; size: number }) {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, start: 0, end: 0, bottom: 0, overflow: 'hidden' }}>
      {artShapes(seed).map((s, i) => [1, 0.8, 0.6, 0.4, 0.22].map((k, j) => {
        const r = s.r * size * 1.15 * k;
        return <View key={`${i}-${j}`} style={{ position: 'absolute', start: s.cx * size - r, top: s.cy * size - r, width: r * 2, height: r * 2, borderRadius: r, backgroundColor: '#ffffff', opacity: s.o * 0.32 }} />;
      }))}
    </View>
  );
}

/** Segnaposto foto/video: gradiente + forme morbide, con play per i video. */
export function ArtPlaceholder({ seed, width, height, video }: { seed: string; width: number; height: number; video?: boolean }) {
  const p = heroPaletteFor(seed);
  return (
    <LinearGradient colors={[p.from, p.to]} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
      <ArtShapes seed={seed} size={width} />
      {video ? (
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(0,0,0,0.38)', alignItems: 'center', justifyContent: 'center' }}><Icon name="play" size={28} color="#fff" fill="#fff" /></View>
      ) : (
        <Icon name="image" size={34} color="rgba(255,255,255,0.55)" stroke={1.5} />
      )}
    </LinearGradient>
  );
}

/** Carta tipografica per i post senza foto: gradiente + testo grande leggibile (contrasto verificato nei test). */
export function TextCard({ seed, text, tag, width, palette }: { seed: string; text: string; tag?: string; width: number; palette?: FeedPalette }) {
  const { tone, hc } = useFeedTone();
  const p = palette ?? paletteFor(seed, tone, hc);
  const fs = textCardFontSize(text.length);
  return (
    <LinearGradient colors={[p.from, p.to]} start={{ x: 0.05, y: 0 }} end={{ x: 0.95, y: 1 }} style={{ width, minHeight: width * 0.86, padding: 26, justifyContent: 'center' }}>
      <ArtShapes seed={seed} size={width} />
      {tag ? <Text style={{ color: p.sub, fontSize: 12, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 14 }} numberOfLines={1}>{tag}</Text> : null}
      <Text numberOfLines={10} style={{ color: p.text, fontSize: fs, lineHeight: Math.round(fs * 1.28), fontWeight: '800', letterSpacing: -0.3 }}>{text}</Text>
    </LinearGradient>
  );
}

/** Pillola piccola e discreta (etichette tipo "Sponsorizzato", "Online"). */
export function SoftPill({ label, icon, color, bg, onPress }: { label: string; icon?: string; color: string; bg: string; onPress?: () => void }) {
  const inner = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', backgroundColor: bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
      {icon ? <Icon name={icon} size={12} color={color} stroke={2.2} /> : null}
      <Text style={{ color, fontSize: 11, fontWeight: '700', letterSpacing: 0.3 }}>{label}</Text>
    </View>
  );
  return onPress ? <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button" accessibilityLabel={translateText(label)}>{inner}</Pressable> : inner;
}
