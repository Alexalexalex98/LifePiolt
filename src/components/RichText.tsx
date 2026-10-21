import { View } from 'react-native';

import { Text } from '@/components/T';
import { inlineBold, toBlocks } from '@/lib/aiPersona';

/** Testo delle risposte di Theia: paragrafi staccati, elenchi con rientro, righe-titolo e **grassetto**, per leggerle a colpo d'occhio. */
export function RichText({ text, color, size = 15, accent }: { text: string; color: string; size?: number; accent?: string }) {
  const blocks = toBlocks(text);
  const line = Math.round(size * 1.45);
  const run = (s: string, base: object) => <Text selectable style={base}>{inlineBold(s).map((p, i) => <Text key={i} style={p.b ? { fontWeight: '800', color: accent ?? color } : undefined}>{p.t}</Text>)}</Text>;
  return (
    <View>
      {blocks.map((b, i) => {
        if (b.kind === 'p' && !b.text) return <View key={i} style={{ height: 6 }} />;
        if (b.kind === 'h') return <Text key={i} selectable style={{ color: accent ?? color, fontSize: size, lineHeight: line, fontWeight: '800', marginTop: i ? 8 : 0 }}>{b.text}</Text>;
        if (b.kind === 'li') {
          return (
            <View key={i} style={{ flexDirection: 'row', gap: 8, marginTop: 3, paddingLeft: b.indent ? 18 : 2 }}>
              <Text style={{ color: accent ?? color, fontSize: size, lineHeight: line, fontWeight: '800', minWidth: 14 }}>{b.n ? `${b.n}.` : '•'}</Text>
              <View style={{ flex: 1 }}>{run(b.text, { color, fontSize: size, lineHeight: line })}</View>
            </View>
          );
        }
        return <View key={i} style={{ marginTop: i ? 2 : 0 }}>{run(b.text, { color, fontSize: size, lineHeight: line })}</View>;
      })}
    </View>
  );
}
