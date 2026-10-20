import { Image } from 'expo-image';
import { View } from 'react-native';
import { Text } from '@/components/T';

import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';

/** Le due foto dell'esercizio (partenza e arrivo) a tutta larghezza, una sopra l'altra, così panche, attrezzi e posizione si vedono bene. */
export function ExercisePhotos({ urls, name, real }: { urls: string[]; name: string; real: boolean }) {
  const t = useTheme();
  const caps = [tl('Partenza'), tl('Arrivo')];
  return (
    <View style={{ gap: 10 }}>
      {urls.slice(0, 2).map((u, i) => (
        <View key={u} style={{ borderRadius: 16, overflow: 'hidden', backgroundColor: t.chip }}>
          <Image source={{ uri: u }} style={{ width: '100%', aspectRatio: 850 / 567 }} contentFit="cover" cachePolicy="disk" transition={150} accessibilityLabel={`${name}: ${caps[i] ?? ''}`} />
          <View style={{ position: 'absolute', left: 10, top: 10, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>{`${i + 1}. ${caps[i] ?? ''}`}</Text>
          </View>
        </View>
      ))}
      {real ? <Text style={{ color: t.muted, fontSize: 11 }}>{tl('Foto: Free Exercise DB (pubblico dominio).')}</Text> : null}
    </View>
  );
}
