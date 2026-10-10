import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Linking, Platform, View } from 'react-native';
import { Text } from '@/components/T';

import { UserAvatar } from '@/components/network';
import { Btn } from '@/components/ui';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { Icon } from '@/lib/icons';

const NATIVE = Platform.OS !== 'web';

/** Messaggio centrato sul fondo scuro (camera non disponibile, permesso negato...). */
export function StageNote({ icon, title, text, action }: { icon: string; title: string; text: string; action?: { label: string; onPress: () => void } }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 10, backgroundColor: '#0b0e14' }}>
      <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={26} color="#fff" /></View>
      <Text style={{ color: '#fff', fontSize: 17, fontWeight: '700', textAlign: 'center' }}>{title}</Text>
      <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, lineHeight: 19, textAlign: 'center', maxWidth: 340 }}>{text}</Text>
      {action ? <Btn small title={action.label} onPress={action.onPress} /> : null}
    </View>
  );
}

/**
 * Anteprima della fotocamera del telefono (relatore o proprio riquadro nella videochiamata).
 * Degrada con un messaggio chiaro se la camera manca, e' spenta o il permesso e' negato.
 * Il microfono si chiede solo se il trasporto invia davvero audio (`needMic`).
 */
export function HostCamera({ facing, torch, camOff, needMic, small }: { facing: 'front' | 'back'; torch: boolean; camOff: boolean; needMic: boolean; small?: boolean }) {
  const [perm, ask] = useCameraPermissions();
  const [micPerm, askMic] = useMicrophonePermissions();
  const [failed, setFailed] = useState<string | null>(null);
  const asked = useRef(false);

  useEffect(() => {
    if (asked.current || !perm || perm.granted || !perm.canAskAgain) return;
    asked.current = true;
    void ask().catch(() => {});
  }, [perm, ask]);
  useEffect(() => {
    if (needMic && micPerm && !micPerm.granted && micPerm.canAskAgain) void askMic().catch(() => {});
  }, [needMic, micPerm, askMic]);

  if (camOff) return small ? <View style={{ flex: 1, backgroundColor: '#161b26', alignItems: 'center', justifyContent: 'center' }}><Icon name="video" size={20} color="rgba(255,255,255,0.6)" /></View> : <StageNote icon="video" title="Fotocamera spenta" text="Gli spettatori non vedono il tuo video. Riaccendila quando vuoi." />;
  if (failed) return small ? <View style={{ flex: 1, backgroundColor: '#161b26', alignItems: 'center', justifyContent: 'center' }}><Icon name="alert" size={20} color="#ffd166" /></View> : <StageNote icon="alert" title="Fotocamera non disponibile" text={failed} />;
  if (!perm) return <View style={{ flex: 1, backgroundColor: '#0b0e14' }} />;
  if (!perm.granted) {
    if (small) return <View style={{ flex: 1, backgroundColor: '#161b26', alignItems: 'center', justifyContent: 'center' }}><Icon name="camera" size={20} color="rgba(255,255,255,0.6)" /></View>;
    return (
      <StageNote
        icon="camera"
        title="Serve la fotocamera"
        text={perm.canAskAgain ? 'Consenti l\'accesso alla fotocamera per mostrare il tuo video. Le immagini restano sul telefono in questa anteprima.' : 'L\'accesso alla fotocamera è bloccato. Abilitalo dalle impostazioni del telefono.'}
        action={perm.canAskAgain ? { label: 'Consenti la fotocamera', onPress: () => { void ask(); } } : Platform.OS !== 'web' ? { label: 'Apri le impostazioni', onPress: () => { void Linking.openSettings().catch(() => {}); } } : undefined}
      />
    );
  }
  return (
    <CameraView
      style={{ flex: 1 }}
      facing={facing}
      enableTorch={torch && facing === 'back'}
      mirror={facing === 'front'}
      onMountError={() => setFailed(Platform.OS === 'web' ? 'Questo browser o dispositivo non ha una fotocamera utilizzabile. Sul telefono l\'anteprima funziona.' : 'Non riesco ad avviare la fotocamera.')}
    />
  );
}

/**
 * Video segnaposto per chi guarda: finche' non e' collegato un servizio di streaming non arriva
 * video vero, quindi mostriamo un'anteprima animata con il relatore.
 */
export function ViewerStage({ host, label = 'Anteprima della diretta' }: { host: string; label?: string }) {
  const reduce = useReduceMotion();
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(Animated.timing(a, { toValue: 1, duration: 4200, easing: Easing.inOut(Easing.sin), useNativeDriver: NATIVE }));
    loop.start();
    return () => loop.stop();
  }, [a, reduce]);
  const ring = (k: number) => ({
    transform: [{ scale: reduce ? 1 + k * 0.5 : a.interpolate({ inputRange: [0, 1], outputRange: [1 + k * 0.3, 1.6 + k * 0.5] }) }],
    opacity: reduce ? 0.12 : a.interpolate({ inputRange: [0, 1], outputRange: [0.28 - k * 0.08, 0] }),
  });
  return (
    <View style={{ flex: 1, backgroundColor: '#0b0e14', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <LinearGradient colors={['#1b2440', '#0b0e14', '#2a1b3d']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, bottom: 0, start: 0, end: 0 }} />
      <View style={{ alignItems: 'center', justifyContent: 'center', width: 220, height: 220 }}>
        {[0, 1].map((k) => <Animated.View key={k} style={[{ position: 'absolute', width: 130, height: 130, borderRadius: 65, backgroundColor: '#8fa4ff' }, ring(k)]} />)}
        <UserAvatar name={host} size={104} />
      </View>
      <View style={{ position: 'absolute', bottom: '38%', backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 999, paddingVertical: 5, paddingHorizontal: 12, flexDirection: 'row', gap: 6, alignItems: 'center' }}>
        <Icon name="video" size={13} color="#fff" />
        <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>{label}</Text>
      </View>
    </View>
  );
}
