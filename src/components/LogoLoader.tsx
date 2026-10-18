import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, Path } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';

const AC = Animated.createAnimatedComponent(Circle);
const AG = Animated.createAnimatedComponent(G);

/** Il simbolo LP come linee con la stessa geometria del logo (spazio 480 x 480): e' il logo finale, non un'altra versione. */
const L_PATH = 'M 34 8 L 34 296 Q 34 333 71 333 L 178 333';
const STEM = 'M 222 116 L 222 465';
const BOWL = 'M 222 135 L 395 135 C 430 135 450 165 450 222 C 450 280 428 310 392 310 L 276 310';
const CX = 240, CY = 240, R_MAX = 345;
/** 0 -> 1 il simbolo cresce dal centro (L e P insieme), poi resta, poi svanisce e si ricomincia. */
const END = 1.5, MS = 2600;

/** Caricamento: il simbolo LP nasce da un puntino al centro e si forma in circa 2 secondi, a ciclo continuo. */
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
  /* raggio: da un punto (3) fino a coprire tutto in ~1,9 s con rallentamento finale; poi resta pieno */
  const r = p.interpolate({ inputRange: [0, 0.01, 0.2, 0.55, 1, 1.5], outputRange: [0, 3, 60, 210, R_MAX, R_MAX], extrapolate: 'clamp' });
  const opacity = p.interpolate({ inputRange: [0, 0.01, 1.25, 1.5], outputRange: [0, 1, 1, 0], extrapolate: 'clamp' });

  const shapes = (
    <>
      <Path d={L_PATH} stroke={color} strokeWidth={47} fill="none" strokeLinejoin="round" />
      <Path d={STEM} stroke={color} strokeWidth={50} fill="none" />
      <Path d={BOWL} stroke={color} strokeWidth={42} fill="none" />
    </>
  );
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel="Theia sta rispondendo" accessibilityLiveRegion="polite" style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 480 480">
        {still ? shapes : (
          <>
            <Defs><ClipPath id="lpGrow"><AC cx={CX} cy={CY} r={r} /></ClipPath></Defs>
            <AG opacity={opacity} clipPath="url(#lpGrow)">{shapes}</AG>
          </>
        )}
      </Svg>
    </View>
  );
}
