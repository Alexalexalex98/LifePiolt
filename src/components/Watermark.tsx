import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/T';
import { watermarkLabel, watermarkTiles } from '@/lib/watermark';
import { useAccount } from '@/store/account';
import { useApp } from '@/store/app';

/**
 * Filigrana quasi invisibile con il nome e cognome (o il nome utente) di chi guarda, ripetuta in diagonale sopra foto e video riservati
 * (LifeClub). Non si può togliere ritagliando e scoraggia screenshot e registrazioni dello schermo per ripubblicare i contenuti.
 * Non intercetta i tocchi. Ogni sessione ha uno scostamento diverso, così il disegno non è sempre identico.
 */
const SEED = Math.floor(Math.random() * 1000);
export function Watermark({ label, opacity = 0.11 }: { label?: string; opacity?: number }) {
  const first = useAccount((s) => s.firstName); const last = useAccount((s) => s.lastName); const name = useApp((s) => s.account.name);
  const text = label ?? watermarkLabel(first, last, name);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const tiles = useMemo(() => watermarkTiles(size.w, size.h, SEED), [size.w, size.h]);
  if (!text) return null;
  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
      {tiles.map((t) => (
        <Text key={t.key} numberOfLines={1} style={{ position: 'absolute', left: t.x, top: t.y, color: '#fff', opacity, fontSize: 12, fontWeight: '700', letterSpacing: 0.4, transform: [{ rotate: '-28deg' }], textShadowColor: '#000', textShadowRadius: 2, textShadowOffset: { width: 0, height: 0 } }}>{text}</Text>
      ))}
    </View>
  );
}
