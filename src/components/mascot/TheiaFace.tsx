import { Image } from 'expo-image';
import { View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { AVATAR_IMG } from '@/lib/theiaAvatars';
import type { AvatarId } from '@/lib/theiaAvatarIds';

/** La faccia di Theia vestita da esperta del campo (camice, occhiali e salvadanaio, cuffie…): rotonda, con un bordo sottile. */
export function TheiaFace({ id, size = 34 }: { id: AvatarId; size?: number }) {
  const t = useTheme();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', borderWidth: 1.5, borderColor: t.accent + '66', backgroundColor: '#f3f4f7' }}>
      <Image source={AVATAR_IMG[id]} style={{ width: '100%', height: '100%' }} contentFit="cover" accessibilityIgnoresInvertColors />
    </View>
  );
}
