import { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useTheme } from '@/hooks/use-theme';

const star = (cx: number, cy: number, r: number) => `M${cx} ${cy - r} Q${cx + r * 0.16} ${cy - r * 0.16} ${cx + r} ${cy} Q${cx + r * 0.16} ${cy + r * 0.16} ${cx} ${cy + r} Q${cx - r * 0.16} ${cy + r * 0.16} ${cx - r} ${cy} Q${cx - r * 0.16} ${cy - r * 0.16} ${cx} ${cy - r} Z`;

/** Le due stelline che girano: Theia sta pensando. Una grande e una piccola, in senso opposto. Si usa dove Theia non mostra il suo viso. */
export function ThinkingStars({ size = 22, color }: { size?: number; color?: string }) {
  const t = useTheme();
  const reduce = useReduceMotion();
  const a = useRef(new Animated.Value(0)).current;
  const b = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) return;
    const l1 = Animated.loop(Animated.timing(a, { toValue: 1, duration: 2600, easing: Easing.linear, useNativeDriver: true }));
    const l2 = Animated.loop(Animated.timing(b, { toValue: 1, duration: 1800, easing: Easing.linear, useNativeDriver: true }));
    l1.start(); l2.start();
    return () => { l1.stop(); l2.stop(); };
  }, [a, b, reduce]);
  const c = color ?? t.accent;
  const big = size * 0.74, small = size * 0.42;
  const Spin = ({ v, rev, s, x, y }: { v: Animated.Value; rev?: boolean; s: number; x: number; y: number }) => (
    <Animated.View style={{ position: 'absolute', left: x, top: y, width: s, height: s, transform: [{ rotate: v.interpolate({ inputRange: [0, 1], outputRange: rev ? ['360deg', '0deg'] : ['0deg', '360deg'] }) }] }}>
      <Svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}><Path d={star(s / 2, s / 2, s / 2)} fill={c} /></Svg>
    </Animated.View>
  );
  return (
    <View accessibilityLabel="Theia sta pensando" accessibilityRole="progressbar" style={{ width: size, height: size }}>
      <Spin v={a} s={big} x={0} y={size - big} />
      <Spin v={b} rev s={small} x={size - small} y={0} />
    </View>
  );
}
