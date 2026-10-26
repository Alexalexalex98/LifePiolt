import type React from 'react';
import { Linking, Pressable, View } from 'react-native';

import { Text } from '@/components/T';
import { inlineBold, toBlocks } from '@/lib/aiPersona';
import { Icon } from '@/lib/icons';

/** Testo delle risposte di Theia: paragrafi staccati, elenchi con rientro, righe-titolo e **grassetto**, per leggerle a colpo d'occhio. */
export function RichText({ text, color, size = 15, accent }: { text: string; color: string; size?: number; accent?: string }) {
  const blocks = toBlocks(text);
  const line = Math.round(size * 1.45);
  const pill = (label: string, href: string, k: string) => (
    <Pressable key={k} accessibilityRole="link" accessibilityLabel={label} onPress={() => { Linking.openURL(href).catch(() => {}); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: (accent ?? color) + '24', borderWidth: 1, borderColor: (accent ?? color) + '55' }}>
      <Icon name="link" size={12} color={accent ?? color} stroke={2.2} />
      <Text numberOfLines={1} style={{ color: accent ?? color, fontSize: Math.max(11, size - 3), fontWeight: '700' }}>{label.replace(/^www\./, '').slice(0, 24)}</Text>
    </Pressable>
  );
  /* un testo con delle fonti: il testo, poi le fonti come pulsantini (solo l'inizio dell'indirizzo), poi il discorso riparte a capo */
  const run = (s: string, base: object) => {
    const nodes: React.ReactNode[] = [];
    let buf: { t: string; b: boolean }[] = [];
    let links: { t: string; href: string }[] = [];
    const flushText = () => { if (!buf.length) return; const parts = buf; buf = []; if (!parts.some((x) => x.t.trim())) return; nodes.push(<Text key={`t${nodes.length}`} selectable style={base}>{parts.map((p, i) => <Text key={i} style={p.b ? { fontWeight: '800' } : undefined}>{p.t}</Text>)}</Text>); };
    const flushLinks = () => { if (!links.length) return; const l = links; links = []; nodes.push(<View key={`l${nodes.length}`} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 5 }}>{l.map((x, i) => pill(x.t, x.href, `${nodes.length}-${i}`))}</View>); };
    for (const p of inlineBold(s)) {
      if (p.href) { flushText(); links.push({ t: p.t, href: p.href }); continue; }
      if (links.length) {
        /* tra due fonti vicine restano solo virgole e spazi: non si spezza il testo */
        if (!p.t.replace(/[\s,.;:·\-–]+/g, '') || /^\s*(?:e|ed|,)\s*$/i.test(p.t)) continue;
        flushLinks();
        const rest = p.t.replace(/^[\s,.;:]+/, '');
        if (rest) buf.push({ t: rest, b: p.b });
        continue;
      }
      buf.push({ t: p.t, b: p.b });
    }
    flushText(); flushLinks();
    return <View>{nodes}</View>;
  };
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
