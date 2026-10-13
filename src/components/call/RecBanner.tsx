import { useEffect, useRef } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { Text } from '@/components/T';

import { alertT } from '@/lib/alert';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { t as tl } from '@/i18n/core';

/** Avviso per tutti i partecipanti: Theia sta registrando la call per gli appunti. Toccandolo si spiega cosa succede. */
export function RecBanner({ by, me, top }: { by?: string; me: string; top: number }) {
  const reduce = useReduceMotion();
  const a = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(Animated.sequence([Animated.timing(a, { toValue: 0.25, duration: 700, useNativeDriver: true }), Animated.timing(a, { toValue: 1, duration: 700, useNativeDriver: true })]));
    loop.start();
    return () => loop.stop();
  }, [reduce, a]);
  const who = !by ? '' : by === me ? tl('Attivata da te') : tl('Attivata da {0}', by);
  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={tl('Questa call è registrata da Theia per gli appunti. Tocca per saperne di più')}
      onPress={() => alertT('Questa call è registrata', 'Theia sta registrando la conversazione per scrivere gli appunti: decisioni, cose da fare e domande. Lo vedono tutti i partecipanti. La voce di ognuno viene trascritta solo se la persona lo consente, sul suo telefono. Non viene salvato nessun audio e chi l\'ha attivata può spegnerla quando vuole.')}
      style={{ position: 'absolute', top, start: 12, end: 12, zIndex: 20, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(120,20,30,0.92)', borderRadius: 14, paddingVertical: 8, paddingHorizontal: 12 }}>
      <Animated.View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#ff5a64', opacity: a }} />
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>{tl('Questa call è registrata da Theia')}</Text>
        <Text numberOfLines={1} style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11.5 }}>{[tl('Solo per gli appunti, nessun audio salvato'), who].filter(Boolean).join(' · ')}</Text>
      </View>
    </Pressable>
  );
}
