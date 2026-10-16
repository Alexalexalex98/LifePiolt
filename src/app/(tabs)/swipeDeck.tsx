import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Animated, Easing, PanResponder, View, useWindowDimensions } from 'react-native';

import { SwipeDeck } from '@/components/feed/SwipeDeck';
import { useDeckCards } from '@/components/feed/useDeckCards';
import { goBack } from '@/lib/nav';
import { backdropUri } from '@/lib/storyBackdrop';
import { postByKey } from '@/lib/network';
import { useSeedMedia } from '@/lib/seedMedia';
import { useNet } from '@/store/network';

/** Swipe dei post a schermo intero (apertura diretta da un contenuto). Dalla Home lo Swipe è un pannello affiancato. */
export default function SwipePage() {
  useSeedMedia();
  const { start, solo } = useLocalSearchParams<{ start?: string; solo?: string }>();
  /* aperto da un contenuto (come i reel): si scorrono altri post e si esce solo con la X, senza passare a Per te / Seguiti */
  const onlyX = solo === '1';
  const { width } = useWindowDimensions();
  const x = useRef(new Animated.Value(width)).current;
  const busy = useRef(false);
  const baseCards = useDeckCards();
  /* il contenuto da cui arrivi c'è sempre, anche se l'algoritmo non lo avrebbe proposto (nascosto, già scelto…) */
  const cards = useMemo(() => {
    if (!start || baseCards.some((c) => c.key === start)) return baseCards;
    const p = postByKey(start);
    if (!p || (!p.uri && !p.text)) return baseCards;
    const sp = start.startsWith('standalone:') ? useNet.getState().posts.find((x) => x.id === Number(start.split(':')[1])) : undefined;
    const uris = sp?.uris && sp.uris.length > 1 ? sp.uris : undefined;
    return [{ key: start, text: p.text, author: p.author, tag: p.tag, uri: p.uri ?? sp?.uris?.[0], poster: sp?.poster, uris, media: p.media ?? null }, ...baseCards];
  }, [baseCards, start]);
  /* la pagina resta montata: a ogni apertura si riparte da zero, così parte proprio dal contenuto toccato */
  const [opened, setOpened] = useState(0);
  useFocusEffect(useCallback(() => {
    setOpened((n) => n + 1);
    busy.current = false;
    x.setValue(width);
    Animated.timing(x, { toValue: 0, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [x, width]));
  const leave = (to: 'Per te' | 'Seguiti' | null) => {
    if (busy.current) return; busy.current = true;
    Animated.timing(x, { toValue: to === 'Seguiti' ? -width : width, duration: 240, easing: Easing.in(Easing.cubic), useNativeDriver: false }).start(() => {
      if (to) useNet.getState().setPref('homeFilter', to);
      goBack();
    });
  };
  const dot = (side: 'left' | 'right') => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderMove: (_e, g) => { if (!busy.current) x.setValue(side === 'left' ? Math.max(0, g.dx) : Math.min(0, g.dx)); },
    onPanResponderRelease: (_e, g) => {
      const d = side === 'left' ? g.dx : -g.dx;
      if (d > 70 || (d > 30 && Math.abs(g.vx) > 0.6)) leave(side === 'left' ? 'Per te' : 'Seguiti');
      else Animated.spring(x, { toValue: 0, useNativeDriver: false, friction: 8 }).start();
    },
  });
  const leftDot = useRef(dot('left')).current, rightDot = useRef(dot('right')).current;
  const dotStyle = (side: 'start' | 'end') => ({ position: 'absolute' as const, [side]: 6, top: '46%' as const, width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.22)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' });
  return (
    <View style={{ flex: 1, backgroundColor: '#000', overflow: 'hidden' }}>
      <Animated.View style={{ flex: 1, transform: [{ translateX: x }] }}>
        <SwipeDeck key={`${start ?? ''}:${opened}`} cards={cards} onClose={() => leave(null)} onDismiss={() => { busy.current = true; goBack(); }} backdrop={onlyX ? backdropUri() : null} startKey={start} />
        {onlyX ? null : <View accessibilityRole="button" accessibilityLabel="Trascina verso destra per tornare a Per te" {...leftDot.panHandlers} style={dotStyle('start')} hitSlop={{ top: 14, bottom: 14, left: 6, right: 14 }} />}
        {onlyX ? null : <View accessibilityRole="button" accessibilityLabel="Trascina verso sinistra per andare a Seguiti" {...rightDot.panHandlers} style={dotStyle('end')} hitSlop={{ top: 14, bottom: 14, left: 14, right: 6 }} />}
      </Animated.View>
    </View>
  );
}
