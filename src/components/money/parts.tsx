import { View } from 'react-native';

import { Text } from '@/components/T';
import { LpTag } from '@/components/network';
import { Press } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { Icon } from '@/lib/icons';

/** Importo in LifePoints con il simbolo LP accanto. */
export function Amount({ n, size = 16, bold = true, color, sign }: { n: number; size?: number; bold?: boolean; color?: string; sign?: boolean }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Text style={{ color: color ?? t.text, fontSize: size, fontWeight: bold ? '800' : '500', letterSpacing: size > 24 ? -1 : 0 }}>{sign && n > 0 ? '+' : ''}{n.toLocaleString('de-CH', { maximumFractionDigits: 2 })}</Text>
      <LpTag size={Math.round(size * 0.85)} />
    </View>
  );
}
export function QuickAction({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Press onPress={onPress} accessibilityLabel={label} style={{ alignItems: 'center', gap: 7, flex: 1 }}>
      <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: t.chip, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon as never} size={22} color={t.text} /></View>
      <Text numberOfLines={1} style={{ color: t.text, fontSize: 12, fontWeight: '700' }}>{label}</Text>
    </Press>
  );
}
export function SectionTitle({ children, right }: { children: string; right?: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 26, marginBottom: 10 }}>
      <Text style={{ color: t.text, fontSize: 19, fontWeight: '800', letterSpacing: -0.3 }}>{children}</Text>
      {right}
    </View>
  );
}
/** Barra sottile di avanzamento. */
export function Bar({ pct, color }: { pct: number; color?: string }) {
  const t = useTheme();
  return (
    <View style={{ height: 6, borderRadius: 3, backgroundColor: t.border, overflow: 'hidden', direction: 'ltr' }}>
      <View style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: '100%', backgroundColor: color ?? t.accent, borderRadius: 3 }} />
    </View>
  );
}
/** Contenitore chiaro, angoli larghi, senza ombre: il tono sobrio delle banche private. */
export function Panel({ children, pad = 18 }: { children: React.ReactNode; pad?: number }) {
  const t = useTheme();
  return <View style={{ backgroundColor: t.card, borderRadius: 24, borderWidth: 1, borderColor: t.border, padding: pad }}>{children}</View>;
}
export function Delta({ pct }: { pct: number | null }) {
  const t = useTheme();
  if (pct === null) return <Text style={{ color: t.muted, fontSize: 12.5, fontWeight: '700' }}>nuovo</Text>;
  const up = pct > 0.5, down = pct < -0.5;
  return <Text style={{ color: up ? t.danger : down ? t.positive : t.muted, fontSize: 12.5, fontWeight: '800' }}>{up ? '+' : ''}{Math.round(pct)}%</Text>;
}
