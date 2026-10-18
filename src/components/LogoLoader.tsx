import { Image } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, View } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';
import { LOGO } from '@/lib/embeddedAssets';

const AP = Animated.createAnimatedComponent(Path);
const AG = Animated.createAnimatedComponent(G);

/** Linee centrali delle due lettere del simbolo LP (spazio 480 x 480) e la loro lunghezza, un po' abbondante. */
const L_PATH = 'M 33 8 L 33 298 Q 33 333 68 333 L 178 333';
const P_PATH = 'M 225 475 L 225 140 L 375 140 C 430 140 450 178 450 226 C 450 280 425 313 370 313 L 278 313';
const L_LEN = 480, P_LEN = 950;
const W = 46;
/** 0 -> 1 si disegna (circa 2 s), poi il simbolo vero compare, resta un attimo e svanisce; poi si ricomincia. */
const END = 1.2, MS = 2400;

/** Caricamento: il simbolo LP parte da un puntino, si disegna e ricomincia finche' serve. */
export function LogoLoader({ size = 56 }: { size?: number }) {
  const th = useTheme();
  const p = useMemo(() => new Animated.Value(0), []);
  const [still, setStill] = useState(false);
  useEffect(() => {
    let off = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => { if (!off) setStill(!!v); }).catch(() => {});
    return () => { off = true; };
  }, []);
  useEffect(() => {
    if (still) return;
    const loop = Animated.loop(Animated.timing(p, { toValue: END, duration: MS, easing: Easing.linear, useNativeDriver: false }));
    loop.start();
    return () => loop.stop();
  }, [p, still]);

  const color = th.mode === 'light' ? '#10151d' : '#f4f6fa';
  const logoTint = th.mode === 'light' ? { tintColor: '#10151d' } : null;
  const offL = p.interpolate({ inputRange: [0, 0.35, 1.2], outputRange: [L_LEN - 0.1, 0, 0], extrapolate: 'clamp' });
  const offP = p.interpolate({ inputRange: [0, 0.35, 1.2], outputRange: [P_LEN - 0.1, P_LEN - 0.1, 0], extrapolate: 'clamp' });
  const showP = p.interpolate({ inputRange: [0, 0.349, 0.35, 1.2], outputRange: [0, 0, 1, 1] });
  const strokesOpacity = p.interpolate({ inputRange: [0, 0.02, 0.92, 1, 1.12, 1.2], outputRange: [0, 1, 1, 0, 0, 0] });
  const logoOpacity = p.interpolate({ inputRange: [0, 0.92, 1, 1.12, 1.2], outputRange: [0, 0, 1, 1, 0] });

  if (still) return <View accessible accessibilityRole="progressbar" accessibilityLabel="Theia sta rispondendo" style={{ width: size, height: size }}><Image source={LOGO} style={{ width: size, height: size, opacity: 0.6, ...(logoTint ?? {}) }} contentFit="contain" /></View>;
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel="Theia sta rispondendo" accessibilityLiveRegion="polite" style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 480 480" style={{ position: 'absolute' }}>
        <AG opacity={strokesOpacity}>
          <AP d={L_PATH} stroke={color} strokeWidth={W} strokeLinecap="round" strokeLinejoin="round" fill="none" strokeDasharray={[L_LEN, L_LEN]} strokeDashoffset={offL} />
          <AP d={P_PATH} stroke={color} strokeWidth={W} strokeLinecap="round" strokeLinejoin="round" fill="none" strokeDasharray={[P_LEN, P_LEN]} strokeDashoffset={offP} opacity={showP} />
        </AG>
      </Svg>
      <Animated.View style={{ position: 'absolute', width: size, height: size, opacity: logoOpacity }}>
        <Image source={LOGO} style={{ width: size, height: size, ...(logoTint ?? {}) }} contentFit="contain" />
      </Animated.View>
    </View>
  );
}
