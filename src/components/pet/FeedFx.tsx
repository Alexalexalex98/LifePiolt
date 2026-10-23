import { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';

import { Text } from '@/components/T';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import type { ArtId, Quality } from '@/lib/petFood';

import { FoodArt } from './FoodArt';

export type FeedRun = { n: number; art: ArtId; q: Quality; /** variazioni di energia e salute (segno) */ energy: number; health: number };

const ANG = [-70, -40, -12, 14, 42, 72];

/**
 * L'animazione di quando Theia mangia: il cibo vola dal vassoio alla bocca (con un arco e rimpicciolendo), poi escono scintille verdi
 * se è un cibo fresco o nuvolette grigie se è molto zuccherato o fritto, e galleggiano le variazioni di energia e salute.
 * Con «Riduci animazioni» compare solo il riepilogo.
 */
export function FeedFx({ run, w, h }: { run: FeedRun | null; w: number; h: number }) {
  const reduce = useReduceMotion();
  const fly = useRef(new Animated.Value(0)).current;
  const burst = useRef(new Animated.Value(0)).current;
  const chips = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!run) return;
    fly.setValue(0); burst.setValue(0); chips.setValue(0);
    if (reduce) { chips.setValue(0.6); const t = setTimeout(() => chips.setValue(0), 1800); return () => clearTimeout(t); }
    Animated.sequence([
      Animated.timing(fly, { toValue: 1, duration: 700, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(burst, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(chips, { toValue: 1, duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]),
    ]).start();
  }, [run?.n]);
  if (!run || !w || !h) return null;
  const good = run.q !== 'goloso';
  const mouthX = w / 2; const mouthY = h * 0.62;
  const startY = h + 20;
  const x = fly.interpolate({ inputRange: [0, 1], outputRange: [w * 0.5 - 28, mouthX - 28] });
  const y = fly.interpolate({ inputRange: [0, 0.55, 1], outputRange: [startY, mouthY - 150, mouthY - 28] });
  const sc = fly.interpolate({ inputRange: [0, 0.6, 1], outputRange: [1, 1.25, 0.15] });
  const rot = fly.interpolate({ inputRange: [0, 1], outputRange: ['-12deg', '24deg'] });
  const flyOp = fly.interpolate({ inputRange: [0, 0.9, 1], outputRange: [1, 1, 0] });
  const chip = (label: string, val: number, i: number) => val === 0 ? null : (
    <Animated.View key={label} style={{ position: 'absolute', left: mouthX - 44 + (i ? 20 : -20), top: mouthY - 70, opacity: chips.interpolate({ inputRange: [0, 0.15, 0.8, 1], outputRange: [0, 1, 1, 0] }), transform: [{ translateY: chips.interpolate({ inputRange: [0, 1], outputRange: [0, -46 - i * 14] }) }], backgroundColor: val > 0 ? '#1f7a4cee' : '#b4551eee', borderRadius: 12, paddingVertical: 3, paddingHorizontal: 9 }}>
      <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>{`${label} ${val > 0 ? '▲' : '▼'}`}</Text>
    </Animated.View>
  );
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width: w, height: h }}>
      {!reduce ? (
        <>
          <Animated.View style={{ position: 'absolute', left: 0, top: 0, opacity: flyOp, transform: [{ translateX: x }, { translateY: y }, { scale: sc }, { rotate: rot }] }}>
            <FoodArt id={run.art} size={56} />
          </Animated.View>
          {ANG.map((a, i) => (
            <Animated.View key={i} style={{ position: 'absolute', left: mouthX - 7, top: mouthY - 7, width: 14, height: 14, borderRadius: 7, backgroundColor: good ? (i % 2 ? '#ffe27a' : '#7be0b0') : '#b9b4c4', opacity: burst.interpolate({ inputRange: [0, 0.1, 1], outputRange: [0, 1, 0] }), transform: [{ translateX: burst.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin((a * Math.PI) / 180) * 70] }) }, { translateY: burst.interpolate({ inputRange: [0, 1], outputRange: [0, good ? -Math.cos((a * Math.PI) / 180) * 70 - 20 : -50 - (i % 3) * 14] }) }, { scale: burst.interpolate({ inputRange: [0, 1], outputRange: good ? [0.5, 1.1] : [0.6, 1.8] }) }] }} />
          ))}
        </>
      ) : null}
      {chip('Energia', run.energy, 0)}
      {chip('Salute', run.health, 1)}
    </View>
  );
}
