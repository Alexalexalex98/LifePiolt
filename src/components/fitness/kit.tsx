import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { Text } from '@/components/T';

import { useTheme } from '@/hooks/use-theme';
import { Icon } from '@/lib/icons';

/** Colore di LifeFitness (lo stesso dell'area nel menu): energico, dentro il tema LifePilot. */
export const FIT = '#ff9d6e';
const FIT2 = '#ff6b5a';

/** Testata: gradiente caldo, strisce diagonali sportive e il manubrio dell'area. */
export function FitHero({ eyebrow, title, sub, children }: { eyebrow?: string; title: string; sub?: string; children?: ReactNode }) {
  return (
    <View style={{ borderRadius: 22, overflow: 'hidden' }}>
      <LinearGradient colors={[FIT2, FIT, '#ffc07a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 18 }}>
        <Svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="none">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => <Line key={i} x1={150 + i * 34} y1={-10} x2={30 + i * 34} y2={260} stroke="#ffffff" strokeOpacity={0.12} strokeWidth={10} />)}
        </Svg>
        <View style={{ position: 'absolute', right: 14, top: 12, opacity: 0.22 }}><Icon name="lifefitness" size={64} color="#fff" stroke={1.6} /></View>
        {eyebrow ? <Text style={{ color: '#2a1208', fontSize: 11.5, fontWeight: '800', letterSpacing: 1.6, textTransform: 'uppercase', opacity: 0.75 }}>{eyebrow}</Text> : null}
        <Text style={{ color: '#1c0b04', fontSize: 28, fontWeight: '900', letterSpacing: -0.5, marginTop: 2 }}>{title}</Text>
        {sub ? <Text style={{ color: '#2a1208', fontSize: 14, fontWeight: '600', marginTop: 2, opacity: 0.85 }}>{sub}</Text> : null}
        {children ? <View style={{ marginTop: 14 }}>{children}</View> : null}
      </LinearGradient>
    </View>
  );
}

/** Anello di progresso con numero grande al centro. */
export function Ring({ value, size = 96, stroke = 10, color = FIT, big, small }: { value: number; size?: number; stroke?: number; color?: string; big: string; small?: string }) {
  const t = useTheme();
  const r = (size - stroke) / 2; const c = 2 * Math.PI * r; const v = Math.max(0, Math.min(1, value));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={t.chip} strokeWidth={stroke} fill="none" />
        {v > 0 ? <Circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${c * v} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} /> : null}
      </Svg>
      <Text style={{ color: t.text, fontSize: size * 0.26, fontWeight: '900' }}>{big}</Text>
      {small ? <Text style={{ color: t.muted, fontSize: Math.max(10, size * 0.115), fontWeight: '600' }}>{small}</Text> : null}
    </View>
  );
}

/** Riquadro con numero grande e etichetta. */
export function StatTile({ value, label, icon, color = FIT }: { value: string | number; label: string; icon?: string; color?: string }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: t.card, borderColor: t.border, borderWidth: 1, borderRadius: 18, padding: 12, gap: 2 }}>
      {icon ? <Icon name={icon} size={16} color={color} stroke={2.2} /> : null}
      <Text style={{ color: t.text, fontSize: 28, fontWeight: '900', letterSpacing: -0.5 }}>{value}</Text>
      <Text style={{ color: t.muted, fontSize: 11.5, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

/** Barra macro sottile con etichetta e grammi. */
export function MacroBar({ label, grams, color, pct }: { label: string; grams: number; color: string; pct: number }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: t.text, fontSize: 16, fontWeight: '800' }}>{grams} g</Text>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: t.chip, marginVertical: 4, overflow: 'hidden' }}><View style={{ width: `${Math.max(4, Math.min(100, pct))}%`, height: 6, backgroundColor: color, borderRadius: 3 }} /></View>
      <Text style={{ color: t.muted, fontSize: 11.5 }}>{label}</Text>
    </View>
  );
}
