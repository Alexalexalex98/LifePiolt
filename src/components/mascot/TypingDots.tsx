import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

/** I tre puntini del caricamento: arrivano uno alla volta, poi ricominciano. */
export function TypingDots({ size = 9, color }: { size?: number; color?: string }) {
  const t = useTheme();
  const [n, setN] = useState(1);
  useEffect(() => { const h = setInterval(() => setN((x) => (x + 1) % 4), 420); return () => clearInterval(h); }, []);
  return (
    <View accessibilityLabel="Theia sta scrivendo" style={{ flexDirection: 'row', gap: size * 0.7, alignItems: 'center', height: size * 2 }}>
      {[0, 1, 2].map((i) => <View key={i} style={{ width: size, height: size, borderRadius: size, backgroundColor: color ?? t.accent, opacity: i < n ? 1 : 0.18, transform: [{ scale: i < n ? 1 : 0.7 }] }} />)}
    </View>
  );
}
