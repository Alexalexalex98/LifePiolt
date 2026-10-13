import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, View } from 'react-native';
import { Text } from '@/components/T';
import { useReduceMotion } from '@/hooks/use-reduce-motion';

const NATIVE = Platform.OS !== 'web';
const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

/** Una cifra che scorre in verticale come in una vecchia cassa o in un contachilometri. */
function Digit({ d, h, color, size, delay, from }: { d: number; h: number; color: string; size: number; delay: number; from: number }) {
  const reduce = useReduceMotion();
  const y = useRef(new Animated.Value(-from * h)).current;
  const first = useRef(true);
  useEffect(() => {
    const to = -d * h;
    if (reduce) { y.setValue(to); return; }
    // all'inizio le cifre salgono da 0, poi scorrono solo quando il numero cambia
    const anim = Animated.timing(y, { toValue: to, duration: first.current ? 900 : 650, delay: first.current ? delay : delay / 2, easing: Easing.out(Easing.cubic), useNativeDriver: NATIVE });
    first.current = false;
    anim.start();
    return () => anim.stop();
  }, [d, h, delay, reduce, y]);
  return (
    <View style={{ height: h, overflow: 'hidden' }}>
      <Animated.View style={{ transform: [{ translateY: y }] }}>
        {DIGITS.map((n) => <Text key={n} style={{ color, fontSize: size, fontWeight: '800', height: h, lineHeight: h, fontVariant: ['tabular-nums'] }}>{n}</Text>)}
      </Animated.View>
    </View>
  );
}

/**
 * Numero con cifre che salgono e cambiano scorrendo, come una cassa o un contachilometri.
 * Gli altri caratteri (punto, virgola, segno) restano fermi. Con «Riduci animazioni» il numero cambia e basta.
 */
export function RollingNumber({ text, color, size = 15 }: { text: string; color: string; size?: number }) {
  const h = Math.round(size * 1.35);
  const chars = [...text];
  // le cifre si contano da destra: l'unità è la prima a muoversi
  const total = chars.filter((c) => /\d/.test(c)).length;
  let seen = 0;
  return (
    <View accessible accessibilityLabel={text} style={{ flexDirection: 'row', alignItems: 'center' }}>
      {chars.map((c, i) => {
        if (!/\d/.test(c)) return <Text key={`s${i}`} style={{ color, fontSize: size, fontWeight: '800', lineHeight: h }}>{c}</Text>;
        const rank = total - 1 - seen++;
        return <Digit key={`d${rank}`} d={Number(c)} h={h} color={color} size={size} delay={rank * 70} from={0} />;
      })}
    </View>
  );
}
