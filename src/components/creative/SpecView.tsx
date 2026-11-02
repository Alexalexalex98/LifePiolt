import { View } from 'react-native';

import { Text } from '@/components/T';
import { Body, Btn, H } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import type { Spec } from '@/lib/creative/spec';
import { toast } from '@/store/toast';

/** Disegna una scheda fatta di blocchi: solo componenti dell'app, nessun codice dell'utente. */
export function SpecView({ spec, demo }: { spec: Spec; demo?: boolean }) {
  const t = useTheme();
  return (
    <View style={{ gap: 10 }}>
      <H>{spec.title}</H>
      {spec.blocks.map((b, i) => {
        switch (b.t) {
          case 'heading': return <Text key={i} style={{ color: t.text, fontSize: 17, fontWeight: '800', marginTop: 6 }}>{b.text}</Text>;
          case 'text': return <Body key={i}>{b.text}</Body>;
          case 'note': return <View key={i} style={{ backgroundColor: t.tile, borderRadius: 12, padding: 10 }}><Body small muted>{b.text}</Body></View>;
          case 'list': return <View key={i} style={{ gap: 4 }}>{b.items.map((x, k) => <Body key={k}>{`•  ${x}`}</Body>)}</View>;
          case 'stat': return (
            <View key={i} style={{ backgroundColor: t.tile, borderRadius: 14, padding: 12 }}>
              <Body small muted>{b.label}</Body>
              <Text style={{ color: t.text, fontSize: 26, fontWeight: '800' }}>{b.value}</Text>
              {b.hint ? <Body small muted>{b.hint}</Body> : null}
            </View>
          );
          case 'progress': return (
            <View key={i}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Body>{b.label}</Body><Body bold>{b.pct}%</Body></View>
              <View style={{ height: 8, borderRadius: 4, backgroundColor: t.tile, marginTop: 4, overflow: 'hidden' }}><View style={{ width: `${b.pct}%`, height: 8, backgroundColor: t.accent }} /></View>
            </View>
          );
          case 'button': return <Btn key={i} small ghost title={b.label} onPress={() => toast(demo ? `${b.message} (anteprima)` : b.message)} />;
          case 'divider': return <View key={i} style={{ height: 1, backgroundColor: t.border, marginVertical: 4 }} />;
          default: return null;
        }
      })}
    </View>
  );
}
