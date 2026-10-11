import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';

import { useKeyboardInset } from '@/hooks/use-keyboard-inset';
import { useReduceMotion } from '@/hooks/use-reduce-motion';

/**
 * Contenitore a tutta pagina che lascia sempre libero lo spazio della tastiera in fondo, così la barra di scrittura
 * (e il campo attivo) restano visibili. Sostituisce KeyboardAvoidingView, che con edge-to-edge su Android non fa nulla.
 * Il padding si anima (180 ms) e si ferma subito con "Riduci animazioni".
 */
export function KeyboardDock({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const kb = useKeyboardInset();
  const reduce = useReduceMotion();
  const pad = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce || kb.height === 0) { pad.setValue(kb.height); return; }
    const a = Animated.timing(pad, { toValue: kb.height, duration: Math.min(260, kb.duration || 180), easing: Easing.out(Easing.cubic), useNativeDriver: false });
    a.start();
    return () => a.stop();
  }, [kb.height, kb.duration, reduce, pad]);
  return <Animated.View style={[{ flex: 1 }, style, { paddingBottom: pad }]}>{children}</Animated.View>;
}
