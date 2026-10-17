import { LinearGradient } from 'expo-linear-gradient';
import { liveAccent } from '@/lib/liveTheme';
import { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/T';

import { RecBanner } from '@/components/call/RecBanner';
import { RoundBtn } from '@/components/live/Overlay';
import { HostCamera } from '@/components/live/VideoSurface';
import { UserAvatar } from '@/components/network';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { t as tl } from '@/i18n/core';
import { clockLabel } from '@/lib/liveRoom';

export type DuoState = 'ringing' | 'connected' | 'noanswer';

/** Cerchi che si allargano attorno alla foto mentre squilla. */
function Rings({ on }: { on: boolean }) {
  const reduce = useReduceMotion();
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!on || reduce) { a.setValue(0); return; }
    const loop = Animated.loop(Animated.timing(a, { toValue: 1, duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [on, reduce, a]);
  return (
    <>
      {[0, 1].map((k) => (
        <Animated.View key={k} pointerEvents="none" style={{ position: 'absolute', width: 150, height: 150, borderRadius: 75, borderWidth: 2, borderColor: 'rgba(143,164,255,0.6)', opacity: on ? a.interpolate({ inputRange: [0, 1], outputRange: [0.6 - k * 0.2, 0] }) : 0, transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [1 + k * 0.3, 1.9 + k * 0.3] }) }] }} />
      ))}
    </>
  );
}

/**
 * Chiamata a due come in una chat: foto grande, «Squilla…» poi il tempo, e in basso altoparlante, video, microfono, aggiungi e termina.
 * Con il video, l'altra persona è a tutto schermo e tu sei in piccolo in alto.
 */
export function DuoCall(p: {
  other: string; me: string; video: boolean; state: DuoState; elapsedMs: number;
  micOff: boolean; camOff: boolean; speaker: boolean; facing: 'front' | 'back';
  theiaOn: boolean; theiaBy?: string; onTheia: () => void;
  onMic: () => void; onCam: () => void; onSpeaker: () => void; onFlip: () => void; onAdd: () => void; onEnd: () => void; onRetry: () => void; onShare: () => void;
}) {
  const insets = useSafeAreaInsets();
  const status = p.state === 'ringing' ? tl('Squilla…') : p.state === 'noanswer' ? tl('Non risponde') : clockLabel(p.elapsedMs);
  return (
    <View style={{ flex: 1, backgroundColor: '#0b0e14' }}>
      <LinearGradient colors={['#1b2440', '#0b0e14']} style={{ position: 'absolute', top: 0, bottom: 0, start: 0, end: 0 }} />
      {p.theiaOn ? <RecBanner by={p.theiaBy} me={p.me} top={insets.top + 6} /> : null}
      <View style={{ paddingTop: insets.top + (p.theiaOn ? 64 : 24), alignItems: 'center', gap: 4 }}>
        <Text style={{ color: '#fff', fontSize: 26, fontWeight: '800' }}>{p.other}</Text>
        <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 15 }} accessibilityLiveRegion="polite">{status}</Text>
      </View>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Rings on={p.state === 'ringing'} />
        <UserAvatar name={p.other} size={150} />
        {p.state === 'noanswer' ? <Text onPress={p.onRetry} style={{ color: liveAccent(), fontSize: 16, fontWeight: '800', marginTop: 24 }}>{tl('Richiama')}</Text> : null}
      </View>
      {p.video && !p.camOff ? (
        <View style={{ position: 'absolute', top: insets.top + 24, end: 14, width: 100, height: 140, borderRadius: 14, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,255,255,0.7)', backgroundColor: '#000' }}>
          <HostCamera facing={p.facing} torch={false} camOff={false} needMic={false} small />
        </View>
      ) : null}
      <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, textAlign: 'center', paddingHorizontal: 30, marginBottom: 10 }}>{tl('Anteprima: voce e video tra telefoni si attivano collegando il servizio di streaming')}</Text>
      <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 14, paddingBottom: insets.bottom + 30, paddingHorizontal: 12, flexWrap: 'wrap' }}>
        <RoundBtn icon="headphones" label={p.speaker ? 'Spegni il vivavoce' : 'Attiva il vivavoce'} on={p.speaker} onPress={p.onSpeaker} size={56} />
        <RoundBtn icon="video" label={p.camOff || !p.video ? 'Accendi il video' : 'Spegni il video'} slash={p.video && p.camOff} on={p.video && !p.camOff} onPress={p.onCam} size={56} />
        <RoundBtn icon="mic" label={p.micOff ? 'Riattiva il microfono' : 'Silenzia il microfono'} slash={p.micOff} onPress={p.onMic} size={56} />
        <RoundBtn icon="sparkle" label={p.theiaOn ? 'Disattiva gli appunti di Theia' : 'Attiva gli appunti di Theia'} on={p.theiaOn} onPress={p.onTheia} size={56} />
        <RoundBtn icon="plus" label="Aggiungi una persona" onPress={p.onAdd} size={56} />
        <RoundBtn icon="phone" label="Termina la chiamata" danger onPress={p.onEnd} size={64} />
      </View>
    </View>
  );
}
