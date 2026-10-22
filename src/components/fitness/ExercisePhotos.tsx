import { Image } from 'expo-image';
import { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import { Text } from '@/components/T';

import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import { exPhotoUrls } from '@/lib/fitness/exPhotos';
import type { ExerciseX } from '@/lib/fitness/exerciseDb';
import { Icon } from '@/lib/icons';

/** Le foto di un esercizio: le tue, se le hai messe, altrimenti quelle dell'archivio. */
export const photosOf = (ex: Pick<ExerciseX, 'id' | 'photos'>): { urls: string[]; real: boolean } | null => {
  const own = ex.photos ?? [];
  if (own.length) return { urls: own, real: false };
  const r = exPhotoUrls(ex.id);
  return r ? { urls: r, real: true } : null;
};

/** Le due foto (partenza e arrivo) una sopra l'altra che si alternano con dissolvenza, come se la persona si muovesse. */
export function ExercisePhotos({ urls, name, real, maxWidth }: { urls: string[]; name: string; real: boolean; maxWidth?: number }) {
  const t = useTheme();
  const k = useRef(new Animated.Value(0)).current;
  const two = urls.length > 1;
  useEffect(() => {
    if (!two) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.delay(700),
      Animated.timing(k, { toValue: 1, duration: 450, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.delay(700),
      Animated.timing(k, { toValue: 0, duration: 450, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [k, two]);
  return (
    <View>
      <View style={{ borderRadius: 16, overflow: 'hidden', backgroundColor: t.chip, aspectRatio: 850 / 567, width: '100%', maxWidth, alignSelf: 'center' }}>
        <Image source={{ uri: urls[0] }} style={{ position: 'absolute', width: '100%', height: '100%' }} contentFit="cover" cachePolicy="disk" accessibilityLabel={`${name}: ${tl('Partenza')}`} />
        {two ? <Animated.View style={{ position: 'absolute', width: '100%', height: '100%', opacity: k }}><Image source={{ uri: urls[1] }} style={{ width: '100%', height: '100%' }} contentFit="cover" cachePolicy="disk" accessibilityLabel={`${name}: ${tl('Arrivo')}`} /></Animated.View> : null}
      </View>
      {real ? <Text style={{ color: t.muted, fontSize: 11, marginTop: 6 }}>{tl('Foto: Free Exercise DB (pubblico dominio).')}</Text> : null}
    </View>
  );
}

/** Piccola anteprima per le liste: la foto di partenza, o un'icona neutra se l'esercizio non ha foto. */
export function ExerciseThumb({ ex, size = 52 }: { ex: Pick<ExerciseX, 'id' | 'photos'>; size?: number }) {
  const t = useTheme();
  const p = photosOf(ex);
  return (
    <View style={{ width: size, height: size, borderRadius: 12, overflow: 'hidden', backgroundColor: t.chip, alignItems: 'center', justifyContent: 'center' }}>
      {p ? <Image source={{ uri: p.urls[0] }} style={{ width: '100%', height: '100%' }} contentFit="cover" cachePolicy="disk" transition={120} recyclingKey={ex.id} /> : <Icon name="lifefitness" size={Math.round(size * 0.42)} color={t.muted} />}
    </View>
  );
}

/** La foto grande dell'esercizio o, se non c'è, un riquadro con l'icona. */
export function ExerciseMedia({ ex, maxWidth }: { ex: Pick<ExerciseX, 'id' | 'photos' | 'name'>; maxWidth?: number }) {
  const t = useTheme();
  const p = photosOf(ex);
  if (p) return <ExercisePhotos urls={p.urls} name={ex.name} real={p.real} maxWidth={maxWidth} />;
  return <View style={{ aspectRatio: 850 / 567, borderRadius: 16, backgroundColor: t.chip, alignItems: 'center', justifyContent: 'center', width: '100%', maxWidth, alignSelf: 'center' }}><Icon name="lifefitness" size={48} color={t.muted} /></View>;
}
