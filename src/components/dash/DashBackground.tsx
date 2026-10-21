import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { View } from 'react-native';

import { resolveBg } from '@/lib/dash/backgrounds';
import { useDash } from '@/store/dash';

/** Lo sfondo della Dashboard: una sola immagine (mai ripetuta) oppure un modello di colore, fermo dietro ai widget che scorrono. */
export function DashBackground() {
  const bg = useDash((s) => s.bg);
  const legacy = useDash((s) => s.photos?.[0]);
  const dim = useDash((s) => s.dim);
  const r = resolveBg(bg, legacy);
  if (r.kind === 'none') return null;
  if (r.kind === 'photo') {
    return (
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}>
        <Image source={{ uri: r.uri }} style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }} contentFit="cover" />
        <View style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, backgroundColor: `rgba(7,9,13,${dim})` }} />
      </View>
    );
  }
  const p = r.preset;
  return <LinearGradient pointerEvents="none" colors={p.colors as [string, string, ...string[]]} start={{ x: p.from[0], y: p.from[1] }} end={{ x: p.to[0], y: p.to[1] }} style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }} />;
}
