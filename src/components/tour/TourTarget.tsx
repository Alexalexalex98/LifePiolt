import { useEffect, useRef, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { registerTarget, unregisterTarget } from './registry';

/** Registra l'elemento come bersaglio del tour (si misura quando serve: rotazione, scroll e cambi di layout compresi). */
export function useTourTarget(id: string) {
  const ref = useRef<View>(null);
  useEffect(() => {
    registerTarget(id, ref);
    return () => unregisterTarget(id, ref);
  }, [id]);
  return { ref, collapsable: false } as const;
}

/** Avvolge un elemento rendendolo evidenziabile dal tour. Non cambia l'aspetto. */
export function TourTarget({ id, children, style }: { id: string; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const p = useTourTarget(id);
  return <View ref={p.ref} collapsable={false} style={style}>{children}</View>;
}
