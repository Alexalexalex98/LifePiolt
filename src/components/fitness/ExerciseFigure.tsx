import { Image } from 'expo-image';
import { View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { Text } from '@/components/T';

import { FIT } from '@/components/fitness/kit';
import { useTheme } from '@/hooks/use-theme';
import { t as tl } from '@/i18n/core';
import type { ExerciseX } from '@/lib/fitness/exerciseDb';
import { FAMILIES, figurePanels } from '@/lib/fitness/poses';

/** Dimostrazione dell'esercizio: due immagini (partenza e arrivo). Con foto scelte dall'utente mostra quelle. */
export function ExerciseFigure({ ex, size = 120, captions = true, single = false }: { ex: Pick<ExerciseX, 'fam' | 'photos' | 'name'> | undefined; size?: number; captions?: boolean; single?: boolean }) {
  const t = useTheme();
  const fam = ex?.fam ? FAMILIES[ex.fam] : undefined;
  const photos = ex?.photos ?? [];
  const caps = [tl('Partenza'), tl('Arrivo')];
  const box = { width: size, height: size, borderRadius: Math.max(8, size / 9), backgroundColor: t.chip, overflow: 'hidden' as const };
  if (photos.length) {
    return <View style={{ flexDirection: 'row', gap: 6 }}>{(single ? photos.slice(0, 1) : photos).map((u, i) => <View key={u}><Image source={{ uri: u }} style={box} contentFit="cover" accessibilityLabel={`${ex?.name ?? ''} ${caps[i] ?? ''}`} />{captions && !single ? <Text style={{ color: t.muted, fontSize: 11, marginTop: 3, textAlign: 'center' }}>{caps[i]}</Text> : null}</View>)}</View>;
  }
  if (!fam) return <View style={[box, { alignItems: 'center', justifyContent: 'center' }]}><Text style={{ color: t.muted, fontSize: 11, textAlign: 'center', padding: 6 }}>{tl('Nessuna immagine')}</Text></View>;
  const panels = figurePanels(fam);
  const shown = single ? panels.slice(0, 1) : panels;
  const col = { body: t.text, prop: FIT, floor: t.muted };
  return (
    <View style={{ flexDirection: 'row', gap: 6 }} accessible accessibilityLabel={`${ex?.name ?? fam.name}: ${caps.slice(0, panels.length).join(', ')}`}>
      {shown.map((pan, i) => (
        <View key={i}>
          <View style={box}>
            <Svg width={size} height={size} viewBox="0 0 100 100">
              {pan.lines.map((l, k) => <Line key={k} x1={l.a[0]} y1={l.a[1]} x2={l.b[0]} y2={l.b[1]} stroke={col[l.c]} strokeWidth={l.w} strokeLinecap="round" opacity={l.o} />)}
              {pan.circles.map((c, k) => <Circle key={k} cx={c.c[0]} cy={c.c[1]} r={c.r} fill={c.fill ? col[c.col] : 'none'} stroke={col[c.col]} strokeWidth={2} />)}
            </Svg>
          </View>
          {captions && !single && panels.length > 1 ? <Text style={{ color: t.muted, fontSize: 11, marginTop: 3, textAlign: 'center' }}>{caps[i]}</Text> : null}
        </View>
      ))}
    </View>
  );
}
