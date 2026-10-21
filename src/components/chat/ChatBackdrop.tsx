import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { View } from 'react-native';

import { wallColor } from '@/components/chat/parts';
import { useTheme } from '@/hooks/use-theme';
import { parseWall } from '@/lib/chatBg';
import { useChatBg } from '@/store/chatBg';

/** Lo sfondo di una chat, fermo dietro ai messaggi: colore, modello di sfumatura o una foto (adattata allo schermo, mai ripetuta). */
export function ChatBackdrop({ wall }: { wall: string | undefined }) {
  const t = useTheme();
  const dim = useChatBg((s) => s.dim);
  const w = parseWall(wall);
  const fill = { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 } as const;
  if (w.kind === 'color') return <View pointerEvents="none" style={[fill, { backgroundColor: wallColor(w.key, { light: t.mode === 'light' }) }]} />;
  if (w.kind === 'preset') return <LinearGradient pointerEvents="none" colors={w.preset.colors as [string, string, ...string[]]} start={{ x: w.preset.from[0], y: w.preset.from[1] }} end={{ x: w.preset.to[0], y: w.preset.to[1] }} style={fill} />;
  return (
    <View pointerEvents="none" style={fill}>
      <Image source={{ uri: w.uri }} style={fill} contentFit="cover" />
      <View style={[fill, { backgroundColor: `rgba(7,9,13,${dim})` }]} />
    </View>
  );
}
